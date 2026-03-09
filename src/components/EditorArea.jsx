import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import SearchReplace from './SearchReplace';
import { useImagePaste } from '../hooks/useImagePaste';
import { IconDocument, IconSidebar } from './icons/AppIcons';

/**
 * 编辑器区域组件
 * 包含 textarea 编辑器和左下角的控制按钮（文件浏览器、Git 管理）
 */
const EditorArea = forwardRef(({
  markdown,
  onMarkdownChange,
  currentFont,
  currentFontFamily,
  appBgColor,
  appTextColor,
  currentFolder,
  currentFilePath,
  sidebarVisible,
  onToggleSidebar,
  onEditorScroll,
  previewVisible,
  onTogglePreview,
  onImagePasted,
  chars,
  words,
  lines
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
    <div
      className="jm-editor-surface relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: appBgColor }}
    >
      <textarea
        ref={textareaRef}
        className={`min-h-0 flex-1 resize-none bg-transparent px-8 pb-24 pt-8 outline-none placeholder-gray-300 dark:placeholder-gray-600 ${currentFont.size} ${currentFont.leading}`}
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
      {currentFolder && (
        <div className="absolute bottom-4 left-4 z-20">
          <button
            onClick={() => onToggleSidebar(!sidebarVisible)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur-md transition-all duration-200 ${
              sidebarVisible
                ? 'bg-black/90 dark:bg-white/90'
                : 'bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'
            }`}
            title={sidebarVisible ? 'Hide Explorer' : 'Show Explorer'}
          >
            <IconSidebar className={`h-3.5 w-3.5 ${sidebarVisible ? 'text-white dark:text-black' : 'text-black/60 dark:text-white/60'}`} />
          </button>
        </div>
      )}

    </div>
  );
});

EditorArea.displayName = 'EditorArea';

export default EditorArea;
