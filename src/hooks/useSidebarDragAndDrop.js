import { useCallback, useRef, useState } from 'react';

const AUTO_EXPAND_DELAY_MS = 650;
const AUTO_SCROLL_EDGE_PX = 56;
const AUTO_SCROLL_STEP_PX = 18;

export function useSidebarDragAndDrop({
  currentFolder,
  expandedFolders,
  fileOps,
  getBaseName,
  isValidDropTarget,
  replaceRecentFilePath,
  removeRecentFilePrefix,
  setExpandedFolders,
  setNotice,
  sidebarRef
}) {
  const [draggedPath, setDraggedPath] = useState(null);
  const [draggedEntryType, setDraggedEntryType] = useState(null);
  const [dragOperation, setDragOperation] = useState('move');
  const [dropTargetPath, setDropTargetPath] = useState(null);
  const [invalidDropPath, setInvalidDropPath] = useState(null);
  const [rootDropActive, setRootDropActive] = useState(false);

  const dragExpandTimerRef = useRef(null);
  const dragExpandPathRef = useRef(null);

  const clearExpandTimer = useCallback(() => {
    if (dragExpandTimerRef.current) {
      clearTimeout(dragExpandTimerRef.current);
      dragExpandTimerRef.current = null;
      dragExpandPathRef.current = null;
    }
  }, []);

  const clearDragState = useCallback(() => {
    clearExpandTimer();
    setDraggedPath(null);
    setDraggedEntryType(null);
    setDragOperation('move');
    setDropTargetPath(null);
    setInvalidDropPath(null);
    setRootDropActive(false);
  }, [clearExpandTimer]);

  const scheduleAutoExpand = useCallback((folderPath) => {
    if (expandedFolders.has(folderPath) || dragExpandPathRef.current === folderPath) {
      return;
    }

    clearExpandTimer();
    dragExpandPathRef.current = folderPath;
    dragExpandTimerRef.current = setTimeout(() => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(folderPath);
        return next;
      });
      dragExpandTimerRef.current = null;
      dragExpandPathRef.current = null;
    }, AUTO_EXPAND_DELAY_MS);
  }, [clearExpandTimer, expandedFolders, setExpandedFolders]);

  const moveDraggedEntry = useCallback(async (targetFolderPath, operation = dragOperation) => {
    if (!draggedPath || !isValidDropTarget(draggedPath, targetFolderPath)) {
      clearDragState();
      return;
    }

    try {
      if (operation === 'copy') {
        await fileOps.copyEntry(draggedPath, targetFolderPath, { isDirectory: draggedEntryType === 'folder' });
      } else {
        const nextPath = await fileOps.moveEntry(draggedPath, targetFolderPath);
        replaceRecentFilePath(draggedPath, nextPath);
      }
    } catch (error) {
      if (error?.code === 'TARGET_ALREADY_EXISTS') {
        setNotice({
          mode: operation === 'copy' ? 'replace-copy' : 'replace-move',
          title: 'Replace Existing Item?',
          message: `"${getBaseName(draggedPath)}" already exists in the destination folder. ${operation === 'copy' ? 'Copying' : 'Moving'} will replace the existing item.`,
          sourcePath: draggedPath,
          targetFolderPath,
          targetPath: error.targetPath,
          operation,
          isDirectory: draggedEntryType === 'folder',
        });
      } else {
        setNotice({
          mode: 'info',
          title: operation === 'copy' ? 'Copy Failed' : 'Move Failed',
          message: error?.message || `${operation === 'copy' ? 'The item could not be copied.' : 'The item could not be moved.'} Please try again.`,
        });
      }
    } finally {
      clearDragState();
    }
  }, [clearDragState, dragOperation, draggedEntryType, draggedPath, fileOps, getBaseName, isValidDropTarget, replaceRecentFilePath, setNotice]);

  const confirmReplacementNotice = useCallback(async (notice) => {
    if (!notice?.mode?.startsWith('replace')) {
      return;
    }

    try {
      if (notice.operation === 'copy') {
        await fileOps.copyEntry(notice.sourcePath, notice.targetFolderPath, {
          overwrite: true,
          isDirectory: notice.isDirectory
        });
        removeRecentFilePrefix(notice.targetPath);
      } else {
        const nextPath = await fileOps.moveEntry(notice.sourcePath, notice.targetFolderPath, { overwrite: true });
        removeRecentFilePrefix(notice.targetPath);
        replaceRecentFilePath(notice.sourcePath, nextPath);
      }
      setNotice(null);
    } catch (error) {
      setNotice({
        mode: 'info',
        title: 'Replace Failed',
        message: error?.message || 'The existing item could not be replaced. Please try again.',
      });
    }
  }, [fileOps, removeRecentFilePrefix, replaceRecentFilePath, setNotice]);

  const handleDragStartEntry = useCallback((path, isDirectory) => {
    setDraggedPath(path);
    setDraggedEntryType(isDirectory ? 'folder' : 'file');
    setDragOperation('move');
    setDropTargetPath(null);
    setInvalidDropPath(null);
    setRootDropActive(false);
  }, []);

  const handleDragHoverEntry = useCallback((targetPath, isDirectory, altKey = false) => {
    if (!draggedPath || !isDirectory) return;

    setDragOperation(altKey ? 'copy' : 'move');

    if (!isValidDropTarget(draggedPath, targetPath)) {
      clearExpandTimer();
      setDropTargetPath(null);
      setRootDropActive(false);
      setInvalidDropPath(targetPath);
      return;
    }

    setInvalidDropPath(null);
    setRootDropActive(false);
    setDropTargetPath(targetPath);
    scheduleAutoExpand(targetPath);
  }, [clearExpandTimer, draggedPath, isValidDropTarget, scheduleAutoExpand]);

  const handleDropEntry = useCallback((targetPath) => {
    void moveDraggedEntry(targetPath, dragOperation);
  }, [dragOperation, moveDraggedEntry]);

  const handleSidebarDragOver = useCallback((e) => {
    if (!draggedPath || !currentFolder) return;
    const sidebarElement = sidebarRef.current;
    if (sidebarElement) {
      const rect = sidebarElement.getBoundingClientRect();
      if (e.clientY < rect.top + AUTO_SCROLL_EDGE_PX) {
        sidebarElement.scrollTop -= AUTO_SCROLL_STEP_PX;
      } else if (e.clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
        sidebarElement.scrollTop += AUTO_SCROLL_STEP_PX;
      }
    }

    const targetElement = e.target;
    const isTreeNode = targetElement instanceof Element && targetElement.closest('[data-tree-node="true"]');
    if (isTreeNode) return;

    e.preventDefault();
    const nextOperation = e.altKey ? 'copy' : 'move';
    setDragOperation(nextOperation);
    e.dataTransfer.dropEffect = isValidDropTarget(draggedPath, currentFolder) ? nextOperation : 'none';

    if (!isValidDropTarget(draggedPath, currentFolder)) {
      setDropTargetPath(null);
      setInvalidDropPath(currentFolder);
      setRootDropActive(false);
      return;
    }

    clearExpandTimer();
    setDropTargetPath(null);
    setInvalidDropPath(null);
    setRootDropActive(true);
  }, [clearExpandTimer, currentFolder, draggedPath, isValidDropTarget, sidebarRef]);

  const handleSidebarDrop = useCallback((e) => {
    if (!draggedPath || !currentFolder) return;
    const targetElement = e.target;
    const isTreeNode = targetElement instanceof Element && targetElement.closest('[data-tree-node="true"]');
    if (isTreeNode) return;

    e.preventDefault();
    if (isValidDropTarget(draggedPath, currentFolder)) {
      void moveDraggedEntry(currentFolder, dragOperation);
    } else {
      clearDragState();
    }
  }, [clearDragState, currentFolder, draggedPath, dragOperation, isValidDropTarget, moveDraggedEntry]);

  return {
    draggedPath,
    dragOperation,
    dropTargetPath,
    invalidDropPath,
    rootDropActive,
    clearDragState,
    clearExpandTimer,
    confirmReplacementNotice,
    handleDragStartEntry,
    handleDragHoverEntry,
    handleDropEntry,
    handleSidebarDragOver,
    handleSidebarDrop,
  };
}
