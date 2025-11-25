# JustMark

**The Zen of Writing.** **回归写作本质的极简编辑器。**

JustMark is not just a Markdown editor; it is a space designed for focus. We stripped away complex toolbars and heavy dependencies to bring you a writing tool that feels as light as air.

JustMark 不仅仅是一个编辑器，它是一个专为专注而生的空间。我们摒弃了复杂的菜单和沉重的依赖，只为你提供如空气般轻盈的写作体验。

## 🌟 Why JustMark? / 核心优势

### 🪶 Ultra Lightweight / 极致轻量

Forget about 100MB+ Electron apps. Built on next-gen native technology, JustMark is incredibly small (**<10MB**) and launches instantly. It respects your computer's memory and battery.
告别臃肿的传统编辑器。基于下一代原生技术构建，JustMark 体积微小（**小于 10MB**），秒级启动。它极度节省你的内存和电量。

### 🍎 Extreme Minimalism / 极简美学

* **Borderless Design**: An immersive window that blends into your desktop.
* **Intuitive Drag**: Drag anywhere on the header to move the window.
* **Zero Clutter**: No complex menus. Just you and your words.
* **无边框设计**：沉浸式窗口，完美融合 macOS 桌面美学。
* **全域拖拽**：顶部栏任意位置均可拖动，手感顺滑。
* **零干扰**：没有复杂的菜单栏，只有你和文字。

### 📄 What You See Is What You Get / 真实纸张预览

The right panel perfectly simulates **A4 paper size**. No more guessing page breaks. When you click "Export", you get exactly what you see.
右侧预览区严格对应 **A4 纸张尺寸**。无需猜测排版，无需调整页边距。当你点击“导出”时，得到的 PDF 与你看到的分毫不差。

### 🌗 Day & Night / 昼夜陪伴

Native Dark Mode support. Whether you are writing in a sunlit cafe or a dim room, JustMark adapts to your eyes instantly.
原生暗夜模式支持。无论是在阳光充足的咖啡馆，还是深夜的房间，一键切换，时刻护眼。

---

## 📥 Download / 下载使用

Visit the [Releases Page](../../releases) to download the latest version for macOS.
请访问 [Releases 页面](../../releases) 下载适用于 macOS 的最新版本。

1. Download the `.dmg` file. (下载 .dmg 文件)
2. Drag into Applications. (拖入应用程序文件夹)
3. Start writing. (开始写作)

---

*JustMark - Write Simply.*

## Q&A

### 1: macOS 安装后提示“已损坏，无法打开”

在终端粘贴复制输入命令（注意最后有一个空格）：

```
sudo xattr -r -d com.apple.quarantine 
```

先不要按回车！先不要按回车！先不要按回车！先不要按回车！

然后打开 “访达”（Finder）进入 “应用程序” 目录，找到该软件图标，将图标拖到刚才的终端窗口里面，会得到如下组合(如图所示)：

```
sudo xattr -r -d com.apple.quarantine /Applications/JustMark.app
```

回到终端窗口按回车，输入系统密码回车即可。
