"""音名、音阶、和弦的小工具。音高用 MIDI number：C4 = 60。"""

from __future__ import annotations

NOTE_OFFSETS = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "Fb": 4,
    "E#": 5, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9,
    "A#": 10, "Bb": 10, "B": 11, "Cb": 11,
}

# 和弦类型 -> 相对根音的半音间隔
CHORD_FORMULAS = {
    "": (0, 4, 7),
    "maj": (0, 4, 7),
    "m": (0, 3, 7),
    "min": (0, 3, 7),
    "dim": (0, 3, 6),
    "aug": (0, 4, 8),
    "sus2": (0, 2, 7),
    "sus4": (0, 5, 7),
    "6": (0, 4, 7, 9),
    "m6": (0, 3, 7, 9),
    "7": (0, 4, 7, 10),
    "maj7": (0, 4, 7, 11),
    "m7": (0, 3, 7, 10),
    "m7b5": (0, 3, 6, 10),
    "dim7": (0, 3, 6, 9),
    "9": (0, 4, 7, 10, 14),
    "maj9": (0, 4, 7, 11, 14),
    "m9": (0, 3, 7, 10, 14),
    "add9": (0, 4, 7, 14),
}

SCALES = {
    "major": (0, 2, 4, 5, 7, 9, 11),
    "natural_minor": (0, 2, 3, 5, 7, 8, 10),
    "harmonic_minor": (0, 2, 3, 5, 7, 8, 11),
    "major_pentatonic": (0, 2, 4, 7, 9),
    "minor_pentatonic": (0, 3, 5, 7, 10),
    "dorian": (0, 2, 3, 5, 7, 9, 10),
    "mixolydian": (0, 2, 4, 5, 7, 9, 10),
}


def pitch(name: str) -> int:
    """'C4' -> 60, 'F#3' -> 54, 'Bb5' -> 82"""
    i = 1
    if len(name) > 1 and name[1] in "#b":
        i = 2
    step, octave = name[:i], int(name[i:])
    return NOTE_OFFSETS[step] + (octave + 1) * 12


def chord(symbol: str, octave: int = 3, inversion: int = 0) -> list[int]:
    """'Am7' -> [57, 60, 64, 67]；支持 'G/B' 这样的转位低音写法。"""
    bass = None
    if "/" in symbol:
        symbol, bass_name = symbol.split("/", 1)
        bass = NOTE_OFFSETS[bass_name] + (octave + 1) * 12

    i = 1
    if len(symbol) > 1 and symbol[1] in "#b":
        i = 2
    root_name, quality = symbol[:i], symbol[i:]
    if quality not in CHORD_FORMULAS:
        raise ValueError(f"未知和弦类型: {quality!r} (来自 {symbol!r})")

    root = NOTE_OFFSETS[root_name] + (octave + 1) * 12
    notes = [root + s for s in CHORD_FORMULAS[quality]]
    for _ in range(inversion):
        notes = notes[1:] + [notes[0] + 12]
    if bass is not None:
        while bass >= notes[0]:
            bass -= 12
        notes = [bass] + notes
    return notes


def scale(root: str, mode: str = "major", octaves: int = 1) -> list[int]:
    base = pitch(root)
    steps = SCALES[mode]
    return [base + o * 12 + s for o in range(octaves) for s in steps] + [base + octaves * 12]


def transpose(notes, semitones: int):
    return [n + semitones for n in notes]
