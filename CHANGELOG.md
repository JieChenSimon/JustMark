# Changelog

All notable changes to JustMark will be documented in this file.

## [v0.0.1] - 2025-11-24

### Added
- 首个公开版本，包含分屏编辑/预览、深浅色模式、字体调节、PDF 导出等核心特性。
- 支持文件新建、打开、保存与文件夹浏览。
- 使用 Tailwind + React Markdown + Tauri 2.x 构建。

---

### Added

#### Core Features
- **PDF Export**: Export markdown content to PDF with one click
  - Uses html2canvas + jsPDF for high-quality rendering
  - Custom export button with "Cooking..." loading state
  - Automatic file save dialog integration

#### File Operations
- **New**: Create a new document with unsaved changes warning
- **Open**: Open markdown files (.md, .markdown, .txt)
  - File picker with format filters
  - Automatic content loading
- **Save**: Save current document
  - Auto-save to current file path
  - "Save As" dialog for new files
  - Visual indicator (*) for unsaved changes
  - Current filename display in toolbar

#### Editor Features
- **Split View**: Side-by-side markdown editor and live preview
- **Dark Mode**: Toggle between light and dark themes (🌙/🌞)
- **Font Size Control**:
  - Small (default)
  - Medium
  - Large
  - A-/A+ buttons for easy adjustment
- **Syntax Support**: GitHub Flavored Markdown (GFM)
  - Tables
  - Task lists
  - Strikethrough
  - Autolinks

#### UI/UX Improvements
- **Clean Interface**: Minimalist design with focus on content
- **macOS Integration**:
  - Proper window controls spacing
  - Native-looking toolbar
  - Frameless window design
- **Responsive Layout**: Adaptive interface elements
- **Typography**: Professional serif font for app title (Georgia)

### Design
- **Custom Logo**: Minimalist "J" letter design
  - SVG-based vector graphics
  - Generated for all platforms (PNG, ICNS, ICO)
  - High contrast dark theme (#1a1a1a background, white foreground)

### Technical
- **Framework**: Tauri 2.x + React 19 + Vite
- **Styling**: TailwindCSS with typography plugin
- **Plugins**:
  - @tauri-apps/plugin-dialog (file operations)
  - @tauri-apps/plugin-fs (file system access)
  - @tauri-apps/plugin-opener (external links)
  - @tauri-apps/plugin-shell (system integration)
- **Libraries**:
  - react-markdown (markdown rendering)
  - remark-gfm (GitHub Flavored Markdown)
  - html2canvas (DOM to image conversion)
  - jspdf (PDF generation)

### Permissions
- File system read/write for .md files
- Dialog for file picker and save operations
- Secure capability-based permission system

---

## Upcoming Features (Roadmap)

- [ ] Keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S)
- [ ] Auto-save functionality
- [ ] Recent files list
- [ ] Export to HTML
- [ ] Custom themes
- [ ] Markdown templates
- [ ] Word count statistics
- [ ] Find and replace
- [ ] Multi-tab support
- [ ] iCloud sync (macOS)

---

**Note**: This is the initial release of JustMark - a simple, focused markdown editor for macOS.
