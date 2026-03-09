import { forwardRef, useState, useEffect, useMemo, useRef, useImperativeHandle } from 'react';

/**
 * 搜索和替换组件
 * 在编辑器中支持 Ctrl/Cmd+F 快捷键触发搜索和替换功能
 */
const SearchReplace = forwardRef(function SearchReplace({
  isOpen,
  onClose,
  markdown,
  onReplace,
  textareaRef
}, ref) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [replaceVisible, setReplaceVisible] = useState(false);
  const searchInputRef = useRef(null);

  // 当打开搜索框时，自动聚焦到搜索输入框
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isOpen]);

  const totalMatches = useMemo(() => {
    if (!searchTerm) {
      return 0;
    }
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const matches = markdown.match(regex);
    return matches ? matches.length : 0;
  }, [searchTerm, markdown, caseSensitive]);

  const activeMatch = totalMatches === 0 ? 0 : Math.min(Math.max(currentMatch, 1), totalMatches);

  // 跳转到指定匹配项
  const jumpToMatch = (matchIndex) => {
    if (!searchTerm || !textareaRef.current || totalMatches === 0) return;

    const text = markdown;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    let count = 0;
    let match;
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      count++;
      if (count === matchIndex) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(match.index, match.index + match[0].length);

        const textarea = textareaRef.current;
        const textBeforeCursor = text.substring(0, match.index);
        const lines = textBeforeCursor.split('\n');
        const lineNumber = lines.length;
        const lineHeight = 24;
        const scrollPosition = (lineNumber - 5) * lineHeight;
        textarea.scrollTop = Math.max(0, scrollPosition);

        break;
      }
    }
  };

  // 上一个匹配项
  const handlePrevious = () => {
    if (totalMatches === 0) return;
    const newIndex = activeMatch <= 1 ? totalMatches : activeMatch - 1;
    setCurrentMatch(newIndex);
    jumpToMatch(newIndex);
  };

  // 下一个匹配项
  const handleNext = () => {
    if (totalMatches === 0) return;
    const newIndex = activeMatch >= totalMatches ? 1 : activeMatch + 1;
    setCurrentMatch(newIndex);
    jumpToMatch(newIndex);
  };

  useImperativeHandle(ref, () => ({
    open: (mode = 'find') => {
      setReplaceVisible(mode === 'replace');
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    },
    close: () => {
      setReplaceVisible(false);
      onClose();
    },
    findNext: () => {
      setReplaceVisible(false);
      handleNext();
    },
    findPrevious: () => {
      setReplaceVisible(false);
      handlePrevious();
    },
    focusReplace: () => {
      setReplaceVisible(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }));

  // 替换当前匹配项
  const handleReplace = () => {
    if (!searchTerm || totalMatches === 0 || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);

    // 检查选中的文本是否匹配搜索词
    const isMatch = caseSensitive
      ? selectedText === searchTerm
      : selectedText.toLowerCase() === searchTerm.toLowerCase();

    if (isMatch) {
      const newText = markdown.substring(0, start) + replaceTerm + markdown.substring(end);
      onReplace(newText);

      // 移动到下一个匹配项
      setTimeout(() => handleNext(), 50);
    } else {
      // 如果当前没有选中匹配项，跳转到第一个
      jumpToMatch(activeMatch || 1);
    }
  };

  // 替换全部
  const handleReplaceAll = () => {
    if (!searchTerm) return;

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const newText = markdown.replace(regex, replaceTerm);
    onReplace(newText);

    setSearchTerm('');
    setReplaceTerm('');
  };

  // 处理回车键
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      onClose();
      e.preventDefault();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-30"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="absolute left-1/2 top-12 -translate-x-1/2 w-[480px] rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/96 dark:bg-slate-800/96 px-2.5 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-400 dark:focus:border-blue-500"
          />
          <div className="min-w-[60px] text-right text-[10px] text-slate-500 dark:text-slate-400">
            {totalMatches > 0 ? `${activeMatch}/${totalMatches}` : 'No results'}
          </div>
          <button
            onClick={handlePrevious}
            disabled={totalMatches === 0}
            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            title="Previous (Shift+Enter)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            disabled={totalMatches === 0}
            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            title="Next (Enter)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => setReplaceVisible(!replaceVisible)}
            className="h-6 px-2 flex items-center justify-center rounded-md text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Toggle Replace"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <label className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-300 transition-colors" title="Match Case">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-3 h-3 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-1 focus:ring-blue-500/50"
            />
            Aa
          </label>
          <button
            onClick={onClose}
            className="ml-auto h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {replaceVisible && (
          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
            <input
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder="Replace"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-400 dark:focus:border-blue-500"
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleReplace}
              disabled={totalMatches === 0}
              className="h-6 px-2.5 flex items-center justify-center rounded-md text-[10px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={totalMatches === 0}
              className="h-6 px-2.5 flex items-center justify-center rounded-md text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              All
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default SearchReplace;
