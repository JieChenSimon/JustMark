# JustMark Native

这是一个独立于现有 `React + Tauri` 工程的 macOS SwiftUI 原生骨架。

当前目标不是功能对等，而是先把真正原生的架构边界固定下来：

- `SwiftUI` 负责 App、窗口、菜单、设置页、三栏布局
- `NSTextView` 负责文本编辑内核
- `WKWebView` 暂时作为低风险预览容器
- `FileManager / NSOpenPanel / NSSavePanel` 负责文件系统
- `Security` 框架负责 Keychain
- `WebDAVService` 保留现有配置和凭据规则，但还未实现完整同步

## 目录

- `Sources/App`
  App 入口、根视图、Commands、WorkspaceStore
- `Sources/Core`
  App 和 CLI 共用的外部命令协议
- `Sources/Editor`
  文档模型、Tab、`NSTextView` 包装、Markdown 格式化
- `Sources/Preview`
  预览引擎与 `WKWebView` 容器
- `Sources/SystemIntegration`
  文件系统、Keychain、窗口、最近文件、布局状态
- `Sources/Utils`
  共享模型、设置 store、TOC 解析
- `Sources/WebDAV`
  WebDAV 配置校验与凭据边界

## CLI

当前仓库已经包含一个原生命令行入口 `justmark`，用于从终端拉起 SwiftUI 原生版应用，或做基础的无界面渲染。

构建：

```bash
cd /path/to/JustMark/macos/JustMark
swift build --product justmark
```

常用调用：

```bash
./.build/debug/justmark
./.build/debug/justmark README.md
./.build/debug/justmark .
./.build/debug/justmark new
./.build/debug/justmark render-html README.md --output /tmp/preview.html
./.build/debug/justmark render-pdf README.md --output /tmp/preview.pdf
```

安装到当前用户 PATH：

```bash
cd /path/to/JustMark/macos/JustMark
./scripts/install-cli.sh
justmark version
```

如果本机存在多个同名 `JustMark.app`，可以显式指定原生版 app bundle：

```bash
./.build/debug/justmark --app /path/to/JustMark.app README.md --preview
```

CLI 通过自定义 URL scheme `justmark://` 向 app 投递 `open` / `new` 命令。当前 v1 支持：

- 打开 app
- 打开文件或文件夹
- 新建空白文档
- 切换预览显隐
- `render-html` 本地渲染 Markdown 为 HTML
- `render-pdf` 本地导出 Markdown 为 PDF

## 下一步

1. 给 `WorkspaceStore` 加入保存、另存、自动保存和会话恢复。
2. 给 `EditorView` 加入查找替换、图片粘贴、光标恢复和滚动同步。
3. 把 `PreviewEngine` 从占位 HTML 升级为真正的 Markdown 渲染链。
4. 实现 `WebDAVService` 的目录列出、上传、下载和冲突处理。
