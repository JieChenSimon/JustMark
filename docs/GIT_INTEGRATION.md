# Git 集成功能说明

## 概述

JustMark 现在集成了优雅的 Git 源代码管理功能，采用 macOS 设计风格，类似 VSCode 的布局但更加简洁美观。

## 功能特性

### 🎨 设计风格
- **Apple 设计语言**：遵循 macOS 的视觉规范和交互模式
- **毛玻璃效果**：backdrop-blur 提供现代感的半透明效果
- **流畅动画**：所有交互都有精心设计的过渡动画
- **SF Symbols 风格图标**：清晰易懂的视觉符号

### 📁 侧边栏布局
- **左侧图标导航**：类似 VSCode 的垂直图标栏
  - 📁 文件浏览器图标
  - 🔧 Git 源代码管理图标（带更改数量徽章）
- **右侧内容面板**：根据选择的图标显示不同内容
  - 文件树视图
  - Git 更改列表

### 🔄 Git 功能

#### 1. 状态显示
- **实时更新**：自动检测文件更改
- **颜色标识**：
  - 🟢 绿色 (U/A)：未跟踪/新增文件
  - 🟠 橙色 (M/S)：已修改/已暂存文件
  - 🔴 红色 (D)：已删除文件
- **分支信息**：显示当前分支名称和更改数量

#### 2. 文件操作
- **Stage（暂存）**：
  - 单个文件：点击文件旁的 `+` 按钮
  - 全部文件：点击 "Stage All" 按钮
- **Unstage（取消暂存）**：
  - 单个文件：点击文件旁的 `-` 按钮
  - 全部文件：点击 "Unstage All" 按钮
- **Discard（丢弃更改）**：
  - 鼠标悬停在未暂存的文件上，点击 `×` 按钮

#### 3. 提交更改
1. 暂存需要提交的文件
2. 点击 "Commit" 按钮
3. 输入提交信息
4. 点击 "Commit" 完成提交

## 使用方法

### 启用 Git 功能
1. 打开一个包含 Git 仓库的文件夹（File → Open → Folder）
2. 侧边栏会自动显示
3. 点击左侧的 Git 图标切换到源代码管理视图

### 查看文件更改
- Git 图标上的蓝色徽章显示更改的文件数量
- 切换到 Git 视图后可以看到：
  - **Staged Changes**：已暂存的更改
  - **Changes**：未暂存的更改

### 快速操作
- 所有操作都采用直观的图标按钮
- 悬停时显示工具提示
- 点击时有视觉反馈（active:scale-95）

## 技术实现

### 架构
```
src/
├── hooks/
│   └── useGit.js          # Git 操作 Hook（使用 Tauri Shell）
├── components/
│   └── GitPanel.jsx       # Git UI 组件
└── App.jsx               # 主应用（集成 Git 功能）
```

### 依赖
- `@tauri-apps/plugin-shell`：执行 Git 命令
- Tauri Shell 权限配置在 `src-tauri/tauri.conf.json`

### Git 命令
所有 Git 操作通过 Tauri 的 Shell 插件安全执行：
- `git status --porcelain -u`：获取文件状态
- `git branch --show-current`：获取当前分支
- `git add <file>`：暂存文件
- `git reset HEAD <file>`：取消暂存
- `git commit -m "<message>"`：提交更改
- `git checkout -- <file>`：丢弃更改

## UI 细节

### macOS 风格特征
1. **毛玻璃效果**：`backdrop-blur-xl` + 半透明背景
2. **渐变背景**：`bg-gradient-to-b` 在头部区域
3. **圆角按钮**：`rounded-lg` 柔和的视觉效果
4. **悬停效果**：`hover:bg-gray-200/50` 轻微的背景变化
5. **活动反馈**：`active:scale-95` 微妙的按压效果
6. **阴影效果**：`shadow-md` 提供深度感

### 颜色系统
- **主色调**：Apple Blue (`#007AFF`)
- **成功色**：Apple Green (`#34C759`)
- **警告色**：Apple Orange (`#FF9F0A`)
- **危险色**：Apple Red (`#FF3B30`)
- **中性色**：Apple Gray (`#8E8E93`)

## 快捷键
目前 Git 功能通过界面操作，未来可以添加：
- `Cmd+Shift+G`：切换到 Git 视图
- `Cmd+Enter`：快速提交
- `Cmd+K`：打开提交输入框

## 注意事项
1. 需要系统安装 Git 命令行工具
2. 只在打开包含 `.git` 目录的文件夹时可用
3. 提交操作不会自动 push 到远程仓库
4. 建议先在终端配置好 Git 用户信息

## 未来改进
- [ ] 添加 Git diff 视图
- [ ] 支持分支切换
- [ ] 集成 Git 历史记录
- [ ] 支持 Pull/Push 操作
- [ ] 添加冲突解决界面
- [ ] 支持 .gitignore 规则显示
