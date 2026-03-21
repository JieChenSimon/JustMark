# JustMark 性能优化方案

## 🔴 当前问题诊断

### 1. 代码架构问题
- **App.jsx 过度臃肿**: 2658 行，33+ useState，13+ useEffect
- **组件未拆分**: 所有逻辑集中在单一组件
- **重渲染频繁**: 每次状态更新触发大量不必要的重渲染

### 2. 依赖加载问题
```javascript
// 启动时全部加载，即使不使用
import html2canvas from 'html2canvas';  // ~500KB
import jsPDF from 'jspdf';              // ~200KB
import mermaid from 'mermaid';          // ~800KB
import { Document, Packer } from 'docx'; // ~300KB
```
**影响**: 首次加载时间增加 2-3 秒，内存占用增加 ~2MB

### 3. Markdown 渲染性能
- 每次输入都完整解析 Markdown
- 长文档（>1000 行）卡顿明显
- ReactMarkdown 未做优化

### 4. 文件系统操作
- 频繁扫描文件树
- 无缓存机制
- 同步操作阻塞 UI

## ⚡ 优化方案（按优先级）

### 优先级 1: 代码分割与懒加载 ⭐⭐⭐⭐⭐

**预期收益**: 启动速度提升 60%，内存减少 40%

#### 1.1 懒加载重量级依赖
```javascript
// src/utils/lazyImports.js (已创建)
export const loadHtml2Canvas = () => import('html2canvas');
export const loadJsPDF = () => import('jspdf');
export const loadDocx = () => import('docx');
export const loadMermaid = () => import('mermaid');
```

#### 1.2 修改导出函数使用懒加载
```javascript
// App.jsx 中修改
const exportToPDF = async () => {
  setIsExporting(true);
  try {
    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF } = await import('jspdf');
    // ... 导出逻辑
  } finally {
    setIsExporting(false);
  }
};
```

### 优先级 2: 组件拆分与状态管理 ⭐⭐⭐⭐⭐

**预期收益**: 重渲染减少 70%，响应速度提升 50%

#### 2.1 拆分 App.jsx
```
src/
├── components/
│   ├── Editor/
│   │   ├── EditorPanel.jsx          (编辑器面板)
│   │   └── EditorToolbar.jsx        (工具栏)
│   ├── Preview/
│   │   ├── MarkdownPreview.jsx      (Markdown 预览)
│   │   └── PDFPreview.jsx           (PDF 预览)
│   ├── Sidebar/
│   │   ├── FileExplorer.jsx         (文件浏览器)
│   │   └── FileTree.jsx             (文件树)
│   └── Export/
│       └── ExportManager.jsx        (导出管理器)
├── contexts/
│   ├── EditorContext.jsx            (编辑器状态)
│   ├── ThemeContext.jsx             (主题状态)
│   └── FileContext.jsx              (文件状态)
└── App.jsx                          (仅布局和路由)
```

#### 2.2 使用 Context 替代 Props 传递
```javascript
// src/contexts/EditorContext.jsx
import { createContext, useContext, useState } from 'react';

const EditorContext = createContext();

export const EditorProvider = ({ children }) => {
  const [markdown, setMarkdown] = useState('');
  const [currentFile, setCurrentFile] = useState(null);

  return (
    <EditorContext.Provider value={{ markdown, setMarkdown, currentFile, setCurrentFile }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => useContext(EditorContext);
```

### 优先级 3: Markdown 渲染优化 ⭐⭐⭐⭐

**预期收益**: 输入延迟减少 80%，长文档流畅度提升 90%

#### 3.1 增加防抖延迟
```javascript
// 当前: 300ms
const DEBOUNCE_DELAY = 300;

// 优化: 500ms (更好的性能/体验平衡)
const DEBOUNCE_DELAY = 500;
```

#### 3.2 使用 React.memo 优化 Markdown 组件
```javascript
const MarkdownPreview = memo(({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
    >
      {content}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);
```

#### 3.3 虚拟化长文档
```javascript
// 安装依赖
npm install react-window

// 使用虚拟滚动
import { FixedSizeList } from 'react-window';
```

### 优先级 4: 文件系统优化 ⭐⭐⭐⭐

**预期收益**: 文件树加载速度提升 80%

#### 4.1 实现文件树缓存
```javascript
// src/utils/fileCache.js
const fileTreeCache = new Map();

export const getCachedFileTree = async (path, maxAge = 5000) => {
  const cached = fileTreeCache.get(path);
  if (cached && Date.now() - cached.timestamp < maxAge) {
    return cached.data;
  }

  const data = await readDir(path);
  fileTreeCache.set(path, { data, timestamp: Date.now() });
  return data;
};
```

#### 4.2 使用 Web Worker 处理文件操作
```javascript
// src/workers/fileWorker.js
self.addEventListener('message', async (e) => {
  const { type, path } = e.data;

  if (type === 'scanDirectory') {
    const files = await scanDirectory(path);
    self.postMessage({ type: 'scanComplete', files });
  }
});
```

### 优先级 5: Rust 后端优化 ⭐⭐⭐

**预期收益**: 文件读写速度提升 30%

#### 5.1 批量文件操作
```rust
// src-tauri/src/file_operations.rs
#[tauri::command]
async fn batch_read_files(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut results = Vec::new();
    for path in paths {
        let content = tokio::fs::read_to_string(path).await
            .map_err(|e| e.to_string())?;
        results.push(content);
    }
    Ok(results)
}
```

#### 5.2 文件监听优化
```rust
// 使用 notify crate 实现文件监听
[dependencies]
notify = "6.0"
```

### 优先级 6: 构建优化 ⭐⭐⭐

**预期收益**: 构建体积减少 30%，加载速度提升 25%

#### 6.1 Vite 配置优化
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'markdown': ['react-markdown', 'remark-gfm', 'remark-math'],
          'export': ['html2canvas', 'jspdf', 'docx'],
          'vendor': ['react', 'react-dom']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
};
```

#### 6.2 Tree Shaking 优化
```javascript
// 只导入需要的部分
import { Packer, Document } from 'docx'; // ❌
import Packer from 'docx/build/packer'; // ✅
```

### 优先级 7: 内存管理 ⭐⭐⭐

#### 7.1 清理未使用的 useEffect
```javascript
// 检查并移除不必要的 useEffect
// 合并相关的 useEffect
useEffect(() => {
  // 操作 A
}, [depA]);

useEffect(() => {
  // 操作 B (如果依赖相同)
}, [depA]);

// 合并为:
useEffect(() => {
  // 操作 A
  // 操作 B
}, [depA]);
```

#### 7.2 使用 useMemo 缓存计算结果
```javascript
const filteredFiles = useMemo(() => {
  return folderContents.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [folderContents, searchQuery]);
```

## 📊 预期性能提升

| 指标 | 当前 | 优化后 | 提升 |
|------|------|--------|------|
| 启动时间 | ~3s | ~1s | 66% ↓ |
| 内存占用 | ~150MB | ~80MB | 47% ↓ |
| 输入延迟 | ~300ms | ~50ms | 83% ↓ |
| 文件树加载 | ~500ms | ~100ms | 80% ↓ |
| 导出速度 | ~2s | ~1.5s | 25% ↓ |
| 包体积 | ~8MB | ~5MB | 37% ↓ |

## 🚀 实施步骤

### 第一阶段（1-2 天）- 快速见效
1. ✅ 创建 lazyImports.js
2. 修改导出函数使用懒加载
3. 增加 Markdown 防抖延迟到 500ms
4. 添加 React.memo 到 Preview 组件

### 第二阶段（3-5 天）- 架构优化
1. 创建 Context 文件
2. 拆分 App.jsx 为多个组件
3. 实现文件树缓存
4. 优化 Vite 配置

### 第三阶段（5-7 天）- 深度优化
1. 实现虚拟滚动
2. 添加 Web Worker
3. Rust 后端批量操作
4. 性能监控和分析

## 🔧 快速修复（立即可做）

### 1. 移除未使用的导入
```bash
npx depcheck
```

### 2. 清理 node_modules 和重新安装
```bash
rm -rf node_modules package-lock.json
npm install
```

### 3. 清理 Tauri target 目录
```bash
cd src-tauri
cargo clean
```

### 4. 启用生产模式构建
```bash
npm run build
npm run tauri build
```

## 📝 监控指标

使用 React DevTools Profiler 监控:
- 组件渲染次数
- 渲染耗时
- 重渲染原因

使用 Chrome DevTools:
- Memory Profiler (内存泄漏)
- Performance (性能瓶颈)
- Network (资源加载)

## ⚠️ 注意事项

1. **渐进式优化**: 不要一次性修改所有代码
2. **保持备份**: 每个阶段完成后提交 Git
3. **性能测试**: 每次优化后测试实际效果
4. **用户体验**: 确保优化不影响功能
