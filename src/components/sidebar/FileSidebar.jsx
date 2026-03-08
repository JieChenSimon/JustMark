import { FileTreeItem, InlineCreateRow } from './FileTreeItem';

const FileSidebar = ({
  currentFolder,
  folderContents,
  expandedFolders,
  currentFilePath,
  fileTags,
  inlineCreate,
  inlineCreateName,
  inlineCreateInputRef,
  onSelectEntry,
  onToggleFolder,
  onToggleTag,
  onDeleteEntry,
  onRenameEntry,
  onCreateEntry,
  onInlineNameChange,
  onConfirmInlineCreate,
  onCancelInlineCreate,
  sidebarWidth,
  appBgColor
}) => {
  if (!currentFolder) {
    return (
      <div style={{ width: `${sidebarWidth}px`, backgroundColor: appBgColor }}
        className="h-full flex items-center justify-center text-gray-500">
        打开文件夹以查看文件
      </div>
    );
  }

  return (
    <div style={{ width: `${sidebarWidth}px`, backgroundColor: appBgColor }}
      className="h-full overflow-y-auto">
      <div className="p-2">
        {inlineCreate?.basePath === currentFolder && (
          <InlineCreateRow
            type={inlineCreate.type}
            value={inlineCreateName}
            onChange={onInlineNameChange}
            onConfirm={onConfirmInlineCreate}
            onCancel={onCancelInlineCreate}
            inputRef={inlineCreateInputRef}
          />
        )}
        {folderContents.map((item) => (
          <FileTreeItem
            key={item.path}
            item={item}
            level={0}
            expandedFolders={expandedFolders}
            currentFilePath={currentFilePath}
            fileTags={fileTags}
            onSelect={onSelectEntry}
            onToggle={onToggleFolder}
            onToggleTag={onToggleTag}
            onDelete={onDeleteEntry}
            onRename={onRenameEntry}
            onCreate={onCreateEntry}
          />
        ))}
      </div>
    </div>
  );
};

export default FileSidebar;
