import { useState, useEffect, useRef } from 'react';

/**
 * 搜索和替换组件
 * 在编辑器中支持 Ctrl/Cmd+F 快捷键触发搜索和替换功能
 */
export default function SearchReplace({
  isOpen,
  onClose,
  markdown,
  onReplace,
  textareaRef
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const searchInputRef = useRef(null);

  // 当打开搜索框时，自动聚焦到搜索输入框
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isOpen]);

  // 查找所有匹配项
  useEffect(() => {
    if (!searchTerm) {
      setTotalMatches(0);
      setCurrentMatch(0);
      return;
    }

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const matches = markdown.match(regex);
    setTotalMatches(matches ? matches.length : 0);

    if (matches && matches.length > 0) {
      setCurrentMatch(1);
    } else {
      setCurrentMatch(0);
    }
  }, [searchTerm, markdown, caseSensitive]);

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
        // 设置光标位置并选中匹配的文本
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(match.index, match.index + match[0].length);

        // 滚动到可见区域
        const textarea = textareaRef.current;
        const textBeforeCursor = text.substring(0, match.index);
        const lines = textBeforeCursor.split('\n');
        const lineNumber = lines.length;
        const lineHeight = 24; // 根据你的字体大小调整
        const scrollPosition = (lineNumber - 5) * lineHeight; // 留出一些上下文
        textarea.scrollTop = Math.max(0, scrollPosition);

        break;
      }
    }
  };

  // 上一个匹配项
  const handlePrevious = () => {
    if (totalMatches === 0) return;
    const newIndex = currentMatch <= 1 ? totalMatches : currentMatch - 1;
    setCurrentMatch(newIndex);
    jumpToMatch(newIndex);
  };

  // 下一个匹配项
  const handleNext = () => {
    if (totalMatches === 0) return;
    const newIndex = currentMatch >= totalMatches ? 1 : currentMatch + 1;
    setCurrentMatch(newIndex);
    jumpToMatch(newIndex);
  };

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
      jumpToMatch(currentMatch);
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
    <div className="absolute top-4 right-4 z-30 bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-gray-200/30 dark:border-gray-600/30 p-4 w-[340px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Find and Replace</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-700/60 text-gray-500 dark:text-gray-400 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find..."
            className="flex-1 px-2.5 py-1.5 text-xs bg-white/50 dark:bg-gray-700/50 border border-gray-300/40 dark:border-gray-600/40 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 backdrop-blur-sm transition-all duration-200"
          />
          <button
            onClick={handlePrevious}
            disabled={totalMatches === 0}
            className="p-1.5 text-sm bg-white/50 dark:bg-gray-700/50 hover:bg-gray-200/60 dark:hover:bg-gray-600/60 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-all duration-200"
            title="Previous (Shift+Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            disabled={totalMatches === 0}
            className="p-1.5 text-sm bg-white/50 dark:bg-gray-700/50 hover:bg-gray-200/60 dark:hover:bg-gray-600/60 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-all duration-200"
            title="Next (Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="text-[10px] text-gray-500 dark:text-gray-400 text-right -mt-1">
          {totalMatches > 0 ? `${currentMatch} of ${totalMatches}` : 'No results'}
        </div>

        {/* Replace Input */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace..."
            className="flex-1 px-2.5 py-1.5 text-xs bg-white/50 dark:bg-gray-700/50 border border-gray-300/40 dark:border-gray-600/40 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 backdrop-blur-sm transition-all duration-200"
          />
          <button
            onClick={handleReplace}
            disabled={totalMatches === 0}
            className="px-2.5 py-1.5 text-[11px] bg-blue-500/90 hover:bg-blue-600/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-all duration-200 font-medium"
          >
            Replace
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={totalMatches === 0}
            className="px-2.5 py-1.5 text-[11px] bg-blue-500/90 hover:bg-blue-600/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-all duration-200 font-medium"
          >
            All
          </button>
        </div>

        {/* Options */}
        <div className="flex items-center gap-2 pt-0.5">
          <label className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-300 transition-colors duration-200">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-3 h-3 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-1 focus:ring-blue-500/50"
            />
            Match Case
          </label>
        </div>
      </div>
    </div>
  );
}
