# 音乐改编工作台 —— 常用命令
# 核心功能零依赖，`make audio` 等才需要额外软件。

PYTHON ?= python3
BUILD := build

.PHONY: help all example song clean audio deps new

help:
	@echo "make example   生成示例曲目的 MIDI"
	@echo "make all       构建 arrangements/ 下所有曲目"
	@echo "make new N=my-song   从模板新建一个曲目目录"
	@echo "make audio     把 build/ 里的 MIDI 渲染成 wav + mp3（自带合成器，需 numpy）"
	@echo "make song      生成《坏蛋》中文版 男声 Gm 版并渲染音频"
	@echo "make deps      安装可选依赖（numpy 渲染音频 / mido / music21）"
	@echo "make clean     清空 build/"

example:
	$(PYTHON) arrangements/example-canon-folk/build.py

song:
	$(PYTHON) arrangements/bad-guy-cn/build.py --key G
	PYTHONPATH=tools $(PYTHON) -m miditools.render $(BUILD)/bad-guy-cn-gm.mid --mp3

all:
	@for f in arrangements/*/build.py; do echo "==> $$f"; $(PYTHON) "$$f"; done

new:
	@test -n "$(N)" || (echo "用法: make new N=my-song"; exit 1)
	@test ! -e arrangements/$(N) || (echo "arrangements/$(N) 已存在"; exit 1)
	cp -r arrangements/_template arrangements/$(N)
	@echo "已创建 arrangements/$(N)，先去填 README.md 的信息卡"

audio:
	@for m in $(BUILD)/*.mid; do \
		echo "==> $$m"; \
		PYTHONPATH=tools $(PYTHON) -m miditools.render "$$m" --mp3; \
	done

deps:
	$(PYTHON) -m venv .venv && .venv/bin/pip install -r requirements.txt

clean:
	rm -rf $(BUILD)/*
