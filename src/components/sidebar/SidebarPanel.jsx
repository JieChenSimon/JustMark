import { FileTreeItem, InlineCreateRow } from './FileTreeItem';

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
}) {
  if (!currentFolder) {
    return null;
  }

  return (
    <aside
      ref={setSidebarRef}
      style={{ width: `${sidebarWidth}px` }}
      className={`jm-panel jm-sidebar overflow-y-auto transition-colors ${rootDropActive ? 'bg-blue-500/6 dark:bg-blue-400/8' : ''}`}
      tabIndex={0}
      onDragOver={handleSidebarDragOver}
      onDrop={handleSidebarDrop}
      onKeyDown={handleSidebarKeyDown}
      onFocus={onFocusSidebar}
    >
      <div className="p-3 relative">
        <div className="mb-3 px-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
          <div className="mt-1 truncate text-[13px] font-semibold text-slate-800">{currentFolder.split('/').pop()}</div>
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
      </div>
    </aside>
  );
}
