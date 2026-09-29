#!/usr/bin/env python3
"""示例：把帕赫贝尔《卡农》的低音进行改编成民谣小品（公有领域素材）。

这个文件的作用是当「可运行的说明书」——展示 tools/miditools 怎么用。
用法：python3 arrangements/example-canon-folk/build.py
输出：build/example-canon-folk.mid
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))

from miditools import Song, chord, pitch  # noqa: E402

OUT_DIR = pathlib.Path(__file__).resolve().parents[2] / "build"
BPM = 92

# 卡农进行（D 大调）：D A Bm F#m G D G A
PROGRESSION = ["D", "A/C#", "Bm7", "F#m", "G", "D/F#", "Gmaj7", "A7"]

# 主旋律：(起拍, 音名, 时值) —— 以拍为单位，一小节 4 拍
MELODY = [
    (0.0, "F#5", 1.5), (1.5, "E5", 0.5), (2.0, "D5", 2.0),
    (4.0, "C#5", 1.5), (5.5, "B4", 0.5), (6.0, "A4", 2.0),
    (8.0, "B4", 1.0), (9.0, "C#5", 1.0), (10.0, "D5", 1.0), (11.0, "E5", 1.0),
    (12.0, "F#5", 1.5), (13.5, "E5", 0.5), (14.0, "D5", 2.0),
    (16.0, "B4", 1.0), (17.0, "C#5", 1.0), (18.0, "D5", 2.0),
    (20.0, "A4", 1.0), (21.0, "B4", 1.0), (22.0, "F#4", 2.0),
    (24.0, "G4", 1.0), (25.0, "A4", 1.0), (26.0, "B4", 1.0), (27.0, "C#5", 1.0),
    (28.0, "D5", 2.0), (30.0, "C#5", 1.0), (31.0, "D5", 1.0),
]

SECTIONS = [(0, "Intro"), (8, "A 段"), (16, "A 段加花"), (24, "Outro")]  # (小节号, 标记)


def build() -> Song:
    song = Song("Canon · Folk Arrangement", bpm=BPM, time_signature=(4, 4))

    guitar = song.track("Acoustic Guitar", channel=0, program=25)
    piano = song.track("Piano", channel=1, program=0)
    bass = song.track("Bass", channel=2, program=33)
    drums = song.track("Drums", channel=9)

    total_bars = 32  # 4 遍 × 8 小节
    for bar in range(total_bars):
        beat = bar * 4.0
        sym = PROGRESSION[bar % len(PROGRESSION)]
        notes = chord(sym, octave=3)
        root = notes[0] - 12

        # 吉他分解：低-中-高-中，营造流动感
        pattern = [notes[0], notes[1], notes[-1], notes[1]]
        for i, p in enumerate(pattern):
            guitar.note(beat + i, p, 1.0, velocity=62)

        # 贝斯：根音 + 第 4 拍经过音
        bass.note(beat, root, 3.0, velocity=80)
        nxt = chord(PROGRESSION[(bar + 1) % len(PROGRESSION)], octave=3)[0] - 12
        bass.note(beat + 3, (root + nxt) // 2, 1.0, velocity=70)

        # 鼓：第 9 通道，36=底鼓 38=军鼓 42=闭镲
        if bar >= 8:
            for i in range(4):
                drums.note(beat + i, 42, 0.5, velocity=55)
            drums.note(beat, 36, 0.5, velocity=90)
            drums.note(beat + 2, 38, 0.5, velocity=85)

    # 主旋律从第 9 小节（第 32 拍）进，第二遍高八度
    for offset, octave_shift, vel in ((32.0, 0, 88), (64.0, 12, 95)):
        for start, name, dur in MELODY:
            piano.note(offset + start, pitch(name) + octave_shift, dur, velocity=vel)

    for bar, label in SECTIONS:
        song.conductor.marker(bar * 4.0, label)

    return song


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    path = build().save(str(OUT_DIR / "example-canon-folk.mid"))
    print(f"已生成 {path}")


if __name__ == "__main__":
    main()
