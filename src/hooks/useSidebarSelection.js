import { useCallback, useMemo, useState } from 'react';

export function useSidebarSelection({
  currentFilePath,
  currentFolder,
  folderContents,
  onOpenFile,
  onToggleFolder,
  sidebarRef,
}) {
  const [manualSelection, setManualSelection] = useState(null);

  const selectedSidebarPath = useMemo(() => {
    if (!currentFolder) return null;
    if (currentFilePath) return currentFilePath;
    if (manualSelection && (manualSelection === currentFolder || manualSelection.startsWith(`${currentFolder}/`))) {
      return manualSelection;
    }
    return folderContents[0]?.path || null;
  }, [currentFilePath, currentFolder, folderContents, manualSelection]);

  const focusSidebarNode = useCallback((path) => {
    if (!path) return;

    requestAnimationFrame(() => {
      const nodes = Array.from(sidebarRef.current?.querySelectorAll('[data-tree-node="true"]') || []);
      const nextNode = nodes.find((node) => node.dataset.path === path);
      nextNode?.focus();
      nextNode?.scrollIntoView({ block: 'nearest' });
    });
  }, [sidebarRef]);

  const selectSidebarPath = useCallback((path) => {
    if (!path) return;
    setManualSelection(path);
    focusSidebarNode(path);
  }, [focusSidebarNode]);

  const activateSidebarEntry = useCallback((path, isDirectory) => {
    selectSidebarPath(path);
    if (isDirectory) {
      onToggleFolder(path);
      return;
    }

    void onOpenFile(path);
  }, [onOpenFile, onToggleFolder, selectSidebarPath]);

  const handleSidebarKeyDown = useCallback((event) => {
    const target = event.target;
    if (target instanceof Element && target.matches('input, textarea')) {
      return;
    }

    const nodes = Array.from(sidebarRef.current?.querySelectorAll('[data-tree-node="true"]') || []);
    if (nodes.length === 0) {
      return;
    }

    const activePath = selectedSidebarPath && nodes.some((node) => node.dataset.path === selectedSidebarPath)
      ? selectedSidebarPath
      : nodes[0].dataset.path;
    const currentIndex = Math.max(0, nodes.findIndex((node) => node.dataset.path === activePath));
    const currentNode = nodes[currentIndex];
    const currentPath = currentNode?.dataset.path;
    const currentParentPath = currentNode?.dataset.parentPath;
    const isDirectory = currentNode?.dataset.isDirectory === 'true';
    const isExpanded = currentNode?.dataset.expanded === 'true';

    if (!currentPath) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextNode = nodes[Math.min(currentIndex + 1, nodes.length - 1)];
      if (nextNode?.dataset.path) {
        selectSidebarPath(nextNode.dataset.path);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextNode = nodes[Math.max(currentIndex - 1, 0)];
      if (nextNode?.dataset.path) {
        selectSidebarPath(nextNode.dataset.path);
      }
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (isDirectory && !isExpanded) {
        onToggleFolder(currentPath);
        selectSidebarPath(currentPath);
        return;
      }

      const childNode = nodes.find((node) => node.dataset.parentPath === currentPath);
      if (childNode?.dataset.path) {
        selectSidebarPath(childNode.dataset.path);
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (isDirectory && isExpanded) {
        onToggleFolder(currentPath);
        selectSidebarPath(currentPath);
        return;
      }

      if (currentParentPath && currentParentPath !== currentFolder) {
        selectSidebarPath(currentParentPath);
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateSidebarEntry(currentPath, isDirectory);
    }
  }, [activateSidebarEntry, currentFolder, onToggleFolder, selectSidebarPath, selectedSidebarPath, sidebarRef]);

  return {
    selectedSidebarPath,
    selectSidebarPath,
    activateSidebarEntry,
    handleSidebarKeyDown,
  };
}
