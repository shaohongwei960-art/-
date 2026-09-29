# 曲目信息卡 · 卡农（民谣改编示例）

| 项目 | 内容 |
| --- | --- |
| 原曲 / 原作者 | Canon in D · Johann Pachelbel（**公有领域**） |
| 改编类型 | 换风格 + 重新配和声 |
| 目标风格 | 民谣小品：木吉他分解 + 钢琴主旋律 + 轻鼓 |
| 调性 | D 大调（原调） |
| 拍号 / BPM | 4/4 · 92 |
| 编制 | 木吉他、钢琴、贝斯、鼓 |
| 用途 | 仓库示例，演示工具链怎么用 |
| 状态 | 已定稿（示例） |

## 怎么听

```bash
python3 arrangements/example-canon-folk/build.py
# -> build/example-canon-folk.mid
```

用任意 DAW、MuseScore 或系统播放器打开即可；装了 FluidSynth 的话 `make audio` 能直接转成 wav。

## 结构

| 小节 | 段落 | 内容 |
| --- | --- | --- |
| 1–8 | Intro | 吉他分解 + 贝斯，铺出卡农进行 |
| 9–16 | A 段 | 钢琴主旋律进入，鼓组加入 |
| 17–24 | A 段加花 | 旋律高八度，力度推上去 |
| 25–32 | Outro | 重复收尾 |

和声进行（每小节一个）：`D | A/C# | Bm7 | F#m | G | D/F# | Gmaj7 | A7`
