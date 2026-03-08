import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import SearchReplace from './SearchReplace';
import { useImagePaste } from '../hooks/useImagePaste';
import { IconDocument, IconPreview, IconSidebar } from './icons/AppIcons';

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
  const searchReplaceRef = useRef(null);
  const { handlePaste: handleImagePaste } = useImagePaste(currentFolder, currentFilePath);

  const openSearch = (mode = 'find') => {
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchReplaceRef.current?.open(mode);
    });
  };

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
    },
    openFind: () => openSearch('find'),
    openReplace: () => openSearch('replace'),
    findNext: () => {
      if (!searchOpen) {
        openSearch('find');
        return;
      }
      searchReplaceRef.current?.findNext();
    },
    findPrevious: () => {
      if (!searchOpen) {
        openSearch('find');
        return;
      }
      searchReplaceRef.current?.findPrevious();
    },
    pastePlainText: async () => {
      const textarea = textareaRef.current;
      if (!textarea || !navigator.clipboard?.readText) return;

      const plainText = await navigator.clipboard.readText();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${markdown.slice(0, start)}${plainText}${markdown.slice(end)}`;
      onMarkdownChange({ target: { value: nextValue } });

      requestAnimationFrame(() => {
        const cursor = start + plainText.length;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
    }
  }));

  // 处理编辑器滚动事件
  const handleScroll = () => {
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
        openSearch('find');
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openSearch('replace');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  return (
    <div className="jm-editor-surface flex-1 relative flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-200/70 bg-[rgba(248,249,251,0.82)] backdrop-blur-xl">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Editor</div>
          <div className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-slate-800">
            <IconDocument className="h-4 w-4 text-slate-400" />
            <span>{currentFilePath ? currentFilePath.split('/').pop() : 'Untitled.md'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded-[9px] border border-slate-200/80 bg-white/85 px-2 py-1">Markdown</span>
          <span className="rounded-[9px] border border-slate-200/80 bg-white/85 px-2 py-1">{currentFont.name}</span>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className={`flex-1 px-8 pb-8 pt-10 outline-none resize-none bg-transparent placeholder-gray-300 dark:placeholder-gray-600 ${currentFont.size} ${currentFont.leading}`}
        style={{
          fontFamily: currentFontFamily.family,
          color: appTextColor
        }}
        value={markdown}
        onChange={onMarkdownChange}
        onScroll={handleScroll}
        onPaste={handlePaste}
        placeholder="Start writing..."
        spellCheck="false"
      />

      {/* 搜索替换面板 */}
      <SearchReplace
        ref={searchReplaceRef}
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
      <div className="absolute bottom-5 left-5 flex items-end gap-2 z-20">
        {/* 侧边栏导航按钮组 - 只在有文件夹时显示 */}
        {currentFolder && (
          <div className="flex flex-col gap-1">
            {/* 预览切换按钮 */}
            <button
              onClick={onTogglePreview}
              className={`w-9 h-9 flex items-center justify-center rounded-[12px] backdrop-blur-xl shadow-sm transition-all active:scale-95 ${previewVisible
                ? 'bg-[#dce9ff] border border-[#b7cdfa]'
                : 'bg-white/88 hover:bg-white border border-slate-200/80'
                }`}
              title={previewVisible ? 'Hide Preview' : 'Show Preview'}
            >
              <IconPreview className={`w-4 h-4 ${previewVisible ? 'text-[#2d5bd1]' : 'text-slate-600'}`} />
            </button>

            {/* File Browser Button */}
            <button
              onClick={() => onToggleSidebar(!sidebarVisible)}
              className={`w-9 h-9 flex items-center justify-center rounded-[12px] backdrop-blur-xl shadow-sm transition-all active:scale-95 ${sidebarVisible
                ? 'bg-[#dce9ff] border border-[#b7cdfa]'
                : 'bg-white/88 hover:bg-white border border-slate-200/80'
                }`}
              title={sidebarVisible ? 'Hide Explorer' : 'Show Explorer'}
            >
              <IconSidebar className={`w-4 h-4 ${sidebarVisible ? 'text-[#2d5bd1]' : 'text-slate-600'}`} />
            </button>
          </div>
        )}

        {/* 文件名显示 */}
        {currentFilePath && (
          <span className="mb-0.5 rounded-[10px] border border-slate-200/80 bg-white/88 px-2.5 py-1 text-[10px] text-slate-500 backdrop-blur-xl shadow-sm">
            {currentFilePath.split('/').pop()}
          </span>
        )}
      </div>
    </div>
  );
});

EditorArea.displayName = 'EditorArea';

export default EditorArea;
