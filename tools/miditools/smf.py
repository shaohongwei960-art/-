"""极简 Standard MIDI File (SMF Format 1) 写出器 —— 仅用 Python 标准库。

设计目标：不装任何第三方包也能把编曲想法变成可听的 .mid 文件。
如果后续需要更强的乐理/记谱能力，再按 requirements.txt 装 mido / music21。
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field

TICKS_PER_BEAT = 480


def _vlq(value: int) -> bytes:
    """MIDI 变长数字 (variable-length quantity)。"""
    if value < 0:
        raise ValueError("VLQ 不支持负数")
    out = bytearray([value & 0x7F])
    value >>= 7
    while value:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(out))


@dataclass(order=True)
class _Event:
    tick: int
    order: int
    data: bytes = field(compare=False)


class Track:
    """一条音轨。时间单位统一用「拍」(float)，写文件时再换算成 tick。"""

    def __init__(self, name: str, channel: int = 0, program: int | None = None):
        self.name = name
        self.channel = channel
        self._events: list[_Event] = []
        self._seq = 0
        self._meta(0, 0x03, name.encode("utf-8"))
        if program is not None:
            self._add(0, bytes([0xC0 | channel, program & 0x7F]))

    # -- 内部 -------------------------------------------------------------
    def _add(self, beat: float, data: bytes) -> None:
        self._seq += 1
        self._events.append(_Event(round(beat * TICKS_PER_BEAT), self._seq, data))

    def _meta(self, beat: float, kind: int, payload: bytes) -> None:
        self._add(beat, bytes([0xFF, kind]) + _vlq(len(payload)) + payload)

    # -- 公开 API ---------------------------------------------------------
    def note(self, beat: float, pitch: int, duration: float, velocity: int = 80) -> "Track":
        """在第 beat 拍（从 0 开始）落一个音，时值 duration 拍。"""
        self._add(beat, bytes([0x90 | self.channel, pitch & 0x7F, velocity & 0x7F]))
        self._add(beat + duration, bytes([0x80 | self.channel, pitch & 0x7F, 0x40]))
        return self

    def chord(self, beat: float, pitches, duration: float, velocity: int = 70) -> "Track":
        for p in pitches:
            self.note(beat, p, duration, velocity)
        return self

    def tempo(self, beat: float, bpm: float) -> "Track":
        us = int(round(60_000_000 / bpm))
        self._meta(beat, 0x51, us.to_bytes(3, "big"))
        return self

    def time_signature(self, beat: float, numerator: int, denominator: int) -> "Track":
        import math

        self._meta(beat, 0x58, bytes([numerator, int(math.log2(denominator)), 24, 8]))
        return self

    def marker(self, beat: float, text: str) -> "Track":
        self._meta(beat, 0x06, text.encode("utf-8"))
        return self

    def to_bytes(self) -> bytes:
        events = sorted(self._events)
        chunk = bytearray()
        last = 0
        for ev in events:
            chunk += _vlq(ev.tick - last) + ev.data
            last = ev.tick
        chunk += _vlq(0) + b"\xff\x2f\x00"  # End of Track
        return b"MTrk" + struct.pack(">I", len(chunk)) + bytes(chunk)


class Song:
    def __init__(self, title: str, bpm: float = 100, time_signature=(4, 4)):
        self.title = title
        self.tracks: list[Track] = []
        conductor = Track(title, channel=0)
        conductor.tempo(0, bpm)
        conductor.time_signature(0, *time_signature)
        self.tracks.append(conductor)
        self.conductor = conductor

    def track(self, name: str, channel: int = 0, program: int | None = None) -> Track:
        t = Track(name, channel=channel, program=program)
        self.tracks.append(t)
        return t

    def save(self, path: str) -> str:
        header = b"MThd" + struct.pack(">IHHH", 6, 1, len(self.tracks), TICKS_PER_BEAT)
        with open(path, "wb") as fh:
            fh.write(header)
            for t in self.tracks:
                fh.write(t.to_bytes())
        return path
