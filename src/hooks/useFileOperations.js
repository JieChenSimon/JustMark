import { useCallback } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile, readDir, remove, mkdir, rename, exists, copyFile } from '@tauri-apps/plugin-fs';
import { getCachedFileTree, invalidateCache } from '../utils/fileCache';

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
  markdown,
  currentFilePath,
  currentFolder,
  setMarkdown,
  setCurrentFilePath,
  setHasUnsavedChanges,
  addRecentFile,
  setCurrentFolder,
  setFolderContents,
  setExpandedFolders,
  sortEntries,
  parseTags,
  setFileTags,
  onPersistMarkdown,
  getTagColor
}) => {
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
    setCurrentFilePath(null);
    setMarkdown('');
    onPersistMarkdown('');
    setHasUnsavedChanges(false);
  }, [onPersistMarkdown, setCurrentFilePath, setHasUnsavedChanges, setMarkdown]);

  const scanTagsForEntries = useCallback(async (entries) => {
    const mdFiles = entries.filter((item) => !item.isDirectory && item.name?.endsWith('.md'));
    const batchSize = 10;

    for (let i = 0; i < mdFiles.length; i += batchSize) {
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
    const entries = await getCachedFileTree(folderPath, readDir);

    setCurrentFolder(folderPath);
    setFolderContents(sortEntries(entries));
    setExpandedFolders((prev) => {
      if (!preserveExpanded) {
        return new Set([folderPath]);
      }

      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });

    setTimeout(() => {
      void scanTagsForEntries(entries);
    }, 100);
  }, [scanTagsForEntries, setCurrentFolder, setExpandedFolders, setFolderContents, sortEntries]);

  const getSubfolderContents = useCallback(async (folderPath) => {
    try {
      const entries = await getCachedFileTree(folderPath, readDir);
      return sortEntries(entries);
    } catch (error) {
      console.error('读取子文件夹失败:', error);
      return [];
    }
  }, [sortEntries]);

  const openFileInEditor = useCallback(async (filePath, options = {}) => {
    const { revealInSidebar = true } = options;
    const content = await readTextFile(filePath);

    setMarkdown(content);
    onPersistMarkdown(content);
    setCurrentFilePath(filePath);
    setHasUnsavedChanges(false);
    addRecentFile(filePath);

    if (revealInSidebar) {
      const folderPath = getParentPath(filePath);
      if (folderPath) {
        await loadFolderContents(folderPath, { preserveExpanded: true });
      }
    }
  }, [
    addRecentFile,
    getParentPath,
    loadFolderContents,
    onPersistMarkdown,
    setCurrentFilePath,
    setHasUnsavedChanges,
    setMarkdown
  ]);

  const handleSave = useCallback(async () => {
    if (!currentFilePath) return false;

    await writeTextFile(currentFilePath, markdown);
    onPersistMarkdown(markdown);
    setHasUnsavedChanges(false);
    return true;
  }, [currentFilePath, markdown, onPersistMarkdown, setHasUnsavedChanges]);

  const handleSaveAs = useCallback(async () => {
    const filePath = await save({
      defaultPath: currentFilePath || 'untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (!filePath) return null;

    await writeTextFile(filePath, markdown);
    onPersistMarkdown(markdown);
    setCurrentFilePath(filePath);
    setHasUnsavedChanges(false);
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
    markdown,
    onPersistMarkdown,
    setCurrentFilePath,
    setHasUnsavedChanges
  ]);

  const handleOpenFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    });

    if (selected) {
      await openFileInEditor(selected);
    }
  }, [openFileInEditor]);

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });

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

    if (currentFilePath === targetPath) {
      clearEditorState();
    }

    if (currentFolder) {
      await loadFolderContents(currentFolder, { preserveExpanded: true });
    }
  }, [
    clearEditorState,
    currentFilePath,
    currentFolder,
    loadFolderContents,
    setFileTags,
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

    if (currentFilePath === oldPath || currentFilePath?.startsWith(`${oldPath}/`)) {
      setCurrentFilePath((prev) => (prev ? updatePathPrefix(prev, oldPath, newPath) : prev));
    }

    if (currentFolder) {
      await loadFolderContents(currentFolder, { preserveExpanded: true });
    }
  }, [currentFilePath, currentFolder, getParentPath, loadFolderContents, rewriteMappedPaths, setCurrentFilePath, setFileTags, updatePathPrefix]);

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
      setCurrentFilePath((prev) => (prev ? updatePathPrefix(prev, sourcePath, nextPath) : prev));
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
    setCurrentFilePath,
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
