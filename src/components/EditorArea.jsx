import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import SearchReplace from './SearchReplace';
import { useImagePaste } from '../hooks/useImagePaste';

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
  onToggleSidebar,
  onEditorScroll,
  previewVisible,
  onTogglePreview,
  onImagePasted
}, ref) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const textareaRef = useRef(null);
  const { handlePaste: handleImagePaste } = useImagePaste(currentFolder, currentFilePath);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    scrollToPercentage: (percentage) => {
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const maxScroll = textarea.scrollHeight - textarea.clientHeight;
        textarea.scrollTop = maxScroll * percentage;
      }
    },
    getTextareaElement: () => textareaRef.current,
    getSelection: () => {
      if (!textareaRef.current) return null;
      return {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd
      };
    },
    setSelection: (start, end) => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(start, end);
        textareaRef.current.focus();
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

  // 处理粘贴事件（检测图片）
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 查找图片项
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault(); // 阻止默认粘贴行为

        const blob = item.getAsFile();
        if (!blob) continue;

        const reader = new FileReader();

        reader.onload = async (event) => {
          const base64String = event.target.result;
          // Remove data:image/png;base64, prefix
          const base64Data = base64String.split(',')[1];

          // Save image and get relative path
          const relativePath = await handleImagePaste(base64Data);

          if (relativePath && onImagePasted) {
            // Insert markdown image syntax at cursor position
            const imageMarkdown = `![](${relativePath})`;
            onImagePasted(imageMarkdown, textareaRef.current);
          }
        };

        reader.readAsDataURL(blob);
        break; // Only handle first image
      }
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
        onPaste={handlePaste}
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
            {/* 预览切换按钮 */}
            <button
              onClick={onTogglePreview}
              className={`w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-sm shadow-md transition-all active:scale-95 ${previewVisible
                ? 'bg-blue-500/20 dark:bg-blue-500/30 border border-blue-400/50 dark:border-blue-400/50'
                : 'bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/90 dark:hover:bg-gray-700/90 border border-gray-300/50 dark:border-gray-600/50'
                }`}
              title={previewVisible ? 'Hide Preview' : 'Show Preview'}
            >
              <svg className={`w-4 h-4 ${previewVisible ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {previewVisible ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                )}
              </svg>
            </button>

            {/* File Browser Button */}
            <button
              onClick={() => onToggleSidebar(!sidebarVisible)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-sm shadow-md transition-all active:scale-95 ${sidebarVisible
                ? 'bg-blue-500/20 dark:bg-blue-500/30 border border-blue-400/50 dark:border-blue-400/50'
                : 'bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/90 dark:hover:bg-gray-700/90 border border-gray-300/50 dark:border-gray-600/50'
                }`}
              title={sidebarVisible ? 'Hide Explorer' : 'Show Explorer'}
            >
              <svg className={`w-4 h-4 ${sidebarVisible ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
