import { useEffect, useState } from 'react';
import { FileTreeItem, InlineCreateRow } from './FileTreeItem';
import { IconDocument, IconListTree, IconMoon, IconPreview, IconSun, IconTableOfContents, IconClip, IconSync } from '../icons/AppIcons';
import { useWebDAVSync } from '../../hooks/useWebDAVSync';

export default function SidebarPanel({
  currentFilePath,
  currentFolder,
  dragOperation,
  draggedPath,
  dropTargetPath,
  expandedFolders,
  fileOps,
  fileTags,
  folderContents,
  handleSidebarDragOver,
  handleSidebarDrop,
  handleSidebarKeyDown,
  inlineCreate,
  inlineCreateInputRef,
  inlineCreateName,
  invalidDropPath,
  onConfirmInlineCreate,
  onDeleteEntry,
  onDragEndEntry,
  onDragHoverEntry,
  onDragStartEntry,
  onDropEntry,
  onFocusSidebar,
  onInlineChange,
  onInlineCancel,
  onOpenFile,
  onRevealInFinder,
  onRenameEntry,
  onSelectEntry,
  onStartInlineCreate,
  onToggleFolder,
  rootDropActive,
  selectedSidebarPath,
  setSidebarRef,
  sidebarWidth,
  tocItems,
  onSelectToc,
  isDarkMode,
  previewVisible,
  previewMode,
  onToggleTheme,
  onTogglePreview,
  onTogglePreviewMode,
  chars,
  words,
  lines,
  onClipUrl,
  isClipping,
}) {
  const [activePage, setActivePage] = useState('files');
  const { isSyncing, syncProgress, startSync, cancelSync } = useWebDAVSync();
  const isTextDocument = !currentFilePath || /\.(md|markdown|txt)$/i.test(currentFilePath);

  useEffect(() => {
    const shouldDebug = import.meta.env.DEV && (
      currentFolder?.includes('SimonChen') ||
      folderContents.some((entry) => /00- 雅思-口语|Hu et al\.|面签英语/.test(entry.path || entry.name || ''))
    );

    if (!shouldDebug) {
      return;
    }

    console.groupCollapsed('[tree-root] SidebarPanel');
    console.log('currentFolder', currentFolder);
    console.table(folderContents.map((entry) => ({
      name: entry.name,
      path: entry.path,
      isDirectory: entry.isDirectory,
    })));
    console.groupEnd();
  }, [currentFolder, folderContents]);

  useEffect(() => {
    if (!isTextDocument && activePage === 'toc') {
      setActivePage('files');
    }
  }, [activePage, isTextDocument]);

  if (!currentFolder) {
    return null;
  }

  const showTocPage = isTextDocument;

  return (
    <aside
      ref={setSidebarRef}
      style={{ width: `${sidebarWidth}px` }}
      className={`jm-panel jm-sidebar overflow-y-auto overflow-x-hidden transition-colors ${rootDropActive ? 'bg-blue-500/6 dark:bg-blue-400/8' : ''}`}
      tabIndex={0}
      onDragOver={handleSidebarDragOver}
      onDrop={handleSidebarDrop}
      onKeyDown={handleSidebarKeyDown}
      onFocus={onFocusSidebar}
    >
      <div className="relative flex h-full min-h-0 flex-col overflow-x-hidden px-1.5 pb-1.5 pt-6">
        <div className="mb-1.5 flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-800 dark:text-slate-200">
            {currentFolder.split('/').pop()}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200/70 bg-white/45 p-0.5 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/35">
            <button
              type="button"
              onClick={() => setActivePage('files')}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                activePage === 'files'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/5'
              }`}
              title="Files"
              aria-label="Show files"
            >
              <IconListTree className="h-3.5 w-3.5" />
            </button>
            {showTocPage && (
              <button
                type="button"
                onClick={() => setActivePage('toc')}
                className={`relative flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  activePage === 'toc'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/5'
                }`}
                title="Show table of contents"
                aria-label="Show table of contents"
              >
                <IconTableOfContents className="h-3.5 w-3.5" />
                <span className={`absolute -right-1 -top-1 min-w-[12px] rounded-full px-1 py-[1px] text-[7px] leading-none ${
                  activePage === 'toc' ? 'bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900' : 'bg-black/8 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                }`}>
                  {tocItems.length}
                </span>
              </button>
            )}
          </div>
        </div>
        {draggedPath && rootDropActive && (
          <div className="sticky top-2 z-20 mb-2 rounded-xl border border-blue-500/30 dark:border-blue-400/30 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.14)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-200">
              {dragOperation === 'copy' ? 'Copy To Current Folder' : 'Move To Current Folder'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
              {dragOperation === 'copy' ? 'Drop to copy this item into the current folder.' : 'Drop to move this item into the current folder.'}
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activePage === 'files' && (
            <>
              {inlineCreate?.basePath === currentFolder && (
                <InlineCreateRow
                  level={0}
                  type={inlineCreate.type}
                  value={inlineCreateName}
                  onChange={onInlineChange}
                  onConfirm={onConfirmInlineCreate}
                  onCancel={onInlineCancel}
                  inputRef={inlineCreateInputRef}
                />
              )}

              {folderContents.map((entry) => (
                <FileTreeItem
                  key={entry.path}
                  entry={entry}
                  basePath={currentFolder}
                  rootPath={currentFolder}
                  level={0}
                  currentFilePath={currentFilePath}
                  selectedSidebarPath={selectedSidebarPath}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                  onOpenFile={onOpenFile}
                  getSubfolderContents={fileOps.getSubfolderContents}
                  onStartInlineCreate={onStartInlineCreate}
                  onDeleteEntry={onDeleteEntry}
                  onRenameEntry={onRenameEntry}
                  onRevealInFinder={onRevealInFinder}
                  onDragStartEntry={onDragStartEntry}
                  onDragEndEntry={onDragEndEntry}
                  onDragHoverEntry={onDragHoverEntry}
                  onDropEntry={onDropEntry}
                  inlineCreate={inlineCreate}
                  inlineInputRef={inlineCreateInputRef}
                  onInlineChange={onInlineChange}
                  onInlineConfirm={onConfirmInlineCreate}
                  onInlineCancel={onInlineCancel}
                  onSelectEntry={onSelectEntry}
                  fileTags={fileTags}
                  draggedPath={draggedPath}
                  dropTargetPath={dropTargetPath}
                  invalidDropPath={invalidDropPath}
                  dragOperation={dragOperation}
                />
              ))}
            </>
          )}

          {activePage === 'toc' && showTocPage && (
            <section className="rounded-xl border border-slate-200/70 bg-white/45 px-2 py-2 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/35">
              {tocItems.length > 0 ? (
                <div className="space-y-0.5">
                  {tocItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectToc(item)}
                      className="flex w-full items-center rounded-lg px-1.5 py-1.5 text-left text-[11px] text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      style={{ paddingLeft: `${6 + (item.level - 1) * 10}px` }}
                      title={item.text}
                    >
                      <span className="truncate">{item.text}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-1.5 py-1 text-[11px] text-slate-400 dark:text-slate-500">No headings</div>
              )}
            </section>
          )}
        </div>
        <div className="mt-2 flex items-end justify-between border-t border-slate-200/60 px-1.5 pt-1.5 dark:border-slate-700/60">
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={isSyncing ? cancelSync : startSync}
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              isSyncing
                ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
                : 'text-slate-700 hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5'
            }`}
            title={isSyncing ? `Syncing... ${syncProgress}%` : 'Sync with WebDAV'}
            aria-label={isSyncing ? 'Cancel sync' : 'Start sync'}
          >
            {isSyncing ? (
              <>
                <span className="text-[7px] font-semibold">{syncProgress}%</span>
                <svg className="absolute h-7 w-7" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${syncProgress * 0.628} 62.8`}
                    className="opacity-40"
                    transform="rotate(-90 12 12)"
                  />
                </svg>
              </>
            ) : (
              <IconSync className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClipUrl}
            disabled={isClipping}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-200 dark:hover:bg-white/5"
            title={isClipping ? 'Clipping...' : 'Clip URL (select URL first)'}
            aria-label="Clip URL from selection"
          >
            <IconClip className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePreviewMode}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5"
            title={previewMode === 'markdown' ? 'Switch to PDF preview' : 'Switch to markdown preview'}
            aria-label={previewMode === 'markdown' ? 'Switch to PDF preview' : 'Switch to markdown preview'}
          >
            {previewMode === 'markdown' ? <IconDocument className="h-3.5 w-3.5" /> : <IconPreview className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5"
            title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDarkMode ? <IconSun className="h-3.5 w-3.5" /> : <IconMoon className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onTogglePreview}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5"
            title={previewVisible ? 'Hide preview' : 'Show preview'}
            aria-label={previewVisible ? 'Hide preview' : 'Show preview'}
          >
            <IconPreview className="h-3.5 w-3.5" />
          </button>
          </div>
          <div className="pb-0.5 text-[8px] text-slate-400 dark:text-slate-500 tabular-nums whitespace-nowrap">
            {chars.toLocaleString()} · {words.toLocaleString()}w · {lines.toLocaleString()}L
          </div>
        </div>
      </div>
    </aside>
  );
}
