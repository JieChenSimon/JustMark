import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile, readTextFile, readDir } from '@tauri-apps/plugin-fs';

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

// 广受好评的阅读背景色配置
const BACKGROUND_COLORS = [
  {
    name: 'Light Gray',
    bgLight: '#F5F5F7',
    bgDark: '#111',
    description: 'Default neutral'
  },
  {
    name: 'Sepia',
    bgLight: '#F4ECD8',
    bgDark: '#2B2416',
    description: 'Warm & comfortable'
  },
  {
    name: 'Green Tea',
    bgLight: '#E3EDCD',
    bgDark: '#1C2614',
    description: 'Eye protection'
  },
  {
    name: 'Paper White',
    bgLight: '#FEFEFE',
    bgDark: '#0D0D0D',
    description: 'Pure & clean'
  },
  {
    name: 'Blue Light',
    bgLight: '#E8F4F8',
    bgDark: '#0F1E23',
    description: 'Calm & soothing'
  },
];

// 文件树组件
function FileTreeItem({ entry, basePath, level, currentFilePath, expandedFolders, onToggleFolder, onOpenFile, getSubfolderContents }) {
  const [children, setChildren] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
    if (entry.isDirectory) {
      onToggleFolder(fullPath);
    } else {
      onOpenFile(fullPath);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
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
              />
            ))
          )}
        </div>
      )}
    </>
  );
}

function App() {
  const [markdown, setMarkdown] = useState("### JustMark\n Write in a single way...");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontIndex, setFontIndex] = useState(0);
  const [fontFamilyIndex, setFontFamilyIndex] = useState(1); // 默认使用 Georgia (衬线字体)
  const [bgColorIndex, setBgColorIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showBgColorMenu, setShowBgColorMenu] = useState(false);
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [previewMode, setPreviewMode] = useState('markdown'); // 'markdown' or 'pdf'
  const [showIndicator, setShowIndicator] = useState(true);
  const [showBgColorWarning, setShowBgColorWarning] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderContents, setFolderContents] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const indicatorTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

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

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 检测 Mac 的 Cmd 键或 Windows/Linux 的 Ctrl 键
      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        switch(e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            handleNew();
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
  }, [hasUnsavedChanges, currentFilePath, markdown]);

  // 切换字体
  const handleFontChange = (index) => {
    setFontFamilyIndex(index);
    setShowFontMenu(false);
  };

  // 切换背景色
  const handleBgColorChange = (index) => {
    setBgColorIndex(index);
    setShowBgColorMenu(false);
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

  // 新建文件
  const handleNew = () => {
    if (hasUnsavedChanges) {
      const confirmed = confirm('当前文档有未保存的更改，确定要新建文档吗？');
      if (!confirmed) return;
    }
    setMarkdown('');
    setCurrentFilePath(null);
    setHasUnsavedChanges(false);
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
    try {
      const content = await readTextFile(filePath);
      setMarkdown(content);
      setCurrentFilePath(filePath);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('打开文件失败:', error);
      alert('❌ 打开文件失败: ' + error.message);
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
  const isPaperWhite = currentBgColor.name === 'Paper White';
  const previewBgColor = isDarkMode && isPaperWhite
    ? currentBgColor.bgLight
    : (isDarkMode ? currentBgColor.bgDark : currentBgColor.bgLight);
  const shouldInvertPreview = isDarkMode && !isPaperWhite;

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen w-screen flex flex-col transition-colors duration-300`}>
      
      {/* 添加打印样式 */}
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
      `}</style>
      
      {/* === 工具栏 === */}
      <header className={`${HEADER_HEIGHT} flex-none z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300`}>
        
        <div className="h-full flex items-center justify-between px-4">

          {/* 左侧：macOS窗口控制区域占位 + 文件操作按钮 */}
          <div className="flex items-center gap-0.5">
            {/* macOS窗口控制按钮占位 (红黄绿) */}
            <div className="w-14"></div>

            <button
              onClick={handleNew}
              className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all"
              title="New (Cmd+N)"
            >
              New
            </button>

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

          {/* 中间：应用名称 */}
          <div className="flex-1 flex items-center justify-center">
            <span
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '14px',
                fontWeight: '300',
                letterSpacing: '0.15em',
                color: isDarkMode ? '#e5e7eb' : '#374151'
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
                          backgroundColor:
                            isDarkMode && color.name === 'Paper White'
                              ? color.bgLight
                              : (isDarkMode ? color.bgDark : color.bgLight)
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

        {/* 左侧：输入区 + 文件浏览器 */}
        <section className="w-1/2 h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors duration-300 relative flex">
          {/* 文件浏览器侧边栏 - macOS 风格 */}
          {sidebarVisible && currentFolder && (
            <div
              className="w-56 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50 flex flex-col transition-all duration-300 ease-out"
            >
              {/* 侧边栏头部 - macOS 风格 */}
              <div className="h-10 px-3 flex items-center justify-between border-b border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-b from-gray-50/80 to-white/60 dark:from-gray-800/80 dark:to-gray-900/60">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate">
                    {currentFolder.split('/').pop() || 'Files'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
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
              </div>

              {/* 文件树列表 */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 custom-scrollbar">
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
                  />
                ))}
              </div>
            </div>
          )}

          {/* 编辑器文本区域 */}
          <div className="flex-1 relative flex flex-col">
            <textarea
              className={`flex-1 p-6 outline-none resize-none text-gray-700 dark:text-gray-300 bg-transparent placeholder-gray-300 dark:placeholder-gray-600 ${currentFont.size} ${currentFont.leading}`}
              style={{
                fontFamily: currentFontFamily.family
              }}
              value={markdown}
              onChange={handleMarkdownChange}
              placeholder="开始输入..."
              spellCheck="false"
            />

            {/* 左下角：文件夹按钮和文件名 */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20">
              {/* 切换侧边栏按钮 - 只在有文件夹时显示 */}
              {currentFolder && (
                <button
                  onClick={() => setSidebarVisible(!sidebarVisible)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/90 dark:hover:bg-gray-700/90 border border-gray-300/50 dark:border-gray-600/50 backdrop-blur-sm shadow-md transition-all active:scale-95"
                  title={sidebarVisible ? '隐藏目录' : '显示目录'}
                >
                  <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </button>
              )}
              {/* 文件名显示 */}
              {currentFilePath && (
                <span className="px-2.5 py-1 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 rounded-lg border border-gray-300/50 dark:border-gray-600/50 backdrop-blur-sm shadow-sm">
                  {currentFilePath.split('/').pop()}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 右侧：预览区 */}
        <section
          className="w-1/2 h-full overflow-y-auto p-6 flex justify-center transition-colors duration-300 relative"
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

          {previewMode === 'markdown' ? (
            /* Markdown 预览模式 - 正常网页效果 */
            <div className="w-full max-w-4xl">
              <article
                className={`prose max-w-none prose-headings:font-semibold ${shouldInvertPreview ? 'dark:prose-invert' : ''}`}
                style={{ 
                  fontFamily: currentFontFamily.family,
                  color: shouldInvertPreview ? undefined : '#111827'
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdown}
                </ReactMarkdown>
              </article>
            </div>
          ) : (
            /* PDF 预览模式 - LaTeX 论文风格的 A4 页面 */
            <div
              id="print-target"
              className="bg-white shadow-2xl"
              style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '20mm 25mm',
                fontFamily: currentFontFamily.family,
                fontSize: currentFont.size === 'text-sm' ? '10pt' : currentFont.size === 'text-base' ? '11pt' : '12pt',
                lineHeight: '1.5',
                color: '#000',
              }}
            >
              <style>{`
                #print-target h1 {
                  font-size: 18pt;
                  font-weight: 700;
                  margin-top: 0;
                  margin-bottom: 12pt;
                  text-align: center;
                  line-height: 1.2;
                }
                #print-target h2 {
                  font-size: 14pt;
                  font-weight: 600;
                  margin-top: 16pt;
                  margin-bottom: 8pt;
                  line-height: 1.2;
                }
                #print-target h3 {
                  font-size: 12pt;
                  font-weight: 600;
                  margin-top: 12pt;
                  margin-bottom: 6pt;
                  line-height: 1.2;
                }
                #print-target p {
                  margin-top: 0;
                  margin-bottom: 8pt;
                  text-align: justify;
                  text-indent: 0;
                }
                #print-target ul, #print-target ol {
                  margin-top: 6pt;
                  margin-bottom: 8pt;
                  padding-left: 1.5em;
                }
                #print-target li {
                  margin-bottom: 3pt;
                }
                #print-target code {
                  font-family: 'Courier New', monospace;
                  font-size: 10pt;
                  background: #f5f5f5;
                  padding: 2px 4px;
                  border-radius: 2px;
                }
                #print-target pre {
                  background: #f5f5f5;
                  padding: 12pt;
                  margin: 12pt 0;
                  border-left: 3pt solid #ddd;
                  overflow-x: auto;
                  font-size: 10pt;
                  line-height: 1.4;
                }
                #print-target blockquote {
                  margin: 12pt 0;
                  padding: 8pt 16pt;
                  border-left: 4pt solid #ddd;
                  background: #fafafa;
                  font-style: italic;
                }
                #print-target table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 12pt 0;
                  font-size: 10pt;
                }
                #print-target th, #print-target td {
                  border: 1pt solid #ddd;
                  padding: 6pt 10pt;
                  text-align: left;
                }
                #print-target th {
                  background: #f5f5f5;
                  font-weight: 600;
                }
                #print-target a {
                  color: #0066cc;
                  text-decoration: none;
                }
                #print-target hr {
                  border: none;
                  border-top: 1pt solid #ddd;
                  margin: 16pt 0;
                }
              `}</style>
              <article>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdown}
                </ReactMarkdown>
              </article>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

export default App;