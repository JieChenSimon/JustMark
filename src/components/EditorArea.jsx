import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import SearchReplace from './SearchReplace';

/**
 * 编辑器区域组件
 * 包含 textarea 编辑器和左下角的控制按钮（文件浏览器、Git 管理）
 */
const EditorArea = forwardRef(({
  markdown,
  onMarkdownChange,
  currentFont,
  currentFontFamily,
  appTextColor,
  currentFolder,
  currentFilePath,
  sidebarVisible,
  sidebarView,
  onToggleSidebar,
  onSetSidebarView,
  gitStatus,
  onEditorScroll
}, ref) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const textareaRef = useRef(null);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    scrollToPercentage: (percentage) => {
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const maxScroll = textarea.scrollHeight - textarea.clientHeight;
        textarea.scrollTop = maxScroll * percentage;
      }
    }
  }));

  // 处理编辑器滚动事件
  const handleScroll = (e) => {
    if (onEditorScroll && textareaRef.current) {
      const textarea = textareaRef.current;
      const scrollPercentage = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
      onEditorScroll(scrollPercentage);
    }
  };

  // 监听 Ctrl/Cmd+F 快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex-1 relative flex flex-col">
      <textarea
        ref={textareaRef}
        className={`flex-1 p-6 outline-none resize-none bg-transparent placeholder-gray-300 dark:placeholder-gray-600 ${currentFont.size} ${currentFont.leading}`}
        style={{
          fontFamily: currentFontFamily.family,
          color: appTextColor
        }}
        value={markdown}
        onChange={onMarkdownChange}
        onScroll={handleScroll}
        placeholder="JustMark..."
        spellCheck="false"
      />

      {/* 搜索替换面板 */}
      <SearchReplace
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        markdown={markdown}
        onReplace={(newMarkdown) => {
          const syntheticEvent = {
            target: { value: newMarkdown }
          };
          onMarkdownChange(syntheticEvent);
        }}
        textareaRef={textareaRef}
      />

      {/* 左下角：侧边栏导航按钮和文件名 */}
      <div className="absolute bottom-4 left-4 flex items-end gap-2 z-20">
        {/* 侧边栏导航按钮组 - 只在有文件夹时显示 */}
        {currentFolder && (
          <div className="flex flex-col gap-1">
            {/* Git 源代码管理按钮 */}
            <button
              onClick={() => {
                onSetSidebarView('git');
                onToggleSidebar(true);
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
              {gitStatus?.hasChanges && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-md">
                  {gitStatus.files?.length > 9 ? '9+' : gitStatus.files?.length}
                </span>
              )}
            </button>

            {/* 文件浏览器按钮 */}
            <button
              onClick={() => {
                onSetSidebarView('files');
                onToggleSidebar(!sidebarVisible);
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
  );
});

EditorArea.displayName = 'EditorArea';

export default EditorArea;
