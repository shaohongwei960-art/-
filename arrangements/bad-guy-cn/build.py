#!/usr/bin/env python3
"""《坏蛋》中文版 —— 原创旋律 demo 渲染成 MIDI。

声明：本文件中的旋律为**原创**，只在风格（伊善电子摩兰、A 小调五声）与主题上
致敬泰语原曲《บักคนซั่ว》，不包含原曲旋律。

用法：python3 arrangements/bad-guy-cn/build.py
输出：build/bad-guy-cn.mid
"""

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))

from miditools import Song, chord, pitch  # noqa: E402

OUT_DIR = pathlib.Path(__file__).resolve().parents[2] / "build"
BPM = 98
BAR = 4.0  # 4/4

# 主旋律写在 Am 上（记谱音域 G4–A5）。实唱调门由 --key 决定：
#   男声默认 Gm —— 主歌 F3–D4，副歌顶到 G4，末段升 Am 顶到 A4，
#   这是绝大多数男声「够得着、但要用力」的位置，正好配这首歌的劲儿。
KEY_SHIFT = {"E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "Bb": 1, "B": 2}
DEFAULT_KEY = "G"      # 男声版
VOCAL_OCTAVE = -12     # 人声轨相对记谱下移一个八度（男声）

# ---------------------------------------------------------------- 和声
INTRO = ["Am", "Am", "F", "G"] * 2
VERSE = ["Am", "Am", "F", "G", "Am", "Am", "Dm7", "G"]
PRE = ["F", "G", "Em7", "Am"]
CHORUS = ["Am", "F", "C", "G", "Am", "F", "G", "Am"]
BRIDGE = ["Dm7", "Am", "Dm7", "E7", "F", "G", "Am", "G"]
OUTRO = ["Am", "F", "G", "Am"]

# 段落表：(名称, 和声, 移调半音, 编制档位)
# 编制档位 0=极简(仅钢琴) 1=薄 2=中 3=满
SECTIONS = [
    ("Intro", INTRO, 0, 1),
    ("Verse 1", VERSE, 0, 1),
    ("Pre-Chorus 1", PRE, 0, 2),
    ("Chorus 1", CHORUS, 0, 3),
    ("Verse 2", VERSE, 0, 2),
    ("Pre-Chorus 2", PRE, 0, 2),
    ("Chorus 2", CHORUS, 0, 3),
    ("Bridge", BRIDGE, 0, 0),
    ("Final Chorus", CHORUS, 2, 3),
    ("Outro", OUTRO, 2, 1),
]

# ------------------------------------------------- 原创动机与旋律（A 小调五声）
# 格式：(起拍, 音名, 时值)
HOOK = [  # Intro / Outro 的笙动机，4 小节
    (0.0, "A4", 0.5), (0.5, "C5", 0.5), (1.0, "E5", 1.0), (2.0, "D5", 0.5),
    (2.5, "C5", 0.5), (3.0, "A4", 1.0),
    (4.0, "C5", 0.5), (4.5, "D5", 0.5), (5.0, "E5", 1.5), (6.5, "D5", 0.5),
    (7.0, "C5", 1.0),
    (8.0, "E5", 0.5), (8.5, "G5", 0.5), (9.0, "E5", 1.0), (10.0, "D5", 1.0),
    (11.0, "C5", 1.0),
    (12.0, "D5", 0.5), (12.5, "C5", 0.5), (13.0, "A4", 2.0),
]

VERSE_MEL = [  # 8 小节，叙事型：音区低、节奏密，像说话
    # 喜帖压在我的烟盒下
    (0.0, "A4", 0.5), (0.5, "A4", 0.5), (1.0, "C5", 0.5), (1.5, "C5", 0.5),
    (2.0, "D5", 0.5), (2.5, "C5", 0.5), (3.0, "A4", 1.0),
    # 红得像句说不出口的话
    (4.0, "C5", 0.5), (4.5, "C5", 0.5), (5.0, "D5", 0.5), (5.5, "E5", 0.5),
    (6.0, "D5", 0.5), (6.5, "C5", 0.5), (7.0, "A4", 1.0),
    # 镜子里那个人梳得太假
    (8.0, "A4", 0.5), (8.5, "C5", 0.5), (9.0, "C5", 0.5), (9.5, "D5", 0.5),
    (10.0, "C5", 0.5), (10.5, "A4", 0.5), (11.0, "G4", 1.0),
    # 他要去参加你的婚礼啊
    (12.0, "A4", 0.5), (12.5, "C5", 0.5), (13.0, "D5", 0.5), (13.5, "C5", 0.5),
    (14.0, "A4", 2.0),
    # 第二乐句（5-8 小节）整体重复并略作变化
    (16.0, "A4", 0.5), (16.5, "A4", 0.5), (17.0, "C5", 0.5), (17.5, "D5", 0.5),
    (18.0, "E5", 0.5), (18.5, "D5", 0.5), (19.0, "C5", 1.0),
    (20.0, "C5", 0.5), (20.5, "D5", 0.5), (21.0, "E5", 1.0), (22.0, "D5", 1.0),
    (23.0, "C5", 1.0),
    (24.0, "D5", 0.5), (24.5, "D5", 0.5), (25.0, "C5", 0.5), (25.5, "A4", 0.5),
    (26.0, "G4", 1.0), (27.0, "A4", 1.0),
    (28.0, "C5", 0.5), (28.5, "D5", 0.5), (29.0, "E5", 1.0), (30.0, "D5", 2.0),
]

PRE_MEL = [  # 4 小节，四个短句、刻意断开，音区逐句抬高
    (0.0, "C5", 0.5), (0.5, "C5", 1.0),                      # 音乐越吵
    (2.0, "D5", 0.5), (2.5, "C5", 0.5), (3.0, "A4", 1.0),    # 我越听得见自己
    (4.0, "D5", 0.5), (4.5, "D5", 1.0),                      # 灯光越亮
    (6.0, "E5", 0.5), (6.5, "D5", 0.5), (7.0, "C5", 1.0),    # 我越像个影子
    (8.0, "E5", 0.5), (8.5, "E5", 0.5), (9.0, "G5", 1.5),
    (11.0, "E5", 1.0),
    (12.0, "D5", 1.0), (13.0, "E5", 1.0), (14.0, "G5", 2.0),  # 挂在五度上，不解决
]

CHORUS_MEL = [  # 8 小节，钩子：句首高音落强拍，"坏蛋"二字用下行长音
    # 我才是那个坏蛋
    (0.0, "E5", 0.5), (0.5, "E5", 0.5), (1.0, "G5", 0.5), (1.5, "E5", 0.5),
    (2.0, "D5", 0.5), (2.5, "C5", 1.5),
    # 弄丢了你的那种坏蛋
    (4.0, "C5", 0.5), (4.5, "C5", 0.5), (5.0, "D5", 0.5), (5.5, "E5", 0.5),
    (6.0, "D5", 0.5), (6.5, "C5", 0.5), (7.0, "A4", 1.0),
    # 你穿白纱的样子真好看
    (8.0, "E5", 0.5), (8.5, "G5", 0.5), (9.0, "A5", 1.0), (10.0, "G5", 0.5),
    (10.5, "E5", 0.5), (11.0, "D5", 1.0),
    # 好看得我连呼吸都要放慢
    (12.0, "C5", 0.5), (12.5, "D5", 0.5), (13.0, "E5", 0.5), (13.5, "D5", 0.5),
    (14.0, "C5", 0.5), (14.5, "A4", 1.5),
    # 后半段：重复并推高
    (16.0, "E5", 0.5), (16.5, "E5", 0.5), (17.0, "G5", 0.5), (17.5, "E5", 0.5),
    (18.0, "D5", 0.5), (18.5, "C5", 1.5),
    (20.0, "C5", 0.5), (20.5, "D5", 0.5), (21.0, "E5", 1.0), (22.0, "D5", 1.0),
    (23.0, "C5", 1.0),
    (24.0, "G5", 0.5), (24.5, "A5", 0.5), (25.0, "G5", 1.0), (26.0, "E5", 1.0),
    (27.0, "D5", 1.0),
    (28.0, "C5", 0.5), (28.5, "D5", 0.5), (29.0, "A4", 3.0),
]

BRIDGE_MEL = [  # 8 小节，只剩钢琴，rubato 感：长音多、留白多
    (0.0, "A4", 1.0), (1.0, "C5", 1.0), (2.0, "D5", 2.0),
    (4.0, "C5", 1.0), (5.0, "A4", 3.0),
    (8.0, "D5", 1.0), (9.0, "E5", 1.0), (10.0, "D5", 2.0),
    (12.0, "C5", 1.0), (13.0, "B4", 1.0), (14.0, "A4", 2.0),  # E7 上的 B 与 G#
    (16.0, "C5", 1.0), (17.0, "D5", 1.0), (18.0, "E5", 2.0),
    (20.0, "G5", 2.0), (22.0, "E5", 2.0),
    (24.0, "D5", 1.0), (25.0, "C5", 1.0), (26.0, "A4", 2.0),
    (28.0, "B4", 2.0), (30.0, "C5", 2.0),
]

MELODY = {
    "Intro": HOOK, "Outro": HOOK[:12],
    "Verse 1": VERSE_MEL, "Verse 2": VERSE_MEL,
    "Pre-Chorus 1": PRE_MEL, "Pre-Chorus 2": PRE_MEL,
    "Chorus 1": CHORUS_MEL, "Chorus 2": CHORUS_MEL, "Final Chorus": CHORUS_MEL,
    "Bridge": BRIDGE_MEL,
}
# 主旋律由谁演奏：Intro/Outro 给笙，其余给「人声轨」
HOOK_SECTIONS = {"Intro", "Outro"}

# 鼓：一小节 16 格
KICK = [0, 3, 6, 8, 11]
SNARE = [4, 12]
HAT = [0, 2, 4, 6, 8, 10, 12, 14]


def build(key: str = DEFAULT_KEY, vocal_octave: int = VOCAL_OCTAVE) -> Song:
    key_shift = KEY_SHIFT[key]
    song = Song(f"坏蛋 · 中文版 demo ({key}m)", bpm=BPM, time_signature=(4, 4))

    lead = song.track("Lead Vocal (guide)", channel=0, program=54)   # 人声代用音色
    khaen = song.track("Khaen / 笙", channel=1, program=22)           # 口琴代用
    piano = song.track("Piano", channel=2, program=0)
    guitar = song.track("E.Guitar (chop)", channel=3, program=27)
    pad = song.track("Synth Pad", channel=4, program=89)
    bass = song.track("Synth Bass", channel=5, program=38)
    drums = song.track("Drums", channel=9)

    cursor = 0.0  # 当前拍
    for name, progression, shift, density in SECTIONS:
        song.conductor.marker(cursor, name)

        for i, sym in enumerate(progression):
            beat = cursor + i * BAR
            notes = [n + shift + key_shift for n in chord(sym, octave=3)]
            root = notes[0] - 12

            # 钢琴：Bridge 用分解，其余用柱式
            if density == 0:
                for j, p in enumerate([notes[0], notes[1], notes[-1], notes[1]]):
                    piano.note(beat + j, p, 1.0, velocity=52)
            else:
                piano.chord(beat, notes, 3.5, velocity=48)

            # 贝斯：八分推进 + 第 4 拍反拍切分
            if density >= 1:
                for j in range(8):
                    if j == 7:
                        continue
                    bass.note(beat + j * 0.5, root, 0.45, velocity=86 if j % 2 == 0 else 70)
                bass.note(beat + 3.75, root + 7, 0.25, velocity=78)

            # 电吉他反拍十六分切音
            if density >= 2:
                for j in range(8):
                    guitar.chord(beat + j * 0.5 + 0.25, notes[1:], 0.2, velocity=58)

            # Pad 只在满编制铺底
            if density >= 3:
                pad.chord(beat, [n + 12 for n in notes], 4.0, velocity=45)

            # 鼓
            if density >= 1:
                step = 0.25
                for s in HAT:
                    drums.note(beat + s * step, 42, 0.2, velocity=52 if s % 4 else 64)
                if density >= 1:
                    for s in KICK:
                        drums.note(beat + s * step, 36, 0.2, velocity=100)
                if density >= 2:
                    for s in SNARE:
                        drums.note(beat + s * step, 38, 0.2, velocity=92)
                if density >= 3:
                    for s in SNARE:
                        drums.note(beat + s * step, 39, 0.2, velocity=80)  # clap
                # 段落最后一小节加 fill
                if i == len(progression) - 1 and density >= 2:
                    for k in range(4):
                        drums.note(beat + 3 + k * 0.25, 38, 0.2, velocity=70 + k * 8)

        # 主旋律
        mel = MELODY.get(name, [])
        is_hook = name in HOOK_SECTIONS
        target = khaen if is_hook else lead
        # 人声下移一个八度唱（男声）；笙保持记谱音区
        octave = 0 if is_hook else vocal_octave
        vel = 84 if density < 3 else 96
        for start, note_name, dur in mel:
            target.note(cursor + start, pitch(note_name) + shift + key_shift + octave,
                        dur, velocity=vel)

        # 副歌里笙在人声句尾填空（一问一答）
        if name.startswith(("Chorus", "Final")):
            for bar_idx in (1, 3, 5, 7):
                b = cursor + bar_idx * BAR + 3.0
                for j, p in enumerate(["E5", "D5", "C5"]):
                    khaen.note(b + j * 0.25, pitch(p) + shift + key_shift + 12,
                               0.25, velocity=62)

        cursor += len(progression) * BAR

    return song


def vocal_range(key: str, vocal_octave: int) -> str:
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    fmt = lambda p: f"{names[p % 12]}{p // 12 - 1}"  # noqa: E731
    pitches = []
    for name, _prog, shift, _d in SECTIONS:
        for _s, note_name, _dur in MELODY.get(name, []):
            if name not in HOOK_SECTIONS:
                pitches.append(pitch(note_name) + shift + KEY_SHIFT[key] + vocal_octave)
    return f"{fmt(min(pitches))} – {fmt(max(pitches))}"


def main() -> None:
    ap = argparse.ArgumentParser(description="生成《坏蛋》中文版 demo MIDI")
    ap.add_argument("--key", default=DEFAULT_KEY, choices=sorted(KEY_SHIFT),
                    help=f"主调（小调主音），默认 {DEFAULT_KEY}m（男声）")
    ap.add_argument("--vocal-octave", type=int, default=VOCAL_OCTAVE,
                    help="人声轨移调半音数，男声 -12，女声/原记谱 0")
    ap.add_argument("-o", "--out", help="输出文件名")
    args = ap.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    song = build(args.key, args.vocal_octave)
    out = args.out or f"bad-guy-cn-{args.key.lower().replace('#', 's')}m.mid"
    path = song.save(str(OUT_DIR / out))
    bars = sum(len(s[1]) for s in SECTIONS)
    print(f"已生成 {path}")
    print(f"调性 {args.key}m，末段 +2")
    print(f"人声音域 {vocal_range(args.key, args.vocal_octave)}")
    print(f"共 {bars} 小节 / {BPM} BPM ≈ {bars * 4 * 60 / BPM:.0f} 秒")


if __name__ == "__main__":
    main()
