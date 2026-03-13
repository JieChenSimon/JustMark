import { useState, useEffect, useRef } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';

export default function GlobalSearch({
  isOpen,
  onClose,
  currentFolder,
  folderContents,
  onOpenFile,
  getSubfolderContents,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInContent, setSearchInContent] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState({ files: [], contents: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setResults({ files: [], contents: [] });
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults({ files: [], contents: [] });
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchInContent, caseSensitive, currentFolder]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const totalResults = getAllResults().length;
        setSelectedIndex((prev) => (prev + 1) % totalResults);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const totalResults = getAllResults().length;
        setSelectedIndex((prev) => (prev - 1 + totalResults) % totalResults);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const allResults = getAllResults();
        if (allResults[selectedIndex]) {
          handleResultClick(allResults[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, results]);

  const getAllFiles = async (entries) => {
    const allFiles = [];

    for (const entry of entries) {
      if (entry.isDirectory) {
        try {
          const subEntries = await getSubfolderContents(entry.path);
          const subFiles = await getAllFiles(subEntries);
          allFiles.push(...subFiles);
        } catch (error) {
          console.warn('Failed to read subfolder:', entry.path, error);
        }
      } else if (/\.(md|markdown|txt)$/i.test(entry.name)) {
        allFiles.push(entry);
      }
    }

    return allFiles;
  };

  const performSearch = async () => {
    if (!currentFolder || !searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
      const fileResults = [];
      const contentResults = [];

      const allFiles = await getAllFiles(folderContents);

      for (const file of allFiles) {
        const fileName = caseSensitive ? file.name : file.name.toLowerCase();

        if (fileName.includes(query)) {
          fileResults.push({
            path: file.path,
            name: file.name,
            type: 'filename',
          });
        }

        if (searchInContent) {
          try {
            const content = await readTextFile(file.path);
            const lines = content.split('\n');
            const matches = [];

            lines.forEach((line, index) => {
              const searchLine = caseSensitive ? line : line.toLowerCase();
              if (searchLine.includes(query)) {
                matches.push({
                  line: index + 1,
                  text: line.trim(),
                });
              }
            });

            if (matches.length > 0) {
              contentResults.push({
                path: file.path,
                name: file.name,
                matches,
              });
            }
          } catch (error) {
            console.warn('Failed to read file:', file.path, error);
          }
        }
      }

      setResults({ files: fileResults, contents: contentResults });
      setSelectedIndex(0);
    } finally {
      setIsSearching(false);
    }
  };

  const getAllResults = () => {
    const allResults = [];
    results.files.forEach((file) => {
      allResults.push({ type: 'file', data: file });
    });
    results.contents.forEach((content) => {
      content.matches.slice(0, 3).forEach((match) => {
        allResults.push({ type: 'content', data: content, match });
      });
    });
    return allResults;
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, caseSensitive ? 'g' : 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const isMatch = caseSensitive ? part === query : part.toLowerCase() === query.toLowerCase();
      if (isMatch) {
        return (
          <mark key={index} className="rounded-sm bg-yellow-400/90 px-0.5 text-slate-900 dark:bg-yellow-500/90">
            {part}
          </mark>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleResultClick = (result) => {
    if (result.type === 'file') {
      onOpenFile(result.data.path);
    } else {
      onOpenFile(result.data.path);
    }
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const allResults = getAllResults();
  const totalFiles = results.files.length + results.contents.length;
  const totalMatches = results.contents.reduce((sum, item) => sum + item.matches.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-md"
      onClick={handleBackdropClick}
      style={{
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        ref={panelRef}
        className="mt-[15vh] w-full max-w-2xl"
        style={{
          animation: 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 dark:border-slate-700/60">
            <svg
              className="h-5 w-5 flex-shrink-0 text-slate-400 dark:text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in files..."
              className="flex-1 bg-transparent text-[15px] text-slate-900 placeholder-slate-400 outline-none dark:text-white dark:placeholder-slate-500"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
            />
            <kbd className="hidden rounded-md border border-slate-300/60 bg-slate-100/80 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-600/60 dark:bg-slate-800/80 dark:text-slate-400 sm:inline-block">
              ESC
            </kbd>
          </div>

          {/* Search Options */}
          <div className="flex items-center gap-4 border-b border-slate-200/60 px-5 py-2.5 dark:border-slate-700/60">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={searchInContent}
                onChange={(e) => setSearchInContent(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-[13px] text-slate-600 dark:text-slate-400">Search content</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-[13px] text-slate-600 dark:text-slate-400">Match case</span>
            </label>
            {searchQuery && (
              <div className="ml-auto text-[12px] text-slate-500 dark:text-slate-400">
                {isSearching ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Searching...
                  </span>
                ) : (
                  `${totalFiles} file${totalFiles !== 1 ? 's' : ''} · ${totalMatches} match${totalMatches !== 1 ? 'es' : ''}`
                )}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {!searchQuery ? (
              <div className="flex flex-col items-center justify-center py-16">
                <svg
                  className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-[13px] text-slate-500 dark:text-slate-400">Type to search across all files</p>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                  <kbd className="rounded border border-slate-300/60 bg-slate-100/80 px-1.5 py-0.5 dark:border-slate-600/60 dark:bg-slate-800/80">
                    ⌘
                  </kbd>
                  <kbd className="rounded border border-slate-300/60 bg-slate-100/80 px-1.5 py-0.5 dark:border-slate-600/60 dark:bg-slate-800/80">
                    ⇧
                  </kbd>
                  <kbd className="rounded border border-slate-300/60 bg-slate-100/80 px-1.5 py-0.5 dark:border-slate-600/60 dark:bg-slate-800/80">
                    F
                  </kbd>
                  <span>to open</span>
                </div>
              </div>
            ) : allResults.length === 0 && !isSearching ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <svg className="h-6 w-6 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-[13px] text-slate-500 dark:text-slate-400">No results found</p>
                <p className="mt-1 text-[12px] text-slate-400 dark:text-slate-500">Try a different search term</p>
              </div>
            ) : (
              <div className="py-2">
                {results.files.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Files
                    </div>
                    {results.files.map((file, idx) => {
                      const globalIdx = allResults.findIndex((r) => r.type === 'file' && r.data.path === file.path);
                      const isSelected = globalIdx === selectedIndex;
                      return (
                        <button
                          key={file.path}
                          onClick={() => handleResultClick({ type: 'file', data: file })}
                          className={`group flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-500/10 dark:bg-blue-500/20'
                              : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <svg
                            className={`h-4 w-4 flex-shrink-0 ${
                              isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
                              {highlightMatch(file.name, searchQuery)}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {file.path.replace(currentFolder + '/', '')}
                            </div>
                          </div>
                          {isSelected && (
                            <kbd className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                              ↵
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {results.contents.length > 0 && (
                  <div>
                    <div className="mb-1.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Content
                    </div>
                    {results.contents.map((content) =>
                      content.matches.slice(0, 3).map((match, matchIdx) => {
                        const globalIdx = allResults.findIndex(
                          (r) => r.type === 'content' && r.data.path === content.path && r.match.line === match.line
                        );
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <button
                            key={`${content.path}-${match.line}`}
                            onClick={() => handleResultClick({ type: 'content', data: content, match })}
                            className={`group flex w-full items-start gap-3 px-5 py-2.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-blue-500/10 dark:bg-blue-500/20'
                                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <div
                              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-medium ${
                                isSelected
                                  ? 'bg-blue-500/20 text-blue-600 dark:bg-blue-500/30 dark:text-blue-400'
                                  : 'bg-slate-200/80 text-slate-500 dark:bg-slate-700/80 dark:text-slate-400'
                              }`}
                            >
                              {match.line}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                {content.name}
                              </div>
                              <div className="truncate text-[13px] text-slate-700 dark:text-slate-300">
                                {highlightMatch(match.text, searchQuery)}
                              </div>
                            </div>
                            {isSelected && (
                              <kbd className="mt-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                                ↵
                              </kbd>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Custom scrollbar for macOS feel */
        .max-h-\\[50vh\\]::-webkit-scrollbar {
          width: 10px;
        }

        .max-h-\\[50vh\\]::-webkit-scrollbar-track {
          background: transparent;
        }

        .max-h-\\[50vh\\]::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .dark .max-h-\\[50vh\\]::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .max-h-\\[50vh\\]::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
          background-clip: padding-box;
        }

        .dark .max-h-\\[50vh\\]::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
          background-clip: padding-box;
        }
      `}</style>
    </div>
  );
}
