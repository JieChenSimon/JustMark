import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile, readTextFile, readDir, remove, mkdir, rename } from '@tauri-apps/plugin-fs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useWebClipper } from './hooks/useWebClipper';
import { useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import { useWindowManager } from './hooks/useWindowManager';
import { useAutoSave } from './hooks/useAutoSave';
import { useRecentFiles } from './hooks/useRecentFiles';
import { useWordCount } from './hooks/useWordCount';
import { useLocalStorage } from './hooks/useLocalStorage';
import useWebDAVSync from './hooks/useWebDAVSync';
import PreviewColorPicker from './components/PreviewColorPicker';
import EditorArea from './components/EditorArea';
import ConfirmDialog from './components/ConfirmDialog';
import WebDAVSettings from './components/WebDAVSettings';
import TableOfContents from './components/TableOfContents';
import { remarkObsidianImage } from './utils/remarkObsidianImage';
import { FileTreeItem, InlineCreateRow } from './components/sidebar/FileTreeItem';

import { HEADER_HEIGHT, FONT_FAMILIES, FONT_OPTIONS, BACKGROUND_COLORS } from './constants/theme';

// macOS Finder 风格彩色标签
const TAG_COLORS = [
  { name: 'red', color: '#FF3B30' },
  { name: 'orange', color: '#FF9500' },
  { name: 'yellow', color: '#FFCC00' },
  { name: 'green', color: '#34C759' },
  { name: 'blue', color: '#007AFF' },
  { name: 'purple', color: '#AF52DE' },
  { name: 'gray', color: '#8E8E93' }
];

const getTagColor = (tagName) => {
  const hash = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[hash % TAG_COLORS.length].color;
};

function App() {
  // 调试：检查 Tauri 环境
  useEffect(() => {
    console.log('🔍 JustMark 调试信息:');
    console.log('  - 是否在 Tauri 环境:', window.__TAURI__ !== undefined);
    console.log('  - User Agent:', navigator.userAgent);
    console.log('  - Platform:', navigator.platform);

    // 测试拖动区域
    const header = document.querySelector('header[data-tauri-drag-region]');
    if (header) {
      const style = window.getComputedStyle(header);
      console.log('  - Header 拖动样式:', {
        webkitAppRegion: style.webkitAppRegion || style['-webkit-app-region'],
        appRegion: style.appRegion
      });
    }
  }, []);

  const [markdown, setMarkdown] = useState("### JustMark\n Write in a single way...");
  const [debouncedMarkdown, setDebouncedMarkdown] = useState(markdown);

  // === 主题管理 ===
  const theme = useTheme();
  const {
    isDarkMode, setIsDarkMode,
    fontIndex, setFontIndex,
    fontFamilyIndex, setFontFamilyIndex,
    bgColorIndex, setBgColorIndex,
    previewBgColorIndex, setPreviewBgColorIndex,
    showFontMenu, setShowFontMenu,
    showBgColorMenu, setShowBgColorMenu,
    showPreviewBgColorMenu, setShowPreviewBgColorMenu,
    showBgColorWarning, setShowBgColorWarning,
    currentFont, currentFontFamily, currentBgColor,
    appBgColor, appTextColor,
    previewBgColor, previewTextColor,
    toggleTheme,
    increaseFontSize, decreaseFontSize,
  } = theme;

  // === 设置管理 ===
  const { 
    attachmentFolder, setAttachmentFolder, 
    showSettingsDialog, setShowSettingsDialog,
    autoSaveEnabled, setAutoSaveEnabled,
    fileSortBy, setFileSortBy
  } = useSettings();

  // === 最近文件管理 ===
  const { recentFiles, addRecentFile, clearRecentFiles } = useRecentFiles();

  // === 字数统计 ===
  const { chars, words, lines } = useWordCount(markdown);

  // === 窗口面板管理 ===
  const {
    sidebarWidth, setSidebarWidth,
    editorWidth, setEditorWidth,
    isDraggingSidebar, setIsDraggingSidebar,
    isDraggingEditor, setIsDraggingEditor,
  } = useWindowManager();

  const [isExporting, setIsExporting] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useLocalStorage('currentFilePath', null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [fileTags, setFileTags] = useLocalStorage('justmark_file_tags', {});
  const [tagMenuOpen, setTagMenuOpen] = useState(null);
  
  const [previewMode, setPreviewMode] = useLocalStorage('previewMode', 'markdown');
  const [showIndicator, setShowIndicator] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useLocalStorage('sidebarVisible', false);
  const [currentFolder, setCurrentFolder] = useLocalStorage('currentFolder', null);
  const [folderContents, setFolderContents] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderRefreshTimestamps, setFolderRefreshTimestamps] = useState({});
  const indicatorTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);


  const [pdfScale, setPdfScale] = useState(1);
  const pdfContainerRef = useRef(null);
  const previewSectionRef = useRef(null);
  const editorAreaRef = useRef(null);

  // Web Clipper
  const { clipFromSelection, isClipping, error: clipError, clearError: clearClipError } = useWebClipper();
  const [showClipError, setShowClipError] = useState(false);

  // Preview panel visibility
  const [previewVisible, setPreviewVisible] = useLocalStorage('previewVisible', true);

  // TOC visibility
  const [tocVisible, setTocVisible] = useLocalStorage('tocVisible', false);

  // Last saved timestamp
  const [lastSaved, setLastSaved] = useState(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    position: null
  });

  // WebDAV state
  const [showWebDAVSettings, setShowWebDAVSettings] = useState(false);
  const { syncing, syncToWebDAV } = useWebDAVSync();

  // 处理编辑器滚动同步到预览区
  const handleEditorScroll = (scrollPercentage) => {
    if (previewSectionRef.current && !isNaN(scrollPercentage)) {
      const preview = previewSectionRef.current;
      const maxScroll = preview.scrollHeight - preview.clientHeight;
      preview.scrollTo({
        top: maxScroll * scrollPercentage,
        behavior: 'auto'
      });
    }
  };

  // 处理预览区点击跳转到编辑器
  const handlePreviewClickToJump = (e) => {
    if (previewMode !== 'markdown' || !previewSectionRef.current || !editorAreaRef.current) {
      return;
    }
    const preview = previewSectionRef.current;
    const scrollPercentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    if (editorAreaRef.current.scrollToPercentage) {
      editorAreaRef.current.scrollToPercentage(scrollPercentage);
    }
  };

  // 目录上下文 & 内联新建
  const [selectedSidebarEntry, setSelectedSidebarEntry] = useState(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef(null);
  const [inlineCreate, setInlineCreate] = useState(null);
  const inlineCreateInputRef = useRef(null);

  // 文件搜索
  const [fileSearchQuery, setFileSearchQuery] = useState('');

  // PDF 自动缩放以适应窗口和拖动
  useEffect(() => {
    if (previewMode !== 'pdf' || !pdfContainerRef.current) return;

    const updatePdfScale = () => {
      const container = pdfContainerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      // A4纸张宽度 210mm,换算为像素 (1mm ≈ 3.7795px)
      const pdfWidth = 210 * 3.7795; // 约793px

      // 计算缩放比例,让PDF始终填满容器宽度
      const scale = containerWidth / pdfWidth;
      setPdfScale(scale);
    };

    updatePdfScale();

    // 使用 ResizeObserver 监听容器宽度变化（用于拖动分隔符时的自适应）
    const resizeObserver = new ResizeObserver(() => {
      updatePdfScale();
    });

    resizeObserver.observe(pdfContainerRef.current);
    window.addEventListener('resize', updatePdfScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePdfScale);
    };
  }, [previewMode]);

  // 文件拖拽打开
  useEffect(() => {
    const handleDrop = async (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      
      if (file.name.endsWith('.md')) {
        const content = await readTextFile(file.path);
        setMarkdown(content);
        setCurrentFilePath(file.path);
        setHasUnsavedChanges(false);
        addRecentFile(file.path);
      } else if (file.type === '') {
        // 可能是文件夹
        setCurrentFolder(file.path);
        await loadFolderContents(file.path);
      }
    };
    
    const handleDragOver = (e) => e.preventDefault();
    
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    
    return () => {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [addRecentFile]);

  // 窗口关闭前的未保存警告
  useEffect(() => {
    const handleBeforeUnload = async (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 显示指示器并设置自动隐藏
  const showPreviewIndicator = () => {
    setShowIndicator(true);

    // 清除之前的定时器
    if (indicatorTimeoutRef.current) {
      clearTimeout(indicatorTimeoutRef.current);
    }

    // 5秒后自动隐藏
    indicatorTimeoutRef.current = setTimeout(() => {
      setShowIndicator(false);
    }, 5000);
  };

  // 切换预览模式
  const togglePreviewMode = () => {
    setPreviewMode(previewMode === 'markdown' ? 'pdf' : 'markdown');
    showPreviewIndicator();
  };

  // 平滑调整窗口大小的辅助函数
  const smoothResizeWindow = async (targetWidth, targetHeight, duration = 500) => {
    try {
      const appWindow = getCurrentWindow();
      const currentSize = await appWindow.innerSize();

      const startWidth = currentSize.width;
      const startHeight = currentSize.height;
      const startTime = performance.now();

      // 使用 ease-in-out cubic 缓动函数，更明显的动画效果
      const easeInOutCubic = (t) => {
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      const animate = async (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        const newWidth = Math.round(startWidth + (targetWidth - startWidth) * easedProgress);
        const newHeight = Math.round(startHeight + (targetHeight - startHeight) * easedProgress);

        await appWindow.setSize({ width: newWidth, height: newHeight });

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } catch (error) {
      console.error('平滑调整窗口大小失败:', error);
    }
  };

  // 切换预览可见性并调整窗口大小
  const togglePreviewVisibility = async () => {
    const newVisible = !previewVisible;
    setPreviewVisible(newVisible);

    try {
      const appWindow = getCurrentWindow();
      const currentSize = await appWindow.innerSize();

      // 假设预览区宽度约为窗口宽度的 40%
      const widthChange = Math.floor(currentSize.width * 0.4);

      let targetWidth;
      if (!newVisible) {
        // 关闭预览：缩小窗口
        targetWidth = currentSize.width - widthChange;
      } else {
        // 打开预览：扩大窗口
        targetWidth = currentSize.width + widthChange;
      }

      // 使用平滑动画调整窗口大小
      await smoothResizeWindow(targetWidth, currentSize.height);
    } catch (error) {
      console.error('调整窗口大小失败:', error);
    }
  };

  // 点击预览区显示指示器
  const handlePreviewClick = () => {
    showPreviewIndicator();
  };

  // 组件挂载时显示指示器，模式切换时也显示
  useEffect(() => {
    showPreviewIndicator();
  }, [previewMode]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (indicatorTimeoutRef.current) {
        clearTimeout(indicatorTimeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  // 监听新建菜单的外部点击关闭
  useEffect(() => {
    if (!showNewMenu) return;

    const handleClickOutside = (e) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) {
        setShowNewMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewMenu]);

  // 监听标签菜单的外部点击关闭
  // 点击外部关闭标签菜单
  useEffect(() => {
    if (!tagMenuOpen) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest('.tag-menu')) {
        setTagMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tagMenuOpen]);

  // 当切换根目录时重置选择和菜单状态
  useEffect(() => {
    setShowNewMenu(false);
    if (currentFolder) {
      setSelectedSidebarEntry({ path: currentFolder, isDirectory: true });
    } else {
      setSelectedSidebarEntry(null);
    }
    setInlineCreate(null);
  }, [currentFolder]);

  // 内联输入自动聚焦
  useEffect(() => {
    if (inlineCreate && inlineCreateInputRef.current) {
      inlineCreateInputRef.current.focus();
      inlineCreateInputRef.current.select();
    }
  }, [inlineCreate?.parentPath, inlineCreate?.type]);

  // 监听点击其他区域取消内联创建
  useEffect(() => {
    if (!inlineCreate) return;

    const handleClickOutside = (e) => {
      // 如果点击的是输入框或其父元素，不取消
      if (inlineCreateInputRef.current &&
        (e.target === inlineCreateInputRef.current ||
          inlineCreateInputRef.current.contains(e.target))) {
        return;
      }

      // 检查是否点击在以下任意区域，都应该取消创建：
      // 1. 侧边栏内（但不是输入框）
      const sidebarElement = document.querySelector('.flex-1.overflow-y-auto.overflow-x-hidden.py-1');
      if (sidebarElement && sidebarElement.contains(e.target)) {
        cancelInlineCreate();
        return;
      }

      // 2. 编辑器文本区域
      const editorElement = document.querySelector('textarea');
      if (editorElement && (e.target === editorElement || editorElement.contains(e.target))) {
        cancelInlineCreate();
        return;
      }

      // 3. 预览区域（包括 Markdown 和 PDF 模式）
      const previewSections = document.querySelectorAll('main > section');
      for (const section of previewSections) {
        if (section.contains(e.target)) {
          // 检查是否是预览区（不包含侧边栏的 section）
          const hasSidebar = section.querySelector('.flex-1.overflow-y-auto.overflow-x-hidden.py-1');
          if (!hasSidebar) {
            cancelInlineCreate();
            return;
          }
        }
      }

      // 4. 工具栏区域
      const headerElement = document.querySelector('header');
      if (headerElement && headerElement.contains(e.target)) {
        cancelInlineCreate();
        return;
      }
    };

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inlineCreate]);

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (inlineCreate) return;

      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        const key = e.key.toLowerCase();
        const withShift = e.shiftKey;

        if (key === 'n' && !withShift) {
          e.preventDefault();
          handleNew({ fromHotkey: true });
        } else if (key === 'o' && !withShift) {
          e.preventDefault();
          handleOpen();
        } else if (key === 's' && !withShift) {
          e.preventDefault();
          handleSave();
        } else if (key === 's' && withShift) {
          e.preventDefault();
          handleSaveAs();
        } else if (key === 'w' && !withShift) {
          e.preventDefault();
          handleCloseFile();
        } else if (key === 'b' && !withShift) {
          e.preventDefault();
          handleFormatText('bold');
        } else if (key === 'i' && !withShift) {
          e.preventDefault();
          handleFormatText('italic');
        } else if (key === 'u' && !withShift) {
          e.preventDefault();
          handleFormatText('strikethrough');
        } else if (key === 'k' && !withShift) {
          e.preventDefault();
          handleFormatText('link');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, currentFilePath, markdown, inlineCreate, handleFormatText, handleCloseFile]);

  // 切换字体
  const handleFontChange = (index) => {
    setFontFamilyIndex(index);
    setShowFontMenu(false);
  };

  // 切换背景色
  const handleBgColorChange = (index) => {
    setBgColorIndex(index);
    setShowBgColorMenu(false);
    // 如果当前是黑暗模式，切换主题颜色时自动退出黑暗模式
    if (isDarkMode) {
      setIsDarkMode(false);
    }
  };

  // 处理背景色按钮点击
  const handleBgColorButtonClick = () => {
    if (previewMode === 'pdf') {
      // PDF 模式下显示警告
      setShowBgColorWarning(true);

      // 清除之前的定时器
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }

      // 3秒后自动隐藏
      warningTimeoutRef.current = setTimeout(() => {
        setShowBgColorWarning(false);
      }, 3000);
    } else {
      // Markdown 模式下正常切换
      setShowBgColorMenu(!showBgColorMenu);
    }
  };

  const handleSelectSidebarEntry = useCallback((path, isDirectory) => {
    setSelectedSidebarEntry({ path, isDirectory });
  }, []);

  const resolveCreationTargetPath = (explicitBasePath) => {
    if (explicitBasePath) return explicitBasePath;
    if (!currentFolder) return null;
    if (!selectedSidebarEntry) return currentFolder;
    if (selectedSidebarEntry.isDirectory) return selectedSidebarEntry.path;
    const lastSlash = selectedSidebarEntry.path.lastIndexOf('/');
    if (lastSlash === -1) return currentFolder;
    return selectedSidebarEntry.path.substring(0, lastSlash);
  };

  const handleInlineNameChange = (value) => {
    setInlineCreate(prev => (prev ? { ...prev, value } : prev));
  };

  const ensureFolderExpanded = (folderPath) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });
  };

  const startInlineCreate = (type = 'file', explicitBasePath) => {
    const folderPath = resolveCreationTargetPath(explicitBasePath);
    if (!folderPath) return;
    if (folderPath !== currentFolder) {
      ensureFolderExpanded(folderPath);
    }
    setInlineCreate({
      parentPath: folderPath,
      type,
      value: ''
    });
    setShowNewMenu(false);
  };

  const startCreateEntryFromContext = useCallback((folderPath, type = 'file') => {
    startInlineCreate(type, folderPath);
  }, [startInlineCreate]);

  const cancelInlineCreate = () => {
    setInlineCreate(null);
  };

  const confirmInlineCreate = async () => {
    if (!inlineCreate || !inlineCreate.value.trim()) return;

    let fileName = inlineCreate.value.trim();
    const folderPath = inlineCreate.parentPath;
    const isFolder = inlineCreate.type === 'folder';

    // 如果是文件且没有 .md 后缀，自动添加
    if (!isFolder && !fileName.endsWith('.md')) {
      fileName = fileName + '.md';
    }

    // 检查非法字符 (Windows/Unix 通用限制)
    if (/[<>:"/\\|?*]/.test(fileName)) {
      alert('❌ 名称包含不允许的字符！请避免使用 < > : " / \\ | ? *');
      return;
    }

    if (fileName.length > 255) {
      alert('❌ 名称过长！最多255个字符。');
      return;
    }

    try {
      const filePath = folderPath + '/' + fileName;

      if (isFolder) {
        await mkdir(filePath, { recursive: true });
      } else {
        try {
          await readTextFile(filePath);
          alert('❌ 文件已存在！');
          return;
        } catch {
          // 文件不存在，继续创建
        }
        await writeTextFile(filePath, '');
      }

      setInlineCreate(null);

      await refreshFolderContents(folderPath);

      if (isFolder) {
        ensureFolderExpanded(filePath);
        setSelectedSidebarEntry({ path: filePath, isDirectory: true });
      } else {
        setSelectedSidebarEntry({ path: filePath, isDirectory: false });
        setTimeout(() => {
          handleOpenFileFromSidebar(filePath);
        }, 100);
      }
    } catch (error) {
      console.error('创建失败:', error);
      alert('❌ 创建失败: ' + (error?.message || error));
    }
  };

  const deleteEntryWithFallback = async (targetPath) => {
    await remove(targetPath, { recursive: true });
  };

  // 新建空白文档或在目录中创建条目
  const handleNew = ({ fromHotkey = false } = {}) => {
    if (!currentFolder) {
      if (hasUnsavedChanges) {
        const confirmed = confirm('当前文档有未保存的更改，确定要新建文档吗？');
        if (!confirmed) return;
      }
      setMarkdown('');
      setCurrentFilePath(null);
      setHasUnsavedChanges(false);
      return;
    }

    if (fromHotkey) {
      startInlineCreate('file');
      return;
    }

    setShowNewMenu(prev => !prev);
  };

  // 打开文件或文件夹按钮点击
  const handleOpen = () => {
    setShowOpenMenu(!showOpenMenu);
  };

  // 打开文件
  const handleOpenFile = async () => {
    try {
      setShowOpenMenu(false);
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }]
      });

      if (!selected) return;

      const content = await readTextFile(selected);
      setMarkdown(content);
      setCurrentFilePath(selected);
      setHasUnsavedChanges(false);
      setSelectedSidebarEntry({ path: selected, isDirectory: false });

      // 提取文件夹路径并加载文件夹内容（但不自动显示侧边栏）
      const folderPath = selected.substring(0, selected.lastIndexOf('/'));
      await loadFolderContents(folderPath);
    } catch (error) {
      console.error('打开文件失败:', error);
      alert('❌ 打开文件失败: ' + error.message);
    }
  };

  // 打开文件夹
  const handleOpenFolder = async () => {
    try {
      setShowOpenMenu(false);
      const selected = await open({
        multiple: false,
        directory: true
      });

      if (!selected) return;

      await loadFolderContents(selected);
      setSidebarVisible(true);
    } catch (error) {
      console.error('打开文件夹失败:', error);
      alert('❌ 打开文件夹失败: ' + error.message);
    }
  };

  // 标签管理
  const handleAddTag = async () => {
    const tag = tagInput.trim();
    if (!tag || !currentFilePath) return;
    
    if (currentTags.includes(tag)) {
      setTagInput('');
      return;
  // 彩色标签处理函数
  const toggleFileTag = useCallback((filePath, colorName) => {
    setFileTags(prev => {
      const current = prev[filePath] || [];
      const newTags = current.includes(colorName)
        ? current.filter(c => c !== colorName)
        : [...current, colorName];
      
      return newTags.length > 0 
        ? { ...prev, [filePath]: newTags }
        : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== filePath));
    });
  }, []);

  // 切换文件夹展开/折叠
  const toggleFolder = useCallback(async (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  }, []);

  // 加载文件夹内容（根目录）
  const sortEntries = useCallback((entries) => {
    return [...entries].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      if (fileSortBy === 'modified') {
        return (b.modifiedAt || 0) - (a.modifiedAt || 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [fileSortBy]);

  const loadFolderContents = useCallback(async (folderPath) => {
    try {
      setCurrentFolder(folderPath);
      const entries = await readDir(folderPath);
      setFolderContents(sortEntries(entries));
      setExpandedFolders(new Set([folderPath]));
      
      // 并行扫描当前层级的 .md 文件标签
      const scanCurrentLevel = async () => {
        const mdFiles = entries.filter(item => !item.isDirectory && item.name.endsWith('.md'));
        const results = await Promise.all(
          mdFiles.map(async item => {
            const fullPath = `${folderPath}/${item.name}`;
            try {
              const content = await readTextFile(fullPath);
              const tags = parseTags(content);
              return tags.length > 0 ? { fullPath, tags: tags.map(name => ({ name, color: getTagColor(name) })) } : null;
            } catch (e) {
              return null;
            }
          })
        );
        const tagMap = {};
        results.forEach(r => r && (tagMap[r.fullPath] = r.tags));
        setFileTags(prev => ({ ...prev, ...tagMap }));
      };
      scanCurrentLevel();
    } catch (error) {
      console.error('读取文件夹失败:', error);
    }
  }, [sortEntries, parseTags]);

  // 递归读取子文件夹内容
  const getSubfolderContents = useCallback(async (folderPath) => {
    try {
      const entries = await readDir(folderPath);
      return sortEntries(entries);
    } catch (error) {
      console.error('读取子文件夹失败:', error);
      return [];
    }
  }, [sortEntries]);

  // 过滤文件列表
  const filteredFolderContents = useMemo(() => {
    if (!fileSearchQuery.trim() && !selectedTag) return folderContents;
    
    let filtered = folderContents;
    
    // 按文件名搜索
    if (fileSearchQuery.trim()) {
      const query = fileSearchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.name.toLowerCase().includes(query)
      );
    }
    
    // 按标签过滤（仅对 .md 文件）
    if (selectedTag) {
      filtered = filtered.filter(entry => {
        if (entry.isDirectory) return true;
        if (!entry.name.endsWith('.md')) return false;
        // 这里需要读取文件内容来检查标签，暂时跳过
        return true;
      });
    }
    
    return filtered;
  }, [folderContents, fileSearchQuery, selectedTag]);

  // 解析 frontmatter 中的标签
  const parseTags = useCallback((content) => {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return [];
    
    const frontmatter = frontmatterMatch[1];
    const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
    if (!tagsMatch) return [];
    
    return tagsMatch[1].split(',').map(tag => tag.trim().replace(/['"]/g, '')).filter(Boolean);
  }, []);

  // 从侧边栏打开文件
  const handleOpenFileFromSidebar = useCallback(async (filePath) => {
    console.log('尝试打开文件:', filePath);
    try {
      const content = await readTextFile(filePath);
      console.log('文件读取成功，内容长度:', content.length);
      setMarkdown(content);
      setCurrentFilePath(filePath);
      setHasUnsavedChanges(false);
      setSelectedSidebarEntry({ path: filePath, isDirectory: false });
      addRecentFile(filePath);
    } catch (error) {
      console.error('打开文件失败:', error);
      alert('❌ 打开文件失败: ' + error.message);
    }
  }, [addRecentFile]);

  // 刷新文件夹内容
  const refreshFolderContents = async (folderPath) => {
    try {
      const entries = await readDir(folderPath);
      // 与 loadFolderContents 保持一致：显示所有文件和文件夹
      const sorted = entries
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      // 如果是根目录，更新根目录内容
      if (currentFolder === folderPath) {
        setFolderContents(sorted);
      }

      // 更新刷新时间戳，通知子组件刷新
      setFolderRefreshTimestamps(prev => ({
        ...prev,
        [folderPath]: Date.now()
      }));
    } catch (error) {
      console.error('刷新文件夹失败:', error);
    }
  };

  // 重命名文件或文件夹
  const handleRenameEntry = useCallback(async (oldPath, newName) => {
    try {
      const lastSlashIndex = oldPath.lastIndexOf('/');
      const parentPath = lastSlashIndex > 0 ? oldPath.substring(0, lastSlashIndex) : currentFolder;
      const newPath = parentPath + '/' + newName;

      await rename(oldPath, newPath);

      // 如果重命名的是当前打开的文件，更新路径
      if (currentFilePath === oldPath) {
        setCurrentFilePath(newPath);
      } else if (currentFilePath && currentFilePath.startsWith(oldPath + '/')) {
        // 如果重命名的是当前打开文件的父文件夹
        setCurrentFilePath(currentFilePath.replace(oldPath, newPath));
      }

      // 更新展开的文件夹集合
      setExpandedFolders(prev => {
        const newSet = new Set();
        prev.forEach(path => {
          if (path === oldPath) {
            newSet.add(newPath);
          } else if (path.startsWith(oldPath + '/')) {
            newSet.add(path.replace(oldPath, newPath));
          } else {
            newSet.add(path);
          }
        });
        return newSet;
      });

      // 刷新父文件夹内容
      if (parentPath) {
        await refreshFolderContents(parentPath);
      }
    } catch (error) {
      console.error('重命名失败:', error);
      alert('❌ Rename failed: ' + (error?.message || error));
    }
  }, [currentFolder, currentFilePath, refreshFolderContents]);

  // 在 Finder 中显示
  const handleRevealInFinder = useCallback(async (path) => {
    try {
      await revealItemInDir(path);
    } catch (error) {
      console.error('在 Finder 中显示失败:', error);
    }
  }, []);

  // 删除文件或文件夹
  const handleDeleteFile = async (filePath, event = null) => {
    const fileName = filePath.split('/').pop();

    // 获取鼠标位置
    const position = event ? { x: event.clientX, y: event.clientY } : null;

    // Show custom confirm dialog
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Item',
      message: `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
      position: position,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));

        try {
          await deleteEntryWithFallback(filePath);

          // 如果删除的是当前打开的文件，则清空编辑器
          if (currentFilePath === filePath || currentFilePath?.startsWith(filePath + '/')) {
            setMarkdown('');
            setCurrentFilePath(null);
            setHasUnsavedChanges(false);
          }

          // 获取父文件夹路径
          const lastSlashIndex = filePath.lastIndexOf('/');
          const parentPath = lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : currentFolder;

          // 刷新父文件夹内容
          if (parentPath) {
            await refreshFolderContents(parentPath);
          }

          // 从展开的文件夹集合中移除被删除的文件夹
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            Array.from(newSet).forEach(path => {
              if (path === filePath || path.startsWith(filePath + '/')) {
                newSet.delete(path);
              }
            });
            return newSet;
          });

          if (selectedSidebarEntry && (selectedSidebarEntry.path === filePath || selectedSidebarEntry.path.startsWith(filePath + '/'))) {
            setSelectedSidebarEntry(null);
          }
        } catch (error) {
          console.error('删除文件失败:', error);
          alert('❌ Delete failed: ' + (error?.message || error));
        }
      }
    });
  };

  // 保存文件
  const handleSave = useCallback(async () => {
    try {
      let filePath = currentFilePath;

      if (!filePath) {
        // 第一次保存：显示保存对话框
        filePath = await save({
          defaultPath: 'untitled.md',
          filters: [{
            name: 'Markdown',
            extensions: ['md']
          }]
        });

        if (!filePath) return; // 用户取消保存

        setCurrentFilePath(filePath);
      }

      // 直接保存到当前文件
      await writeTextFile(filePath, markdown);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      addRecentFile(filePath);

      // WebDAV 自动同步
      const webdavConfig = localStorage.getItem('webdav_config');
      if (webdavConfig) {
        const filename = filePath.split('/').pop();
        await syncToWebDAV(filename, markdown);
      }
    } catch (error) {
      console.error('保存文件失败:', error);
      alert('❌ 保存失败: ' + error.message);
    }
  }, [currentFilePath, markdown, addRecentFile, syncToWebDAV]);

  // 另存为
  const handleSaveAs = async () => {
    try {
      const filePath = await save({
        defaultPath: currentFilePath || 'untitled.md',
        filters: [{
          name: 'Markdown',
          extensions: ['md']
        }]
      });

      if (!filePath) return;

      await writeTextFile(filePath, markdown);
      setCurrentFilePath(filePath);
      setHasUnsavedChanges(false);
      addRecentFile(filePath);
      alert('✅ 文件保存成功！');
    } catch (error) {
      console.error('保存文件失败:', error);
      alert('❌ 保存失败: ' + error.message);
    }
  };

  // 关闭当前文件
  const handleCloseFile = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = confirm('当前文档有未保存的更改，确定要关闭吗？');
      if (!confirmed) return;
    }
    setMarkdown('');
    setCurrentFilePath(null);
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges]);

  // 文本格式化
  const handleFormatText = useCallback((format) => {
    const textarea = editorAreaRef.current?.getTextareaElement();
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);
    const before = markdown.substring(0, start);
    const after = markdown.substring(end);

    let newText, newCursorPos;

    switch (format) {
      case 'bold':
        if (selectedText) {
          newText = `${before}**${selectedText}**${after}`;
          newCursorPos = end + 4;
        } else {
          newText = `${before}****${after}`;
          newCursorPos = start + 2;
        }
        break;
      case 'italic':
        if (selectedText) {
          newText = `${before}*${selectedText}*${after}`;
          newCursorPos = end + 2;
        } else {
          newText = `${before}**${after}`;
          newCursorPos = start + 1;
        }
        break;
      case 'strikethrough':
        if (selectedText) {
          newText = `${before}~~${selectedText}~~${after}`;
          newCursorPos = end + 4;
        } else {
          newText = `${before}~~~~${after}`;
          newCursorPos = start + 2;
        }
        break;
      case 'link':
        if (selectedText) {
          newText = `${before}[${selectedText}](url)${after}`;
          newCursorPos = end + 3;
        } else {
          newText = `${before}[text](url)${after}`;
          newCursorPos = start + 1;
        }
        break;
      default:
        return;
    }

    setMarkdown(newText);
    setHasUnsavedChanges(true);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [markdown, editorAreaRef]);

  // 自动保存
  useAutoSave(markdown, currentFilePath, hasUnsavedChanges, autoSaveEnabled, handleSave);

  // 监听内容变化
  const handleMarkdownChange = (e) => {
    setMarkdown(e.target.value);
    setHasUnsavedChanges(true);
  };

  // 处理图片粘贴：在光标位置插入图片 Markdown 语法
  const handleImagePasted = (imageMarkdown, textareaElement) => {
    if (!textareaElement) return;

    const start = textareaElement.selectionStart;
    const end = textareaElement.selectionEnd;
    const currentText = markdown;

    // 在光标位置插入图片 markdown
    const newText = currentText.substring(0, start) + imageMarkdown + currentText.substring(end);

    setMarkdown(newText);
    setHasUnsavedChanges(true);

    // 将光标移动到插入内容之后
    setTimeout(() => {
      textareaElement.focus();
      const newCursorPos = start + imageMarkdown.length;
      textareaElement.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // 使用 html2canvas + jsPDF 导出 PDF
  const handleExport = async () => {
    setIsExporting(true);
    let tempElement = null;

    try {
      // 如果是 Markdown 模式，需要临时创建一个 PDF 风格的元素来导出
      let element = document.getElementById('print-target');

      if (previewMode === 'markdown') {
        // 创建临时的 PDF 风格容器
        tempElement = document.createElement('div');
        tempElement.id = 'temp-print-target';
        tempElement.style.position = 'absolute';
        tempElement.style.left = '-9999px';
        tempElement.style.width = '210mm';
        tempElement.style.minHeight = '297mm';
        tempElement.style.padding = '20mm 25mm';
        tempElement.style.fontFamily = currentFontFamily.family;
        tempElement.style.fontSize = currentFont.size === 'text-sm' ? '10pt' : currentFont.size === 'text-base' ? '11pt' : '12pt';
        tempElement.style.lineHeight = '1.5';
        tempElement.style.color = '#000';
        tempElement.style.backgroundColor = '#fff';

        // 复制 Markdown 内容
        const markdownContainer = document.querySelector('.prose');
        if (markdownContainer) {
          tempElement.innerHTML = markdownContainer.innerHTML;
        }

        document.body.appendChild(tempElement);
        element = tempElement;
      }

      if (!element) {
        throw new Error('未找到导出内容');
      }

      // 第二步：使用 html2canvas 将内容转换为图片
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      // 第三步：创建 PDF
      const imgWidth = 210; // A4 宽度 (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // 第四步：将图片添加到 PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // 第五步：获取 PDF 数据
      const pdfBlob = pdf.output('blob');
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfUint8Array = new Uint8Array(pdfArrayBuffer);

      // 第六步：使用 Tauri 的文件保存对话框
      const filePath = await save({
        defaultPath: 'document.pdf',
        filters: [{
          name: 'PDF',
          extensions: ['pdf']
        }]
      });

      if (!filePath) {
        // 用户取消了保存
        // 清理临时元素
        if (tempElement && tempElement.parentNode) {
          tempElement.parentNode.removeChild(tempElement);
        }
        setIsExporting(false);
        return;
      }

      // 第七步：保存文件
      await writeFile(filePath, pdfUint8Array);
      alert('✅ PDF 导出成功！\n文件已保存到: ' + filePath);
    } catch (error) {
      console.error('导出失败:', error);
      const errorMsg = error.message || String(error);
      alert('❌ 导出失败\n\n错误信息: ' + errorMsg + '\n\n请检查文件权限或尝试选择其他保存位置。');
    } finally {
      // 清理临时元素
      if (tempElement && tempElement.parentNode) {
        tempElement.parentNode.removeChild(tempElement);
      }
      setIsExporting(false);
    }
  };

  // 导出 Word 文档
  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      const lines = markdown.split('\n');
      const children = [];
      
      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
        } else if (line.startsWith('## ')) {
          children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
        } else if (line.startsWith('### ')) {
          children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
        } else {
          children.push(new Paragraph({ children: [new TextRun(line)] }));
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const buffer = await blob.arrayBuffer();

      const filePath = await save({
        defaultPath: 'document.docx',
        filters: [{ name: 'Word', extensions: ['docx'] }]
      });

      if (filePath) {
        await writeFile(filePath, new Uint8Array(buffer));
        alert('✅ Word 导出成功！\n文件已保存到: ' + filePath);
      }
    } catch (error) {
      alert('❌ 导出失败\n\n错误信息: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // 使用 useMemo 缓存 markdown 渲染内容，避免主题切换时重新渲染
  const renderedMarkdown = useMemo(() => {
    // Pre-process markdown to convert Obsidian syntax to standard markdown
    const processedMarkdown = debouncedMarkdown.replace(
      /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp|ico))\]\]/gi,
      (match, filename) => {
        // URL encode the entire path to handle spaces and special characters
        const imagePath = `${attachmentFolder}/${filename}`;
        // Encode each path component separately to preserve the forward slash
        const encodedPath = imagePath.split('/').map(part => encodeURIComponent(part)).join('/');
        console.log('🖼️ Obsidian image found:', { original: match, filename, imagePath, encodedPath });
        return `![](${encodedPath})`;
      }
    );

    // Debug: show a sample of processedMarkdown
    if (processedMarkdown !== debouncedMarkdown) {
      const sample = processedMarkdown.substring(0, 500);
      console.log('📝 Processed markdown sample:', sample);
    }


    // Custom img component to handle local image paths
    const components = {
      img: ({ node, src, alt, ...props }) => {
        let imageSrc = src;

        // Handle local paths (not HTTP, data, or asset URLs)
        if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('asset://')) {
          const basePath = currentFolder ||
            (currentFilePath ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : '');

          if (basePath) {
            // Decode URL-encoded path first
            const decodedSrc = decodeURIComponent(src);
            const cleanSrc = decodedSrc.startsWith('./') ? decodedSrc.substring(2) : decodedSrc;
            const absolutePath = `${basePath}/${cleanSrc}`;

            try {
              imageSrc = convertFileSrc(absolutePath);
              console.log('🖼️ Image transformed:', { original: src, decoded: decodedSrc, absolute: absolutePath, asset: imageSrc });
            } catch (error) {
              console.error('❌ Image transform failed:', error);
            }
          }
        }

        return <img src={imageSrc} alt={alt || ''} {...props} />;
      }
    };

    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [rehypeKatex, {
            strict: false,
            trust: true,
            throwOnError: false
          }]
        ]}
        components={components}
      >
        {processedMarkdown}
      </ReactMarkdown>
    );
  }, [debouncedMarkdown, currentFolder, currentFilePath, attachmentFolder]);

  // Debounce markdown for preview
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMarkdown(markdown), 300);
    return () => clearTimeout(timer);
  }, [markdown]);

  // 应用启动时恢复上次打开的文件和文件夹
  useEffect(() => {
    const restoreLastSession = async () => {
      console.log('🔄 恢复会话:', {
        currentFolder,
        currentFilePath,
        sidebarVisible
      });

      // 如果有保存的文件夹，加载文件夹内容
      if (currentFolder) {
        try {
          await loadFolderContents(currentFolder);
          console.log('✅ 文件夹内容已加载');
        } catch (error) {
          console.error('❌ 无法恢复文件夹:', error);
          setCurrentFolder(null);
        }
      }

      // 如果有保存的文件，尝试加载
      if (currentFilePath) {
        try {
          const content = await readTextFile(currentFilePath);
          setMarkdown(content);
          setHasUnsavedChanges(false);
          console.log('✅ 成功恢复文件:', currentFilePath);
        } catch (error) {
          console.error('❌ 无法恢复文件:', error);
          setCurrentFilePath(null);
        }
      }
    };

    const timer = setTimeout(() => {
      restoreLastSession();
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`${isDarkMode ? 'dark' : ''} h-screen w-screen flex flex-col transition-colors duration-300`}
      style={{
        backgroundColor: appBgColor,
        color: appTextColor
      }}
    >

      {/* 添加打印样式和 macOS 风格动画 */}
      <style>{`
        @media print {
          /* 隐藏工具栏和左侧编辑区 */
          header, section:first-of-type {
            display: none !important;
          }
          /* 预览区占满整个页面 */
          main {
            display: block !important;
          }
          section:last-of-type {
            width: 100% !important;
            background: white !important;
            padding: 0 !important;
          }
          #print-target {
            box-shadow: none !important;
            max-width: 100% !important;
          }
        }

        /* macOS 风格的自定义滚动条 */
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        /* macOS 风格的淡入动画 */
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        /* Modal dialog scale-in animation */
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* 平滑的颜色过渡 - 仅应用于关键元素 */
        header, .sidebar-item, button, input, textarea, select {
          transition-property: background-color, border-color, color;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }

        /* 使用 CSS 变量和 will-change 优化性能 */
        .dark {
          color-scheme: dark;
        }

        /* 防止拖动时的闪动 */
        section {
          will-change: width;
        }

        section > * {
          pointer-events: auto;
        }

        /* 拖动时禁用所有交互和选择 */
        body.dragging,
        body.dragging * {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          pointer-events: none !important;
          cursor: col-resize !important;
        }

        /* 只允许关键元素保持可交互 */
        body.dragging section,
        body.dragging textarea,
        body.dragging .custom-scrollbar {
          pointer-events: auto !important;
        }

        /* 防止 iframe 和其他嵌入内容干扰拖动 */
        body.dragging iframe,
        body.dragging object,
        body.dragging embed {
          pointer-events: none !important;
        }

        /* 拖动时禁用过渡效果，减少闪烁 */
        body.dragging section,
        body.dragging textarea,
        body.dragging .prose,
        body.dragging #print-target {
          transition: none !important;
        }

        /* 窗口拖动区域样式 - 明确指定 header 区域可拖动 */
        header[data-tauri-drag-region],
        header [data-tauri-drag-region] {
          -webkit-app-region: drag !important;
          app-region: drag !important;
        }

        /* 确保按钮、输入框和其他交互元素不受拖动影响 */
        header button,
        header input,
        header textarea,
        header select,
        header a,
        header .relative,
        header [role="button"] {
          -webkit-app-region: no-drag !important;
          app-region: no-drag !important;
        }

        /* 禁止工具栏中所有文字被选中 */
        header,
        header *,
        header span,
        header button,
        header div {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
      `}</style>

      {/* === 工具栏 === */}
      <header
        className={`${HEADER_HEIGHT} flex-none z-50 border-b transition-colors duration-300`}
        style={{
          backgroundColor: appBgColor,
          borderBottomColor: 'rgba(0, 0, 0, 0.1)'
        }}
        data-tauri-drag-region
      >

        <div className="h-full flex items-center justify-between px-4" data-tauri-drag-region>

          {/* 左侧：macOS窗口控制区域占位 + 文件操作按钮 */}
          <div className="flex items-center gap-0.5">
            {/* macOS窗口控制按钮占位 (红黄绿) */}
            <div className="w-14"></div>

            <div className="relative">
              <button
                onClick={() => handleNew()}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all flex items-center gap-1 ${currentFolder
                  ? 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-gray-800/60'
                  }`}
                title={currentFolder ? 'New (Cmd+N)' : 'New Document (Cmd+N)'}
              >
                New
                {currentFolder && (
                  <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </button>

              {currentFolder && showNewMenu && (
                <div
                  ref={newMenuRef}
                  className="absolute left-0 top-7 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in"
                >
                  <button
                    onClick={() => startInlineCreate('file')}
                    className="w-full px-3 py-2 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <span>📄</span>
                    <span>文件</span>
                  </button>
                  <button
                    onClick={() => startInlineCreate('folder')}
                    className="w-full px-3 py-2 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <span>📁</span>
                    <span>文件夹</span>
                  </button>
                </div>
              )}
            </div>

            {/* Open 按钮带下拉菜单 */}
            <div className="relative flex items-center">
              <button
                onClick={handleOpen}
                className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all"
                title="Open (Cmd+O)"
              >
                Open
              </button>

              {/* Open 下拉菜单 */}
              {showOpenMenu && (
                <div className="absolute left-0 top-7 w-28 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={handleOpenFile}
                    className="w-full px-3 py-1.5 text-left text-[10px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <span>📄</span>
                    <span>File</span>
                  </button>
                  <button
                    onClick={handleOpenFolder}
                    className="w-full px-3 py-1.5 text-left text-[10px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <span>📁</span>
                    <span>Folder</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all"
              title="Save (Cmd+S)"
            >
              Save{hasUnsavedChanges && '*'}
            </button>
          </div>

          {/* 中间：应用名称 - 可拖动区域 */}
          <div className="flex-1 flex items-center justify-center" data-tauri-drag-region>
            <span
              data-tauri-drag-region
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '14px',
                fontWeight: '300',
                letterSpacing: '0.15em',
                color: appTextColor
              }}
            >
              JustMark
            </span>
          </div>

          {/* 右侧：功能按钮 */}
          <div className="w-40 flex items-center justify-end gap-2 relative">

            {/* 字体选择器 */}
            <div className="relative">
              <button
                onClick={() => setShowFontMenu(!showFontMenu)}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95"
                title={`字体: ${currentFontFamily.nameZh}`}
              >
                <span className="text-[11px] font-medium">Aa</span>
              </button>

              {showFontMenu && (
                <div className="absolute right-0 top-8 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {FONT_FAMILIES.map((font, index) => (
                    <button
                      key={index}
                      onClick={() => handleFontChange(index)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${fontFamilyIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''
                        }`}
                      style={{ fontFamily: font.family }}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {font.nameZh}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {font.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={decreaseFontSize}
              disabled={fontIndex === 0}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              title="字体变小"
            >
              <span className="text-sm font-bold">A-</span>
            </button>

            <button
              onClick={increaseFontSize}
              disabled={fontIndex === FONT_OPTIONS.length - 1}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              title="字体变大"
            >
              <span className="text-sm font-bold">A+</span>
            </button>

            {/* 背景色选择器 */}
            <div className="relative">
              <button
                onClick={handleBgColorButtonClick}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95"
                title={`Background: ${currentBgColor.name}`}
              >
                <div
                  className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: previewBgColor }}
                ></div>
              </button>

              {/* 背景色选项菜单 - 仅在 Markdown 模式下显示 */}
              {showBgColorMenu && previewMode === 'markdown' && (
                <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  {BACKGROUND_COLORS.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => handleBgColorChange(index)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${bgColorIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''
                        }`}
                    >
                      <div
                        className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0"
                        style={{
                          backgroundColor: color.bg
                        }}
                      ></div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {color.name}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          {color.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* PDF 模式警告提示 */}
              {showBgColorWarning && (
                <div className="absolute right-0 top-8 px-3 py-2 rounded-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg border border-gray-200/50 dark:border-gray-700/50 z-50 animate-fade-in">
                  <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    Not available in PDF mode
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={togglePreviewMode}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95 text-[10px]"
              title={previewMode === 'markdown' ? '切换到PDF预览' : '切换到Markdown预览'}
            >
              {previewMode === 'markdown' ? '📄' : '📝'}
            </button>

            {/* Web Clipper 按钮 */}
            <div className="relative">
              <button
                onClick={async () => {
                  const textarea = editorAreaRef.current?.getTextareaElement?.();
                  if (!textarea) {
                    setShowClipError(true);
                    setTimeout(() => setShowClipError(false), 3000);
                    return;
                  }
                  try {
                    await clipFromSelection(textarea, markdown, setMarkdown, setHasUnsavedChanges);
                  } catch (err) {
                    setShowClipError(true);
                    setTimeout(() => {
                      setShowClipError(false);
                      clearClipError();
                    }, 3000);
                  }
                }}
                disabled={isClipping}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
                title="剪藏 - 选中URL后点击抓取网页内容"
              >
                {isClipping ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}
              </button>
              {/* Clip Error Tooltip */}
              {showClipError && clipError && (
                <div className="absolute right-0 top-8 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/50 backdrop-blur-md shadow-lg border border-red-200/50 dark:border-red-700/50 z-50 animate-fade-in max-w-xs">
                  <div className="text-xs text-red-600 dark:text-red-300 whitespace-nowrap">
                    ❌ {clipError}
                  </div>
                </div>
              )}
            </div>

            {/* WebDAV 同步按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowWebDAVSettings(true)}
                disabled={syncing}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
                title={syncing ? "Syncing..." : "WebDAV Sync"}
              >
                {syncing ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                )}
              </button>
              {syncing && (
                <div className="absolute right-0 top-8 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/50 shadow-lg border border-blue-200 dark:border-blue-700 z-50">
                  <div className="text-xs text-blue-600 dark:text-blue-300 whitespace-nowrap">
                    Syncing...
                  </div>
                </div>
              )}
            </div>

            {/* TOC 切换按钮 */}
            <button
              onClick={() => setTocVisible(!tocVisible)}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95"
              title={tocVisible ? '隐藏目录' : '显示目录'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>

            {/* Settings按钮 */}
            <button
              onClick={() => setShowSettingsDialog(true)}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95"
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* 黑暗模式切换按钮 */}
            <button
              onClick={toggleTheme}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95 text-[10px]"
            >
              {isDarkMode ? '🌞' : '🌙'}
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="ml-2 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export PDF"
            >
              {isExporting ? 'Cooking...' : 'PDF'}
            </button>

            <button
              onClick={handleExportWord}
              disabled={isExporting}
              className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export Word"
            >
              {isExporting ? 'Cooking...' : 'Word'}
            </button>
          </div>
        </div>
      </header>

      {/* === 主工作区 === */}
      <main className="flex-1 flex overflow-hidden">

        {/* 左侧：输入区 + 文件浏览器 + Git 面板 */}
        <section
          className="h-full border-r transition-colors duration-300 relative flex"
          style={{
            width: previewVisible ? `${editorWidth}%` : '100%',
            backgroundColor: appBgColor,
            borderRightColor: 'rgba(0, 0, 0, 0.1)'
          }}
        >
          {/* 侧边栏 - macOS 风格 */}
          {sidebarVisible && currentFolder && (
            <>
              <div
                className="backdrop-blur-xl border-r flex flex-col"
                style={{
                  width: `${sidebarWidth}px`,
                  backgroundColor: `${appBgColor}f2`, // 95% opacity
                  borderRightColor: 'rgba(0, 0, 0, 0.1)'
                }}
              >
                {/* 文件浏览器头部 */}
                <div
                  className="h-10 px-3 flex items-center justify-between border-b flex-shrink-0"
                  style={{
                    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                    backgroundColor: appBgColor
                  }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className="text-[11px] font-semibold truncate"
                      style={{ color: appTextColor }}
                    >
                      {currentFolder.split('/').pop() || 'Files'}
                    </span>
                  </div>
                  <button
                    onClick={() => setSidebarVisible(false)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200/70 dark:hover:bg-gray-700/70 transition-all active:scale-95"
                    title="Close"
                  >
                    <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                {/* 文件搜索框 */}
                <div className="px-2 py-2 border-b" style={{ borderBottomColor: 'rgba(0, 0, 0, 0.1)' }}>
                  <div className="relative">
                    <input
                      type="text"
                      value={fileSearchQuery}
                      onChange={(e) => setFileSearchQuery(e.target.value)}
                      placeholder="Search files..."
                      className="w-full px-2 py-1 text-[11px] rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400"
                      style={{
                        color: appTextColor,
                        borderColor: 'rgba(0, 0, 0, 0.2)'
                      }}
                    />
                    {fileSearchQuery && (
                      <button
                        onClick={() => setFileSearchQuery('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200/70 dark:hover:bg-gray-700/70"
                      >
                        <svg className="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* 文件树列表 */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 custom-scrollbar">
                  {inlineCreate && inlineCreate.parentPath === currentFolder && (
                    <InlineCreateRow
                      level={0}
                      type={inlineCreate.type}
                      value={inlineCreate.value}
                      inputRef={inlineCreateInputRef}
                      onChange={handleInlineNameChange}
                      onConfirm={confirmInlineCreate}
                      onCancel={cancelInlineCreate}
                    />
                  )}
                  {filteredFolderContents.map((entry, index) => (
                    <FileTreeItem
                      key={index}
                      entry={entry}
                      basePath={currentFolder}
                      level={0}
                      currentFilePath={currentFilePath}
                      expandedFolders={expandedFolders}
                      folderRefreshTimestamps={folderRefreshTimestamps}
                      onToggleFolder={toggleFolder}
                      onOpenFile={handleOpenFileFromSidebar}
                      getSubfolderContents={getSubfolderContents}
                      onStartInlineCreate={startCreateEntryFromContext}
                      onDeleteEntry={handleDeleteFile}
                      onRenameEntry={handleRenameEntry}
                      onRevealInFinder={handleRevealInFinder}
                      inlineCreate={inlineCreate}
                      inlineInputRef={inlineCreateInputRef}
                      onInlineChange={handleInlineNameChange}
                      onInlineConfirm={confirmInlineCreate}
                      onInlineCancel={cancelInlineCreate}
                      onSelectEntry={handleSelectSidebarEntry}
                      fileTags={fileTags}
                    />
                  ))}
                </div>

              {/* 侧边栏拖动条 */}
              <div
                className="w-px bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-300/70 dark:hover:bg-gray-600/70 cursor-col-resize active:bg-blue-400/70 dark:active:bg-blue-500/70 transition-colors relative group"
                onMouseDown={() => setIsDraggingSidebar(true)}
              >
                <div className="absolute inset-y-0 -left-2 -right-2" />
            </>
          )}

          {/* 编辑器文本区域 */}
          <EditorArea
            ref={editorAreaRef}
            markdown={markdown}
            onMarkdownChange={handleMarkdownChange}
            currentFont={currentFont}
            currentFontFamily={currentFontFamily}
            appTextColor={appTextColor}
            currentFolder={currentFolder}
            currentFilePath={currentFilePath}
            sidebarVisible={sidebarVisible}
            onToggleSidebar={setSidebarVisible}
            onEditorScroll={handleEditorScroll}
            previewVisible={previewVisible}
            onTogglePreview={togglePreviewVisibility}
            onImagePasted={handleImagePasted}
          />
        </section>

        {/* 编辑器和预览区之间的分隔符 */}
        {previewVisible && (
          <div
            className="w-px bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-300/70 dark:hover:bg-gray-600/70 cursor-col-resize active:bg-blue-400/70 dark:active:bg-blue-500/70 transition-colors relative group"
            onMouseDown={() => setIsDraggingEditor(true)}
          >
            <div className="absolute inset-y-0 -left-2 -right-2" />
        )}

        {/* 右侧：预览区 */}
        {previewVisible && (
          <section
            ref={(el) => {
              pdfContainerRef.current = el;
              previewSectionRef.current = el;
            }}
            className="flex-1 h-full overflow-y-auto flex justify-center transition-colors duration-300 relative"
            style={{ backgroundColor: previewBgColor }}
            onClick={(e) => {
              handlePreviewClick();
              handlePreviewClickToJump(e);
            }}
          >

            {/* macOS 风格的预览模式指示器 */}
            {showIndicator && (
              <div className="absolute top-4 right-4 z-10 animate-fade-in">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border border-gray-200/50 dark:border-gray-700/50 transition-all">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {previewMode === 'markdown' ? '📝 Markdown' : '📄 PDF'}
                  </span>
                </div>
              </div>
            )}

            {/* 预览区颜色选择按钮 - 仅在 Markdown 模式下显示 */}
            {previewMode === 'markdown' && (
              <PreviewColorPicker
                previewBgColor={previewBgColor}
                previewBgColorIndex={previewBgColorIndex}
                showMenu={showPreviewBgColorMenu}
                onToggleMenu={() => setShowPreviewBgColorMenu(!showPreviewBgColorMenu)}
                onColorSelect={(index) => {
                  setPreviewBgColorIndex(index);
                  setShowPreviewBgColorMenu(false);
                }}
                onReset={() => {
                  setPreviewBgColorIndex(null);
                  setShowPreviewBgColorMenu(false);
                }}
              />
            )}

            {previewMode === 'markdown' ? (
              /* Markdown 预览模式 - 正常网页效果 */
              <div className="w-full max-w-4xl p-6 flex gap-6">
                {/* TOC 组件 */}
                {tocVisible && (
                  <TableOfContents
                    markdown={markdown}
                    onHeadingClick={(id) => {
                      const element = document.getElementById(id);
                      if (element) element.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                )}
                <article
                  className="prose max-w-none prose-headings:font-semibold"
                  style={{
                    fontFamily: currentFontFamily.family,
                    color: previewTextColor
                  }}
                >
                  <style>{`
                  .prose {
                    font-size: ${currentFont.size === 'text-xs' ? '0.75rem' :
                      currentFont.size === 'text-sm' ? '0.875rem' :
                        currentFont.size === 'text-base' ? '1rem' :
                          currentFont.size === 'text-lg' ? '1.125rem' :
                            '1.25rem'
                    } !important;
                    line-height: ${currentFont.leading === 'leading-5' ? '1.25rem' :
                      currentFont.leading === 'leading-6' ? '1.5rem' :
                        currentFont.leading === 'leading-7' ? '1.75rem' :
                          currentFont.leading === 'leading-8' ? '2rem' :
                            '2.25rem'
                    } !important;
                  }
                  .prose p {
                    margin-top: 0 !important;
                    margin-bottom: ${currentFont.leading === 'leading-5' ? '0.625rem' :
                      currentFont.leading === 'leading-6' ? '0.75rem' :
                        currentFont.leading === 'leading-7' ? '0.875rem' :
                          currentFont.leading === 'leading-8' ? '1rem' :
                            '1.125rem'
                    } !important;
                  }
                  .prose h1 {
                    font-size: ${currentFont.size === 'text-xs' ? '1.25rem' :
                      currentFont.size === 'text-sm' ? '1.5rem' :
                        currentFont.size === 'text-base' ? '1.875rem' :
                          currentFont.size === 'text-lg' ? '2.25rem' :
                            '2.5rem'
                    } !important;
                    line-height: 1.2 !important;
                    margin-top: ${currentFont.leading === 'leading-5' ? '0.875rem' :
                      currentFont.leading === 'leading-6' ? '1rem' :
                        currentFont.leading === 'leading-7' ? '1.25rem' :
                          currentFont.leading === 'leading-8' ? '1.5rem' :
                            '1.75rem'
                    } !important;
                    margin-bottom: ${currentFont.leading === 'leading-5' ? '0.375rem' :
                      currentFont.leading === 'leading-6' ? '0.5rem' :
                        currentFont.leading === 'leading-7' ? '0.625rem' :
                          currentFont.leading === 'leading-8' ? '0.75rem' :
                            '0.875rem'
                    } !important;
                    color: inherit !important;
                  }
                  .prose h2 {
                    font-size: ${currentFont.size === 'text-xs' ? '1.125rem' :
                      currentFont.size === 'text-sm' ? '1.25rem' :
                        currentFont.size === 'text-base' ? '1.5rem' :
                          currentFont.size === 'text-lg' ? '1.875rem' :
                            '2.125rem'
                    } !important;
                    line-height: 1.2 !important;
                    margin-top: ${currentFont.leading === 'leading-5' ? '0.75rem' :
                      currentFont.leading === 'leading-6' ? '0.875rem' :
                        currentFont.leading === 'leading-7' ? '1rem' :
                          currentFont.leading === 'leading-8' ? '1.25rem' :
                            '1.5rem'
                    } !important;
                    margin-bottom: ${currentFont.leading === 'leading-5' ? '0.375rem' :
                      currentFont.leading === 'leading-6' ? '0.5rem' :
                        currentFont.leading === 'leading-7' ? '0.625rem' :
                          currentFont.leading === 'leading-8' ? '0.75rem' :
                            '0.875rem'
                    } !important;
                    color: inherit !important;
                  }
                  .prose h3 {
                    font-size: ${currentFont.size === 'text-xs' ? '1rem' :
                      currentFont.size === 'text-sm' ? '1.125rem' :
                        currentFont.size === 'text-base' ? '1.25rem' :
                          currentFont.size === 'text-lg' ? '1.5rem' :
                            '1.75rem'
                    } !important;
                    line-height: 1.2 !important;
                    margin-top: ${currentFont.leading === 'leading-5' ? '0.625rem' :
                      currentFont.leading === 'leading-6' ? '0.75rem' :
                        currentFont.leading === 'leading-7' ? '0.875rem' :
                          currentFont.leading === 'leading-8' ? '1rem' :
                            '1.125rem'
                    } !important;
                    margin-bottom: ${currentFont.leading === 'leading-5' ? '0.25rem' :
                      currentFont.leading === 'leading-6' ? '0.375rem' :
                        currentFont.leading === 'leading-7' ? '0.5rem' :
                          currentFont.leading === 'leading-8' ? '0.625rem' :
                            '0.75rem'
                    } !important;
                    color: inherit !important;
                  }
                  .prose h4, .prose h5, .prose h6 {
                    color: inherit !important;
                  }
                  .prose strong, .prose b {
                    color: inherit !important;
                  }
                  .prose em, .prose i {
                    color: inherit !important;
                  }
                  .prose a {
                    color: inherit !important;
                  }
                  .prose blockquote {
                    color: inherit !important;
                  }
                  .prose ul, .prose ol {
                    margin-top: ${currentFont.leading === 'leading-6' ? '0.5rem' : currentFont.leading === 'leading-7' ? '0.625rem' : '0.75rem'} !important;
                    margin-bottom: ${currentFont.leading === 'leading-6' ? '0.75rem' : currentFont.leading === 'leading-7' ? '0.875rem' : '1rem'} !important;
                    padding-left: 1.5em !important;
                  }
                  .prose li {
                    margin-bottom: ${currentFont.leading === 'leading-6' ? '0.25rem' : currentFont.leading === 'leading-7' ? '0.375rem' : '0.5rem'} !important;
                  }
                  .prose blockquote {
                    margin-top: ${currentFont.leading === 'leading-6' ? '0.75rem' : currentFont.leading === 'leading-7' ? '0.875rem' : '1rem'} !important;
                    margin-bottom: ${currentFont.leading === 'leading-6' ? '0.75rem' : currentFont.leading === 'leading-7' ? '0.875rem' : '1rem'} !important;
                    padding-left: 1em !important;
                    padding-right: 1em !important;
                  }
                  .prose pre {
                    margin-top: ${currentFont.leading === 'leading-6' ? '0.75rem' : currentFont.leading === 'leading-7' ? '0.875rem' : '1rem'} !important;
                    margin-bottom: ${currentFont.leading === 'leading-6' ? '0.75rem' : currentFont.leading === 'leading-7' ? '0.875rem' : '1rem'} !important;
                    padding: 0.75rem 1rem !important;
                    overflow-x: auto !important;
                    font-size: ${currentFont.size === 'text-xs' ? '0.75rem' :
                      currentFont.size === 'text-sm' ? '0.875rem' :
                        currentFont.size === 'text-base' ? '1rem' :
                          currentFont.size === 'text-lg' ? '1.125rem' :
                            '1.25rem'
                    } !important;
                    line-height: ${currentFont.leading === 'leading-5' ? '1.25rem' :
                      currentFont.leading === 'leading-6' ? '1.5rem' :
                        currentFont.leading === 'leading-7' ? '1.75rem' :
                          currentFont.leading === 'leading-8' ? '2rem' :
                            '2.25rem'
                    } !important;
                  }
                  /* 移除 Tailwind Typography 默认的反引号 */
                  .prose code::before,
                  .prose code::after {
                    content: none !important;
                  }

                  /* 内联代码样式 - 不在 pre 中的 code */
                  .prose :not(pre) > code {
                    background-color: rgba(175, 184, 193, 0.2) !important;
                    padding: 0.2em 0.4em !important;
                    border-radius: 3px !important;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
                    font-size: 0.875em !important;
                    font-weight: 400 !important;
                    color: #eb5757 !important;
                    border: 1px solid rgba(175, 184, 193, 0.3) !important;
                  }

                  /* 代码块中的 code */
                  .prose pre code {
                    font-size: inherit !important;
                    color: inherit !important;
                    background-color: transparent !important;
                    padding: 0 !important;
                    border: none !important;
                  }
                  
                  /* 强制覆盖 Tailwind Typography 的默认样式 */
                  .prose > pre {
                    font-size: ${currentFont.size === 'text-xs' ? '0.75rem' :
                      currentFont.size === 'text-sm' ? '0.875rem' :
                        currentFont.size === 'text-base' ? '1rem' :
                          currentFont.size === 'text-lg' ? '1.125rem' :
                            '1.25rem'
                    } !important;
                  }
                  
                  .prose > pre > code {
                    font-size: inherit !important;
                  }

                  /* KaTeX 数学公式样式 */
                  .prose .katex {
                    color: inherit !important;
                  }
                  .prose .katex-display {
                    color: inherit !important;
                  }
                  .prose .katex-html {
                    color: inherit !important;
                  }
                `}</style>
                  {renderedMarkdown}
                </article>
              </div>
            ) : (
              /* PDF 预览模式 - LaTeX 论文风格的 A4 页面，带动态缩放 */
              <div className="pdf-preview-container" style={{
                width: '100%',
                height: '100%',
              }}>
                <div
                  id="print-target"
                  style={{
                    width: '210mm',
                    minHeight: '297mm',
                    padding: '20mm 25mm',
                    fontFamily: currentFontFamily.family,
                    fontSize: currentFont.size === 'text-sm' ? '10pt' : currentFont.size === 'text-base' ? '11pt' : '12pt',
                    lineHeight: '1.5',
                    color: '#000',
                    backgroundColor: '#ffffff',
                    transform: `scale(${pdfScale})`,
                    transformOrigin: 'top left',
                    boxSizing: 'border-box',
                    transition: 'transform 0.2s ease-out',
                  }}
                >
                  <style>{`
                #print-target {
                  background-color: #ffffff !important;
                }
                #print-target * {
                  background-color: transparent !important;
                }
                #print-target h1 {
                  font-size: 18pt;
                  font-weight: 700;
                  margin-top: 0;
                  margin-bottom: 12pt;
                  text-align: center;
                  line-height: 1.2;
                  color: #000 !important;
                }
                #print-target h2 {
                  font-size: 14pt;
                  font-weight: 600;
                  margin-top: 16pt;
                  margin-bottom: 8pt;
                  line-height: 1.2;
                  color: #000 !important;
                }
                #print-target h3 {
                  font-size: 12pt;
                  font-weight: 600;
                  margin-top: 12pt;
                  margin-bottom: 6pt;
                  line-height: 1.2;
                  color: #000 !important;
                }
                #print-target p {
                  margin-top: 0;
                  margin-bottom: 8pt;
                  text-align: justify;
                  text-indent: 0;
                  color: #000 !important;
                }
                #print-target ul, #print-target ol {
                  margin-top: 6pt;
                  margin-bottom: 8pt;
                  padding-left: 1.5em;
                  color: #000 !important;
                }
                #print-target li {
                  margin-bottom: 3pt;
                  color: #000 !important;
                }
                #print-target code {
                  font-family: 'Courier New', monospace;
                  font-size: 10pt;
                  background: #f5f5f5 !important;
                  padding: 2px 4px;
                  border-radius: 2px;
                  color: #000 !important;
                }
                #print-target pre {
                  background: #f5f5f5 !important;
                  padding: 12pt;
                  margin: 12pt 0;
                  border-left: 3pt solid #ddd;
                  overflow-x: auto;
                  font-size: 10pt;
                  line-height: 1.4;
                }
                #print-target pre code {
                  background: transparent !important;
                  color: #000 !important;
                }
                #print-target blockquote {
                  margin: 12pt 0;
                  padding: 8pt 16pt;
                  border-left: 4pt solid #ddd;
                  background: #fafafa !important;
                  font-style: italic;
                  color: #000 !important;
                }
                #print-target table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 12pt 0;
                  font-size: 10pt;
                  color: #000 !important;
                }
                #print-target th, #print-target td {
                  border: 1pt solid #ddd;
                  padding: 6pt 10pt;
                  text-align: left;
                  color: #000 !important;
                  background: transparent !important;
                }
                #print-target th {
                  background: #f5f5f5 !important;
                  font-weight: 600;
                  color: #000 !important;
                }
                #print-target a {
                  color: #0066cc !important;
                  text-decoration: none;
                }
                #print-target hr {
                  border: none;
                  border-top: 1pt solid #ddd;
                  margin: 16pt 0;
                }
              `}</style>
                  <article>
                    {renderedMarkdown}
                  </article>
            )}
          </section>
        )}

      </main>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        isDangerous={true}
        position={confirmDialog.position}
      />

      {/* Settings Dialog */}
      {showSettingsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Settings
              </h2>
              <button
                onClick={() => setShowSettingsDialog(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attachment Folder
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Folder name for Obsidian-style image references (e.g., ![[image.png]])
                </p>
                <input
                  type="text"
                  value={attachmentFolder}
                  onChange={(e) => setAttachmentFolder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="00- Attachment"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Common folders: "00- Attachment", "attachments", "assets", "images"
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSettingsDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Word Count Status Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        padding: '4px 12px',
        fontSize: '12px',
        color: appTextColor,
        opacity: 0.6,
        backgroundColor: appBgColor,
        borderTop: `1px solid ${isDarkMode ? '#333' : '#ddd'}`,
        zIndex: 10
      }}>
        {chars} 字符 · {words} 单词 · {lines} 行
      </div>

      {/* WebDAV Settings Dialog */}
      {showWebDAVSettings && (
        <WebDAVSettings onClose={() => setShowWebDAVSettings(false)} />
      )}
    </div>
  );
}

export default App;