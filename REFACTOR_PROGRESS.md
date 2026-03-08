# App.jsx 拆分进度

## 目标
将 2642 行的 App.jsx 拆分为多个小模块，提高可维护性。

## 已创建的模块

### Hooks
- ✅ `useMarkdownEditor.js` - 编辑器逻辑（格式化、图片粘贴）
- ✅ `useFileOperations.js` - 文件操作（打开、保存、加载文件夹）
- ✅ `useKeyboardShortcuts.js` - 快捷键处理

### Components
- ✅ `AppHeader.jsx` - 顶部工具栏
- ✅ `FileSidebar.jsx` - 文件侧边栏
- ✅ `PreviewPanel.jsx` - 预览面板

### Utils
- ✅ `fileHelpers.js` - 文件工具函数（标签、排序、扩展名）

## 下一步
1. 创建简化版 App.jsx 集成所有模块
2. 测试功能完整性
3. 删除冗余代码

## 预期效果
- App.jsx: 2642 行 → ~500 行
- 代码模块化，易于维护
- 功能保持不变
