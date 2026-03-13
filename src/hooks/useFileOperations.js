import { useCallback, useEffect, useRef } from 'react';
import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile, readDir, remove, mkdir, rename, exists, copyFile } from '@tauri-apps/plugin-fs';
import { getCachedFileTree, invalidateCache } from '../utils/fileCache';
import { filterHiddenFiles } from '../utils/hiddenFiles';

async function copyEntryRecursive(sourcePath, targetPath) {
  const entries = await readDir(sourcePath);
  await mkdir(targetPath, { recursive: true });

  await Promise.all(entries.map(async (entry) => {
    const nextTargetPath = `${targetPath}/${entry.name}`;
    if (entry.isDirectory) {
      await copyEntryRecursive(entry.path, nextTargetPath);
    } else {
      await copyFile(entry.path, nextTargetPath);
    }
  }));
}

export const useFileOperations = ({
  currentFilePath,
  currentFolder,
  setHasUnsavedChanges,
  addRecentFile,
  setCurrentFolder,
  setFolderContents,
  setPreviewFilePath,
  setExpandedFolders,
  sortEntries,
  parseTags,
  setFileTags,
  onPersistMarkdown,
  getTagColor,
  showHiddenFiles,
  hiddenFilesWhitelist,
  openFileInTab,
  saveFile,
  closeFile,
  openFiles,
  setOpenFiles,
  setActiveFilePath
}) => {
  const isMountedRef = useRef(true);
  const folderLoadRequestRef = useRef(0);
  const fileOpenRequestRef = useRef(0);
  const tagScanRequestRef = useRef(0);
  const tagScanTimerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      tagScanRequestRef.current += 1;

      if (tagScanTimerRef.current) {
        clearTimeout(tagScanTimerRef.current);
        tagScanTimerRef.current = null;
      }
    };
  }, []);

  const isEditableTextPath = useCallback((path) => /\.(md|markdown|txt)$/i.test(path || ''), []);

  const getParentPath = useCallback((path) => {
    const lastSlashIndex = path.lastIndexOf('/');
    return lastSlashIndex >= 0 ? path.slice(0, lastSlashIndex) : '';
  }, []);

  const getBaseName = useCallback((path) => path.split('/').pop() || path, []);

  const updatePathPrefix = useCallback((path, fromPath, toPath) => {
    if (path === fromPath) return toPath;
    if (path.startsWith(`${fromPath}/`)) {
      return `${toPath}${path.slice(fromPath.length)}`;
    }
    return path;
  }, []);

  const rewriteMappedPaths = useCallback((mapping, fromPath, toPath) => {
    const next = {};
    Object.entries(mapping).forEach(([path, value]) => {
      next[updatePathPrefix(path, fromPath, toPath)] = value;
    });
    return next;
  }, [updatePathPrefix]);

  const removeMappedPrefix = useCallback((mapping, prefixPath) => Object.fromEntries(
    Object.entries(mapping).filter(([path]) => path !== prefixPath && !path.startsWith(`${prefixPath}/`))
  ), []);

  const clearEditorState = useCallback(() => {
    // Close all tabs
    if (openFiles && openFiles.length > 0) {
      openFiles.forEach(file => closeFile(file.path));
    }
  }, [openFiles, closeFile]);

  const scanTagsForEntries = useCallback(async (entries, requestId) => {
    const mdFiles = entries.filter((item) => !item.isDirectory && item.name?.endsWith('.md'));
    const batchSize = 10;

    for (let i = 0; i < mdFiles.length; i += batchSize) {
      if (!isMountedRef.current || requestId !== tagScanRequestRef.current) {
        return;
      }

      const batch = mdFiles.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await readTextFile(file.path);
            const tags = parseTags(content).map((name) => ({ name, color: getTagColor(name) }));
            return { path: file.path, tags };
          } catch {
            return null;
          }
        })
      );

      if (!isMountedRef.current || requestId !== tagScanRequestRef.current) {
        return;
      }

      setFileTags((prev) => {
        const next = { ...prev };
        results.filter(Boolean).forEach(({ path, tags }) => {
          if (tags.length > 0) {
            next[path] = tags;
          } else {
            delete next[path];
          }
        });
        return next;
      });
    }
  }, [getTagColor, parseTags, setFileTags]);

  const loadFolderContents = useCallback(async (folderPath, options = {}) => {
    const { preserveExpanded = false } = options;
    const requestId = folderLoadRequestRef.current + 1;
    folderLoadRequestRef.current = requestId;

    const entries = await getCachedFileTree(folderPath, readDir);
    const filteredEntries = filterHiddenFiles(entries, showHiddenFiles, hiddenFilesWhitelist);

    if (!isMountedRef.current || requestId !== folderLoadRequestRef.current) {
      return;
    }

    setCurrentFolder(folderPath);
    setFolderContents(sortEntries(filteredEntries));
    setExpandedFolders((prev) => {
      if (!preserveExpanded) {
        return new Set([folderPath]);
      }

      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });

    tagScanRequestRef.current += 1;
    const tagRequestId = tagScanRequestRef.current;

    if (tagScanTimerRef.current) {
      clearTimeout(tagScanTimerRef.current);
    }

    tagScanTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current || requestId !== folderLoadRequestRef.current || tagRequestId !== tagScanRequestRef.current) {
        return;
      }

      void scanTagsForEntries(filteredEntries, tagRequestId);
    }, 100);
  }, [scanTagsForEntries, setCurrentFolder, setExpandedFolders, setFolderContents, sortEntries, showHiddenFiles, hiddenFilesWhitelist]);

  const getSubfolderContents = useCallback(async (folderPath) => {
    try {
      const entries = await getCachedFileTree(folderPath, readDir);
      const filteredEntries = filterHiddenFiles(entries, showHiddenFiles, hiddenFilesWhitelist);
      return sortEntries(filteredEntries);
    } catch (error) {
      console.error('读取子文件夹失败:', error);
      return [];
    }
  }, [sortEntries, showHiddenFiles, hiddenFilesWhitelist]);

  const revealFileInSidebar = useCallback((filePath) => {
    if (!currentFolder || !filePath.startsWith(currentFolder)) {
      return;
    }

    // 获取从 currentFolder 到文件的所有父文件夹路径
    const relativePath = filePath.slice(currentFolder.length + 1);
    const segments = relativePath.split('/');
    segments.pop(); // 移除文件名，只保留文件夹路径

    // 展开所有父文件夹
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      let currentPath = currentFolder;

      for (const segment of segments) {
        currentPath = `${currentPath}/${segment}`;
        next.add(currentPath);
      }

      return next;
    });
  }, [currentFolder, setExpandedFolders]);

  const openFileInEditor = useCallback(async (filePath, options = {}) => {
    const { revealInSidebar = true } = options;
    const requestId = fileOpenRequestRef.current + 1;
    fileOpenRequestRef.current = requestId;

    if (!isEditableTextPath(filePath)) {
      if (!isMountedRef.current || requestId !== fileOpenRequestRef.current) {
        return;
      }

      setPreviewFilePath(filePath);
      addRecentFile(filePath);

      if (revealInSidebar) {
        revealFileInSidebar(filePath);
      }
      return;
    }

    setPreviewFilePath(null);
    const content = await readTextFile(filePath);

    if (!isMountedRef.current || requestId !== fileOpenRequestRef.current) {
      return;
    }

    // Open in tab
    await openFileInTab(filePath, content);
    addRecentFile(filePath);

    if (revealInSidebar) {
      revealFileInSidebar(filePath);
    }
  }, [
    addRecentFile,
    isEditableTextPath,
    revealFileInSidebar,
    setPreviewFilePath,
    openFileInTab
  ]);

  const handleSave = useCallback(async () => {
    if (!currentFilePath || !isEditableTextPath(currentFilePath)) return false;

    await saveFile(currentFilePath);
    return true;
  }, [currentFilePath, isEditableTextPath, saveFile]);

  const handleSaveAs = useCallback(async () => {
    const activeFile = openFiles?.find(f => f.path === currentFilePath);
    const content = activeFile?.content || '';

    const filePath = await save({
      defaultPath: isEditableTextPath(currentFilePath) ? currentFilePath : 'untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (!filePath) return null;

    await writeTextFile(filePath, content);

    // Update the tab with new path
    if (openFileInTab) {
      await openFileInTab(filePath, content);
    }

    addRecentFile(filePath);

    const folderPath = getParentPath(filePath);
    if (folderPath) {
      await loadFolderContents(folderPath, { preserveExpanded: true });
    }

    return filePath;
  }, [
    addRecentFile,
    currentFilePath,
    getParentPath,
    loadFolderContents,
    isEditableTextPath,
    openFiles,
    openFileInTab
  ]);

  const handleOpenFile = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    });

    if (selected) {
      await openFileInEditor(selected);
    }
  }, [openFileInEditor]);

  const handleOpenFolder = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });

    if (selected) {
      await loadFolderContents(selected);
    }
  }, [loadFolderContents]);

  const deleteEntry = useCallback(async (targetPath) => {
    await remove(targetPath, { recursive: true });
    invalidateCache();

    setFileTags((prev) => {
      const next = { ...prev };
      delete next[targetPath];
      return next;
    });

    // Close tab if file is open
    if (closeFile) {
      await closeFile(targetPath);
    }

    if (currentFolder) {
      await loadFolderContents(currentFolder, { preserveExpanded: true });
    }
  }, [
    currentFolder,
    loadFolderContents,
    setFileTags,
    closeFile
  ]);

  const createEntry = useCallback(async (path, isDirectory) => {
    if (isDirectory) {
      await mkdir(path, { recursive: true });
    } else {
      await writeTextFile(path, '');
    }

    invalidateCache();

    if (currentFolder) {
      await loadFolderContents(currentFolder, { preserveExpanded: true });
    }
  }, [currentFolder, loadFolderContents]);

  const renameEntry = useCallback(async (oldPath, nextNameOrPath) => {
    const newPath = nextNameOrPath.includes('/')
      ? nextNameOrPath
      : `${getParentPath(oldPath)}/${nextNameOrPath}`;

    await rename(oldPath, newPath);
    invalidateCache();

    setFileTags((prev) => rewriteMappedPaths(prev, oldPath, newPath));

    // Update tab paths if file is open
    if (openFiles) {
      const fileToUpdate = openFiles.find(f => f.path === oldPath);
      if (fileToUpdate) {
        if (openFileInTab) {
          // Close old tab and open with new path
          await closeFile(oldPath);
          await openFileInTab(newPath, fileToUpdate.content);
        }
      }
    }

    if (currentFolder) {
      await loadFolderContents(currentFolder, { preserveExpanded: true });
    }
  }, [currentFolder, getParentPath, loadFolderContents, rewriteMappedPaths, setFileTags, updatePathPrefix, openFiles, openFileInTab, closeFile]);

  const moveEntry = useCallback(async (sourcePath, targetFolderPath, options = {}) => {
    const { overwrite = false } = options;
    const nextPath = `${targetFolderPath}/${getBaseName(sourcePath)}`;
    const targetExists = await exists(nextPath);

    if (targetExists && !overwrite) {
      const error = new Error('TARGET_ALREADY_EXISTS');
      error.code = 'TARGET_ALREADY_EXISTS';
      error.targetPath = nextPath;
      throw error;
    }

    if (targetExists && overwrite) {
      await remove(nextPath, { recursive: true });
    }

    await rename(sourcePath, nextPath);
    invalidateCache();

    setFileTags((prev) => {
      const cleaned = targetExists && overwrite ? removeMappedPrefix(prev, nextPath) : prev;
      return rewriteMappedPaths(cleaned, sourcePath, nextPath);
    });

    if (currentFilePath === sourcePath || currentFilePath?.startsWith(`${sourcePath}/`)) {
      setOpenFiles?.((prev) => prev.map((file) => (
        file.path === sourcePath || file.path.startsWith(`${sourcePath}/`)
          ? { ...file, path: updatePathPrefix(file.path, sourcePath, nextPath) }
          : file
      )));
      setActiveFilePath?.((prev) => (prev ? updatePathPrefix(prev, sourcePath, nextPath) : prev));
    } else if (targetExists && overwrite && (currentFilePath === nextPath || currentFilePath?.startsWith(`${nextPath}/`))) {
      clearEditorState();
    }

    if (currentFolder) {
      await loadFolderContents(currentFolder, { preserveExpanded: true });
    }

    return nextPath;
  }, [
    clearEditorState,
    currentFilePath,
    currentFolder,
    getBaseName,
    loadFolderContents,
    removeMappedPrefix,
    rewriteMappedPaths,
    setActiveFilePath,
    setOpenFiles,
    setFileTags,
    updatePathPrefix
  ]);

  const copyEntry = useCallback(async (sourcePath, targetFolderPath, options = {}) => {
    const { overwrite = false, isDirectory = false } = options;
    const nextPath = `${targetFolderPath}/${getBaseName(sourcePath)}`;
    const targetExists = await exists(nextPath);

    if (targetExists && !overwrite) {
      const error = new Error('TARGET_ALREADY_EXISTS');
      error.code = 'TARGET_ALREADY_EXISTS';
      error.targetPath = nextPath;
      throw error;
    }

    if (targetExists && overwrite) {
      await remove(nextPath, { recursive: true });
    }

    if (isDirectory) {
      await copyEntryRecursive(sourcePath, nextPath);
    } else {
      await copyFile(sourcePath, nextPath);
    }

    invalidateCache();

    if (targetExists && overwrite && (currentFilePath === nextPath || currentFilePath?.startsWith(`${nextPath}/`))) {
      clearEditorState();
    }

    if (currentFolder) {
      await loadFolderContents(currentFolder, { preserveExpanded: true });
    }

    return nextPath;
  }, [
    clearEditorState,
    currentFilePath,
    currentFolder,
    getBaseName,
    loadFolderContents
  ]);

  return {
    openFileInEditor,
    handleSave,
    handleSaveAs,
    handleOpenFile,
    handleOpenFolder,
    loadFolderContents,
    getSubfolderContents,
    deleteEntry,
    createEntry,
    renameEntry,
    moveEntry,
    copyEntry,
    getParentPath
  };
};
