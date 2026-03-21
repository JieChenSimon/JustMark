# JustMark 原生控件迁移方案（方案A）

## 目标
在保持Tauri跨平台架构的前提下，将关键UI组件替换为macOS原生控件，提升原生感和性能。

## 预期效果
- 内存占用降低 20-30%（从80-120MB → 60-90MB）
- 启动速度提升 30-40%（从1.2-2.0s → 0.8-1.4s）
- 原生感评分提升至 4.0/5.0（当前3.28/5.0）
- 保留跨平台能力（Windows/Linux）

---

## 当前进度（2025-03-21）

### ✅ 已完成
- **1.1 原生窗口装饰**：交通灯按钮、标题栏
- **1.2 原生菜单栏**：前端已实现
- **3.2 系统服务集成**：已添加到 Info.plist

### ⚠️ 已实现但禁用
- **2.1 原生工具栏**：因样式问题暂时禁用（代码保留在 `native_toolbar.rs`）

### ❌ 已删除
- **2.2 原生分割视图**：Tauri 2 架构不支持，已删除 `native_splitview.rs`

### 📊 性能基线
- Release 二进制大小：6.4 MB
- 详细报告：`PERFORMANCE_BASELINE.md`

---

## 实施阶段

### 第一阶段：窗口和菜单原生化（1周）

#### 1.1 原生窗口装饰
**目标**：使用macOS原生标题栏和交通灯按钮

**实现步骤**：
1. 修改 `src-tauri/tauri.conf.json`：
```json
{
  "tauri": {
    "windows": [{
      "decorations": true,
      "titleBarStyle": "overlay",
      "hiddenTitle": true
    }]
  }
}
```

2. 移除自定义交通灯按钮（`src/components/TrafficLights.jsx`）

3. 调整内容区域padding，避免被原生标题栏遮挡：
```css
/* src/App.css */
.app-container {
  padding-top: 28px; /* macOS标题栏高度 */
}
```

**验证标准**：
- ✅ 交通灯按钮悬停时显示图标（关闭/最小化/全屏）
- ✅ 双击标题栏可最大化/还原窗口
- ✅ 拖拽标题栏可移动窗口

---

#### 1.2 原生菜单栏
**目标**：实现macOS标准菜单栏（File/Edit/View/Help）

**实现步骤**：
1. 创建 `src-tauri/src/menu.rs`：
```rust
use tauri::{Menu, MenuItem, Submenu, CustomMenuItem, WindowMenuEvent, Manager};

pub fn build_menu() -> Menu {
    let file_menu = Submenu::new(
        "File",
        Menu::new()
            .add_item(CustomMenuItem::new("new", "New").accelerator("Cmd+N"))
            .add_item(CustomMenuItem::new("open", "Open...").accelerator("Cmd+O"))
            .add_item(CustomMenuItem::new("save", "Save").accelerator("Cmd+S"))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new("close", "Close").accelerator("Cmd+W"))
    );

    let edit_menu = Submenu::new(
        "Edit",
        Menu::new()
            .add_native_item(MenuItem::Undo)
            .add_native_item(MenuItem::Redo)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::Cut)
            .add_native_item(MenuItem::Copy)
            .add_native_item(MenuItem::Paste)
            .add_native_item(MenuItem::SelectAll)
    );

    let view_menu = Submenu::new(
        "View",
        Menu::new()
            .add_item(CustomMenuItem::new("toggle_sidebar", "Toggle Sidebar").accelerator("Cmd+B"))
            .add_item(CustomMenuItem::new("toggle_preview", "Toggle Preview").accelerator("Cmd+P"))
    );

    Menu::new()
        .add_submenu(file_menu)
        .add_submenu(edit_menu)
        .add_submenu(view_menu)
}

pub fn handle_menu_event(event: WindowMenuEvent) {
    match event.menu_item_id() {
        "new" => {
            event.window().emit("menu:new", ()).unwrap();
        }
        "open" => {
            event.window().emit("menu:open", ()).unwrap();
        }
        "save" => {
            event.window().emit("menu:save", ()).unwrap();
        }
        "toggle_sidebar" => {
            event.window().emit("menu:toggle_sidebar", ()).unwrap();
        }
        "toggle_preview" => {
            event.window().emit("menu:toggle_preview", ()).unwrap();
        }
        _ => {}
    }
}
```

2. 修改 `src-tauri/src/main.rs`：
```rust
mod menu;

fn main() {
    tauri::Builder::default()
        .menu(menu::build_menu())
        .on_menu_event(menu::handle_menu_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

3. 前端监听菜单事件（`src/App.jsx`）：
```javascript
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('menu:new', () => {
    handleNewFile();
  });

  return () => { unlisten.then(f => f()); };
}, []);
```

**验证标准**：
- ✅ 菜单栏显示在屏幕顶部（macOS标准位置）
- ✅ 快捷键正常工作（Cmd+N/O/S等）
- ✅ Edit菜单的Undo/Redo/Cut/Copy/Paste使用系统原生功能

---

### 第二阶段：工具栏和侧边栏原生化（1-2周）

#### 2.1 原生工具栏（NSToolbar）
**目标**：使用macOS原生工具栏替换当前的Web工具栏

**技术方案**：通过Tauri插件调用Objective-C

**实现步骤**：
1. 添加依赖到 `src-tauri/Cargo.toml`：
```toml
[dependencies]
cocoa = "0.25"
objc = "0.2"
```

2. 创建 `src-tauri/src/native_toolbar.rs`：
```rust
use cocoa::appkit::{NSToolbar, NSToolbarItem, NSWindow};
use cocoa::base::{id, nil};
use objc::{class, msg_send, sel, sel_impl};
use tauri::{Runtime, Window};

#[tauri::command]
pub fn setup_native_toolbar<R: Runtime>(window: Window<R>) -> Result<(), String> {
    unsafe {
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;

        // 创建工具栏
        let toolbar: id = msg_send![class!(NSToolbar), alloc];
        let toolbar: id = msg_send![toolbar, initWithIdentifier: NSString::from("MainToolbar")];

        // 设置工具栏样式
        let _: () = msg_send![toolbar, setDisplayMode: 2]; // Icon and Label

        // 添加到窗口
        let _: () = msg_send![ns_window, setToolbar: toolbar];

        Ok(())
    }
}
```

3. 注册命令到 `src-tauri/src/main.rs`：
```rust
mod native_toolbar;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            native_toolbar::setup_native_toolbar
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

4. 前端调用（`src/App.jsx`）：
```javascript
import { invoke } from '@tauri-apps/api/tauri';

useEffect(() => {
  if (window.__TAURI__) {
    invoke('setup_native_toolbar');
  }
}, []);
```

**验证标准**：
- ✅ 工具栏显示在窗口标题栏下方
- ✅ 工具栏按钮使用macOS原生样式
- ✅ 支持工具栏自定义（右键 → Customize Toolbar）

---

#### 2.2 原生侧边栏（NSSplitView）
**目标**：使用原生分割视图替换当前的CSS flex布局

**实现步骤**：
1. 创建 `src-tauri/src/native_splitview.rs`：
```rust
use cocoa::appkit::{NSSplitView, NSView};
use cocoa::base::{id, nil};
use objc::{class, msg_send, sel, sel_impl};
use tauri::{Runtime, Window};

#[tauri::command]
pub fn setup_native_splitview<R: Runtime>(window: Window<R>) -> Result<(), String> {
    unsafe {
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;
        let content_view: id = msg_send![ns_window, contentView];

        // 创建分割视图
        let split_view: id = msg_send![class!(NSSplitView), alloc];
        let split_view: id = msg_send![split_view, initWithFrame: msg_send![content_view, bounds]];

        // 设置为垂直分割
        let _: () = msg_send![split_view, setVertical: true];

        // 设置分割线样式
        let _: () = msg_send![split_view, setDividerStyle: 1]; // Thin divider

        // 添加到内容视图
        let _: () = msg_send![content_view, addSubview: split_view];

        Ok(())
    }
}
```

2. 调整前端布局（`src/App.jsx`）：
```javascript
// 移除CSS flex布局，改用绝对定位配合原生分割视图
<div className="app-container" style={{ position: 'relative' }}>
  <div id="sidebar" style={{ position: 'absolute', left: 0, width: '250px' }}>
    {/* 侧边栏内容 */}
  </div>
  <div id="editor" style={{ position: 'absolute', left: '250px', right: 0 }}>
    {/* 编辑器内容 */}
  </div>
</div>
```

**验证标准**：
- ✅ 分割线使用macOS原生样式（细线）
- ✅ 拖拽分割线时有原生动画效果
- ✅ 双击分割线可折叠/展开侧边栏

---

### 第三阶段：系统集成优化（1周）

#### 3.1 通知中心集成
**实现步骤**：
1. 使用Tauri通知API（`src/hooks/useNotification.js`）：
```javascript
import { sendNotification } from '@tauri-apps/api/notification';

export const useNotification = () => {
  const notify = async (title, body) => {
    await sendNotification({
      title,
      body,
      icon: 'icons/icon.png'
    });
  };

  return { notify };
};
```

2. 替换现有的Web Notification API调用

**验证标准**：
- ✅ 通知显示在macOS通知中心
- ✅ 点击通知可激活应用窗口
- ✅ 通知样式符合macOS规范

---

#### 3.2 系统服务集成
**实现步骤**：
1. 添加Services支持到 `Info.plist`（通过Tauri配置）：
```json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "infoPlist": {
          "NSServices": [{
            "NSMenuItem": {
              "default": "Open in JustMark"
            },
            "NSMessage": "openInJustMark",
            "NSSendTypes": ["public.plain-text"]
          }]
        }
      }
    }
  }
}
```

**验证标准**：
- ✅ 在其他应用中选中文本 → 右键 → Services → Open in JustMark

---

### 第四阶段：性能优化和测试（1周）

#### 4.1 性能对比测试
**测试项目**：
1. 内存占用（Activity Monitor）
2. 启动速度（`time open -a JustMark`）
3. CPU使用率（编辑时）
4. 响应延迟（输入到渲染）

**目标指标**：
- 内存：< 90MB（空闲状态）
- 启动：< 1.4s（冷启动）
- CPU：< 8%（编辑时）
- 延迟：< 20ms（输入响应）

---

#### 4.2 兼容性测试
**测试平台**：
- macOS 13 Ventura
- macOS 14 Sonoma
- macOS 15 Sequoia

**测试项目**：
- 原生菜单栏功能
- 工具栏显示
- 分割视图拖拽
- 通知中心集成

---

## 技术风险和缓解措施

### 风险1：Objective-C FFI复杂度
**缓解措施**：
- 使用成熟的`cocoa` crate
- 参考Tauri官方示例
- 逐步迁移，保留Web实现作为fallback

### 风险2：跨平台兼容性
**缓解措施**：
- 使用条件编译（`#[cfg(target_os = "macos")]`）
- Windows/Linux保持Web实现
- 统一的前端API接口

### 风险3：调试困难
**缓解措施**：
- 添加详细日志（`tracing` crate）
- 使用Xcode Instruments profiling
- 保留Web DevTools调试能力

---

## 实施时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| 第一阶段 | 窗口和菜单原生化 | 1周 | 开发者 |
| 第二阶段 | 工具栏和侧边栏原生化 | 1-2周 | 开发者 |
| 第三阶段 | 系统集成优化 | 1周 | 开发者 |
| 第四阶段 | 性能优化和测试 | 1周 | 开发者 + 测试 |
| **总计** | | **4-5周** | |

---

## 成功标准

### 功能完整性
- ✅ 所有现有功能正常工作
- ✅ 原生菜单栏完整实现
- ✅ 原生工具栏和侧边栏正常显示
- ✅ 通知中心集成成功

### 性能提升
- ✅ 内存占用降低 ≥ 20%
- ✅ 启动速度提升 ≥ 30%
- ✅ CPU使用率降低 ≥ 15%

### 用户体验
- ✅ 原生感评分 ≥ 4.0/5.0
- ✅ 无明显UI闪烁或卡顿
- ✅ 快捷键和手势正常工作

### 跨平台兼容
- ✅ Windows/Linux版本正常运行
- ✅ 代码可维护性良好
- ✅ 构建流程无额外复杂度

---

## 后续优化方向

### 短期（1-2月）
1. 实现原生文件选择器（NSOpenPanel）
2. 优化滚动性能（使用原生滚动视图）
3. 添加Touch Bar支持

### 中期（3-6月）
1. 实现Quick Look预览
2. Spotlight搜索集成
3. iCloud同步支持

### 长期（6-12月）
1. 探索SwiftUI混合架构
2. 原生Markdown渲染引擎
3. 完整的macOS系统集成
