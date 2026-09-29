# 音乐改编工作台

一个用来放**改编创作**的仓库：歌词、和弦谱、编曲结构、以及能直接跑出 MIDI 的脚本。
核心工具零第三方依赖，有 Python 3 就能用。

## 快速开始

```bash
make song                     # 生成《坏蛋》中文版 demo，出 MIDI + wav + mp3
make example                  # 生成示例曲目的 MIDI
make new N=my-song            # 从模板新建一首曲子
make help                     # 看所有可用命令
```

## 试听

装不上 FluidSynth 也能听——`tools/miditools/render.py` 是自己用 numpy 写的加法合成器，
把 MIDI 直接渲染成音频（音色不拟真，但足够听清编曲的层次和动态）：

```bash
pip install numpy imageio-ffmpeg
PYTHONPATH=tools python3 -m miditools.render build/xxx.mid --mp3
```

## 目录结构

```
.
├── arrangements/              # 一首曲子一个目录
│   ├── _template/             # 新曲模板（信息卡 / 歌词 / 和弦 / 编曲 / build.py）
│   ├── example-canon-folk/    # 示例：卡农的民谣改编（公有领域素材）
│   └── bad-guy-cn/            #《坏蛋》中文版：原创词 + 伊善风编曲（男声 Gm）
├── tools/miditools/           # 工具库
│   ├── smf.py                 # 标准 MIDI 文件写出器（零依赖）
│   ├── theory.py              # 音名、音阶、和弦（零依赖）
│   └── render.py              # 自写软件合成器：MIDI -> wav/mp3（需 numpy）
├── docs/
│   ├── workflow.md            # 改编工作流：从立项到出活的六步
│   └── conventions.md         # 和弦写法、音高记号、GM 音色、力度对照
├── build/                     # 生成的 MIDI / 音频（已 gitignore）
├── Makefile
└── requirements.txt           # 可选增强：mido / music21 / pretty_midi
```

## 工具库用法

```python
from miditools import Song, chord, pitch

song = Song("My Song", bpm=92)
gtr = song.track("Guitar", channel=0, program=25)   # 25 = 钢弦木吉他

for bar, sym in enumerate(["C", "G/B", "Am7", "Fmaj7"]):
    gtr.chord(bar * 4, chord(sym, octave=3), 4)     # 时间单位是「拍」

song.save("build/my-song.mid")
```

- 音高用科学记号，**C4 = 中央 C = MIDI 60**；
- 和弦符号支持 `m7 / maj7 / sus4 / add9 / dim7 / C/E` 等，详见 `docs/conventions.md`；
- 鼓走第 10 通道（代码里 `channel=9`）。

## 约定

- 每首曲子先填 `README.md` 的信息卡（原曲、调性、音域、用途），再动手。
- 所有生成物只进 `build/`，不入版本库；乐谱源文件（MusicXML / LilyPond）放各曲目的 `score/`。
- **版权**：公有领域作品随意改；现代作品的改词与改编属演绎创作，发布或商用前需取得词曲版权方授权，且不要把原唱录音放进仓库。
