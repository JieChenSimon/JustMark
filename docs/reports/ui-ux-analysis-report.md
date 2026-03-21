# JustMark UI/UX 原生对比分析报告

## 执行摘要

JustMark 是一个基于 Tauri + React 的 Markdown 编辑器，整体设计已经较好地模仿了 macOS 原生应用的视觉风格，但在多个关键维度上与真正的原生 Swift 应用存在明显差距。

**核心问题：**
1. 缺少原生窗口控件（traffic lights）
2. 布局和间距不符合 macOS HIG 规范
3. 动画曲线和时长不符合系统标准
4. 字体渲染和排版细节欠缺
5. 交互反馈不够精细

---

## 1. 窗口与标题栏 (Window & Title Bar)

### 当前实现
```jsx
// App.jsx:589-593
<div
  data-tauri-drag-region
  className="pointer-events-auto absolute inset-x-0 top-0 z-30 h-5"
  style={{ backgroundColor: 'transparent' }}
/>
```

### 问题分析
- **缺少 Traffic Lights**：macOS 原生应用左上角有红黄绿三个窗口控制按钮
- **拖拽区域高度不标准**：使用 `h-5` (20px)，而 macOS 标准标题栏高度为 22px
- **无标题栏模糊效果**：原生应用标题栏有 vibrancy 材质效果

### macOS HIG 标准
- 标题栏高度：22px (非全屏) / 28px (全屏)
- Traffic lights 位置：距左边缘 13px，距顶部 13px
- 标题栏材质：NSVisualEffectView with .titlebar material

### 改进建议
```jsx
// 添加原生 traffic lights 区域
<div className="h-[22px] flex items-center pl-[78px]" data-tauri-drag-region>
  {/* 左侧预留 traffic lights 空间 (13px + 52px + 13px) */}
  <div className="flex-1 text-center text-[13px] font-medium">
    {currentFileName}
  </div>
</div>
```

---

## 2. 布局与间距 (Layout & Spacing)

### 当前实现问题

#### 2.1 Sidebar 间距
```jsx
// SidebarPanel.jsx:107
<div className="relative flex h-full min-h-0 flex-col overflow-x-hidden px-1.5 pb-1.5 pt-6">
```
- `pt-6` (24px) 过大，原生应用通常为 8-12px
- `px-1.5` (6px) 过小，原生侧边栏内边距通常为 8-10px

#### 2.2 文件树项高度
```jsx
// FileTreeItem 高度不统一
// 原生 Finder/Xcode 侧边栏项高度：20px (compact) / 24px (regular)
```

#### 2.3 Tab 高度
```css
/* FileTabs.css:38 */
height: 19px;
```
- 原生 Safari/Xcode tabs 高度：28px
- 当前实现过于紧凑

### macOS HIG 标准
- **8pt Grid System**：所有间距应为 8 的倍数
- **Sidebar 宽度**：最小 180px，默认 220-260px
- **List Item 高度**：20px (compact) / 24px (regular) / 28px (large)

### 改进建议
```css
/* 标准化间距 */
.jm-sidebar {
  padding: 8px 8px 8px 8px; /* 改为 8px */
}

.jm-file-tab {
  height: 28px; /* 改为原生标准 */
  padding: 0 12px; /* 增加水平内边距 */
}
```

---

## 3. 字体与排版 (Typography)

### 当前实现
```css
/* index.css:29 */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
```

### 问题分析
1. **字体回退顺序不正确**：应优先使用 SF Pro
2. **字号不符合规范**：
   - Sidebar 文件名：`text-[12px]` → 应为 13px
   - Tab 文字：`font-size: 11px` → 应为 13px
   - 按钮文字：`text-[11px]` → 应为 13px

3. **行高不标准**：
   ```css
   /* index.css:11 */
   line-height: 24px; /* 应根据字号动态调整 */
   ```

4. **字重使用不当**：
   ```jsx
   // SidebarPanel.jsx:109
   <div className="text-[12px] font-semibold">
   ```
   - macOS 原生使用 SF Pro Medium (500) 而非 Semibold (600)

### macOS HIG 标准
- **系统字体**：SF Pro Text (< 20pt) / SF Pro Display (≥ 20pt)
- **标准字号**：
  - Large Title: 26pt
  - Title 1: 22pt
  - Headline: 17pt
  - Body: 13pt (默认)
  - Callout: 12pt
  - Footnote: 10pt
  - Caption: 10pt

- **字重**：
  - Regular: 400
  - Medium: 500 (常用于强调)
  - Semibold: 600 (少用)
  - Bold: 700 (标题)

### 改进建议
```css
:root {
  /* 使用正确的字体栈 */
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  font-size: 13px; /* macOS 默认 body 字号 */
  line-height: 1.4; /* 相对行高更灵活 */
}

/* 标准化字号 */
.jm-sidebar-item {
  font-size: 13px;
  font-weight: 400; /* Regular */
}

.jm-sidebar-header {
  font-size: 11px;
  font-weight: 600; /* Semibold for headers */
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.jm-tab-name {
  font-size: 13px; /* 改为标准 body 字号 */
  font-weight: 400;
}
```

---

## 4. 颜色与视觉层次 (Colors & Visual Hierarchy)

### 当前实现问题

#### 4.1 背景色不够精细
```css
/* index.css:7 */
--jm-window-bg: #f5f5f5;
```
- 原生 macOS 使用更复杂的颜色系统（NSColor.windowBackgroundColor）
- 缺少 vibrancy 和 translucency 效果

#### 4.2 边框颜色过重
```css
/* index.css:14 */
--jm-panel-border: rgba(0, 0, 0, 0.06);
```
- 原生应用边框更轻：`rgba(0, 0, 0, 0.04)` 或使用 separator color

#### 4.3 阴影不符合规范
```css
/* FileTabs.css:91-94 */
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.72),
  inset 0 0 0 0.5px rgba(15, 23, 42, 0.04),
  0 1px 2px rgba(15, 23, 42, 0.05),
  0 6px 16px rgba(15, 23, 42, 0.05);
```
- 阴影层级过多，原生应用通常只用 1-2 层
- 模糊半径过大

### macOS HIG 标准
- **系统颜色**：使用语义化颜色（labelColor, secondaryLabelColor, separatorColor）
- **阴影规范**：
  - Level 1: `0 1px 3px rgba(0,0,0,0.12)`
  - Level 2: `0 2px 6px rgba(0,0,0,0.16)`
  - Level 3: `0 4px 12px rgba(0,0,0,0.18)`

### 改进建议
```css
:root {
  /* 使用更接近原生的颜色 */
  --jm-window-bg: #ececec; /* NSColor.windowBackgroundColor 近似值 */
  --jm-text: rgba(0, 0, 0, 0.85); /* labelColor */
  --jm-text-secondary: rgba(0, 0, 0, 0.55); /* secondaryLabelColor */
  --jm-separator: rgba(0, 0, 0, 0.1); /* separatorColor */

  /* 简化阴影 */
  --jm-shadow-1: 0 1px 3px rgba(0, 0, 0, 0.12);
  --jm-shadow-2: 0 2px 6px rgba(0, 0, 0, 0.16);
}

.dark {
  --jm-window-bg: #1e1e1e;
  --jm-text: rgba(255, 255, 255, 0.85);
  --jm-text-secondary: rgba(255, 255, 255, 0.55);
  --jm-separator: rgba(255, 255, 255, 0.1);
}
```

---

## 5. 动画与过渡 (Animations & Transitions)

### 当前实现问题

#### 5.1 动画时长不标准
```css
/* FileTabs.css:49-53 */
transition:
  background-color 140ms ease,
  color 140ms ease,
  box-shadow 140ms ease,
  transform 140ms ease;
```
- 140ms 不是标准值
- 原生 macOS 使用：200ms (standard) / 300ms (emphasized)

#### 5.2 缓动函数不正确
```jsx
// App.jsx:596
className="transition-[width,opacity,transform] duration-300 ease-out"
```
- `ease-out` 不是 macOS 标准缓动
- 应使用 `cubic-bezier(0.25, 0.1, 0.25, 1)` (ease-in-out-quart)

#### 5.3 布局动画不流畅
```jsx
// App.jsx:113
const shouldAnimateLayout = !isDragging && !isDraggingSidebar;
```
- 拖拽时禁用动画会导致视觉跳跃
- 应使用 spring 动画保持连续性

### macOS HIG 标准
- **动画时长**：
  - Instant: 0ms
  - Fast: 100ms
  - Standard: 200ms
  - Emphasized: 300ms
  - Slow: 500ms

- **缓动函数**：
  - Ease In: `cubic-bezier(0.42, 0, 1, 1)`
  - Ease Out: `cubic-bezier(0, 0, 0.58, 1)`
  - Ease In-Out: `cubic-bezier(0.42, 0, 0.58, 1)`
  - Spring: 使用 CASpringAnimation

### 改进建议
```css
/* 标准化动画时长和缓动 */
:root {
  --jm-duration-fast: 100ms;
  --jm-duration-standard: 200ms;
  --jm-duration-emphasized: 300ms;

  --jm-ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);
  --jm-ease-out: cubic-bezier(0, 0, 0.58, 1);
}

.jm-file-tab {
  transition:
    background-color var(--jm-duration-standard) var(--jm-ease-in-out),
    color var(--jm-duration-standard) var(--jm-ease-in-out),
    box-shadow var(--jm-duration-standard) var(--jm-ease-in-out);
}

/* 使用 will-change 优化性能 */
.jm-sidebar {
  will-change: width;
  transition: width var(--jm-duration-emphasized) var(--jm-ease-in-out);
}
```

---

## 6. 交互反馈 (Interaction Feedback)

### 当前实现问题

#### 6.1 Hover 状态不够明显
```css
/* FileTabs.css:71-74 */
.jm-file-tab:hover:not(.active) {
  background: rgba(15, 23, 42, 0.045);
  color: rgba(15, 23, 42, 0.92);
}
```
- 背景色变化太微弱（4.5% opacity）
- 原生应用 hover 通常为 6-8% opacity

#### 6.2 Active 状态缺少按压效果
```css
/* index.css:78-81 */
.jm-button:active {
  background: rgba(0, 0, 0, 0.06);
  transform: scale(0.985);
}
```
- `scale(0.985)` 缩放过小，不够明显
- 原生应用通常使用 `scale(0.95)` 或亮度变化

#### 6.3 Focus 状态不符合规范
```css
/* index.css:83-87 */
.jm-button:focus-visible {
  outline: 2px solid var(--jm-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--jm-accent-soft);
}
```
- 原生 macOS 使用 3px 蓝色 focus ring
- outline-offset 应为 0 或 -2px

### macOS HIG 标准
- **Hover**：背景色变化 6-8%，无需动画
- **Active**：背景色变化 10-12%，或使用 brightness filter
- **Focus**：3px 蓝色 ring，offset -2px
- **Disabled**：opacity 0.5，cursor not-allowed

### 改进建议
```css
/* 增强交互反馈 */
.jm-button:hover {
  background: rgba(0, 0, 0, 0.08); /* 增加到 8% */
}

.jm-button:active {
  background: rgba(0, 0, 0, 0.12);
  transform: scale(0.96); /* 更明显的缩放 */
}

.jm-button:focus-visible {
  outline: 3px solid rgba(0, 122, 255, 0.6);
  outline-offset: -2px;
  box-shadow: none; /* 移除额外阴影 */
}

.jm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

## 7. 组件细节问题

### 7.1 FileTabs

**问题：**
```css
/* FileTabs.css:33-54 */
.jm-file-tab {
  height: 19px; /* 过矮 */
  min-width: 76px; /* 过窄 */
  border-radius: 6px 6px 4px 4px; /* 不对称圆角不符合规范 */
}
```

**原生标准：**
- Safari tabs: 28px 高，最小宽度 100px
- 圆角：6px (统一) 或 8px

**改进：**
```css
.jm-file-tab {
  height: 28px;
  min-width: 100px;
  max-width: 200px;
  border-radius: 6px 6px 0 0; /* 顶部圆角，底部直角 */
  padding: 0 12px;
}
```

### 7.2 ConfirmDialog

**问题：**
```jsx
// ConfirmDialog.jsx:66-68
className="relative w-[240px] rounded-[20px] border border-slate-200/70 bg-white/88"
```
- 宽度 240px 过窄，原生 alert 最小 260px
- 圆角 20px 过大，原生使用 12px
- 背景透明度 88% 不符合规范，应为 95-98%

**改进：**
```jsx
className="relative min-w-[260px] max-w-[420px] rounded-[12px] border border-slate-200/80 bg-white/96"
```

### 7.3 GlobalSearch

**问题：**
```jsx
// GlobalSearch.jsx:216
className="overflow-hidden rounded-2xl border border-black/10 bg-white/95"
```
- `rounded-2xl` (16px) 过大
- 边框颜色过淡

**改进：**
```jsx
className="overflow-hidden rounded-[12px] border border-black/15 bg-white/98"
```

### 7.4 SearchReplace

**问题：**
```jsx
// SearchReplace.jsx:181
className="absolute left-1/2 top-12 -translate-x-1/2 w-[480px] rounded-xl"
```
- 宽度固定 480px，应响应式
- 位置 top-12 (48px) 过低，应为 20-24px

**改进：**
```jsx
className="absolute left-1/2 top-6 -translate-x-1/2 w-full max-w-[560px] px-4 rounded-xl"
```

---

## 8. 滚动条样式

### 当前实现
```css
/* index.css:452-456 */
::-webkit-scrollbar {
  width: 0px;
  height: 0px;
  display: none;
}
```

**问题：**
- 完全隐藏滚动条不符合 macOS 规范
- 原生应用使用 overlay scrollbar（悬浮时显示）

### macOS HIG 标准
- **Overlay Scrollbar**：默认隐藏，滚动时显示
- **宽度**：15px (regular) / 11px (small)
- **颜色**：rgba(0, 0, 0, 0.3) light / rgba(255, 255, 255, 0.3) dark

### 改进建议
```css
/* 使用原生风格滚动条 */
::-webkit-scrollbar {
  width: 15px;
  height: 15px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 4px solid transparent;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
  background-clip: padding-box;
}

.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
```

---

## 9. 可访问性 (Accessibility)

### 当前实现问题

1. **键盘导航不完整**
   - FileTabs 支持键盘导航，但缺少 Cmd+数字 快捷键
   - Sidebar 缺少 arrow key 导航

2. **Focus 指示器不明显**
   - 部分组件缺少 focus-visible 样式

3. **ARIA 标签不完整**
   ```jsx
   // FileTabs.jsx:61-63
   role="tab"
   tabIndex={0}
   aria-selected={isActive}
   ```
   - 缺少 aria-label 描述文件路径

### macOS HIG 标准
- **VoiceOver 支持**：所有交互元素需要 accessible label
- **键盘导航**：Tab / Shift+Tab / Arrow keys
- **Focus Ring**：3px 蓝色，清晰可见

### 改进建议
```jsx
// 添加完整的 ARIA 标签
<div
  role="tab"
  tabIndex={0}
  aria-selected={isActive}
  aria-label={`${fileName} - ${isUnsaved ? 'unsaved' : 'saved'}`}
  aria-controls={`panel-${filePath}`}
>
```

---

## 10. 性能优化建议

### 当前问题

1. **过度使用 backdrop-filter**
   ```css
   /* index.css:56 */
   backdrop-filter: blur(20px);
   ```
   - blur(20px) 性能开销大
   - 建议降低到 blur(10px) 或使用半透明背景

2. **动画未使用 GPU 加速**
   ```css
   /* 缺少 will-change 和 transform */
   ```

3. **未使用 CSS containment**
   ```css
   /* 应添加 contain 属性优化渲染 */
   ```

### 改进建议
```css
/* 优化性能 */
.jm-sidebar {
  contain: layout style paint;
  will-change: width;
}

.jm-file-tab {
  contain: layout style;
  will-change: transform;
}

/* 降低 blur 强度 */
.jm-panel {
  backdrop-filter: blur(10px); /* 从 18px 降低到 10px */
}
```

---

## 总结与优先级

### 高优先级（影响用户体验）
1. ✅ **添加 Traffic Lights 区域**：预留左上角窗口控制按钮空间
2. ✅ **标准化字号**：统一使用 13px body 字号
3. ✅ **修正 Tab 高度**：从 19px 改为 28px
4. ✅ **优化动画时长**：使用 200ms/300ms 标准值
5. ✅ **增强 Hover 反馈**：背景色变化从 4.5% 提升到 8%

### 中优先级（提升视觉质量）
6. ✅ **修正圆角半径**：统一使用 6px/8px/12px
7. ✅ **优化颜色系统**：使用更接近原生的颜色值
8. ✅ **简化阴影**：减少阴影层级
9. ✅ **标准化间距**：遵循 8pt grid system
10. ✅ **改进滚动条样式**：使用 overlay scrollbar

### 低优先级（细节打磨）
11. ✅ **完善 ARIA 标签**：提升可访问性
12. ✅ **优化性能**：添加 will-change 和 contain
13. ✅ **统一字重**：使用 400/500/600 标准字重
14. ✅ **修正 Focus Ring**：使用 3px 蓝色 ring

---

## 附录：关键文件清单

### 需要修改的文件
1. `/Users/SimonChen/JustMark/src/index.css` - 全局样式和颜色系统
2. `/Users/SimonChen/JustMark/src/components/FileTabs.css` - Tab 样式
3. `/Users/SimonChen/JustMark/src/App.jsx` - 窗口布局和动画
4. `/Users/SimonChen/JustMark/src/components/ConfirmDialog.jsx` - 对话框样式
5. `/Users/SimonChen/JustMark/src/components/GlobalSearch.jsx` - 搜索面板
6. `/Users/SimonChen/JustMark/src/components/SearchReplace.jsx` - 搜索替换
7. `/Users/SimonChen/JustMark/src/components/sidebar/SidebarPanel.jsx` - 侧边栏

### 参考资源
- [macOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/macos)
- [SF Pro Font Specification](https://developer.apple.com/fonts/)
- [NSColor Documentation](https://developer.apple.com/documentation/appkit/nscolor)
- [CAAnimation Timing](https://developer.apple.com/documentation/quartzcore/camediatiming)

---

**报告生成时间：** 2026-03-21
**分析工具：** Claude Opus 4.6
**项目版本：** JustMark 0.1.5
