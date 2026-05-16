#!/bin/bash

# 顾念笔记 - 中国网络环境安装脚本
# 在国内网络环境下安装 Electron

set -e

echo "📦 开始安装 顾念笔记 (Alhagi)..."

# 设置 Electron 镜像
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

# 安装依赖（跳过 postinstall 脚本）
echo "📥 安装 npm 依赖..."
npm install --ignore-scripts

# 下载 Electron 二进制文件
ELECTRON_VERSION=$(node -p "require('./package.json').devDependencies.electron")
echo "⬇️ 下载 Electron v${ELECTRON_VERSION}..."
mkdir -p ~/.cache/electron
curl -L -o ~/.cache/electron/electron-v${ELECTRON_VERSION}-linux-x64.zip \
  "https://npmmirror.com/mirrors/electron/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-x64.zip"

# 解压到缓存目录
echo "📂 解压 Electron..."
cd ~/.cache/electron
unzip -o electron-v${ELECTRON_VERSION}-linux-x64.zip

# 复制到项目
echo "📦 配置 Electron..."
mkdir -p node_modules/electron/dist
cp -r electron/* node_modules/electron/dist/

# 安装系统依赖 (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🔧 安装系统依赖..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y libgtk-3-0 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2
    elif command -v yum &> /dev/null; then
        sudo yum install -y gtk3 atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXrandr mesa-libgbm alsa-lib
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm gtk3 atk at-spi2-atk cups libdrm libxkbcommon libxcomposite libxdamage libxrandr mesa alsa-lib
    fi
fi

echo "✅ 安装完成！"
echo ""
echo "启动方式："
echo "  npm run dev"
echo ""
echo "如果遇到问题，尝试："
echo "  npm run dev -- --no-sandbox"
