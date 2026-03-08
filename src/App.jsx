import { useState, useEffect, useRef, useDeferredValue, useCallback } from 'react';
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import { useWindowManager } from './hooks/useWindowManager';
import { useRecentFiles } from './hooks/useRecentFiles';
import { useWordCount } from './hooks/useWordCount';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMarkdownEditor } from './hooks/useMarkdownEditor';
import { useFileOperations } from './hooks/useFileOperations';
import EditorArea from './components/EditorArea';
import MarkdownPreview from './components/preview/MarkdownPreview';
import { useExportManager } from './components/Export/ExportManager';
import { FileTreeItem, InlineCreateRow } from './components/sidebar/FileTreeItem';
import ConfirmDialog from './components/ConfirmDialog';
import {
  IconDocument,
  IconExport,
  IconFolder,
  IconMinus,
  IconPlus,
  IconPreview,
  IconSave,
  IconSidebar,
  IconWindowClose,
  IconWindowMaximize,
  IconWindowMinimize
} from './components/icons/AppIcons';
import { parseTags, sortEntries, getTagColor } from './utils/fileHelpers';
import { HEADER_HEIGHT } from './constants/theme';
import { bringAllToFront, openDocumentWindow, openPreferencesWindow } from './utils/windows';

const AUTO_EXPAND_DELAY_MS = 650;
const AUTO_SCROLL_EDGE_PX = 56;
const AUTO_SCROLL_STEP_PX = 18;

const formatRecentFileLabel = (path) => {
  const segments = path.split('/').filter(Boolean);
  const fileName = segments.at(-1) || path;
  const parentName = segments.at(-2);

  return parentName ? `${fileName} — ${parentName}` : fileName;
};

function App() {
  const [markdown, setMarkdown] = useState('### JustMark\nWrite in a single way...');
  const markdownRef = useRef(markdown);
  const savedMarkdownRef = useRef(markdown);
  const didRestoreRef = useRef(false);

  const theme = useTheme();
  const {
    isDarkMode,
    currentFont,
    currentFontFamily,
    appBgColor,
    appTextColor,
    previewTextColor,
    toggleTheme,
    increaseFontSize,
    decreaseFontSize
  } = theme;

  const {
    attachmentFolder,
    autoSaveEnabled,
    fileSortBy
  } = useSettings();
  const { recentFiles, addRecentFile, clearRecentFiles, replaceRecentFilePath, removeRecentFilePrefix } = useRecentFiles();
  const { chars, words, lines } = useWordCount(markdown);
  const { sidebarWidth, editorWidth } = useWindowManager();
  const { isExporting, exportToPDF, exportToDOCX } = useExportManager();

  const [currentFilePath, setCurrentFilePath] = useLocalStorage('currentFilePath', null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentFolder, setCurrentFolder] = useLocalStorage('currentFolder', null);
  const [folderContents, setFolderContents] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [fileTags, setFileTags] = useLocalStorage('justmark_file_tags', {});
  const [selectedSidebarPath, setSelectedSidebarPath] = useState(null);
  const [previewVisible, setPreviewVisible] = useLocalStorage('previewVisible', true);
  const [sidebarVisible, setSidebarVisible] = useLocalStorage('sidebarVisible', false);
  const [inlineCreate, setInlineCreate] = useState(null);
  const [inlineCreateName, setInlineCreateName] = useState('');
  const [draggedPath, setDraggedPath] = useState(null);
  const [draggedEntryType, setDraggedEntryType] = useState(null);
  const [dragOperation, setDragOperation] = useState('move');
  const [dropTargetPath, setDropTargetPath] = useState(null);
  const [invalidDropPath, setInvalidDropPath] = useState(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const [dragNotice, setDragNotice] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const inlineCreateInputRef = useRef(null);
  const previewSectionRef = useRef(null);
  const editorAreaRef = useRef(null);
  const sidebarRef = useRef(null);
  const dragExpandTimerRef = useRef(null);
  const dragExpandPathRef = useRef(null);
  const closeBypassRef = useRef(false);
  const menuActionRef = useRef({});
  const deferredMarkdown = useDeferredValue(markdown);

  const { handleMarkdownChange, handleFormatText, handleImagePasted } = useMarkdownEditor({
    markdown,
    setMarkdown,
    markdownRef
  });

  const persistSavedMarkdown = useCallback((content) => {
    savedMarkdownRef.current = content;
    markdownRef.current = content;
  }, []);

  const fileOps = useFileOperations({
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
    sortEntries: (entries) => sortEntries(entries, fileSortBy),
    parseTags,
    setFileTags,
    onPersistMarkdown: persistSavedMarkdown,
    getTagColor
  });

  const handleNewFile = useCallback(() => {
    setMarkdown('');
    setCurrentFilePath(null);
    setHasUnsavedChanges(false);
    persistSavedMarkdown('');
  }, [persistSavedMarkdown, setCurrentFilePath]);

  const saveCurrentDocument = useCallback(async () => {
    if (currentFilePath) {
      return fileOps.handleSave();
    }

    return Boolean(await fileOps.handleSaveAs());
  }, [currentFilePath, fileOps]);

  const requestActionWithUnsavedGuard = useCallback((action) => {
    if (!hasUnsavedChanges) {
      void action();
      return;
    }

    setPendingAction(() => action);
    setDragNotice({
      mode: 'unsaved-document',
      title: 'Save Changes?',
      message: 'This document has unsaved changes. You can save before continuing, or continue without saving.',
    });
  }, [hasUnsavedChanges]);

  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

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

  const handleOpenFolder = useCallback(async () => {
    await fileOps.handleOpenFolder();
    setSidebarVisible(true);
  }, [fileOps, setSidebarVisible]);

  const startInlineCreate = useCallback((basePath, type) => {
    setInlineCreate({ basePath, parentPath: basePath, type });
    setInlineCreateName('');
    setTimeout(() => inlineCreateInputRef.current?.focus(), 0);
  }, []);

  const cancelInlineCreate = useCallback(() => {
    setInlineCreate(null);
    setInlineCreateName('');
  }, []);

  const confirmInlineCreate = useCallback(async () => {
    if (!inlineCreate || !inlineCreateName.trim()) return;

    await fileOps.createEntry(`${inlineCreate.basePath}/${inlineCreateName.trim()}`, inlineCreate.type === 'folder');
    cancelInlineCreate();
  }, [cancelInlineCreate, fileOps, inlineCreate, inlineCreateName]);

  const handleRevealInFinder = useCallback(async (path) => {
    try {
      await revealItemInDir(path);
    } catch (error) {
      console.error('Failed to reveal item in Finder:', error);
    }
  }, []);

  const appWindow = getCurrentWindow();

  const focusSidebarNode = useCallback((path) => {
    if (!path) return;

    requestAnimationFrame(() => {
      const nodes = Array.from(sidebarRef.current?.querySelectorAll('[data-tree-node="true"]') || []);
      const nextNode = nodes.find((node) => node.dataset.path === path);
      nextNode?.focus();
      nextNode?.scrollIntoView({ block: 'nearest' });
    });
  }, []);

  const selectSidebarPath = useCallback((path) => {
    if (!path) return;
    setSelectedSidebarPath(path);
    focusSidebarNode(path);
  }, [focusSidebarNode]);

  const handleExportPDF = useCallback(() => {
    const fileName = (currentFilePath?.split('/').pop() || 'document').replace(/\.(md|markdown|txt)$/i, '.pdf');
    return exportToPDF(previewSectionRef, fileName);
  }, [currentFilePath, exportToPDF]);

  const handleExportDOCX = useCallback(() => {
    const fileName = (currentFilePath?.split('/').pop() || 'document').replace(/\.(md|markdown|txt)$/i, '.docx');
    return exportToDOCX(markdown, fileName);
  }, [currentFilePath, exportToDOCX, markdown]);

  const handleMinimizeWindow = useCallback(() => {
    void appWindow.minimize();
  }, [appWindow]);

  const handleToggleMaximizeWindow = useCallback(() => {
    void appWindow.toggleMaximize();
  }, [appWindow]);

  const handleCloseWindow = useCallback(() => {
    requestActionWithUnsavedGuard(async () => {
      closeBypassRef.current = true;
      await appWindow.close();
    });
  }, [appWindow, requestActionWithUnsavedGuard]);

  const isDescendantPath = useCallback((sourcePath, targetPath) => targetPath.startsWith(`${sourcePath}/`), []);
  const getBaseName = useCallback((path) => path.split('/').pop() || path, []);
  const handleOpenPreferences = useCallback(() => {
    void openPreferencesWindow();
  }, []);

  const handleNewWindow = useCallback(() => {
    openDocumentWindow();
  }, []);

  const activateSidebarEntry = useCallback((path, isDirectory) => {
    selectSidebarPath(path);
    if (isDirectory) {
      toggleFolder(path);
      return;
    }

    void fileOps.openFileInEditor(path, { revealInSidebar: false });
  }, [fileOps, selectSidebarPath, toggleFolder]);

  const handleSelectSidebarEntry = useCallback((path) => {
    selectSidebarPath(path);
  }, [selectSidebarPath]);

  const isValidDropTarget = useCallback((sourcePath, targetFolderPath) => {
    if (!sourcePath || !targetFolderPath) return false;
    if (sourcePath === targetFolderPath) return false;
    if (isDescendantPath(sourcePath, targetFolderPath)) return false;
    if (fileOps.getParentPath(sourcePath) === targetFolderPath) return false;
    return true;
  }, [fileOps, isDescendantPath]);

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
  }, [clearExpandTimer, expandedFolders]);

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
        setDragNotice({
          mode: operation === 'copy' ? 'replace-copy' : 'replace-move',
          title: operation === 'copy' ? 'Replace Existing Item?' : 'Replace Existing Item?',
          message: `"${getBaseName(draggedPath)}" already exists in the destination folder. ${operation === 'copy' ? 'Copying' : 'Moving'} will replace the existing item.`,
          sourcePath: draggedPath,
          targetFolderPath,
          targetPath: error.targetPath,
          operation,
          isDirectory: draggedEntryType === 'folder',
        });
      } else {
        setDragNotice({
          mode: 'info',
          title: operation === 'copy' ? 'Copy Failed' : 'Move Failed',
          message: error?.message || `${operation === 'copy' ? 'The item could not be copied.' : 'The item could not be moved.'} Please try again.`,
        });
      }
    } finally {
      clearDragState();
    }
  }, [clearDragState, dragOperation, draggedEntryType, draggedPath, fileOps, getBaseName, isValidDropTarget, replaceRecentFilePath]);

  const handleConfirmDragNotice = useCallback(async () => {
    if (!dragNotice) return;

    if (dragNotice.mode === 'delete-entry') {
      try {
        await fileOps.deleteEntry(dragNotice.targetPath);
        setDragNotice(null);
      } catch (error) {
        setDragNotice({
          mode: 'info',
          title: 'Delete Failed',
          message: error?.message || 'The selected item could not be deleted.',
        });
      }
      return;
    }

    if (!dragNotice.mode.startsWith('replace')) {
      setDragNotice(null);
      return;
    }

    try {
      if (dragNotice.operation === 'copy') {
        await fileOps.copyEntry(dragNotice.sourcePath, dragNotice.targetFolderPath, {
          overwrite: true,
          isDirectory: dragNotice.isDirectory
        });
        removeRecentFilePrefix(dragNotice.targetPath);
      } else {
        const nextPath = await fileOps.moveEntry(dragNotice.sourcePath, dragNotice.targetFolderPath, { overwrite: true });
        removeRecentFilePrefix(dragNotice.targetPath);
        replaceRecentFilePath(dragNotice.sourcePath, nextPath);
      }
      setDragNotice(null);
    } catch (error) {
      setDragNotice({
        mode: 'info',
        title: 'Replace Failed',
        message: error?.message || 'The existing item could not be replaced. Please try again.',
      });
    }
  }, [dragNotice, fileOps, removeRecentFilePrefix, replaceRecentFilePath]);

  const handleDeleteEntryRequest = useCallback((targetPath) => {
    setDragNotice({
      mode: 'delete-entry',
      title: 'Move to Trash?',
      message: `“${getBaseName(targetPath)}” will be removed from this workspace immediately. This action cannot be undone.`,
      targetPath,
    });
  }, [getBaseName]);

  const handleDragStartEntry = useCallback((path, isDirectory) => {
    setDraggedPath(path);
    setDraggedEntryType(isDirectory ? 'folder' : 'file');
    setDragOperation('move');
    setDropTargetPath(null);
    setInvalidDropPath(null);
    setRootDropActive(false);
  }, []);

  const handleDragHoverEntry = useCallback((targetPath, isDirectory, altKey = false) => {
    if (!draggedPath) return;
    if (!isDirectory) return;
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
  }, [clearExpandTimer, currentFolder, draggedPath, isValidDropTarget]);

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

  useKeyboardShortcuts({
    onNew: () => requestActionWithUnsavedGuard(async () => handleNewFile()),
    onOpen: () => requestActionWithUnsavedGuard(async () => fileOps.handleOpenFile()),
    onSave: fileOps.handleSave,
    onSaveAs: fileOps.handleSaveAs,
    onClose: handleCloseWindow,
    onPreferences: handleOpenPreferences,
    onBold: () => handleFormatText('bold'),
    onItalic: () => handleFormatText('italic'),
    onStrikethrough: () => handleFormatText('strikethrough'),
    onLink: () => handleFormatText('link')
  });

  useEffect(() => {
    setHasUnsavedChanges(markdown !== savedMarkdownRef.current);
  }, [markdown]);

  useEffect(() => {
    if (currentFilePath) {
      setSelectedSidebarPath(currentFilePath);
    }
  }, [currentFilePath]);

  useEffect(() => {
    if (!currentFolder) {
      setSelectedSidebarPath(null);
      return;
    }

    setSelectedSidebarPath((prev) => {
      if (prev && (prev === currentFolder || prev.startsWith(`${currentFolder}/`))) {
        return prev;
      }

      if (currentFilePath?.startsWith(`${currentFolder}/`)) {
        return currentFilePath;
      }

      return folderContents[0]?.path || null;
    });
  }, [currentFilePath, currentFolder, folderContents]);

  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges || !currentFilePath) return undefined;

    const timer = setTimeout(() => {
      void fileOps.handleSave();
    }, 2000);

    return () => clearTimeout(timer);
  }, [autoSaveEnabled, currentFilePath, fileOps, hasUnsavedChanges, markdown]);

  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

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
  }, [currentFilePath, currentFolder, fileOps]);

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
    const unlistenPromise = appWindow.onCloseRequested((event) => {
      if (closeBypassRef.current) {
        closeBypassRef.current = false;
        return;
      }

      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      setPendingAction(() => async () => {
        closeBypassRef.current = true;
        await appWindow.close();
      });
      setDragNotice({
        mode: 'unsaved-document',
        title: 'Save Changes Before Closing?',
        message: 'This document has unsaved changes. You can save before closing, or close without saving.',
      });
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [appWindow, hasUnsavedChanges]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const title = currentFilePath ? currentFilePath.split('/').pop() : 'Untitled';
    const prefix = hasUnsavedChanges ? '● ' : '';
    void appWindow.setTitle(`${prefix}${title} — JustMark`);
  }, [appWindow, currentFilePath, hasUnsavedChanges]);

  useEffect(() => {
    menuActionRef.current = {
      newDocument: () => requestActionWithUnsavedGuard(async () => handleNewFile()),
      newWindow: () => handleNewWindow(),
      openFile: () => requestActionWithUnsavedGuard(async () => fileOps.handleOpenFile()),
      openFolder: () => requestActionWithUnsavedGuard(handleOpenFolder),
      openRecentFile: (path) => requestActionWithUnsavedGuard(async () => fileOps.openFileInEditor(path)),
      clearRecentFiles: () => clearRecentFiles(),
      save: () => void fileOps.handleSave(),
      saveAs: () => void fileOps.handleSaveAs(),
      exportPDF: () => void handleExportPDF(),
      exportDOCX: () => void handleExportDOCX(),
      closeWindow: () => handleCloseWindow(),
      openPreferences: () => handleOpenPreferences(),
      openFind: () => editorAreaRef.current?.openFind(),
      openReplace: () => editorAreaRef.current?.openReplace(),
      findNext: () => editorAreaRef.current?.findNext(),
      findPrevious: () => editorAreaRef.current?.findPrevious(),
      pastePlainText: async () => {
        try {
          await editorAreaRef.current?.pastePlainText();
        } catch (error) {
          console.error('粘贴纯文本失败:', error);
        }
      },
      bringAllToFront: () => void bringAllToFront(),
      toggleSidebar: () => setSidebarVisible((prev) => !prev),
      togglePreview: () => setPreviewVisible((prev) => !prev),
      increaseFont: () => increaseFontSize(),
      decreaseFont: () => decreaseFontSize(),
      toggleTheme: () => toggleTheme(),
      minimizeWindow: () => void appWindow.minimize(),
      maximizeWindow: () => void appWindow.toggleMaximize(),
    };
  }, [
    appWindow,
    clearRecentFiles,
    decreaseFontSize,
    fileOps,
    handleCloseWindow,
    handleExportDOCX,
    handleExportPDF,
    handleNewFile,
    handleNewWindow,
    handleOpenFolder,
    handleOpenPreferences,
    increaseFontSize,
    requestActionWithUnsavedGuard,
    setPreviewVisible,
    setSidebarVisible,
    toggleTheme
  ]);

  useEffect(() => {
    let cancelled = false;

    const setupMenu = async () => {
      try {
        const openRecentSubmenu = await Submenu.new({
          text: 'Open Recent',
          items: recentFiles.length > 0
            ? [
                ...await Promise.all(recentFiles.map((path, index) => MenuItem.new({
                  text: formatRecentFileLabel(path),
                  id: `file-open-recent-${index}`,
                  action: () => menuActionRef.current.openRecentFile?.(path)
                }))),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await MenuItem.new({
                  text: 'Clear Menu',
                  id: 'file-open-recent-clear',
                  action: () => menuActionRef.current.clearRecentFiles?.()
                })
              ]
            : [
                await MenuItem.new({
                  text: 'No Recent Documents',
                  id: 'file-open-recent-empty',
                  enabled: false
                })
              ]
        });

        const appSubmenu = await Submenu.new({
          text: 'JustMark',
          items: [
            await PredefinedMenuItem.new({
              item: {
                About: {
                  name: 'JustMark',
                  version: '0.1.1',
                  copyright: 'Simon Chen'
                }
              }
            }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Services' }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Hide' }),
            await PredefinedMenuItem.new({ item: 'HideOthers' }),
            await PredefinedMenuItem.new({ item: 'ShowAll' }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Preferences...', id: 'app-preferences', accelerator: 'CmdOrCtrl+,', action: () => menuActionRef.current.openPreferences?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Quit' })
          ]
        });

        const fileSubmenu = await Submenu.new({
          text: 'File',
          items: [
            await MenuItem.new({ text: 'New', id: 'file-new', accelerator: 'CmdOrCtrl+N', action: () => menuActionRef.current.newDocument?.() }),
            await MenuItem.new({ text: 'New Window', id: 'file-new-window', accelerator: 'CmdOrCtrl+Shift+N', action: () => menuActionRef.current.newWindow?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Open...', id: 'file-open', accelerator: 'CmdOrCtrl+O', action: () => menuActionRef.current.openFile?.() }),
            await MenuItem.new({ text: 'Open Folder...', id: 'file-open-folder', accelerator: 'CmdOrCtrl+Shift+O', action: () => menuActionRef.current.openFolder?.() }),
            openRecentSubmenu,
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Save', id: 'file-save', accelerator: 'CmdOrCtrl+S', action: () => menuActionRef.current.save?.() }),
            await MenuItem.new({ text: 'Save As...', id: 'file-save-as', accelerator: 'CmdOrCtrl+Shift+S', action: () => menuActionRef.current.saveAs?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Export as PDF…', id: 'file-export-pdf', action: () => menuActionRef.current.exportPDF?.() }),
            await MenuItem.new({ text: 'Export as Word…', id: 'file-export-docx', action: () => menuActionRef.current.exportDOCX?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Close Window', id: 'file-close', accelerator: 'CmdOrCtrl+W', action: () => menuActionRef.current.closeWindow?.() })
          ]
        });

        const editSubmenu = await Submenu.new({
          text: 'Edit',
          items: [
            await PredefinedMenuItem.new({ item: 'Undo' }),
            await PredefinedMenuItem.new({ item: 'Redo' }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Cut' }),
            await PredefinedMenuItem.new({ item: 'Copy' }),
            await PredefinedMenuItem.new({ item: 'Paste' }),
            await MenuItem.new({ text: 'Paste and Match Style', id: 'edit-paste-plain', accelerator: 'CmdOrCtrl+Shift+V', action: () => menuActionRef.current.pastePlainText?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Find…', id: 'edit-find', accelerator: 'CmdOrCtrl+F', action: () => menuActionRef.current.openFind?.() }),
            await MenuItem.new({ text: 'Find Next', id: 'edit-find-next', accelerator: 'CmdOrCtrl+G', action: () => menuActionRef.current.findNext?.() }),
            await MenuItem.new({ text: 'Find Previous', id: 'edit-find-previous', accelerator: 'CmdOrCtrl+Shift+G', action: () => menuActionRef.current.findPrevious?.() }),
            await MenuItem.new({ text: 'Replace…', id: 'edit-replace', accelerator: 'CmdOrCtrl+Alt+F', action: () => menuActionRef.current.openReplace?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'SelectAll' })
          ]
        });

        const viewSubmenu = await Submenu.new({
          text: 'View',
          items: [
            await MenuItem.new({ text: 'Toggle Sidebar', id: 'view-sidebar', accelerator: 'CmdOrCtrl+\\', action: () => menuActionRef.current.toggleSidebar?.() }),
            await MenuItem.new({ text: 'Toggle Preview', id: 'view-preview', accelerator: 'CmdOrCtrl+Shift+\\', action: () => menuActionRef.current.togglePreview?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Increase Text Size', id: 'view-font-increase', accelerator: 'CmdOrCtrl+=', action: () => menuActionRef.current.increaseFont?.() }),
            await MenuItem.new({ text: 'Decrease Text Size', id: 'view-font-decrease', accelerator: 'CmdOrCtrl+-', action: () => menuActionRef.current.decreaseFont?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Toggle Appearance', id: 'view-theme', accelerator: 'CmdOrCtrl+Alt+T', action: () => menuActionRef.current.toggleTheme?.() })
          ]
        });

        const windowSubmenu = await Submenu.new({
          text: 'Window',
          items: [
            await PredefinedMenuItem.new({ item: 'Minimize' }),
            await MenuItem.new({ text: 'Zoom', id: 'window-zoom', accelerator: 'Ctrl+Cmd+F', action: () => menuActionRef.current.maximizeWindow?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Bring All to Front', id: 'window-bring-all-to-front', action: () => menuActionRef.current.bringAllToFront?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Close', id: 'window-close', accelerator: 'CmdOrCtrl+W', action: () => menuActionRef.current.closeWindow?.() })
          ]
        });

        const helpSubmenu = await Submenu.new({
          text: 'Help',
          items: [
            await MenuItem.new({
              text: 'JustMark Help',
              id: 'help-justmark'
            })
          ]
        });

        const appMenu = await Menu.new({
          items: [appSubmenu, fileSubmenu, editSubmenu, viewSubmenu, windowSubmenu, helpSubmenu]
        });

        if (cancelled) {
          return;
        }

        await appMenu.setAsAppMenu();
        await helpSubmenu.setAsHelpMenuForNSApp().catch(() => {});
        await windowSubmenu.setAsWindowsMenuForNSApp().catch(() => {});
      } catch (error) {
        console.error('Failed to initialize app menu:', error);
      }
    };

    void setupMenu();

    return () => {
      cancelled = true;
    };
  }, [recentFiles]);

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
        toggleFolder(currentPath);
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
        toggleFolder(currentPath);
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
  }, [activateSidebarEntry, currentFolder, selectSidebarPath, selectedSidebarPath, toggleFolder]);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} jm-window`} style={{ color: appTextColor }}>
      <div className="jm-shell">
      <header className={`jm-toolbar ${HEADER_HEIGHT}`} data-tauri-drag-region>
        <div className="flex items-center gap-3">
          <div className="jm-traffic-lights">
            <button className="jm-traffic-dot bg-[#ff5f57] flex items-center justify-center text-[8px] text-[#7a1d1d]" onClick={handleCloseWindow}><IconWindowClose className="h-2 w-2" /></button>
            <button className="jm-traffic-dot bg-[#febc2e] flex items-center justify-center text-[8px] text-[#7a5516]" onClick={handleMinimizeWindow}><IconWindowMinimize className="h-2 w-2" /></button>
            <button className="jm-traffic-dot bg-[#28c840] flex items-center justify-center text-[8px] text-[#14532d]" onClick={handleToggleMaximizeWindow}><IconWindowMaximize className="h-2 w-2" /></button>
          </div>
          <div className="jm-toolbar-group">
            <button onClick={() => requestActionWithUnsavedGuard(async () => handleNewFile())} className="jm-button jm-button-primary"><IconDocument className="mr-1.5 h-4 w-4" />New</button>
            <button onClick={() => requestActionWithUnsavedGuard(async () => fileOps.handleOpenFile())} className="jm-button"><IconFolder className="mr-1.5 h-4 w-4" />Open</button>
            <button onClick={fileOps.handleSave} className="jm-button"><IconSave className="mr-1.5 h-4 w-4" />Save</button>
          </div>
        </div>

        <div className="flex-1 flex justify-center px-4">
          <div className="jm-title-badge max-w-[420px]">
            <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><IconDocument className="h-4 w-4" /></div>
            <div className="min-w-0 text-center">
              <div className="truncate text-[12px] font-semibold text-slate-800">
                {currentFilePath ? currentFilePath.split('/').pop() : 'Untitled'}
              </div>
              <div className="truncate text-[10px] text-slate-500">
                {hasUnsavedChanges ? 'Edited, not yet saved' : currentFolder ? currentFolder.split('/').pop() : 'JustMark Document'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="jm-toolbar-group">
            <button onClick={handleExportPDF} disabled={isExporting || !previewVisible} className="jm-button disabled:opacity-50"><IconExport className="mr-1.5 h-4 w-4" />PDF</button>
            <button onClick={handleExportDOCX} disabled={isExporting} className="jm-button disabled:opacity-50"><IconExport className="mr-1.5 h-4 w-4" />Word</button>
          </div>
          <div className="jm-toolbar-group">
            <button onClick={() => setSidebarVisible(!sidebarVisible)} className="jm-button"><IconSidebar className="mr-1.5 h-4 w-4" />{sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}</button>
            <button onClick={() => setPreviewVisible(!previewVisible)} className="jm-button"><IconPreview className="mr-1.5 h-4 w-4" />{previewVisible ? 'Hide Preview' : 'Show Preview'}</button>
            <button onClick={decreaseFontSize} className="jm-button"><IconMinus className="h-4 w-4" /></button>
            <button onClick={increaseFontSize} className="jm-button"><IconPlus className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-3 gap-3">
        {sidebarVisible && currentFolder && (
          <aside
            ref={sidebarRef}
            style={{ width: `${sidebarWidth}px` }}
            className={`jm-panel jm-sidebar overflow-y-auto transition-colors ${rootDropActive ? 'bg-blue-500/6 dark:bg-blue-400/8' : ''}`}
            tabIndex={0}
            onDragOver={handleSidebarDragOver}
            onDrop={handleSidebarDrop}
            onKeyDown={handleSidebarKeyDown}
            onFocus={(event) => {
              if (event.target !== event.currentTarget) {
                return;
              }

              const fallbackPath = selectedSidebarPath || currentFilePath || folderContents[0]?.path;
              if (fallbackPath) {
                selectSidebarPath(fallbackPath);
              }
            }}
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
                  onChange={setInlineCreateName}
                  onConfirm={confirmInlineCreate}
                  onCancel={cancelInlineCreate}
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
                  onToggleFolder={toggleFolder}
                  onOpenFile={(path) => fileOps.openFileInEditor(path, { revealInSidebar: false })}
                  getSubfolderContents={fileOps.getSubfolderContents}
                  onStartInlineCreate={startInlineCreate}
                  onDeleteEntry={handleDeleteEntryRequest}
                  onRenameEntry={fileOps.renameEntry}
                  onRevealInFinder={handleRevealInFinder}
                  onDragStartEntry={handleDragStartEntry}
                  onDragEndEntry={clearDragState}
                  onDragHoverEntry={handleDragHoverEntry}
                  onDropEntry={handleDropEntry}
                  inlineCreate={inlineCreate}
                  inlineInputRef={inlineCreateInputRef}
                  onInlineChange={setInlineCreateName}
                  onInlineConfirm={confirmInlineCreate}
                  onInlineCancel={cancelInlineCreate}
                  onSelectEntry={handleSelectSidebarEntry}
                  fileTags={fileTags}
                  draggedPath={draggedPath}
                  dropTargetPath={dropTargetPath}
                  invalidDropPath={invalidDropPath}
                  dragOperation={dragOperation}
                />
              ))}
            </div>
          </aside>
        )}

        <section style={{ width: previewVisible ? `${editorWidth}%` : '100%' }} className="overflow-hidden">
          <EditorArea
            ref={editorAreaRef}
            markdown={markdown}
            onMarkdownChange={handleMarkdownChange}
            onImagePasted={handleImagePasted}
            currentFont={currentFont}
            currentFontFamily={currentFontFamily}
            appBgColor={appBgColor}
            appTextColor={appTextColor}
            currentFolder={currentFolder}
            currentFilePath={currentFilePath}
            sidebarVisible={sidebarVisible}
            onToggleSidebar={setSidebarVisible}
            previewVisible={previewVisible}
            onTogglePreview={() => setPreviewVisible(!previewVisible)}
          />
        </section>

        {previewVisible && (
          <section
            ref={previewSectionRef}
            className="jm-preview-surface flex-1 overflow-y-auto p-10"
            style={{
              color: previewTextColor,
              fontSize: currentFont.previewSize,
              fontFamily: currentFontFamily.family
            }}
          >
            <div className={`prose mx-auto max-w-4xl ${isDarkMode ? 'prose-invert' : ''}`}>
              <MarkdownPreview content={deferredMarkdown} attachmentFolder={attachmentFolder} />
            </div>
          </section>
        )}
      </main>

      <footer className="jm-statusbar">
        <div className="flex items-center justify-between px-4 py-2 text-[11px]">
          <div className="truncate text-slate-500">
            {currentFilePath ? currentFilePath : 'Untitled document'}
          </div>
          <div className="whitespace-nowrap text-slate-500">
            {chars} characters · {words} words · {lines} lines
          </div>
        </div>
      </footer>
      </div>

      {draggedPath && (
        <div className="fixed left-4 bottom-4 z-40 pointer-events-none">
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/78 dark:bg-slate-900/78 px-3.5 py-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {dragOperation === 'copy' ? 'Copy Item' : 'Move Item'}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-slate-800 dark:text-slate-100">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100/90 dark:bg-slate-800/90">
                {dragOperation === 'copy' ? '➕' : '↘'}
              </span>
              <span className="max-w-[240px] truncate font-medium">{getBaseName(draggedPath)}</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              {dragOperation === 'copy' ? 'Drop on a folder to copy.' : 'Drop on a folder to move.'} Press Esc to cancel.
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(dragNotice)}
        title={dragNotice?.title || ''}
        message={dragNotice?.message || ''}
        confirmText={
          dragNotice?.mode === 'unsaved-document'
            ? "Don't Save"
            : dragNotice?.mode?.startsWith('replace')
              ? 'Replace'
              : dragNotice?.mode === 'delete-entry'
                ? 'Delete'
                : 'OK'
        }
        cancelText="Cancel"
        hideCancel={!(dragNotice?.mode?.startsWith('replace') || dragNotice?.mode === 'unsaved-document' || dragNotice?.mode === 'delete-entry')}
        secondaryText={dragNotice?.mode === 'unsaved-document' ? 'Save' : null}
        isDangerous={dragNotice?.mode?.startsWith('replace') || dragNotice?.mode === 'delete-entry'}
        onConfirm={async () => {
          if (dragNotice?.mode === 'unsaved-document') {
            const action = pendingAction;
            setDragNotice(null);
            setPendingAction(null);
            if (action) {
              await action();
            }
            return;
          }
          await handleConfirmDragNotice();
        }}
        onSecondary={async () => {
          const saved = await saveCurrentDocument();
          if (!saved) return;
          const action = pendingAction;
          setDragNotice(null);
          setPendingAction(null);
          if (action) {
            await action();
          }
        }}
        onCancel={() => {
          setDragNotice(null);
          setPendingAction(null);
        }}
        position={null}
      />
    </div>
  );
}

export default App;
