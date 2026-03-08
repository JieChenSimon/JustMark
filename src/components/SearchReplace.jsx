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
    <div className="absolute inset-x-4 top-4 z-30">
      <div className="mx-auto max-w-[760px] rounded-[14px] border border-slate-200/80 bg-[rgba(248,249,251,0.96)] px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find"
            className="min-w-0 flex-[1.2] rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-blue-400"
          />
          <div className="min-w-[72px] text-right text-[10px] text-slate-500">
            {totalMatches > 0 ? `${activeMatch} of ${totalMatches}` : 'No Results'}
          </div>
          <button
            onClick={handlePrevious}
            disabled={totalMatches === 0}
            className="jm-button h-8 w-8 rounded-[10px] px-0 disabled:cursor-not-allowed disabled:opacity-40"
            title="Previous (Shift+Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            disabled={totalMatches === 0}
            className="jm-button h-8 w-8 rounded-[10px] px-0 disabled:cursor-not-allowed disabled:opacity-40"
            title="Next (Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {replaceVisible ? (
            <>
              <input
                type="text"
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                placeholder="Replace"
                className="min-w-0 flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-blue-400"
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={handleReplace}
                disabled={totalMatches === 0}
                className="jm-button jm-button-primary px-3 py-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Replace
              </button>
              <button
                onClick={handleReplaceAll}
                disabled={totalMatches === 0}
                className="jm-button px-3 py-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
              >
                All
              </button>
            </>
          ) : (
            <button
              onClick={() => setReplaceVisible(true)}
              className="jm-button px-3 py-2 text-[11px]"
            >
              Replace
            </button>
          )}
          <label className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-300 transition-colors duration-200">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-3 h-3 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-1 focus:ring-blue-500/50"
            />
            Match Case
          </label>
          <button
            onClick={() => {
              setReplaceVisible(false);
              onClose();
            }}
            className="jm-button ml-auto h-8 rounded-[10px] px-3 text-[11px] text-slate-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});

export default SearchReplace;
