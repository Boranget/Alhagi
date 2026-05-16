# 中国网络环境安装指南

## 问题

在国内网络环境下，使用 `npm install` 安装 Electron 时，可能会遇到以下问题：

```
npm error code 1
npm error path /workspace/node_modules/electron
npm error command failed
npm error command sh -c node install.js
npm error RequestError: connect ETIMEDOUT 47.96.233.62:443
```

这是因为 Electron 需要从 GitHub 下载二进制文件，而国内访问 GitHub 速度较慢或超时。

## 解决方案

### 方案一：使用国内镜像（推荐）

#### 1. 配置环境变量

**Linux / macOS:**
```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm install
```

**Windows (PowerShell):**
```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm install
```

#### 2. 使用安装脚本（自动处理）

```bash
chmod +x scripts/install-cn.sh
./scripts/install-cn.sh
```

#### 3. 使用启动脚本

```bash
chmod +x scripts/dev-cn.sh
./scripts/dev-cn.sh
```

### 方案二：手动下载 Electron 二进制文件

#### 1. 确定 Electron 版本

查看 `package.json` 中的 electron 版本：

```json
"electron": "^29.1.4"
```

#### 2. 下载二进制文件

访问镜像站点下载：
- npmmirror: https://npmmirror.com/mirrors/electron/
- 淘宝镜像: https://npm.taobao.org/mirrors/electron/

下载对应平台的 zip 文件：
- macOS: `electron-v{x.x.x}-darwin-x64.zip`
- Windows: `electron-v{x.x.x}-win32-x64.zip`
- Linux: `electron-v{x.x.x}-linux-x64.zip`

#### 3. 解压到正确位置

**Linux:**
```bash
mkdir -p ~/.cache/electron
unzip electron-v{x.x.x}-linux-x64.zip -d ~/.cache/electron
```

**macOS:**
```bash
mkdir -p ~/Library/Caches/electron
unzip electron-v{x.x.x}-darwin-x64.zip -d ~/Library/Caches/electron
```

**Windows:**
```powershell
# 解压到 %LOCALAPPDATA%\electron\Cache
mkdir $env:LOCALAPPDATA\electron\Cache
Expand-Archive electron-v{x.x.x}-win32-x64.zip $env:LOCALAPPDATA\electron\Cache
```

#### 4. 复制到项目 node_modules

```bash
mkdir -p node_modules/electron/dist
cp -r ~/.cache/electron/electron/* node_modules/electron/dist/
```

### 方案三：使用 cnpm

```bash
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install electron
```

## Linux 系统依赖

Electron 在 Linux 上需要一些系统库。如果遇到缺少库的错误，安装以下依赖：

### Ubuntu / Debian
```bash
sudo apt-get install -y \
  libgtk-3-0 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2
```

### CentOS / RHEL / Fedora
```bash
sudo yum install -y \
  gtk3 \
  atk \
  at-spi2-atk \
  cups-libs \
  libdrm \
  libxkbcommon \
  libXcomposite \
  libXdamage \
  libXrandr \
  mesa-libgbm \
  alsa-lib
```

### Arch Linux
```bash
sudo pacman -S --noconfirm \
  gtk3 \
  atk \
  at-spi2-atk \
  cups \
  libdrm \
  libxkbcommon \
  libxcomposite \
  libxdamage \
  libxrandr \
  mesa \
  alsa-lib
```

## 验证安装

```bash
# 查看 Electron 版本
npx electron --version

# 或直接运行
./node_modules/.bin/electron --version
```

## 常见问题

### Q: npm install 时仍然超时

A: 尝试设置 npm 的超时时间：
```bash
npm config set timeout 300000
npm install
```

### Q: 下载太慢怎么办？

A: 可以使用代理或 VPN，或者使用方案二手动下载。

### Q: Windows 上提示 "Running as root without --no-sandbox"

A: 在启动命令后加 `--no-sandbox` 参数：
```bash
npx electron . --no-sandbox
```

### Q: Electron 版本和 Node.js 版本不兼容

A: 参考以下版本对应表：

| Electron 版本 | Node.js 版本 | Chrome 版本 |
|---------------|--------------|------------|
| 29.x          | 18.x         | 122         |
| 28.x          | 18.x         | 120         |
| 27.x          | 18.17.x      | 118         |
| 26.x          | 16.20.x      | 116         |
| 25.x          | 16.16.x      | 114         |

## 参考链接

- [Electron 官方安装文档](https://www.electronjs.org/docs/latest/tutorial/installation)
- [npmmirror Electron 镜像](https://npmmirror.com/mirrors/electron/)
- [electron-builder 镜像](https://npmmirror.com/mirrors/electron-builder-binaries/)
