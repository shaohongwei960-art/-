"""零依赖的编曲小工具集：写 MIDI + 基础乐理。"""

from .smf import Song, Track, TICKS_PER_BEAT
from .theory import chord, pitch, scale, transpose

__all__ = ["Song", "Track", "TICKS_PER_BEAT", "chord", "pitch", "scale", "transpose"]
