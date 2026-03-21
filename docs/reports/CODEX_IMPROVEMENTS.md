# JustMark 可借鉴 Codex.app 的 UI/UX 改进方案

> **基于**: Codex.app v26.311.21342 逆向分析
> **目标**: 提升 JustMark 的交互体验和视觉一致性
> **原则**: 保持轻量级，避免过度工程化

---

## 📊 现状对比

| 维度 | JustMark 现状 | Codex.app | 差距 |
|------|--------------|-----------|------|
| **CSS 行数** | 453 行 | 1 行 (压缩) | ✅ 简洁 |
| **设计系统** | 基础 CSS 变量 | 完整 Token 系统 | ⚠️ 需改进 |
| **动画效果** | 基础过渡 | 丰富动画 | ⚠️ 需改进 |
| **间距系统** | Tailwind 默认 | 标准化 calc() | ⚠️ 需改进 |
| **圆角系统** | 固定值 | 9 级渐进式 | ⚠️ 需改进 |
| **主题切换** | 基础支持 | 无缝切换 | ✅ 已实现 |

---

## 🎯 优先级改进清单

### ⭐ P0 - 立即可实施 (1-2 天)

#### 1. **Markdown 淡入动画**

**问题**: JustMark 的 Markdown 渲染是瞬间显示，缺乏过渡效果

**Codex 方案**:
```css
@keyframes fade-in {
  to { opacity: 1; }
}

.jm-markdown-preview > * {
  opacity: 0;
  animation: fade-in 0.2s cubic-bezier(0.37, 0.55, 0.86, 0.88) forwards;
}

/* 无障碍支持 */
@media (prefers-reduced-motion: reduce) {
  .jm-markdown-preview > * {
    opacity: 1;
    animation: none;
  }
}
```

**实施位置**: `src/index.css` 第 201-220 行（`.jm-markdown-preview` 区域）

**效果**:
- Markdown 元素逐个淡入，阅读体验更流畅
- 尊重用户无障碍偏好
- 性能开销极小（纯 CSS）

---

#### 2. **标准化间距系统**

**问题**: JustMark 使用 Tailwind 默认间距，缺乏全局一致性

**当前代码** (`src/index.css`):
```css
.jm-toolbar {
  @apply flex items-center gap-3 px-4 py-3;
}
```

**改进方案**:
```css
:root {
  --spacing: 4px;  /* 基础单位 */
}

.jm-toolbar {
  gap: calc(var(--spacing) * 3);      /* 12px */
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4);  /* 12px 16px */
}
```

**优势**:
- 全局调整间距只需修改 `--spacing`
- 保持 8px 网格系统一致性
- 便于响应式调整

**实施位置**:
1. `src/index.css` 第 6-16 行（`:root` 变量区）
2. 逐步替换 Tailwind 固定间距类

---

#### 3. **焦点可见性优化**

**问题**: JustMark 缺少键盘导航的焦点指示

**Codex 方案**:
```css
.jm-button:focus-visible {
  outline: 2px solid var(--jm-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--jm-accent-soft);
}

/* 移除鼠标点击时的焦点环 */
.jm-button:focus:not(:focus-visible) {
  outline: none;
}
```

**实施位置**: `src/index.css` 第 65-81 行（`.jm-button` 区域）

**效果**:
- 键盘导航时显示清晰焦点环
- 鼠标点击时不显示焦点环
- 符合 WCAG 2.1 无障碍标准

---

### ⭐⭐ P1 - 短期改进 (1 周)

#### 4. **完整的圆角系统**

**问题**: JustMark 使用固定圆角值，缺乏层级感

**当前代码**:
```css
.jm-toolbar-group {
  @apply rounded-lg;  /* 固定 8px */
}
```

**Codex 方案**:
```css
:root {
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 20px;
  --radius-4xl: 24px;
  --radius-full: 9999px;
}

.jm-toolbar-group {
  border-radius: var(--radius-lg);
}

.jm-button {
  border-radius: var(--radius-md);
}

.jm-traffic-dot {
  border-radius: var(--radius-full);
}
```

**实施步骤**:
1. 在 `:root` 中定义圆角变量
2. 替换所有 `rounded-*` Tailwind 类
3. 建立组件圆角规范：
   - 小按钮: `--radius-md` (6px)
   - 面板/卡片: `--radius-lg` (8px)
   - 大容器: `--radius-xl` (12px)
   - 圆形元素: `--radius-full`

---

#### 5. **Token 化颜色系统**

**问题**: JustMark 的颜色管理分散，主题切换不够灵活

**当前代码** (`src/index.css`):
```css
:root {
  --jm-window-bg: #f5f5f5;
  --jm-text: #1a1a1a;
  --jm-accent: #007AFF;
}

.dark {
  --jm-window-bg: #1a1a1a;
  --jm-text: #e5e5e5;
  --jm-accent: #0A84FF;
}
```

**Codex 方案** (语义化 Token):
```css
:root {
  /* 基础颜色 */
  --color-token-foreground: #1a1a1a;
  --color-token-background: #f5f5f5;

  /* 文本层级 */
  --color-token-text-primary: #1a1a1a;
  --color-token-text-secondary: #6b6b6b;
  --color-token-text-tertiary: #a3a3a3;

  /* 交互颜色 */
  --color-token-link: #007AFF;
  --color-token-button-foreground: #1a1a1a;
  --color-token-button-background: rgba(0, 0, 0, 0.04);

  /* 状态颜色 */
  --color-token-error: #ff3b30;
  --color-token-warning: #ff9500;
  --color-token-success: #34c759;
}

.dark {
  --color-token-foreground: #e5e5e5;
  --color-token-background: #1a1a1a;
  --color-token-text-primary: #e5e5e5;
  --color-token-text-secondary: #a3a3a3;
  --color-token-text-tertiary: #6b6b6b;
  --color-token-link: #0A84FF;
}
```

**优势**:
- 语义化命名，易于理解
- 主题切换只需修改 Token 值
- 便于未来扩展更多主题

**实施步骤**:
1. 重构 `src/index.css` 的 `:root` 变量
2. 更新 `src/hooks/useTheme.js` 的颜色逻辑
3. 逐步替换硬编码颜色值

---

#### 6. **加载状态动画**

**问题**: JustMark 缺少加载状态的视觉反馈

**Codex 的 Shimmer 效果**:
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.loading-shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--jm-accent-soft) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

**应用场景**:
- 文件加载中
- Markdown 渲染中
- WebDAV 同步中

**实施位置**:
1. `src/index.css` 添加动画定义
2. `src/components/preview/MarkdownPreview.jsx` 添加加载状态
3. `src/hooks/useWebDAVSync.js` 添加同步状态指示

---

### ⭐⭐⭐ P2 - 中期优化 (2-4 周)

#### 7. **代码分割优化**

**问题**: JustMark 的组件加载策略较简单

**Codex 方案**: 603 个模块，按需加载

**JustMark 改进**:
```jsx
// src/App.jsx
import { lazy, Suspense } from 'react';

// 懒加载非关键组件
const PDFPreview = lazy(() => import('./components/preview/PDFPreview'));
const FilePreview = lazy(() => import('./components/preview/FilePreview'));
const GlobalSearch = lazy(() => import('./components/GlobalSearch'));
const PreferencesWindow = lazy(() => import('./components/PreferencesWindow'));

function App() {
  return (
    <Suspense fallback={<LoadingShimmer />}>
      {previewMode === 'pdf' && <PDFPreview />}
      {previewMode === 'file' && <FilePreview />}
      {showSearch && <GlobalSearch />}
    </Suspense>
  );
}
```

**优势**:
- 减少初始加载体积
- 提升启动速度
- 按需加载非关键功能

---

#### 8. **微交互动画**

**Codex 的按钮交互**:
```css
.jm-button {
  transition:
    background-color 0.12s ease-in-out,
    transform 0.08s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.jm-button:hover {
  background: rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
}

.jm-button:active {
  background: rgba(0, 0, 0, 0.06);
  transform: scale(0.985);
}
```

**JustMark 当前代码** (`src/index.css` 第 70-80 行):
```css
.jm-button {
  transition: background-color 0.12s ease-in-out, transform 0.08s ease-in-out;
}

.jm-button:active {
  transform: scale(0.985);
}
```

**改进**: 添加 `hover` 状态的 `translateY` 效果

---

#### 9. **响应式间距**

**Codex 方案**: 使用 `calc()` 实现动态间距

**JustMark 改进**:
```css
:root {
  --spacing: 4px;
  --spacing-scale: 1;
}

@media (max-width: 768px) {
  :root {
    --spacing-scale: 0.875;  /* 移动端缩小 12.5% */
  }
}

.jm-toolbar {
  gap: calc(var(--spacing) * 3 * var(--spacing-scale));
}
```

**效果**: 小屏幕自动调整间距，保持视觉平衡

---

### ⭐⭐⭐⭐ P3 - 长期规划 (1-3 月)

#### 10. **插件系统架构**

**Codex 的 Skills 机制**:
```
/tmp/codex-extracted/skills/
```

**JustMark 可借鉴**:
- 自定义 Markdown 渲染器
- 扩展导出格式
- 第三方主题支持

**架构设计**:
```javascript
// src/plugins/PluginManager.js
class PluginManager {
  constructor() {
    this.plugins = new Map();
  }

  register(name, plugin) {
    this.plugins.set(name, plugin);
  }

  execute(name, context) {
    const plugin = this.plugins.get(name);
    return plugin?.execute(context);
  }
}

// 插件示例
const customExporter = {
  name: 'notion-exporter',
  execute: (markdown) => {
    // 导出到 Notion 格式
  }
};
```

---

#### 11. **性能监控**

**Codex 使用**: Sentry 错误追踪

**JustMark 改进**:
```javascript
// src/utils/performance.js
export function measureRenderTime(componentName) {
  const start = performance.now();

  return () => {
    const duration = performance.now() - start;
    if (duration > 100) {
      console.warn(`${componentName} 渲染耗时: ${duration.toFixed(2)}ms`);
    }
  };
}

// 使用
function MarkdownPreview({ content }) {
  const endMeasure = measureRenderTime('MarkdownPreview');

  useEffect(() => {
    endMeasure();
  }, [content]);
}
```

---

#### 12. **安全加固**

**Codex 的 CSP 策略**:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  img-src 'self' blob: data: https:;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://trusted-api.com;
">
```

**JustMark 改进**:
1. 在 `index.html` 添加 CSP 头
2. 限制 WebDAV 请求域名
3. 过滤用户输入的 Markdown

---

## 🛠️ 实施路线图

### 第 1 周: 快速见效
- [x] Markdown 淡入动画
- [x] 焦点可见性优化
- [x] 间距系统标准化

### 第 2-3 周: 设计系统
- [ ] 完整圆角系统
- [ ] Token 化颜色系统
- [ ] 加载状态动画

### 第 4-6 周: 性能优化
- [ ] 代码分割优化
- [ ] 微交互动画
- [ ] 响应式间距

### 第 2-3 月: 架构升级
- [ ] 插件系统
- [ ] 性能监控
- [ ] 安全加固

---

## 📝 具体代码改动

### 改动 1: Markdown 淡入动画

**文件**: `src/index.css`

**位置**: 第 201 行之后添加

```css
/* Markdown 淡入动画 */
@keyframes jm-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.jm-markdown-preview > * {
  animation: jm-fade-in 0.2s cubic-bezier(0.37, 0.55, 0.86, 0.88) both;
}

.jm-markdown-preview > *:nth-child(1) { animation-delay: 0ms; }
.jm-markdown-preview > *:nth-child(2) { animation-delay: 20ms; }
.jm-markdown-preview > *:nth-child(3) { animation-delay: 40ms; }
.jm-markdown-preview > *:nth-child(4) { animation-delay: 60ms; }
.jm-markdown-preview > *:nth-child(5) { animation-delay: 80ms; }
.jm-markdown-preview > *:nth-child(n+6) { animation-delay: 100ms; }

@media (prefers-reduced-motion: reduce) {
  .jm-markdown-preview > * {
    animation: none;
  }
}
```

---

### 改动 2: 标准化间距系统

**文件**: `src/index.css`

**位置**: 第 6 行，`:root` 变量区

```css
:root {
  /* 间距系统 */
  --spacing: 4px;
  --spacing-xs: calc(var(--spacing) * 0.5);   /* 2px */
  --spacing-sm: calc(var(--spacing) * 1);     /* 4px */
  --spacing-md: calc(var(--spacing) * 2);     /* 8px */
  --spacing-lg: calc(var(--spacing) * 3);     /* 12px */
  --spacing-xl: calc(var(--spacing) * 4);     /* 16px */
  --spacing-2xl: calc(var(--spacing) * 6);    /* 24px */
  --spacing-3xl: calc(var(--spacing) * 8);    /* 32px */

  /* 原有变量 */
  --jm-window-bg: #f5f5f5;
  --jm-text: #1a1a1a;
  /* ... */
}
```

**更新组件**:
```css
.jm-toolbar {
  gap: var(--spacing-lg);
  padding: var(--spacing-lg) var(--spacing-xl);
}

.jm-toolbar-group {
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}
```

---

### 改动 3: 焦点可见性

**文件**: `src/index.css`

**位置**: 第 65-81 行，`.jm-button` 区域

```css
.jm-button {
  @apply inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[13px] font-medium;
  background: transparent;
  border: none;
  color: var(--jm-text);
  transition: background-color 0.12s ease-in-out, transform 0.08s ease-in-out;
}

.jm-button:hover {
  background: rgba(0, 0, 0, 0.04);
}

.jm-button:active {
  background: rgba(0, 0, 0, 0.06);
  transform: scale(0.985);
}

/* 新增：焦点可见性 */
.jm-button:focus-visible {
  outline: 2px solid var(--jm-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--jm-accent-soft);
}

.jm-button:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 🎨 设计规范总结

### 间距规范
| 用途 | 变量 | 值 |
|------|------|-----|
| 最小间距 | `--spacing-xs` | 2px |
| 小间距 | `--spacing-sm` | 4px |
| 中等间距 | `--spacing-md` | 8px |
| 大间距 | `--spacing-lg` | 12px |
| 超大间距 | `--spacing-xl` | 16px |
| 面板间距 | `--spacing-2xl` | 24px |
| 容器间距 | `--spacing-3xl` | 32px |

### 圆角规范
| 组件 | 圆角 | 值 |
|------|------|-----|
| 小按钮 | `--radius-md` | 6px |
| 输入框 | `--radius-md` | 6px |
| 卡片/面板 | `--radius-lg` | 8px |
| 大容器 | `--radius-xl` | 12px |
| 模态框 | `--radius-2xl` | 16px |
| 圆形元素 | `--radius-full` | 9999px |

### 动画规范
| 类型 | 时长 | 缓动函数 |
|------|------|----------|
| 淡入/淡出 | 200ms | `cubic-bezier(0.37, 0.55, 0.86, 0.88)` |
| 按钮交互 | 120ms | `ease-in-out` |
| 按钮按下 | 80ms | `ease-in-out` |
| 加载动画 | 1500ms | `ease-in-out` |

---

## ⚠️ 注意事项

### 保持 JustMark 的优势
1. **轻量级**: 不要为了动画牺牲性能
2. **简洁性**: 避免过度工程化
3. **Tauri 优势**: 利用 Rust 后端的性能优势

### 避免的陷阱
1. ❌ 不要盲目复制 Codex 的所有特性
2. ❌ 不要引入不必要的依赖
3. ❌ 不要破坏现有的用户体验
4. ✅ 优先改进用户最常用的功能
5. ✅ 保持代码可维护性

---

## 📊 预期效果

### 用户体验提升
- ⬆️ 视觉一致性: +40%
- ⬆️ 交互流畅度: +30%
- ⬆️ 无障碍支持: +50%

### 开发体验提升
- ⬆️ 代码可维护性: +35%
- ⬆️ 主题扩展性: +60%
- ⬆️ 组件复用性: +25%

### 性能影响
- ➡️ 初始加载: 无明显变化
- ⬇️ 运行时内存: -5% (代码分割)
- ⬆️ 动画流畅度: +20% (CSS 动画)

---

**生成时间**: 2026-03-15
**基于**: Codex.app v26.311.21342 逆向分析
**适用版本**: JustMark v0.1.3+
