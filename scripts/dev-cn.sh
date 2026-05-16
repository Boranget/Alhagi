#!/bin/bash

# 顾念笔记 - 启动脚本 (中国网络环境优化版)

# 设置 Electron 镜像
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

# 运行开发服务器
npm run dev "$@"
