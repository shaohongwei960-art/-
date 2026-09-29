#!/usr/bin/env python3
"""把念白 guide vocal 铺到伴奏上，混成带人声的 demo。

⚠️ 重要：`build/vox/` 里的人声是**语音合成的朗读**，不是演唱——
它没有旋律，只用来检查歌词落位、字数、断句和倒字。成品需要真人演唱
或歌声合成软件（ACE Studio / Synthesizer V）。

用法：python3 arrangements/bad-guy-cn/mix_vocals.py
输入：build/bad-guy-cn-gm.wav（伴奏）+ build/vox/*.wav（念白）
输出：build/bad-guy-cn-gm-vox.wav / .mp3
"""

import pathlib
import subprocess
import sys
import wave

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))
from miditools.render import reverb  # noqa: E402

SR = 44100
ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / "build"
INSTRUMENTAL = BUILD / "bad-guy-cn-gm.wav"
VOX_DIR = BUILD / "vox"
OUT = BUILD / "bad-guy-cn-gm-vox.wav"

# (念白文件, 入点秒数)。入点 = 段落起点 + 少许延迟，让乐句先起头。
CUES = [
    ("01-verse1.wav",  19.6 + 0.6),   # Verse 1 + 2
    ("02-pre1.wav",    39.2 + 1.2),   # Pre-Chorus 1
    ("03-chorus1.wav", 49.0 + 0.5),   # Chorus 1
    ("04-verse3.wav",  68.6 + 0.6),   # Verse 3
    ("05-pre2.wav",    88.2 + 1.2),   # Pre-Chorus 2
    ("06-chorus2.wav", 98.0 + 0.5),   # Chorus 2
    ("07-bridge.wav", 117.6 + 1.5),   # Bridge（只剩钢琴，人声留白多一点）
    ("08-final.wav",  137.1 + 0.5),   # Final Chorus
]

VOX_GAIN = 1.25      # 念白音量
DUCK_DEPTH = 0.45    # 人声出现时伴奏压低的比例
DUCK_SMOOTH = 0.12   # 闪避包络的平滑时间（秒）


def read_wav(path: pathlib.Path) -> np.ndarray:
    """读成 float32，形状 (n, 2)。"""
    with wave.open(str(path)) as w:
        assert w.getsampwidth() == 2, f"{path} 不是 16bit"
        assert w.getframerate() == SR, f"{path} 采样率不是 {SR}"
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        data = data.reshape(-1, w.getnchannels()).astype(np.float32) / 32768.0
    return np.repeat(data, 2, axis=1) if data.shape[1] == 1 else data


def smooth(x: np.ndarray, seconds: float) -> np.ndarray:
    """滑动平均，用累积和实现，够快。"""
    k = max(1, int(seconds * SR))
    pad = np.concatenate([np.zeros(k, np.float32), x, np.zeros(k, np.float32)])
    cs = np.cumsum(pad, dtype=np.float64)
    out = (cs[k:] - cs[:-k]) / k
    return out[:len(x)].astype(np.float32)


def main() -> None:
    if not INSTRUMENTAL.exists():
        sys.exit(f"缺少伴奏 {INSTRUMENTAL}，先跑 make song")

    bed = read_wav(INSTRUMENTAL)
    n = len(bed)
    vox = np.zeros((n, 2), dtype=np.float32)

    for fname, at in CUES:
        path = VOX_DIR / fname
        if not path.exists():
            print(f"跳过（缺文件）：{fname}")
            continue
        clip = read_wav(path)
        clip = clip / max(1e-6, float(np.max(np.abs(clip))))    # 逐句归一化
        fade = int(0.02 * SR)                                    # 去掉咔哒声
        clip[:fade] *= np.linspace(0, 1, fade)[:, None]
        clip[-fade:] *= np.linspace(1, 0, fade)[:, None]

        i = int(at * SR)
        end = min(n, i + len(clip))
        if end <= i:
            continue
        vox[i:end] += clip[:end - i] * VOX_GAIN
        over = (i + len(clip) - n) / SR
        print(f"{fname:16s} @ {int(at // 60)}:{at % 60:04.1f}  时长 {len(clip)/SR:5.2f}s"
              + (f"  ⚠ 超出曲长 {over:.1f}s" if over > 0 else ""))

    # 伴奏闪避：人声一出来就把底下压下去，说话才听得清
    env = smooth(np.abs(vox).max(axis=1), DUCK_SMOOTH)
    env /= max(1e-6, float(env.max()))
    duck = (1.0 - DUCK_DEPTH * env)[:, None]

    # 人声加一点混响，贴住伴奏的空间
    wet = np.stack([reverb(vox[:, 0], 0.12), reverb(vox[:, 1], 0.12)], axis=1)

    mixed = bed * duck + wet
    peak = float(np.max(np.abs(mixed))) or 1.0
    mixed = np.tanh(mixed / peak * 1.3)
    pcm = (mixed / float(np.max(np.abs(mixed))) * 0.93 * 32767).astype(np.int16)

    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"\n已混音 {OUT}  ({n / SR:.1f} 秒)")

    try:
        import imageio_ffmpeg
        mp3 = OUT.with_suffix(".mp3")
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
                        "-i", str(OUT), "-codec:a", "libmp3lame", "-b:a", "192k", str(mp3)],
                       check=True)
        print(f"已导出 {mp3}")
    except Exception as exc:                                     # noqa: BLE001
        print(f"mp3 导出跳过：{exc}")


if __name__ == "__main__":
    main()
