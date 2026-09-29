"""把 .mid 渲染成音频 —— 纯 numpy 的加法合成器，不需要 FluidSynth 或 SoundFont。

沙箱/CI 里装不上 fluidsynth 时的替代方案。音色是自己用谐波堆出来的，
不追求拟真，目标是**让编曲草稿能听出层次**（谁在弹什么、动态对不对）。

用法：
    python3 -m miditools.render build/song.mid            # -> build/song.wav
    python3 -m miditools.render build/song.mid --mp3      # 额外转 mp3（需 imageio-ffmpeg）
"""

from __future__ import annotations

import argparse
import pathlib
import struct
import subprocess
import sys
import wave

import numpy as np

SR = 44100


# ------------------------------------------------------------------ 解析 MIDI
def parse_midi(path: str):
    """返回 (tracks, tempo_bpm)。track = {name, channel, program, notes[(t, dur, pitch, vel)]}"""
    data = pathlib.Path(path).read_bytes()
    assert data[:4] == b"MThd", "不是 MIDI 文件"
    _, _fmt, ntracks, division = struct.unpack(">IHHH", data[4:14])
    tempo = 500_000  # 默认 120 BPM
    tracks = []
    pos = 14

    for _ in range(ntracks):
        assert data[pos:pos + 4] == b"MTrk"
        length = struct.unpack(">I", data[pos + 4:pos + 8])[0]
        p, end = pos + 8, pos + 8 + length
        tick = 0
        name, program, channel = "", 0, 0
        pending: dict[tuple[int, int], list[tuple[int, int]]] = {}
        notes = []

        while p < end:
            delta = 0
            while True:
                b = data[p]; p += 1
                delta = (delta << 7) | (b & 0x7F)
                if not b & 0x80:
                    break
            tick += delta
            status = data[p]; p += 1

            if status == 0xFF:
                kind = data[p]; p += 1
                ln = 0
                while True:
                    b = data[p]; p += 1
                    ln = (ln << 7) | (b & 0x7F)
                    if not b & 0x80:
                        break
                payload = data[p:p + ln]; p += ln
                if kind == 0x03:
                    name = payload.decode("utf-8", "replace")
                elif kind == 0x51:
                    tempo = int.from_bytes(payload, "big")
            elif status & 0xF0 in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                ch, d1, d2 = status & 0x0F, data[p], data[p + 1]; p += 2
                channel = ch
                if status & 0xF0 == 0x90 and d2 > 0:
                    pending.setdefault((ch, d1), []).append((tick, d2))
                elif status & 0xF0 in (0x80, 0x90):
                    stack = pending.get((ch, d1))
                    if stack:
                        start, vel = stack.pop(0)
                        notes.append((start, tick - start, d1, vel))
            elif status & 0xF0 in (0xC0, 0xD0):
                if status & 0xF0 == 0xC0:
                    program = data[p]
                    channel = status & 0x0F
                p += 1
            else:
                raise ValueError(f"意外的状态字节 {status:#04x}")

        spt = tempo / 1_000_000 / division  # 每 tick 秒数
        tracks.append({
            "name": name,
            "channel": channel,
            "program": program,
            "notes": [(t * spt, d * spt, pitch, vel) for t, d, pitch, vel in notes],
        })
        pos = end

    return tracks, 60_000_000 / tempo


# ------------------------------------------------------------------ 音色定义
# harmonics: 各次谐波的相对振幅；attack/decay/sustain/release 单位为秒/比例
PRESETS = {
    # GM program -> 音色
    0:  dict(harm=[1, .5, .28, .14, .07, .04], atk=.004, dec=.9,  sus=.12, rel=.35, gain=.55),  # 钢琴
    22: dict(harm=[1, .75, .55, .38, .25, .16, .1], atk=.03, dec=.25, sus=.72, rel=.18, gain=.5, vib=5.2),  # 笙/口琴
    27: dict(harm=[1, .62, .4, .3, .18, .1], atk=.003, dec=.12, sus=.0, rel=.06, gain=.42),      # 吉他切音
    38: dict(harm=[1, .42, .1, .05], atk=.005, dec=.35, sus=.6, rel=.1, gain=.85, sub=True),     # 合成贝斯
    54: dict(harm=[1, .34, .2, .09, .04], atk=.05, dec=.3, sus=.78, rel=.25, gain=.62, vib=5.0),  # 人声代用
    89: dict(harm=[1, .5, .33, .22, .15, .1, .07], atk=.5, dec=1.2, sus=.6, rel=.9, gain=.3, detune=.15),  # Pad
    25: dict(harm=[1, .6, .42, .28, .16, .09], atk=.004, dec=.7, sus=.15, rel=.3, gain=.5),      # 木吉他
    33: dict(harm=[1, .45, .15, .06], atk=.006, dec=.5, sus=.5, rel=.12, gain=.8, sub=True),     # 贝斯
}
DEFAULT_PRESET = dict(harm=[1, .5, .25, .12], atk=.01, dec=.4, sus=.5, rel=.2, gain=.5)

# 轨名关键字 -> 声像与增益微调
MIX = {
    "vocal": (0.0, 1.0), "lead": (0.0, 1.0), "笙": (0.08, 0.85), "khaen": (0.08, 0.85),
    "piano": (-0.12, 0.8), "guitar": (-0.42, 0.6), "pad": (0.35, 0.55),
    "bass": (0.0, 1.0), "drum": (0.0, 1.0),
}


def adsr(n: int, atk: float, dec: float, sus: float, rel: float) -> np.ndarray:
    a = max(1, int(atk * SR))
    d = max(1, int(dec * SR))
    env = np.empty(n, dtype=np.float32)
    if a >= n:
        return np.linspace(0, 1, n, dtype=np.float32)
    env[:a] = np.linspace(0, 1, a, dtype=np.float32)
    rest = n - a
    dd = min(d, rest)
    env[a:a + dd] = np.linspace(1, sus, dd, dtype=np.float32)
    if rest > dd:
        env[a + dd:] = sus
    # 尾部释放
    r = min(max(1, int(rel * SR)), n // 2 or 1)
    env[-r:] *= np.linspace(1, 0, r, dtype=np.float32)
    return env


def synth_note(pitch: int, dur: float, vel: int, preset: dict) -> np.ndarray:
    tail = preset.get("rel", .2)
    n = max(64, int((dur + tail) * SR))
    t = np.arange(n, dtype=np.float32) / SR
    freq = 440.0 * 2 ** ((pitch - 69) / 12)

    vib = preset.get("vib")
    phase_mod = 0.0
    if vib:
        phase_mod = (0.004 * np.sin(2 * np.pi * vib * t)).astype(np.float32)

    wave_ = np.zeros(n, dtype=np.float32)
    detune = preset.get("detune", 0.0)
    for i, amp in enumerate(preset["harm"], start=1):
        f = freq * i
        if f > SR / 2.2:
            break
        wave_ += amp * np.sin(2 * np.pi * f * t + phase_mod * i)
        if detune:
            wave_ += amp * 0.6 * np.sin(2 * np.pi * f * (1 + detune / 100) * t)
    if preset.get("sub"):
        wave_ += 0.7 * np.sin(2 * np.pi * (freq / 2) * t)

    wave_ /= max(1e-6, np.max(np.abs(wave_)))
    env = adsr(n, preset["atk"], preset["dec"], preset["sus"], tail)
    return (wave_ * env * (vel / 127.0) ** 1.4 * preset.get("gain", .5)).astype(np.float32)


# ------------------------------------------------------------------ 鼓
_rng = np.random.default_rng(7)


def synth_drum(pitch: int, vel: int) -> np.ndarray:
    v = (vel / 127.0) ** 1.3
    if pitch in (35, 36):                      # 底鼓：频率下滑正弦 + 短击打噪声
        n = int(.28 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        f = 120 * np.exp(-t * 32) + 45
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
        click = _rng.standard_normal(n).astype(np.float32) * np.exp(-t * 320) * .25
        return ((body + click) * v * 1.25).astype(np.float32)
    if pitch in (38, 40):                      # 军鼓：噪声 + 两个共振音
        n = int(.22 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        noise = _rng.standard_normal(n).astype(np.float32) * np.exp(-t * 26)
        tone = (np.sin(2 * np.pi * 190 * t) + .6 * np.sin(2 * np.pi * 278 * t)) * np.exp(-t * 34)
        return ((noise * .9 + tone * .5) * v * .8).astype(np.float32)
    if pitch == 39:                            # 拍手：三次噪声簇
        n = int(.2 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        out = np.zeros(n, dtype=np.float32)
        for off, g in ((0, 1.0), (.011, .75), (.021, .55)):
            s = int(off * SR)
            seg = _rng.standard_normal(n - s).astype(np.float32) * np.exp(-t[:n - s] * 42) * g
            out[s:] += seg
        hp = np.diff(out, prepend=0.0).astype(np.float32)  # 一阶高通，去掉低频轰
        return (hp * v * .55).astype(np.float32)
    if pitch in (42, 44):                      # 闭镲
        n = int(.07 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        noise = _rng.standard_normal(n).astype(np.float32) * np.exp(-t * 95)
        return (np.diff(noise, prepend=0.0) * v * .3).astype(np.float32)
    if pitch in (46, 49, 51):                  # 开镲 / 吊镲
        n = int(.6 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        noise = _rng.standard_normal(n).astype(np.float32) * np.exp(-t * 6)
        return (np.diff(noise, prepend=0.0) * v * .22).astype(np.float32)
    n = int(.12 * SR)
    t = np.arange(n, dtype=np.float32) / SR
    return (_rng.standard_normal(n).astype(np.float32) * np.exp(-t * 30) * v * .3).astype(np.float32)


# ------------------------------------------------------------------ 混响
def reverb(x: np.ndarray, mix: float = .16) -> np.ndarray:
    out = np.zeros_like(x)
    for delay_ms, g in ((29.7, .78), (37.1, .74), (41.1, .71), (43.7, .69)):
        d = int(delay_ms / 1000 * SR)
        buf = x.copy()
        for i in range(d, len(buf), d):          # 分块实现反馈梳状延迟
            seg = min(d, len(buf) - i)
            buf[i:i + seg] += g * buf[i - d:i - d + seg]
        out += buf / 4
    return (x * (1 - mix) + out * mix).astype(np.float32)


# ------------------------------------------------------------------ 主流程
def render(midi_path: str, wav_path: str, master_gain: float = .9) -> str:
    tracks, bpm = parse_midi(midi_path)
    total = max((t + d for tr in tracks for t, d, _, _ in tr["notes"]), default=1.0) + 2.5
    n = int(total * SR)
    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    cache: dict[tuple, np.ndarray] = {}

    for tr in tracks:
        if not tr["notes"]:
            continue
        name = tr["name"].lower()
        pan, gain = 0.0, 1.0
        for key, (p, g) in MIX.items():
            if key in name:
                pan, gain = p, g
                break
        lg, rg = gain * min(1, 1 - pan), gain * min(1, 1 + pan)
        is_drum = tr["channel"] == 9
        preset = PRESETS.get(tr["program"], DEFAULT_PRESET)

        for start, dur, pitch, vel in tr["notes"]:
            key = (tr["program"], pitch, round(dur, 3), vel // 8, is_drum)
            buf = cache.get(key)
            if buf is None:
                buf = synth_drum(pitch, vel) if is_drum else synth_note(pitch, dur, vel, preset)
                cache[key] = buf
            i = int(start * SR)
            end = min(n, i + len(buf))
            if end > i:
                seg = buf[:end - i]
                left[i:end] += seg * lg
                right[i:end] += seg * rg

    stereo = np.stack([reverb(left), reverb(right)], axis=1)
    peak = float(np.max(np.abs(stereo))) or 1.0
    stereo = np.tanh(stereo / peak * 1.4) * master_gain      # 软限幅，避免削顶
    pcm = (stereo / max(1e-6, float(np.max(np.abs(stereo)))) * 0.92 * 32767).astype(np.int16)

    pathlib.Path(wav_path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(wav_path, "wb") as fh:
        fh.setnchannels(2)
        fh.setsampwidth(2)
        fh.setframerate(SR)
        fh.writeframes(pcm.tobytes())
    print(f"已渲染 {wav_path}  ({total:.1f} 秒 / {bpm:.0f} BPM / {len(tracks)} 轨)")
    return wav_path


def to_mp3(wav_path: str, mp3_path: str) -> str | None:
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        print("跳过 mp3：未安装 imageio-ffmpeg", file=sys.stderr)
        return None
    subprocess.run([exe, "-y", "-loglevel", "error", "-i", wav_path,
                    "-codec:a", "libmp3lame", "-b:a", "192k", mp3_path], check=True)
    print(f"已导出 {mp3_path}")
    return mp3_path


def main() -> None:
    ap = argparse.ArgumentParser(description="把 MIDI 渲染成音频（纯 numpy 合成器）")
    ap.add_argument("midi")
    ap.add_argument("-o", "--out", help="输出 wav 路径（默认与 midi 同名）")
    ap.add_argument("--mp3", action="store_true", help="额外导出 mp3")
    args = ap.parse_args()

    midi = pathlib.Path(args.midi)
    wav = args.out or str(midi.with_suffix(".wav"))
    render(str(midi), wav)
    if args.mp3:
        to_mp3(wav, str(pathlib.Path(wav).with_suffix(".mp3")))


if __name__ == "__main__":
    main()
