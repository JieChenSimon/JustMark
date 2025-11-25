import { useState, useEffect } from 'react';
import { getStatusColor, getStatusLabel } from '../hooks/useGit';

/**
 * macOS 风格的 Git 源代码管理面板
 * 上下分栏：上部为 Changes，下部为 History
 */
export function GitPanel({ gitStatus, onStageFile, onUnstageFile, onStageAll, onUnstageAll, onCommit, onDiscardChanges, onClose, onGetLog, appBgColor, appTextColor }) {
  const [commitMessage, setCommitMessage] = useState('');
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [commits, setCommits] = useState([]);
  const [isLoadingLog, setIsLoadingLog] = useState(false);

  // 自动加载提交历史
  useEffect(() => {
    if (onGetLog) {
      setIsLoadingLog(true);
      onGetLog(20).then(logs => {
        setCommits(logs);
        setIsLoadingLog(false);
      });

      // 每10秒刷新一次历史记录
      const interval = setInterval(() => {
        onGetLog(20).then(logs => setCommits(logs));
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [onGetLog]);

  if (!gitStatus) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
        No Git repository
      </div>
    );
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;

    const success = await onCommit(commitMessage);
    if (success) {
      setCommitMessage('');
      setShowCommitInput(false);
      // 刷新历史记录
      if (onGetLog) {
        const logs = await onGetLog(20);
        setCommits(logs);
      }
    }
  };

  const stagedFiles = gitStatus.staged || [];
  const unstagedFiles = gitStatus.files?.filter(f => {
    const isStaged = f.statusCode.charAt(0) !== ' ' && f.statusCode.charAt(0) !== '?';
    return !isStaged;
  }) || [];

  return (
    <div
      className="h-full flex flex-col backdrop-blur-xl"
      style={{ backgroundColor: `${appBgColor}f2` }}
    >
      {/* 头部 - 显示分支名 */}
      <div
        className="h-10 px-3 flex items-center justify-between border-b flex-shrink-0"
        style={{
          borderBottomColor: 'rgba(0, 0, 0, 0.1)',
          backgroundColor: appBgColor
        }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
          </svg>
          <span
            className="text-[11px] font-semibold"
            style={{ color: appTextColor }}
          >
            {gitStatus.branch || 'main'}
          </span>
          {gitStatus.hasChanges && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-500 text-white rounded-full">
              {gitStatus.files?.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200/70 dark:hover:bg-gray-700/70 transition-all active:scale-95"
          title="Close"
        >
          <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 上部：Changes 区域 */}
      <div className="flex-1 flex flex-col min-h-0 border-b-2 border-gray-200 dark:border-gray-700">
        {/* 提交输入区 */}
        <div className="px-3 py-2 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0">
          {showCommitInput ? (
            <div className="space-y-2">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="w-full px-2 py-1.5 text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                rows={2}
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleCommit}
                  disabled={!commitMessage.trim() || stagedFiles.length === 0}
                  className="flex-1 px-2 py-1 text-[10px] font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-all active:scale-95"
                >
                  Commit
                </button>
                <button
                  onClick={() => {
                    setShowCommitInput(false);
                    setCommitMessage('');
                  }}
                  className="px-2 py-1 text-[10px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCommitInput(true)}
              disabled={stagedFiles.length === 0}
              className="w-full px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-all"
            >
              Commit {stagedFiles.length > 0 && `(${stagedFiles.length})`}
            </button>
          )}
        </div>

        {/* Changes 列表 - 可滚动 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* 已暂存的更改 */}
          {stagedFiles.length > 0 && (
            <div>
              <div className="sticky top-0 z-10 px-3 py-1 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Staged Changes ({stagedFiles.length})
                  </span>
                  <button
                    onClick={onUnstageAll}
                    className="text-[9px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    Unstage All
                  </button>
                </div>
              </div>
              {stagedFiles.map((file, index) => (
                <FileItem
                  key={index}
                  file={file}
                  onAction={() => onUnstageFile(file.path)}
                  actionIcon="minus"
                  actionTitle="Unstage"
                />
              ))}
            </div>
          )}

          {/* 未暂存的更改 */}
          {unstagedFiles.length > 0 && (
            <div>
              <div className="sticky top-0 z-10 px-3 py-1 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Changes ({unstagedFiles.length})
                  </span>
                  <button
                    onClick={onStageAll}
                    className="text-[9px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    Stage All
                  </button>
                </div>
              </div>
              {unstagedFiles.map((file, index) => (
                <FileItem
                  key={index}
                  file={file}
                  onAction={() => onStageFile(file.path)}
                  onDiscard={() => onDiscardChanges(file.path)}
                  actionIcon="plus"
                  actionTitle="Stage"
                />
              ))}
            </div>
          )}

          {/* 无更改状态 */}
          {!gitStatus.hasChanges && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-1 px-4">
                <svg className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  No changes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 下部：History 区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* History 标题 */}
        <div className="px-3 py-1 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0">
          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            History
          </span>
        </div>

        {/* History 列表 - 可滚动 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoadingLog ? (
            <div className="flex items-center justify-center py-4">
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          ) : commits.length > 0 ? (
            <div>
              {commits.map((commit, index) => (
                <CommitItem key={index} commit={commit} />
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-1 px-4">
                <svg className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  No commits
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 提交历史项组件 - 更紧凑
function CommitItem({ commit }) {
  const date = new Date(commit.timestamp);
  const relativeTime = getRelativeTime(date);

  return (
    <div className="px-3 py-1.5 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-colors border-b border-gray-200/30 dark:border-gray-700/30">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500/15 dark:bg-blue-500/20 flex items-center justify-center mt-0.5">
          <svg className="w-2 h-2 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="3" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
            {commit.subject}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] text-gray-500 dark:text-gray-400 truncate max-w-[80px]">
              {commit.author}
            </span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500">
              {relativeTime}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 文件项组件 - macOS 风格
function FileItem({ file, onAction, onDiscard, actionIcon, actionTitle }) {
  const [showDiscard, setShowDiscard] = useState(false);

  return (
    <div
      className="group px-3 py-1.5 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-colors flex items-center gap-2"
      onMouseEnter={() => setShowDiscard(true)}
      onMouseLeave={() => setShowDiscard(false)}
    >
      {/* 文件名和路径 */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
          style={{
            backgroundColor: getStatusColor(file.status) + '20',
            color: getStatusColor(file.status)
          }}
        >
          {getStatusLabel(file.status)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-gray-700 dark:text-gray-300 truncate">
            {file.path.split('/').pop()}
          </div>
          {file.path.includes('/') && (
            <div className="text-[9px] text-gray-400 dark:text-gray-500 truncate">
              {file.path.substring(0, file.path.lastIndexOf('/'))}
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1">
        {showDiscard && onDiscard && (
          <button
            onClick={onDiscard}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/10 transition-all active:scale-95"
            title="Discard changes"
          >
            <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <button
          onClick={onAction}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-500/10 transition-all active:scale-95"
          title={actionTitle}
        >
          {actionIcon === 'plus' ? (
            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// 相对时间格式化
function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
