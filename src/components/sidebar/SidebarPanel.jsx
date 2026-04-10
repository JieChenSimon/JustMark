import { useEffect, useState } from 'react';
import { FileTreeItem, InlineCreateRow } from './FileTreeItem';
import {
  IconClip,
  IconDocument,
  IconListTree,
  IconMoon,
  IconPreview,
  IconSearch,
  IconSun,
  IconSync,
  IconTableOfContents,
} from '../icons/AppIcons';
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
  onToggleSearch,
}) {
  const [activePage, setActivePage] = useState('files');
  const { isSyncing, syncProgress, startSync, cancelSync, lastSyncSummary, lastSyncAt, syncMode } = useWebDAVSync(currentFolder);
  const isTextDocument = !currentFilePath || /\.(md|markdown|txt)$/i.test(currentFilePath);
  const syncTimestampLabel = lastSyncAt
    ? new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSyncAt))
    : null;
  const folderName = currentFolder?.split('/').pop() || 'Workspace';
  const showTocPage = isTextDocument;
  const hasToc = showTocPage && tocItems.length > 0;
  const syncModeLabel = syncMode === 'two-way' ? 'Two-way sync' : 'Backup sync';

  const rootStateClass = rootDropActive
    ? 'bg-blue-500/4 dark:bg-blue-400/6'
    : '';
  const panelFrameClass = 'rounded-[18px] bg-transparent shadow-none backdrop-blur-sm';
  const tabButtonBaseClass = 'jm-sidebar-tab h-5 w-5';
  const tabButtonInactiveClass = 'jm-sidebar-tab-inactive';
  const tabButtonActiveClass = 'jm-sidebar-tab-active text-black/72 dark:text-white/84';
  const utilityButtonClass = 'flex h-5 w-5 items-center justify-center rounded-md text-black/28 transition-colors duration-150 hover:bg-black/3 hover:text-black/52 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/24 dark:hover:bg-white/4 dark:hover:text-white/68';
  const utilityButtonAccentClass = 'text-[color:var(--jm-accent)] hover:bg-[color:var(--jm-accent-soft)] hover:text-[color:var(--jm-accent)] dark:text-[color:var(--jm-accent)] dark:hover:bg-[color:var(--jm-accent-soft)]';
  const statusTextClass = 'flex min-w-0 items-center justify-center gap-1.5 text-[8px] text-black/22 dark:text-white/20';

  useEffect(() => {
    if (!isTextDocument && activePage === 'toc') {
      setActivePage('files');
    }
  }, [activePage, isTextDocument]);

  if (!currentFolder) {
    return null;
  }

  const syncTooltip = isSyncing
    ? `${syncProgress}%${lastSyncSummary ? ` · ${lastSyncSummary}` : ''}${syncTimestampLabel ? ` · ${syncTimestampLabel}` : ''}`
    : `${lastSyncSummary || 'WebDAV Sync'}${syncTimestampLabel ? ` · ${syncTimestampLabel}` : ''}`;

  return (
    <aside
      ref={setSidebarRef}
      style={{ width: `${sidebarWidth}px` }}
      className={`jm-panel jm-sidebar h-full overflow-y-auto overflow-x-hidden transition-colors ${rootStateClass}`}
      tabIndex={0}
      onDragOver={handleSidebarDragOver}
      onDrop={handleSidebarDrop}
      onKeyDown={handleSidebarKeyDown}
      onFocus={onFocusSidebar}
    >
      <div className="relative flex h-full min-h-0 flex-col overflow-x-hidden px-2 pb-2 pt-4">
        <div className="mb-2 flex items-center gap-2 px-0.5">
          <div className="min-w-0 flex-1 truncate text-[11px] font-medium tracking-[-0.01em] text-[color:var(--jm-text)]/76">
            {folderName}
          </div>
          <div className={`jm-sidebar-tabs flex items-center gap-1 rounded-lg px-1 py-1 ${panelFrameClass}`}>
            <button
              type="button"
              onClick={() => setActivePage('files')}
              className={`${tabButtonBaseClass} ${activePage === 'files' ? tabButtonActiveClass : tabButtonInactiveClass}`}
              title="Files"
              aria-label="Show files"
            >
              <IconListTree className="h-3.5 w-3.5" />
            </button>
            {showTocPage && (
              <button
                type="button"
                onClick={() => setActivePage('toc')}
                className={`${tabButtonBaseClass} relative ${activePage === 'toc' ? tabButtonActiveClass : tabButtonInactiveClass}`}
                title="Show table of contents"
                aria-label="Show table of contents"
              >
                <IconTableOfContents className="h-3.5 w-3.5" />
                <span className={`absolute -right-1 -top-1 min-w-[12px] rounded-full px-1 py-[1px] text-[7px] leading-none ${
                  activePage === 'toc'
                    ? 'bg-black/6 text-black/58 dark:bg-white/10 dark:text-white/82'
                    : 'bg-black/5 text-black/34 dark:bg-white/8 dark:text-white/38'
                }`}>
                  {tocItems.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {draggedPath && rootDropActive && (
          <div className="sticky top-2 z-20 mb-2 rounded-xl border border-blue-500/12 bg-white/60 px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-blue-400/16 dark:bg-slate-950/60">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-200">
              {dragOperation === 'copy' ? 'Copy To Current Folder' : 'Move To Current Folder'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
              {dragOperation === 'copy'
                ? 'Drop to copy this item into the current folder.'
                : 'Drop to move this item into the current folder.'}
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
            <section className={`px-2 py-2 ${panelFrameClass}`}>
              {hasToc ? (
                <div className="space-y-0.5">
                  {tocItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectToc(item)}
                      className="flex w-full items-center rounded-lg px-1.5 py-1.5 text-left text-[11px] text-black/48 transition-colors hover:bg-black/3 hover:text-black/68 dark:text-white/46 dark:hover:bg-white/4 dark:hover:text-white/76"
                      style={{ paddingLeft: `${6 + (item.level - 1) * 10}px` }}
                      title={item.text}
                    >
                      <span className="truncate">{item.text}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-1.5 py-1 text-[11px] text-black/30 dark:text-white/26">No headings</div>
              )}
            </section>
          )}
        </div>

        <div className="mt-2 border-t border-[rgba(0,0,0,0.06)] pt-2 dark:border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="group relative flex items-center gap-1">
              <button
                type="button"
                onClick={isSyncing ? cancelSync : startSync}
                className={`relative flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  isSyncing ? utilityButtonAccentClass : utilityButtonClass
                }`}
                aria-label={isSyncing ? 'Cancel sync' : 'Start sync'}
                title={syncTooltip}
              >
                {isSyncing ? (
                  <>
                    <span className="text-[7px] font-semibold">{syncProgress}%</span>
                    <svg className="absolute h-7 w-7" viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${syncProgress * 0.628} 62.8`}
                        className="opacity-35"
                        transform="rotate(-90 12 12)"
                      />
                    </svg>
                  </>
                ) : (
                  <IconSync className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onToggleSearch}
                className={utilityButtonClass}
                title="Global search (Cmd+Shift+F)"
                aria-label="Global search"
              >
                <IconSearch className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onClipUrl}
                disabled={isClipping}
                className={utilityButtonClass}
                title={isClipping ? 'Clipping...' : 'Clip URL (select URL first)'}
                aria-label="Clip URL from selection"
              >
                <IconClip className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onTogglePreviewMode}
                className={utilityButtonClass}
                title={previewMode === 'markdown' ? 'Switch to PDF preview' : 'Switch to markdown preview'}
                aria-label={previewMode === 'markdown' ? 'Switch to PDF preview' : 'Switch to markdown preview'}
              >
                {previewMode === 'markdown' ? <IconDocument className="h-3.5 w-3.5" /> : <IconPreview className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className={utilityButtonClass}
                title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
                aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {isDarkMode ? <IconSun className="h-3.5 w-3.5" /> : <IconMoon className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={onTogglePreview}
                className={utilityButtonClass}
                title={previewVisible ? 'Hide preview' : 'Show preview'}
                aria-label={previewVisible ? 'Hide preview' : 'Show preview'}
              >
                <IconPreview className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-2 px-0.5">
            <div className={statusTextClass}>
              {currentFilePath && (
                <>
                  <span className="max-w-[92px] truncate font-medium text-black/30 dark:text-white/28">
                    {currentFilePath.split('/').pop()}
                  </span>
                  <span>·</span>
                </>
              )}
              <span className="tabular-nums">
                {chars.toLocaleString()} · {words.toLocaleString()}w · {lines.toLocaleString()}L
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
