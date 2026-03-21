# JustMark 快捷键功能

## 已实现的快捷键

### 文件操作
- `Cmd/Ctrl + N` - 新建文档
- `Cmd/Ctrl + O` - 打开文件/文件夹
- `Cmd/Ctrl + S` - 保存当前文件
- `Cmd/Ctrl + Shift + S` - 另存为
- `Cmd/Ctrl + W` - 关闭当前文件

### 文本格式化
- `Cmd/Ctrl + B` - 加粗（**文本**）
- `Cmd/Ctrl + I` - 斜体（*文本*）
- `Cmd/Ctrl + U` - 删除线（~~文本~~）
- `Cmd/Ctrl + K` - 插入链接（[文本](url)）

### 搜索
- `Cmd/Ctrl + F` - 打开搜索/替换面板

## 实现细节

### 文本格式化逻辑
1. **有选中文本**：在选中文本两侧添加格式标记
2. **无选中文本**：插入空格式标记，光标定位在中间

### 文件关闭逻辑
- 如果有未保存更改，会弹出确认对话框
- 确认后清空编辑器内容和文件路径

## 技术实现

### 新增文件
- `src/utils/textFormat.js` - 文本格式化工具函数

### 修改文件
- `src/App.jsx` - 添加 `handleFormatText` 和 `handleCloseFile` 函数
- `src/App.jsx` - 增强快捷键处理逻辑
- `src/components/EditorArea.jsx` - 暴露 `getSelection` 和 `setSelection` 方法

## 使用示例

### 格式化选中文本
1. 选中要格式化的文本
2. 按下对应快捷键（如 Cmd+B）
3. 文本自动添加格式标记

### 插入空格式
1. 将光标放在要插入的位置
2. 按下对应快捷键
3. 插入空格式标记，光标定位在中间，可直接输入

### 插入链接
1. 选中链接文本（可选）
2. 按 Cmd+K
3. 自动生成 `[文本](url)` 格式
4. 光标定位在 url 位置，可直接输入链接

## 跨平台支持

- macOS: 使用 `Cmd` 键
- Windows/Linux: 使用 `Ctrl` 键
- 自动检测操作系统并使用正确的修饰键
