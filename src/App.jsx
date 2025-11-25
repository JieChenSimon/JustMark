import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile, readTextFile, readDir, remove, mkdir } from '@tauri-apps/plugin-fs';
import 'katex/dist/katex.min.css';
import { useGit } from './hooks/useGit';
import { GitPanel } from './components/GitPanel';

// ==============================================
// 🛠️ 核心配置
// ==============================================
const HEADER_HEIGHT = "h-8";

// 广受好评的字体配置（包含中文支持）
const FONT_FAMILIES = [
  {
    name: 'System Default',
    nameZh: '系统默认',
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    description: 'Clean and modern'
  },
  {
    name: 'Monospace',
    nameZh: '等宽字体',
    family: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    description: 'Perfect for code'
  },
  {
    name: 'Serif',
    nameZh: '衬线字体',
    family: 'Georgia, Cambria, "Times New Roman", Times, serif',
    description: 'Classic and elegant'
  },
  {
    name: 'PingFang SC',
    nameZh: '苹方-简',
    family: '"PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif',
    description: 'Apple Chinese (Simplified)'
  },
  {
    name: 'PingFang TC',
    nameZh: '苹方-繁',
    family: '"PingFang TC", -apple-system, BlinkMacSystemFont, sans-serif',
    description: 'Apple Chinese (Traditional)'
  },
  {
    name: 'Hiragino Sans',
    nameZh: '冬青黑体',
    family: '"Hiragino Sans GB", "Hiragino Sans", "Microsoft YaHei", 微软雅黑, sans-serif',
    description: 'Elegant Chinese/Japanese'
  },
  {
    name: 'STSong',
    nameZh: '华文宋体',
    family: 'STSong, "Songti SC", SimSun, serif',
    description: 'Traditional Chinese serif'
  },
  {
    name: 'Noto Sans',
    nameZh: 'Noto 黑体',
    family: '"Noto Sans SC", "Noto Sans", sans-serif',
    description: 'Google multilingual'
  },
  {
    name: 'Source Han Sans',
    nameZh: '思源黑体',
    family: '"Source Han Sans SC", "Source Han Sans CN", sans-serif',
    description: 'Adobe open source'
  },
];

const FONT_OPTIONS = [
  { label: 'Small',  size: 'text-sm',  leading: 'leading-6',  name: '默认' },
  { label: 'Medium', size: 'text-base', leading: 'leading-7', name: '中号' },
  { label: 'Large',  size: 'text-lg',   leading: 'leading-8', name: '大号' },
];

// 阅读背景色配置（仅用于预览区）
const BACKGROUND_COLORS = [
  {
    name: 'Paper White',
    bg: '#FFFFFF',
    text: '#1D1D1F',
    description: 'Pure & clean'
  },
  {
    name: 'Light Gray',
    bg: '#F5F5F7',
    text: '#1D1D1F',
    description: 'Default neutral'
  },
  {
    name: 'Sepia',
    bg: '#F4ECD8',
    text: '#3D2817',
    description: 'Warm & comfortable'
  },
  {
    name: 'Green Tea',
    bg: '#E3EDCD',
    text: '#2C3A1E',
    description: 'Eye protection'
  },
  {
    name: 'Blue Light',
    bg: '#E8F4F8',
    text: '#1F3A47',
    description: 'Calm & soothing'
  },
];

function InlineCreateRow({
  level,
  type,
  value,
  inputRef,
  onChange,
  onConfirm,
  onCancel
}) {
  const indent = level * 12;
  return (
    <div
      className="w-full px-2 py-1 text-left text-[11px] flex items-center gap-1.5 transition-all group"
      style={{ paddingLeft: `${indent + 8}px` }}
    >
      <span className="flex-shrink-0">{type === 'folder' ? '📁' : '📄'}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className="flex-1 bg-transparent border-b border-gray-300 dark:border-gray-600 text-[11px] text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
        placeholder={type === 'folder' ? '新建文件夹' : '新建文件'}
        autoComplete="off"
      />
    </div>
  );
}

// 文件树组件
function FileTreeItem({
  entry,
  basePath,
  level,
  currentFilePath,
  expandedFolders,
  onToggleFolder,
  onOpenFile,
  getSubfolderContents,
  onStartInlineCreate,
  onDeleteEntry,
  onSelectEntry,
  inlineCreate,
  inlineInputRef,
  onInlineChange,
  onInlineConfirm,
  onInlineCancel
}) {
  const [children, setChildren] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const fullPath = basePath + '/' + entry.name;
  const isExpanded = expandedFolders.has(fullPath);
  const isSelected = currentFilePath === fullPath;
  const indent = level * 12;

  useEffect(() => {
    if (entry.isDirectory && isExpanded && children.length === 0) {
      setIsLoading(true);
      getSubfolderContents(fullPath).then(contents => {
        setChildren(contents);
        setIsLoading(false);
      });
    }
  }, [isExpanded]);

  const handleClick = () => {
    console.log('点击文件/文件夹:', entry.name, '完整路径:', fullPath, '是否为目录:', entry.isDirectory);
    if (onSelectEntry) {
      onSelectEntry(fullPath, entry.isDirectory);
    }
    if (entry.isDirectory) {
      onToggleFolder(fullPath);
    } else {
      console.log('调用 onOpenFile:', fullPath);
      onOpenFile(fullPath);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSelectEntry) {
      onSelectEntry(fullPath, entry.isDirectory);
    }
    
    // 获取鼠标位置
    const x = e.clientX;
    const y = e.clientY;
    
    setContextMenu({
      x,
      y,
      type: entry.isDirectory ? 'folder' : 'file',
      path: fullPath
    });
  };

  // 点击其他地方关闭菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`w-full px-2 py-1 text-left text-[11px] flex items-center gap-1.5 transition-all group ${
          isSelected
            ? 'bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {entry.isDirectory && (
          <svg
            className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''} ${
              isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {!entry.isDirectory && <span className="w-3" />}
        <span className={`flex-shrink-0 ${isSelected ? 'opacity-100' : 'opacity-70'}`}>
          {entry.isDirectory ? '📁' : '📄'}
        </span>
        <span className={`truncate ${isSelected ? 'font-medium' : 'font-normal'}`}>
          {entry.name}
        </span>
      </button>

      {/* macOS 风格的右键菜单 */}
      {contextMenu && contextMenu.path === fullPath && (
        <div
          className="fixed z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 rounded-lg shadow-lg overflow-hidden"
          style={{ 
            top: `${Math.min(contextMenu.y, window.innerHeight - 120)}px`, 
            left: `${contextMenu.x}px`,
            minWidth: '160px'
          }}
        >
          {contextMenu.type === 'folder' && (
            <>
              <button
                onClick={() => {
                  onStartInlineCreate(fullPath, 'file');
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-[11px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/60 active:bg-gray-200/60 dark:active:bg-gray-600/60 transition-colors flex items-center gap-2.5"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>新建文件</span>
              </button>
              <button
                onClick={() => {
                  onStartInlineCreate(fullPath, 'folder');
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-[11px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/60 active:bg-gray-200/60 dark:active:bg-gray-600/60 transition-colors flex items-center gap-2.5"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
                </svg>
                <span>新建文件夹</span>
              </button>
              <div className="border-t border-gray-200/50 dark:border-gray-700/50 my-0.5" />
            </>
          )}
          <button
            onClick={() => {
              onDeleteEntry(fullPath);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-500/10 active:bg-red-100/60 dark:active:bg-red-500/20 transition-colors flex items-center gap-2.5"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4v2h16V7h-3z" />
            </svg>
            <span>删除</span>
          </button>
        </div>
      )}

      {entry.isDirectory && isExpanded && (
        <div>
          {isLoading ? (
            <div className="px-2 py-1 text-[10px] text-gray-400 dark:text-gray-500" style={{ paddingLeft: `${indent + 24}px` }}>
              Loading...
            </div>
          ) : (
            children.map((child, index) => (
              <FileTreeItem
                key={index}
                entry={child}
                basePath={fullPath}
                level={level + 1}
                currentFilePath={currentFilePath}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onOpenFile={onOpenFile}
                getSubfolderContents={getSubfolderContents}
                onStartInlineCreate={onStartInlineCreate}
                onDeleteEntry={onDeleteEntry}
                inlineCreate={inlineCreate}
                inlineInputRef={inlineInputRef}
                onInlineChange={onInlineChange}
                onInlineConfirm={onInlineConfirm}
                onInlineCancel={onInlineCancel}
                onSelectEntry={onSelectEntry}
              />
            ))
          )}
          {inlineCreate && inlineCreate.parentPath === fullPath && (
            <InlineCreateRow
              level={level + 1}
              type={inlineCreate.type}
              value={inlineCreate.value}
              inputRef={inlineInputRef}
              onChange={onInlineChange}
              onConfirm={onInlineConfirm}
              onCancel={onInlineCancel}
            />
          )}
        </div>
      )}
    </>
  );
}

// 从 localStorage 加载保存的状态
const loadSavedState = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error(`加载状态失败 (${key}):`, error);
  }
  return defaultValue;
};

// 保存状态到 localStorage
const saveState = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`保存状态失败 (${key}):`, error);
  }
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
  const [isDarkMode, setIsDarkMode] = useState(() => loadSavedState('isDarkMode', false));
  const [fontIndex, setFontIndex] = useState(() => loadSavedState('fontIndex', 0));
  const [fontFamilyIndex, setFontFamilyIndex] = useState(() => loadSavedState('fontFamilyIndex', 1));
  const [bgColorIndex, setBgColorIndex] = useState(() => loadSavedState('bgColorIndex', 0));
  const [previewBgColorIndex, setPreviewBgColorIndex] = useState(() => loadSavedState('previewBgColorIndex', null)); // null 表示使用主题颜色
  const [showPreviewBgColorMenu, setShowPreviewBgColorMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState(() => loadSavedState('currentFilePath', null));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showBgColorMenu, setShowBgColorMenu] = useState(false);
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [previewMode, setPreviewMode] = useState(() => loadSavedState('previewMode', 'markdown'));
  const [showIndicator, setShowIndicator] = useState(true);
  const [showBgColorWarning, setShowBgColorWarning] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(() => loadSavedState('sidebarVisible', false));
  const [sidebarView, setSidebarView] = useState(() => loadSavedState('sidebarView', 'files'));
  const [currentFolder, setCurrentFolder] = useState(() => loadSavedState('currentFolder', null));
  const [folderContents, setFolderContents] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(() => {
    const saved = loadSavedState('expandedFolders', []);
    return new Set(saved);
  });
  const indicatorTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  // Git 集成
  const git = useGit(currentFolder);
  const [gitPanelVisible, setGitPanelVisible] = useState(false);
  const [pdfScale, setPdfScale] = useState(1);
  const pdfContainerRef = useRef(null);

  // 可调整面板宽度
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSavedState('sidebarWidth', 224));
  const [editorWidth, setEditorWidth] = useState(() => loadSavedState('editorWidth', 50));
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);

  // 目录上下文 & 内联新建
  const [selectedSidebarEntry, setSelectedSidebarEntry] = useState(null); // { path: string, isDirectory: boolean }
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef(null);
  const [inlineCreate, setInlineCreate] = useState(null); // { parentPath: string, type: 'file'|'folder', value: string }
  const inlineCreateInputRef = useRef(null);

  // 保存状态到 localStorage
  useEffect(() => {
    saveState('isDarkMode', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    saveState('fontIndex', fontIndex);
  }, [fontIndex]);

  useEffect(() => {
    saveState('fontFamilyIndex', fontFamilyIndex);
  }, [fontFamilyIndex]);

  useEffect(() => {
    saveState('bgColorIndex', bgColorIndex);
    // 切换主题时，重置预览区颜色为主题颜色
    setPreviewBgColorIndex(null);
  }, [bgColorIndex]);

  useEffect(() => {
    saveState('previewBgColorIndex', previewBgColorIndex);
  }, [previewBgColorIndex]);

  useEffect(() => {
    saveState('currentFilePath', currentFilePath);
  }, [currentFilePath]);

  useEffect(() => {
    saveState('previewMode', previewMode);
  }, [previewMode]);

  useEffect(() => {
    saveState('sidebarVisible', sidebarVisible);
  }, [sidebarVisible]);

  useEffect(() => {
    saveState('sidebarView', sidebarView);
  }, [sidebarView]);

  useEffect(() => {
    saveState('currentFolder', currentFolder);
  }, [currentFolder]);

  useEffect(() => {
    saveState('expandedFolders', Array.from(expandedFolders));
  }, [expandedFolders]);

  useEffect(() => {
    saveState('sidebarWidth', sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    saveState('editorWidth', editorWidth);
  }, [editorWidth]);

  // 定义 loadFolderContents 函数需要在这里之前声明，所以我们移除这个 useEffect
  // 恢复逻辑将在 loadFolderContents 定义之后添加

  const toggleTheme = () => {
    // 使用 requestAnimationFrame 优化主题切换性能
    requestAnimationFrame(() => {
      setIsDarkMode(!isDarkMode);
    });
  };

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

  // 处理侧边栏拖动
  useEffect(() => {
    if (!isDraggingSidebar) return;

    // 防止拖动时选中文本和闪动
    document.body.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    let animationFrameId = null;

    const handleMouseMove = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 使用 requestAnimationFrame 优化性能
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        const newWidth = e.clientX;
        if (newWidth >= 150 && newWidth <= 400) {
          setSidebarWidth(newWidth);
        }
      });
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      document.body.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDraggingSidebar]);

  // 处理编辑器/预览区拖动
  useEffect(() => {
    if (!isDraggingEditor) return;

    // 防止拖动时选中文本和闪动
    document.body.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    let animationFrameId = null;

    const handleMouseMove = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 使用 requestAnimationFrame 优化性能
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        const container = document.querySelector('main');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const newPercent = ((e.clientX - rect.left) / rect.width) * 100;

        if (newPercent >= 20 && newPercent <= 80) {
          setEditorWidth(newPercent);
        }
      });
    };

    const handleMouseUp = () => {
      setIsDraggingEditor(false);
      document.body.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDraggingEditor]);

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
      // 如果正在输入新建名称，不处理快捷键
      if (inlineCreate) return;

      // 检测 Mac 的 Cmd 键或 Windows/Linux 的 Ctrl 键
      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        switch(e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            handleNew({ fromHotkey: true });
            break;
          case 'o':
            e.preventDefault();
            handleOpen();
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, currentFilePath, markdown, inlineCreate]);

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

  const handleSelectSidebarEntry = (path, isDirectory) => {
    setSelectedSidebarEntry({ path, isDirectory });
  };

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

  const startCreateEntryFromContext = (folderPath, type = 'file') => {
    startInlineCreate(type, folderPath);
  };

  const cancelInlineCreate = () => {
    setInlineCreate(null);
  };

  const confirmInlineCreate = async () => {
    if (!inlineCreate || !inlineCreate.value.trim()) return;

    const fileName = inlineCreate.value.trim();
    const folderPath = inlineCreate.parentPath;
    const isFolder = inlineCreate.type === 'folder';

    if (!/^[\w\-. ]+$/.test(fileName)) {
      alert('❌ 名称包含不允许的字符！只能使用字母、数字、下划线、连字符、点和空格。');
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
    try {
      await remove(targetPath, { recursive: true });
    } catch (error) {
      console.warn('remove API 删除失败，尝试使用 shell:', error);
      try {
        const { Command } = await import('@tauri-apps/plugin-shell');
        const isWindows = navigator.userAgent.toUpperCase().includes('WINDOWS');

        if (isWindows) {
          const quotedPath = `"${targetPath}"`;
          const cmd = new Command('cmd', ['/C', 'rd', '/s', '/q', quotedPath]);
          const result = await cmd.execute();
          if (result.code !== 0) {
            throw new Error(result.stderr || 'cmd 删除失败');
          }
        } else {
          const cmd = new Command('rm', ['-rf', targetPath]);
          const result = await cmd.execute();
          if (result.code !== 0) {
            throw new Error(result.stderr || 'rm 删除失败');
          }
        }
      } catch (shellError) {
        console.error('shell 删除同时失败:', shellError);
        throw error ?? shellError;
      }
    }
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

  // 切换文件夹展开/折叠
  const toggleFolder = async (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  // 加载文件夹内容（根目录）
  const loadFolderContents = async (folderPath) => {
    try {
      setCurrentFolder(folderPath);
      const entries = await readDir(folderPath);

      // 只显示 markdown 文件和子文件夹
      const filtered = entries
        .filter(entry => {
          if (entry.isDirectory) return true;
          const name = entry.name.toLowerCase();
          return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
        })
        .sort((a, b) => {
          // 文件夹在前，文件在后
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      setFolderContents(filtered);
      // 默认展开根目录
      setExpandedFolders(new Set([folderPath]));
    } catch (error) {
      console.error('读取文件夹失败:', error);
    }
  };

  // 递归读取子文件夹内容
  const getSubfolderContents = async (folderPath) => {
    try {
      const entries = await readDir(folderPath);
      return entries
        .filter(entry => {
          if (entry.isDirectory) return true;
          const name = entry.name.toLowerCase();
          return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
        })
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch (error) {
      console.error('读取子文件夹失败:', error);
      return [];
    }
  };

  // 从侧边栏打开文件
  const handleOpenFileFromSidebar = async (filePath) => {
    console.log('尝试打开文件:', filePath);
    try {
      const content = await readTextFile(filePath);
      console.log('文件读取成功，内容长度:', content.length);
      setMarkdown(content);
      setCurrentFilePath(filePath);
      setHasUnsavedChanges(false);
      setSelectedSidebarEntry({ path: filePath, isDirectory: false });
    } catch (error) {
      console.error('打开文件失败:', error);
      alert('❌ 打开文件失败: ' + error.message);
    }
  };

  // 刷新文件夹内容
  const refreshFolderContents = async (folderPath) => {
    try {
      const entries = await readDir(folderPath);
      const filtered = entries
        .filter(entry => {
          if (entry.isDirectory) return true;
          const name = entry.name.toLowerCase();
          return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
        })
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      // 如果是根目录，更新根目录内容
      if (currentFolder === folderPath) {
        setFolderContents(filtered);
      }

      // 如果文件夹已展开，刷新它
      if (expandedFolders.has(folderPath)) {
        setExpandedFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(folderPath);
          return newSet;
        });
        setTimeout(() => {
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.add(folderPath);
            return newSet;
          });
        }, 0);
      }
    } catch (error) {
      console.error('刷新文件夹失败:', error);
    }
  };

  // 删除文件或文件夹
  const handleDeleteFile = async (filePath) => {
    const fileName = filePath.split('/').pop();
    const confirmed = confirm(`确定要删除 "${fileName}" 吗？`);
    if (!confirmed) return;

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
      alert('❌ 删除文件失败: ' + (error?.message || error));
    }
  };

  // 保存文件
  const handleSave = async () => {
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
    } catch (error) {
      console.error('保存文件失败:', error);
      alert('❌ 保存失败: ' + error.message);
    }
  };

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
      alert('✅ 文件保存成功！');
    } catch (error) {
      console.error('保存文件失败:', error);
      alert('❌ 保存失败: ' + error.message);
    }
  };

  // 监听内容变化
  const handleMarkdownChange = (e) => {
    setMarkdown(e.target.value);
    setHasUnsavedChanges(true);
  };
  
  // 字体变大
  const increaseFontSize = () => {
    setFontIndex((prev) => Math.min(prev + 1, FONT_OPTIONS.length - 1));
  };

  // 字体变小
  const decreaseFontSize = () => {
    setFontIndex((prev) => Math.max(prev - 1, 0));
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

  const currentFont = FONT_OPTIONS[fontIndex];
  const currentFontFamily = FONT_FAMILIES[fontFamilyIndex];
  const currentBgColor = BACKGROUND_COLORS[bgColorIndex];

  // 应用颜色逻辑：
  // 1. 黑暗模式优先：如果开启黑暗模式，使用纯黑背景
  // 2. 否则使用主题颜色（浅色版本）
  const appBgColor = isDarkMode ? '#1A1A1A' : currentBgColor.bg;
  const appTextColor = isDarkMode ? '#E5E7EB' : currentBgColor.text;

  // 预览区颜色：如果设置了独立的预览区颜色，使用独立颜色；否则使用应用颜色
  const previewColor = previewBgColorIndex !== null ? BACKGROUND_COLORS[previewBgColorIndex] : null;
  const previewBgColor = previewColor ? previewColor.bg : appBgColor;
  const previewTextColor = previewColor ? previewColor.text : appTextColor;

  // 使用 useMemo 缓存 markdown 渲染内容，避免主题切换时重新渲染
  const renderedMarkdown = useMemo(() => (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {markdown}
    </ReactMarkdown>
  ), [markdown]);

  // 应用启动时恢复上次打开的文件和文件夹
  useEffect(() => {
    const restoreLastSession = async () => {
      const savedFilePath = loadSavedState('currentFilePath', null);
      const savedFolder = loadSavedState('currentFolder', null);
      const savedExpandedFolders = loadSavedState('expandedFolders', []);
      const savedSidebarVisible = loadSavedState('sidebarVisible', false);

      console.log('🔄 恢复会话:', {
        savedFolder,
        savedFilePath,
        savedExpandedFolders,
        savedSidebarVisible
      });

      // 如果有保存的文件夹，加载文件夹内容并显示侧边栏
      if (savedFolder) {
        try {
          // 确保侧边栏可见
          if (savedSidebarVisible) {
            setSidebarVisible(true);
          }

          // 先加载文件夹内容
          await loadFolderContents(savedFolder);
          console.log('✅ 文件夹内容已加载');

          // 然后恢复展开的文件夹状态
          if (savedExpandedFolders && savedExpandedFolders.length > 0) {
            console.log('📂 恢复展开的文件夹:', savedExpandedFolders);
            // 使用 setTimeout 确保状态更新在下一个事件循环
            setTimeout(() => {
              setExpandedFolders(new Set(savedExpandedFolders));
            }, 50);
          }
        } catch (error) {
          console.error('❌ 无法恢复文件夹:', error);
          saveState('currentFolder', null);
        }
      }

      // 如果有保存的文件，尝试加载
      if (savedFilePath) {
        try {
          const content = await readTextFile(savedFilePath);
          setMarkdown(content);
          setHasUnsavedChanges(false);
          console.log('✅ 成功恢复文件:', savedFilePath);
        } catch (error) {
          console.error('❌ 无法恢复文件:', error);
          // 文件不存在或无法读取，清除保存的路径
          saveState('currentFilePath', null);
          setCurrentFilePath(null);
        }
      }
    };

    // 延迟执行，确保组件完全挂载
    const timer = setTimeout(() => {
      restoreLastSession();
    }, 200);

    return () => clearTimeout(timer);
  }, []); // 空依赖数组，只在组件挂载时运行一次

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
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all flex items-center gap-1 ${
                  currentFolder
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
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        fontFamilyIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''
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
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                        bgColorIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''
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
            >
              {isExporting ? 'Cooking...' : 'Export'}
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
            width: `${editorWidth}%`,
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
              {sidebarView === 'files' ? (
                <>
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
                    {folderContents.map((entry, index) => (
                      <FileTreeItem
                        key={index}
                        entry={entry}
                        basePath={currentFolder}
                        level={0}
                        currentFilePath={currentFilePath}
                        expandedFolders={expandedFolders}
                        onToggleFolder={toggleFolder}
                        onOpenFile={handleOpenFileFromSidebar}
                        getSubfolderContents={getSubfolderContents}
                        onStartInlineCreate={startCreateEntryFromContext}
                      onDeleteEntry={handleDeleteFile}
                        inlineCreate={inlineCreate}
                        inlineInputRef={inlineCreateInputRef}
                        onInlineChange={handleInlineNameChange}
                        onInlineConfirm={confirmInlineCreate}
                        onInlineCancel={cancelInlineCreate}
                        onSelectEntry={handleSelectSidebarEntry}
                      />
                    ))}
                  </div>
                </>
              ) : (
                /* Git 源代码管理面板 */
                <GitPanel
                  gitStatus={git.status}
                  onStageFile={git.stageFile}
                  onUnstageFile={git.unstageFile}
                  onStageAll={git.stageAll}
                  onUnstageAll={git.unstageAll}
                  onCommit={git.commit}
                  onDiscardChanges={git.discardChanges}
                  onGetLog={git.getLog}
                  onClose={() => setSidebarVisible(false)}
                  appBgColor={appBgColor}
                  appTextColor={appTextColor}
                />
              )}
            </div>

            {/* 侧边栏拖动条 */}
            <div
              className="w-px bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-300/70 dark:hover:bg-gray-600/70 cursor-col-resize active:bg-blue-400/70 dark:active:bg-blue-500/70 transition-colors relative group"
              onMouseDown={() => setIsDraggingSidebar(true)}
            >
              <div className="absolute inset-y-0 -left-2 -right-2" />
            </div>
          </>
          )}

          {/* 编辑器文本区域 */}
          <div className="flex-1 relative flex flex-col">
            <textarea
              className={`flex-1 p-6 outline-none resize-none bg-transparent placeholder-gray-300 dark:placeholder-gray-600 ${currentFont.size} ${currentFont.leading}`}
              style={{
                fontFamily: currentFontFamily.family,
                color: appTextColor
              }}
              value={markdown}
              onChange={handleMarkdownChange}
              placeholder="JustMark..."
              spellCheck="false"
            />

            {/* 左下角：侧边栏导航按钮和文件名 */}
            <div className="absolute bottom-4 left-4 flex items-end gap-2 z-20">
              {/* 侧边栏导航按钮组 - 只在有文件夹时显示 */}
              {currentFolder && (
                <div className="flex flex-col gap-1">
                  {/* Git 源代码管理按钮 */}
                  <button
                    onClick={() => {
                      setSidebarView('git');
                      setSidebarVisible(true);
                    }}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-sm shadow-md transition-all active:scale-95 relative ${
                      sidebarVisible && sidebarView === 'git'
                        ? 'bg-blue-500/20 dark:bg-blue-500/30 border border-blue-400/50 dark:border-blue-400/50'
                        : 'bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/90 dark:hover:bg-gray-700/90 border border-gray-300/50 dark:border-gray-600/50'
                    }`}
                    title="源代码管理"
                  >
                    <svg className={`w-4 h-4 ${sidebarVisible && sidebarView === 'git' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    {/* 更改数量徽章 */}
                    {git.status?.hasChanges && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-md">
                        {git.status.files?.length > 9 ? '9+' : git.status.files?.length}
                      </span>
                    )}
                  </button>

                  {/* 文件浏览器按钮 */}
                  <button
                    onClick={() => {
                      setSidebarView('files');
                      setSidebarVisible(!sidebarVisible);
                    }}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-sm shadow-md transition-all active:scale-95 ${
                      sidebarVisible && sidebarView === 'files'
                        ? 'bg-blue-500/20 dark:bg-blue-500/30 border border-blue-400/50 dark:border-blue-400/50'
                        : 'bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/90 dark:hover:bg-gray-700/90 border border-gray-300/50 dark:border-gray-600/50'
                    }`}
                    title={sidebarVisible && sidebarView === 'files' ? '隐藏目录' : '显示目录'}
                  >
                    <svg className={`w-4 h-4 ${sidebarVisible && sidebarView === 'files' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                </div>
              )}

              {/* 文件名显示 */}
              {currentFilePath && (
                <span className="px-2.5 py-1 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 rounded-lg border border-gray-300/50 dark:border-gray-600/50 backdrop-blur-sm shadow-sm mb-0.5">
                  {currentFilePath.split('/').pop()}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 编辑器和预览区之间的分隔符 */}
        <div
          className="w-px bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-300/70 dark:hover:bg-gray-600/70 cursor-col-resize active:bg-blue-400/70 dark:active:bg-blue-500/70 transition-colors relative group"
          onMouseDown={() => setIsDraggingEditor(true)}
        >
          <div className="absolute inset-y-0 -left-2 -right-2" />
        </div>

        {/* 右侧：预览区 */}
        <section
          ref={pdfContainerRef}
          className="flex-1 h-full overflow-y-auto flex justify-center transition-colors duration-300 relative"
          style={{ backgroundColor: previewBgColor }}
          onClick={handlePreviewClick}
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
            <div className="absolute bottom-6 right-6 z-10">
              <div className="relative">
                <button
                  onClick={() => setShowPreviewBgColorMenu(!showPreviewBgColorMenu)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border border-gray-200/50 dark:border-gray-700/50 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all active:scale-95"
                  title="预览区颜色"
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white dark:border-gray-600"
                    style={{ backgroundColor: previewBgColor }}
                  ></div>
                </button>

                {/* 预览区颜色选项菜单 */}
                {showPreviewBgColorMenu && (
                  <div className="absolute right-0 bottom-10 w-48 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-lg shadow-xl z-50 overflow-hidden">
                    {/* 重置为主题颜色选项 */}
                    <button
                      onClick={() => {
                        setPreviewBgColorIndex(null);
                        setShowPreviewBgColorMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors flex items-center gap-2 ${
                        previewBgColorIndex === null ? 'bg-gray-100/80 dark:bg-gray-700/80' : ''
                      }`}
                    >
                      <div className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs">↺</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          使用主题颜色
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          跟随当前主题
                        </div>
                      </div>
                    </button>

                    {/* 分隔线 */}
                    <div className="border-t border-gray-200/50 dark:border-gray-700/50 my-1"></div>

                    {/* 颜色选项 */}
                    {BACKGROUND_COLORS.map((color, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setPreviewBgColorIndex(index);
                          setShowPreviewBgColorMenu(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors flex items-center gap-2 ${
                          previewBgColorIndex === index ? 'bg-gray-100/80 dark:bg-gray-700/80' : ''
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
              </div>
            </div>
          )}

          {previewMode === 'markdown' ? (
            /* Markdown 预览模式 - 正常网页效果 */
            <div className="w-full max-w-4xl p-6">
              <article
                className="prose max-w-none prose-headings:font-semibold"
                style={{
                  fontFamily: currentFontFamily.family,
                  color: previewTextColor
                }}
              >
                <style>{`
                  .prose {
                    font-size: ${currentFont.size === 'text-sm' ? '0.875rem' : currentFont.size === 'text-base' ? '1rem' : '1.125rem'} !important;
                    line-height: ${currentFont.leading === 'leading-6' ? '1.5rem' : currentFont.leading === 'leading-7' ? '1.75rem' : '2rem'} !important;
                  }
                  .prose p {
                    margin-top: 0 !important;
                    margin-bottom: ${currentFont.leading === 'leading-6' ? '0.75rem' : currentFont.leading === 'leading-7' ? '0.875rem' : '1rem'} !important;
                  }
                  .prose h1 {
                    font-size: ${currentFont.size === 'text-sm' ? '1.5rem' : currentFont.size === 'text-base' ? '1.875rem' : '2.25rem'} !important;
                    line-height: 1.2 !important;
                    margin-top: ${currentFont.leading === 'leading-6' ? '1rem' : currentFont.leading === 'leading-7' ? '1.25rem' : '1.5rem'} !important;
                    margin-bottom: ${currentFont.leading === 'leading-6' ? '0.5rem' : currentFont.leading === 'leading-7' ? '0.625rem' : '0.75rem'} !important;
                  }
                  .prose h2 {
                    font-size: ${currentFont.size === 'text-sm' ? '1.25rem' : currentFont.size === 'text-base' ? '1.5rem' : '1.875rem'} !important;
                    line-height: 1.2 !important;
                    margin-top: ${currentFont.leading === 'leading-6' ? '0.875rem' : currentFont.leading === 'leading-7' ? '1rem' : '1.25rem'} !important;
                    margin-bottom: ${currentFont.leading === 'leading-6' ? '0.5rem' : currentFont.leading === 'leading-7' ? '0.625rem' : '0.75rem'} !important;
                  }
                  .prose h3 {
                    font-size: ${currentFont.size === 'text-sm' ? '1.125rem' : currentFont.size === 'text-base' ? '1.25rem' : '1.5rem'} !important;
                    line-height: 1.2 !important;
                    margin-top: ${currentFont.leading === 'leading-6' ? '0.75rem' : currentFont.leading === 'leading-7' ? '0.875rem' : '1rem'} !important;
                    margin-bottom: ${currentFont.leading === 'leading-6' ? '0.375rem' : currentFont.leading === 'leading-7' ? '0.5rem' : '0.625rem'} !important;
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
                  }
                  .prose code {
                    font-size: ${currentFont.size === 'text-sm' ? '0.8125rem' : currentFont.size === 'text-base' ? '0.9375rem' : '1.0625rem'} !important;
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
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

export default App;