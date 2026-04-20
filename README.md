# JustMark

**The Zen of Writing.** **回归写作本质的极简编辑器。**

JustMark is a native macOS Markdown editor built for focused writing. The current mainline is based on `SwiftUI + AppKit + WKWebView`, with a stable three-pane workspace, native text editing, and a calmer interface than typical web-wrapped editors.

JustMark 是一个面向专注写作的原生 macOS Markdown 编辑器。当前主线实现基于 `SwiftUI + AppKit + WKWebView`，重点放在稳定的三栏工作区、原生文本编辑体验，以及更克制、更安静的界面。

## 🌟 Why JustMark? / 核心优势

### 🪶 Native & Lightweight / 原生且轻量

Forget about heavy browser shells. JustMark now ships as a native macOS app with fast launch, lower memory overhead, and desktop behaviors that fit the platform.
告别厚重的浏览器壳层。JustMark 现在是一套真正的原生 macOS 应用，启动更快、内存占用更低，也更贴近桌面平台应有的行为。

### 🍎 Focused Workspace / 专注型三栏工作区

* **Sidebar + Editor + Preview**: A stable three-pane layout for folder navigation, writing, and reading.
* **Multi-tab Editing**: Work across multiple Markdown files without leaving the current workspace.
* **Native Text Engine**: The editor is powered by `NSTextView`, which makes macOS text input and keyboard behavior more reliable.
* **三栏布局**：目录、编辑、预览同屏协作，适合持续写作与整理文档。
* **多标签编辑**：可以在一个工作区内切换多个文档。
* **原生编辑内核**：编辑区基于 `NSTextView`，更适合 macOS 的输入和快捷键习惯。

### 📄 Better Markdown Preview / 更可靠的 Markdown 预览

GitHub-style Markdown rendering is now a first-class goal. Common README patterns such as tables, images, links, HTML blocks, and mixed content render much more reliably than before.
GitHub 风格 Markdown 渲染已经成为当前重点。常见 README 场景里的表格、图片、链接、HTML block 和混合内容，现在都比之前稳定得多。

### 🌗 Theme, Fonts, and Reading Comfort / 主题、字体与阅读舒适度

* **App Theme**: Light and dark mode support.
* **Independent Content Surfaces**: Editor and preview can each follow the app theme, or be forced to light/dark independently.
* **Separate Chinese / Latin Fonts**: Configure CJK and Latin fonts independently for editing and preview.
* **全局主题**：支持浅色与深色模式。
* **内容区独立外观**：编辑区和预览区可以跟随应用主题，也可以分别单独设为浅色或深色。
* **中英文字体分离配置**：编辑区和预览区都支持分别设置中文与英文字体。

### ⌨️ Native Workflow / 原生工作流

JustMark supports recent files, recent folders, customizable shortcuts, find/replace, PDF export, and a built-in CLI entry for opening files or rendering output from Terminal.
JustMark 支持最近文件、最近文件夹、自定义快捷键、查找替换、PDF 导出，以及一个可从终端打开文件或渲染输出的 CLI 入口。

---

## ✨ What It Can Do / 现在能做什么

- Open a file or an entire folder as a workspace  
  打开单个 Markdown 文件，或整个文件夹作为工作区
- Edit multiple documents in tabs  
  通过标签页编辑多个文档
- Render GitHub-flavored Markdown in the preview pane  
  在右侧预览区渲染 GitHub 风格 Markdown
- Export the current document as PDF  
  将当前文档导出为 PDF
- Customize shortcuts, fonts, and content appearance  
  自定义快捷键、字体和内容区外观
- Configure WebDAV sync for the current document or Markdown workspace  
  为当前文档或当前 Markdown 工作区配置 WebDAV 同步

## 📥 Download / 下载使用

Download the latest macOS build from this repository's GitHub Releases page.  
请从当前仓库的 GitHub Releases 页面下载最新 macOS 安装包。

1. Download the latest `.dmg` file. (下载最新 `.dmg` 文件)
2. Drag `JustMark.app` into Applications. (拖入应用程序文件夹)
3. Launch and start writing. (启动并开始写作)

---

## 🛠 Build From Source / 从源码运行

Project root:

```bash
cd macos/JustMark
```

Open with Xcode:

```bash
open JustMark.xcodeproj
```

Build from Terminal:

```bash
cd macos/JustMark
xcodebuild \
  -project JustMark.xcodeproj \
  -scheme JustMark \
  -configuration Debug \
  build
```

## 🧰 CLI / 命令行入口

The repository also ships a native CLI named `justmark`.
仓库里同时包含一个原生命令行入口 `justmark`。

Build it:

```bash
cd macos/JustMark
swift build --product justmark
```

Examples:

```bash
./.build/debug/justmark
./.build/debug/justmark README.md
./.build/debug/justmark .
./.build/debug/justmark new
./.build/debug/justmark render-html README.md --output /tmp/preview.html
./.build/debug/justmark render-pdf README.md --output /tmp/preview.pdf
```

Install to your user `PATH`:

```bash
cd macos/JustMark
./scripts/install-cli.sh
justmark version
```

---

*JustMark - Write Simply.*

## Q&A

### 1: macOS 安装后提示“已损坏，无法打开”

在终端粘贴复制输入命令（注意最后有一个空格）：

```bash
sudo xattr -r -d com.apple.quarantine 
```

先不要按回车！先不要按回车！先不要按回车！先不要按回车！

然后打开 “访达”（Finder）进入 “应用程序” 目录，找到该软件图标，将图标拖到刚才的终端窗口里面，会得到如下组合：

```bash
sudo xattr -r -d com.apple.quarantine /Applications/JustMark.app
```

回到终端窗口按回车，输入系统密码回车即可。

### 2: 这个仓库现在到底是哪条技术路线？

当前主线是 `macos/JustMark` 里的原生 macOS 工程。  
目前 README、发布包和后续功能更新，都以这套原生实现为准。

### 3: WebDAV 是完整云盘同步吗？

不是。当前更适合“Markdown 文档 / Markdown 工作区同步或备份”场景。  
它在持续重构中，目标是行为稳定、配置清晰、风险可解释，而不是立即变成通用型云盘客户端。
