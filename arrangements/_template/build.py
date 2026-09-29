#!/usr/bin/env python3
"""把这首曲子的和声与旋律渲染成 MIDI。用法：python3 build.py"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))

from miditools import Song, chord  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[2] / "build"

PROGRESSION = ["C", "G/B", "Am7", "Fmaj7"]


def main() -> None:
    song = Song("Template", bpm=100)
    pad = song.track("Pad", channel=0, program=0)
    for bar, sym in enumerate(PROGRESSION):
        pad.chord(bar * 4, chord(sym, octave=3), 4)

    OUT.mkdir(exist_ok=True)
    path = song.save(str(OUT / "template.mid"))
    print(f"已生成 {path}")


if __name__ == "__main__":
    main()
