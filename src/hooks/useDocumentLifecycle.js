import { useEffect } from 'react';

export function useDocumentLifecycle({
  appWindow,
  autoSaveEnabled,
  clearDragState,
  clearExpandTimer,
  currentFilePath,
  currentFolder,
  draggedPath,
  fileOps,
  hasUnsavedChanges,
  markdown,
  restoreOnceRef,
  savedMarkdownRef,
  setHasUnsavedChanges,
}) {
  const isEditableTextPath = (path) => !path || /\.(md|markdown|txt)$/i.test(path);

  useEffect(() => {
    setHasUnsavedChanges(isEditableTextPath(currentFilePath) && markdown !== savedMarkdownRef.current);
  }, [currentFilePath, markdown, savedMarkdownRef, setHasUnsavedChanges]);

  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges || !currentFilePath || !isEditableTextPath(currentFilePath)) return undefined;

    const timer = setTimeout(() => {
      void fileOps.handleSave();
    }, 2000);

    return () => clearTimeout(timer);
  }, [autoSaveEnabled, currentFilePath, fileOps, hasUnsavedChanges, markdown]);

  useEffect(() => {
    if (restoreOnceRef.current) return;
    restoreOnceRef.current = true;

    const restoreState = async () => {
      try {
        if (currentFolder) {
          await fileOps.loadFolderContents(currentFolder, { preserveExpanded: true });
        }

        if (currentFilePath) {
          await fileOps.openFileInEditor(currentFilePath, { revealInSidebar: false });
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    };

    void restoreState();
  }, [currentFilePath, currentFolder, fileOps, restoreOnceRef]);

  useEffect(() => () => clearExpandTimer(), [clearExpandTimer]);

  useEffect(() => {
    if (!draggedPath) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        clearDragState();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearDragState, draggedPath]);

  useEffect(() => {
    const title = currentFilePath ? currentFilePath.split('/').pop() : 'Untitled';
    const prefix = hasUnsavedChanges ? '● ' : '';
    void appWindow.setTitle(`${prefix}${title} — JustMark`);
  }, [appWindow, currentFilePath, hasUnsavedChanges]);
}
