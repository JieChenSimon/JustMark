/* @refresh reset */
import { useState, useRef, useDeferredValue, useCallback, useMemo, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import { useWindowManager } from './hooks/useWindowManager';
import { useRecentFiles } from './hooks/useRecentFiles';
import { useWordCount } from './hooks/useWordCount';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMarkdownEditor } from './hooks/useMarkdownEditor';
import { useFileOperations } from './hooks/useFileOperations';
import { useAppMenu } from './hooks/useAppMenu';
import { useSidebarDragAndDrop } from './hooks/useSidebarDragAndDrop';
import { useSidebarSelection } from './hooks/useSidebarSelection';
import { useDocumentLifecycle } from './hooks/useDocumentLifecycle';
import { useInlineCreate } from './hooks/useInlineCreate';
import { useNoticeDialog } from './hooks/useNoticeDialog';
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';
import { useWebClipper } from './hooks/useWebClipper';
import EditorArea from './components/EditorArea';
import MarkdownPreview from './components/preview/MarkdownPreview';
import PDFPreview from './components/preview/PDFPreview';
import FilePreview from './components/preview/FilePreview';
import { useExportManager } from './components/Export/ExportManager';
import { useResizable } from './hooks/useResizable';
import PreviewColorPicker from './components/PreviewColorPicker';
import DragNoticeOverlay from './components/sidebar/DragNoticeOverlay';
import SidebarPanel from './components/sidebar/SidebarPanel';
import GlobalSearch from './components/GlobalSearch';
import ConfirmDialog from './components/ConfirmDialog';
import { parseTags, sortEntries, getTagColor } from './utils/fileHelpers';
import { createUniqueHeadingId, extractTocHeadings, flattenReactNodeText, getLineStartOffset } from './utils/toc';
import { bringAllToFront, openDocumentWindow, openPreferencesWindow } from './utils/windows';

const CODE_LIKE_FILE_PATTERN = /\.(json|jsonc|ya?ml|toml|ini|conf|env|xml|log|sh|bash|zsh|fish|js|jsx|ts|tsx|mjs|cjs|py|rs|go|java|c|cc|cpp|h|hpp|css|scss|less|html?)$/i;
const SINGLE_FENCED_BLOCK_PATTERN = /^```[\w-]*\n[\s\S]*\n```$/;

function App() {
  // Multi-file tab state
  const [openFiles, setOpenFiles] = useLocalStorage('openFiles', []);
  const [activeFilePath, setActiveFilePath] = useLocalStorage('activeFilePath', null);

  // Derived state from openFiles
  const activeFile = openFiles.find(f => f.path === activeFilePath);
  const markdown = activeFile?.content || '### JustMark\nWrite in a single way...';
  const hasUnsavedChanges = activeFile ? activeFile.content !== activeFile.savedContent : false;
  const currentFilePath = activeFilePath;

  // Update refs when markdown changes
  useEffect(() => {
    markdownRef.current = markdown;
  }, [markdown]);

  const markdownRef = useRef(markdown);
  const savedMarkdownRef = useRef(markdown);
  const didRestoreRef = useRef(false);

  const theme = useTheme();
  const {
    isDarkMode,
    currentFont,
    currentEditorFont,
    currentPreviewFont,
    currentFontFamily,
    currentBgColor,
    appBgColor,
    appTextColor,
    previewBgColor,
    previewTextColor,
    bgColorIndex,
    setBgColorIndex,
    previewBgColorIndex,
    setPreviewBgColorIndex,
    showBgColorMenu,
    setShowBgColorMenu,
    showPreviewBgColorMenu,
    setShowPreviewBgColorMenu,
    toggleTheme,
    increaseFontSize,
    decreaseFontSize
  } = theme;

  const {
    attachmentFolder,
    autoSaveEnabled,
    fileSortBy,
    showHiddenFiles,
    hiddenFilesWhitelist
  } = useSettings();
  const {
    recentFiles,
    recentFolders,
    addRecentFile,
    addRecentFolder,
    clearRecentHistory,
    replaceRecentFilePath,
    removeRecentFilePrefix
  } = useRecentFiles();
  const { chars, words, lines } = useWordCount(markdown);
  const { sidebarWidth, setSidebarWidth, isDraggingSidebar, setIsDraggingSidebar } = useWindowManager();
  const { isExporting, exportToPDF, exportToDOCX } = useExportManager();
  const { width: editorWidth, setWidth: setEditorWidth, isDragging, handleMouseDown } = useResizable(60, 38, 76);
  const { clipFromSelection, isClipping } = useWebClipper();

  const [currentFolder, setCurrentFolder] = useLocalStorage('currentFolder', null);
  const [folderContents, setFolderContents] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [fileTags, setFileTags] = useLocalStorage('justmark_file_tags', {});
  const [previewVisible, setPreviewVisible] = useLocalStorage('previewVisible', true);
  const [previewMode, setPreviewMode] = useLocalStorage('previewMode', 'markdown');
  const [sidebarVisible, setSidebarVisible] = useLocalStorage('sidebarVisible', false);
  const [dragNotice, setDragNotice] = useState(null);
  const [previewFilePath, setPreviewFilePath] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const inlineCreateInputRef = useRef(null);
  const previewSectionRef = useRef(null);
  const editorAreaRef = useRef(null);
  const sidebarRef = useRef(null);
  const closeBypassRef = useRef(false);
  const deferredMarkdown = useDeferredValue(markdown);
  const appWindow = getCurrentWindow();
  const shouldAnimateLayout = !isDragging && !isDraggingSidebar;
  const isTextDocument = !currentFilePath || /\.(md|markdown|txt)$/i.test(currentFilePath);
  const isSingleFencedBlock = useMemo(() => SINGLE_FENCED_BLOCK_PATTERN.test(markdown.trim()), [markdown]);
  const isCodeLikeDocument = useMemo(() => {
    if (currentFilePath && CODE_LIKE_FILE_PATTERN.test(currentFilePath)) {
      return true;
    }

    if (isSingleFencedBlock) {
      return true;
    }

    const trimmed = markdown.trim();
    if (!trimmed) {
      return false;
    }

    return /^[\[{][\s\S]*[\]}]$/.test(trimmed) && !/^#{1,6}\s/m.test(trimmed);
  }, [currentFilePath, isSingleFencedBlock, markdown]);
  const layoutPreset = isCodeLikeDocument ? 'code' : 'prose';
  const previewFontSize = isCodeLikeDocument ? currentPreviewFont.codePreviewSize : currentPreviewFont.previewSize;
  const tocItems = useMemo(
    () => (isTextDocument ? extractTocHeadings(markdown) : []),
    [isTextDocument, markdown]
  );
  const markdownPreviewComponents = useMemo(() => {
    const headingCounts = new Map();
    const createHeading = (tagName) => function Heading({ children, ...props }) {
      const text = flattenReactNodeText(children);
      const id = createUniqueHeadingId(text, headingCounts);
      const Tag = tagName;
      return (
        <Tag
          id={`jm-heading-${id}`}
          data-jm-heading-id={id}
          className="scroll-mt-6"
          {...props}
        >
          {children}
        </Tag>
      );
    };

    return {
      h1: createHeading('h1'),
      h2: createHeading('h2'),
      h3: createHeading('h3'),
      h4: createHeading('h4'),
      h5: createHeading('h5'),
      h6: createHeading('h6'),
    };
  }, [deferredMarkdown]);

  useEffect(() => {
    const targetEditorWidth = isCodeLikeDocument ? 52 : 60;
    setEditorWidth(targetEditorWidth);
  }, [isCodeLikeDocument, setEditorWidth]);

  const setActiveMarkdown = useCallback((nextMarkdown) => {
    markdownRef.current = nextMarkdown;

    if (!activeFilePath) {
      return;
    }

    setOpenFiles((prev) => prev.map((file) => (
      file.path === activeFilePath ? { ...file, content: nextMarkdown } : file
    )));
  }, [activeFilePath, setOpenFiles]);

  const { handleMarkdownChange, handleFormatText, handleImagePasted } = useMarkdownEditor({
    markdown,
    setMarkdown: setActiveMarkdown,
    markdownRef
  });

  // Tab management functions
  const openFileInTab = useCallback(async (filePath, content) => {
    // Check if already open
    const existingFile = openFiles.find(f => f.path === filePath);
    if (existingFile) {
      setActiveFilePath(filePath);
      return;
    }

    // Check file limit
    if (openFiles.length >= 10) {
      setDragNotice({
        mode: 'info',
        title: 'Tab Limit Reached',
        message: 'Maximum 10 files can be open at once. Close some tabs to open more files.',
      });
      return;
    }

    // Add new file
    const newFile = {
      path: filePath,
      content,
      savedContent: content,
      cursorPosition: 0,
      scrollTop: 0
    };

    setOpenFiles(prev => [...prev, newFile]);
    setActiveFilePath(filePath);
  }, [openFiles, setOpenFiles, setActiveFilePath, setDragNotice]);

  const switchToFile = useCallback((filePath) => {
    // Save current file's cursor and scroll position
    if (activeFilePath && editorAreaRef.current) {
      const textarea = editorAreaRef.current.getTextareaElement?.();
      if (textarea) {
        setOpenFiles(prev => prev.map(f =>
          f.path === activeFilePath
            ? { ...f, cursorPosition: textarea.selectionStart, scrollTop: textarea.scrollTop }
            : f
        ));
      }
    }

    // Switch to target file
    setActiveFilePath(filePath);
  }, [activeFilePath, setOpenFiles, setActiveFilePath]);

  const closeFile = useCallback(async (filePath) => {
    const file = openFiles.find(f => f.path === filePath);

    // Check for unsaved changes
    if (file && file.content !== file.savedContent) {
      return new Promise((resolve) => {
        setDragNotice({
          mode: 'confirm',
          title: 'Unsaved Changes',
          message: `Do you want to save changes to "${file.path.split('/').pop()}"?`,
          confirmText: 'Save',
          secondaryText: "Don't Save",
          cancelText: 'Cancel',
          onConfirm: async () => {
            await saveFile(filePath);
            setDragNotice(null);
            closeFileInternal(filePath);
            resolve(true);
          },
          onSecondary: () => {
            setDragNotice(null);
            closeFileInternal(filePath);
            resolve(true);
          },
          onCancel: () => {
            setDragNotice(null);
            resolve(false);
          }
        });
      });
    }

    closeFileInternal(filePath);
    return true;
  }, [openFiles, setDragNotice]);

  const closeFileInternal = useCallback((filePath) => {
    const newOpenFiles = openFiles.filter(f => f.path !== filePath);
    setOpenFiles(newOpenFiles);

    // If closing active file, switch to adjacent file
    if (filePath === activeFilePath) {
      const index = openFiles.findIndex(f => f.path === filePath);
      const nextFile = newOpenFiles[index] || newOpenFiles[index - 1] || null;
      setActiveFilePath(nextFile?.path || null);
    }
  }, [openFiles, activeFilePath, setOpenFiles, setActiveFilePath]);

  const saveFile = useCallback(async (filePath) => {
    const file = openFiles.find(f => f.path === filePath);
    if (!file) return;

    await writeTextFile(filePath, file.content);

    // Update savedContent
    setOpenFiles(prev => prev.map(f =>
      f.path === filePath ? { ...f, savedContent: f.content } : f
    ));
  }, [openFiles, setOpenFiles]);

  const persistSavedMarkdown = useCallback((content) => {
    savedMarkdownRef.current = content;
    markdownRef.current = content;

    // Update savedContent for active file
    if (activeFilePath) {
      setOpenFiles(prev => prev.map(f =>
        f.path === activeFilePath ? { ...f, savedContent: content } : f
      ));
    }
  }, [activeFilePath, setOpenFiles]);

  const fileOps = useFileOperations({
    currentFilePath,
    currentFolder,
    setHasUnsavedChanges: () => {}, // No longer needed, derived from state
    addRecentFile,
    addRecentFolder,
    setCurrentFolder,
    setFolderContents,
    setExpandedFolders,
    setPreviewFilePath,
    sortEntries: (entries) => sortEntries(entries, fileSortBy),
    parseTags,
    setFileTags,
    onPersistMarkdown: persistSavedMarkdown,
    getTagColor,
    showHiddenFiles,
    hiddenFilesWhitelist,
    openFileInTab,
    saveFile,
    closeFile,
    openFiles,
    setOpenFiles,
    setActiveFilePath
  });

  const handleNewFile = useCallback(() => {
    // Close all tabs and reset
    setOpenFiles([]);
    setActiveFilePath(null);
    persistSavedMarkdown('');
  }, [persistSavedMarkdown, setOpenFiles, setActiveFilePath]);

  const saveCurrentDocument = useCallback(async () => {
    if (activeFilePath) {
      return fileOps.handleSave();
    }

    return Boolean(await fileOps.handleSaveAs());
  }, [activeFilePath, fileOps]);

  const {
    unsavedNotice,
    requestActionWithUnsavedGuard,
    confirmPendingAction,
    saveAndConfirmPendingAction,
    clearPendingAction,
  } = useUnsavedChangesGuard({
    appWindow,
    closeBypassRef,
    hasUnsavedChanges,
    onCloseWindow: async () => appWindow.close(),
    onSaveDocument: saveCurrentDocument,
  });

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

  const handleOpenFolder = useCallback(async () => {
    await fileOps.handleOpenFolder();
    setSidebarVisible(true);
  }, [fileOps, setSidebarVisible]);

  const {
    inlineCreate,
    inlineCreateName,
    setInlineCreateName,
    startInlineCreate,
    cancelInlineCreate,
    confirmInlineCreate,
  } = useInlineCreate({
    fileOps,
    inputRef: inlineCreateInputRef,
  });

  const handleRevealInFinder = useCallback(async (path) => {
    try {
      await revealItemInDir(path);
    } catch (error) {
      console.error('Failed to reveal item in Finder:', error);
    }
  }, []);

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

  const handleSelectToc = useCallback((item) => {
    const previewHeading = previewSectionRef.current?.querySelector?.(`[data-jm-heading-id="${item.id}"]`);
    if (previewHeading) {
      previewHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const textarea = editorAreaRef.current?.getTextareaElement?.();
    if (!textarea) {
      return;
    }

    const offset = getLineStartOffset(markdownRef.current, item.line);
    textarea.focus();
    textarea.setSelectionRange(offset, offset);
  }, []);

  const handleNewWindow = useCallback(() => {
    openDocumentWindow();
  }, []);

  const handleClipUrl = useCallback(async () => {
    const textarea = editorAreaRef.current?.getTextareaElement?.();
    if (!textarea) {
      setDragNotice({
        mode: 'info',
        title: 'Clip Unavailable',
        message: 'Open a text document first, then select a URL in the editor.',
      });
      return;
    }

    try {
      await clipFromSelection(textarea, markdown, setActiveMarkdown, () => {});
      markdownRef.current = textarea.value;
    } catch (error) {
      setDragNotice({
        mode: 'info',
        title: 'Clip Failed',
        message: error?.message || 'The selected content could not be clipped.',
      });
    }
  }, [clipFromSelection, markdown, setActiveMarkdown]);

  const {
    selectedSidebarPath,
    selectSidebarPath,
    activateSidebarEntry, // eslint-disable-line no-unused-vars
    handleSidebarKeyDown,
  } = useSidebarSelection({
    currentFilePath,
    currentFolder,
    folderContents,
    onOpenFile: (path) => fileOps.openFileInEditor(path, { revealInSidebar: false }),
    onToggleFolder: toggleFolder,
    sidebarRef,
  });
  const isValidDropTarget = useCallback((sourcePath, targetFolderPath) => {
    if (!sourcePath || !targetFolderPath) return false;
    if (sourcePath === targetFolderPath) return false;
    if (isDescendantPath(sourcePath, targetFolderPath)) return false;
    if (fileOps.getParentPath(sourcePath) === targetFolderPath) return false;
    return true;
  }, [fileOps, isDescendantPath]);
  const {
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
  } = useSidebarDragAndDrop({
    currentFolder,
    expandedFolders,
    fileOps,
    getBaseName,
    isValidDropTarget,
    replaceRecentFilePath,
    removeRecentFilePrefix,
    setExpandedFolders,
    setNotice: setDragNotice,
    sidebarRef
  });
  const {
    requestDeleteEntryNotice,
    dialogProps,
    handleConfirm: handleNoticeConfirm,
    handleSecondary: handleNoticeSecondary,
    handleCancel: handleNoticeCancel,
  } = useNoticeDialog({
    confirmReplacementNotice,
    fileOps,
    getBaseName,
    notice: dragNotice,
    onClearUnsavedAction: clearPendingAction,
    onConfirmUnsavedAction: confirmPendingAction,
    onSaveAndConfirmUnsavedAction: saveAndConfirmPendingAction,
    setNotice: setDragNotice,
    unsavedNotice,
  });

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
    onLink: () => handleFormatText('link'),
    onSearch: () => setSearchOpen(true)
  });

  useDocumentLifecycle({
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
    restoreOnceRef: didRestoreRef,
    savedMarkdownRef,
  });

  useAppMenu({
    newDocument: () => requestActionWithUnsavedGuard(async () => handleNewFile()),
    newWindow: () => handleNewWindow(),
    openFile: () => requestActionWithUnsavedGuard(async () => fileOps.handleOpenFile()),
    openFolder: () => requestActionWithUnsavedGuard(handleOpenFolder),
    openRecentFile: (path) => requestActionWithUnsavedGuard(async () => fileOps.openFileInEditor(path)),
    openRecentFolder: (path) => requestActionWithUnsavedGuard(async () => fileOps.loadFolderContents(path)),
    clearRecentHistory: () => clearRecentHistory(),
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
        console.error('Failed to paste plain text:', error);
      }
    },
    bringAllToFront: () => void bringAllToFront(),
    toggleSidebar: () => setSidebarVisible((prev) => !prev),
    togglePreview: () => setPreviewVisible((prev) => !prev),
    toggleThemeMode: () => setPreviewMode((prev) => prev === 'markdown' ? 'pdf' : 'markdown'),
    increaseFont: () => increaseFontSize(),
    decreaseFont: () => decreaseFontSize(),
    toggleTheme: () => toggleTheme(),
    minimizeWindow: () => void appWindow.minimize(),
    maximizeWindow: () => void appWindow.toggleMaximize(),
  }, recentFiles, recentFolders);

  useEffect(() => {
    invoke('setup_native_toolbar').catch(() => {});
    invoke('setup_native_splitview').catch(() => {});
  }, []);

  return (
    <div
      className={`${isDarkMode ? 'dark' : ''} jm-window`}
      style={{
        color: appTextColor,
        backgroundColor: appBgColor,
        '--jm-window-bg': appBgColor,
      }}
    >
      <div className="jm-shell relative">
        <div
          data-tauri-drag-region
          className="pointer-events-auto absolute inset-x-0 top-0 z-30 h-5"
          style={{ backgroundColor: 'transparent' }}
        />
        <main className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <div
          className={`flex-shrink-0 overflow-hidden ${shouldAnimateLayout ? 'transition-[width,opacity,transform] duration-300 ease-out' : ''}`}
          style={{
            width: sidebarVisible ? `${sidebarWidth}px` : '0px',
            opacity: sidebarVisible ? 1 : 0,
            transform: sidebarVisible ? 'translateX(0)' : 'translateX(-12px)',
            pointerEvents: sidebarVisible ? 'auto' : 'none',
          }}
        >
          <SidebarPanel
            currentFilePath={currentFilePath}
            currentFolder={currentFolder}
            dragOperation={dragOperation}
            draggedPath={draggedPath}
            dropTargetPath={dropTargetPath}
            expandedFolders={expandedFolders}
            fileOps={fileOps}
            fileTags={fileTags}
            folderContents={folderContents}
            handleSidebarDragOver={handleSidebarDragOver}
            handleSidebarDrop={handleSidebarDrop}
            handleSidebarKeyDown={handleSidebarKeyDown}
            inlineCreate={inlineCreate}
            inlineCreateInputRef={inlineCreateInputRef}
            inlineCreateName={inlineCreateName}
            invalidDropPath={invalidDropPath}
            onConfirmInlineCreate={confirmInlineCreate}
            onDeleteEntry={requestDeleteEntryNotice}
            onDragEndEntry={clearDragState}
            onDragHoverEntry={handleDragHoverEntry}
            onDragStartEntry={handleDragStartEntry}
            onDropEntry={handleDropEntry}
            onFocusSidebar={(event) => {
              if (event.target !== event.currentTarget) {
                return;
              }

              const fallbackPath = selectedSidebarPath || currentFilePath || folderContents[0]?.path;
              if (fallbackPath) {
                selectSidebarPath(fallbackPath);
              }
            }}
            onInlineChange={setInlineCreateName}
            onInlineCancel={cancelInlineCreate}
            onOpenFile={(path) => fileOps.openFileInEditor(path, { revealInSidebar: false })}
            onRevealInFinder={handleRevealInFinder}
            onRenameEntry={fileOps.renameEntry}
            onSelectEntry={selectSidebarPath}
            onStartInlineCreate={startInlineCreate}
            onToggleFolder={toggleFolder}
            rootDropActive={rootDropActive}
            selectedSidebarPath={selectedSidebarPath}
            setSidebarRef={sidebarRef}
            sidebarWidth={sidebarWidth}
            tocItems={tocItems}
            onSelectToc={handleSelectToc}
            isDarkMode={isDarkMode}
            previewVisible={previewVisible}
            previewMode={previewMode}
            onToggleTheme={toggleTheme}
            onTogglePreview={() => setPreviewVisible((prev) => !prev)}
            onTogglePreviewMode={() => setPreviewMode((prev) => (prev === 'markdown' ? 'pdf' : 'markdown'))}
            chars={chars}
            words={words}
            lines={lines}
            onClipUrl={handleClipUrl}
            isClipping={isClipping}
            onToggleSearch={() => setSearchOpen(true)}
          />
        </div>

        <div
          onMouseDown={sidebarVisible ? () => setIsDraggingSidebar(true) : undefined}
          className={`flex-shrink-0 flex justify-center cursor-col-resize ${shouldAnimateLayout ? 'transition-[width,opacity] duration-300 ease-out' : ''}`}
          style={{
            width: sidebarVisible ? '5px' : '0px',
            opacity: sidebarVisible ? 1 : 0,
            pointerEvents: sidebarVisible ? 'auto' : 'none',
          }}
        >
          <div className="h-full w-px bg-[var(--jm-divider)]" />
        </div>

        <section
          style={{ width: previewVisible ? `${editorWidth}%` : '100%' }}
          className={`flex min-h-0 overflow-hidden ${shouldAnimateLayout ? 'transition-[width] duration-300 ease-out' : ''}`}
        >
          <EditorArea
            ref={editorAreaRef}
            markdown={markdown}
            onMarkdownChange={handleMarkdownChange}
            onImagePasted={handleImagePasted}
            currentFont={currentEditorFont || currentFont}
            currentFontFamily={currentFontFamily}
            appBgColor={appBgColor}
            appTextColor={appTextColor}
            currentFolder={currentFolder}
            currentFilePath={currentFilePath}
            sidebarVisible={sidebarVisible}
            onToggleSidebar={setSidebarVisible}
            previewVisible={previewVisible}
            onTogglePreview={() => setPreviewVisible(!previewVisible)}
            chars={chars}
            words={words}
            lines={lines}
            openFiles={openFiles}
            activeFilePath={activeFilePath}
            onSwitchFile={switchToFile}
            onCloseFile={closeFile}
            onNewFile={handleNewFile}
            layoutPreset={layoutPreset}
          />
        </section>

        <div
          onMouseDown={previewVisible ? handleMouseDown : undefined}
          className={`flex-shrink-0 flex justify-center cursor-col-resize ${shouldAnimateLayout ? 'transition-[width,opacity] duration-300 ease-out' : ''}`}
          style={{
            width: previewVisible ? '5px' : '0px',
            opacity: previewVisible ? 1 : 0,
            pointerEvents: previewVisible ? 'auto' : 'none',
          }}
        >
          <div
            className={`h-full w-px transition-colors duration-200 ${isDragging ? 'bg-[var(--jm-accent)]' : 'bg-[var(--jm-divider)]'}`}
          />
        </div>

        <section
          className={`jm-preview-surface flex min-h-0 flex-col overflow-hidden ${shouldAnimateLayout ? 'transition-[width,opacity,transform] duration-300 ease-out' : ''}`}
          style={{
            width: previewVisible ? `${100 - editorWidth}%` : '0%',
            opacity: previewVisible ? 1 : 0,
            transform: previewVisible ? 'translateX(0)' : 'translateX(12px)',
            color: previewTextColor,
            pointerEvents: previewVisible ? 'auto' : 'none',
          }}
        >
          {previewFilePath ? (
            <div className="flex-1 min-h-0">
              <FilePreview filePath={previewFilePath} />
            </div>
          ) : previewMode === 'markdown' ? (
            layoutPreset === 'code' ? (
              <div className="jm-preview-scroll jm-preview-scroll--code min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                <div className="jm-preview-paper-shell jm-preview-paper-shell--code">
                  <div
                    ref={previewSectionRef}
                    className="jm-preview-code-plane jm-markdown-preview jm-markdown-preview--code min-h-full"
                    style={{
                      backgroundColor: 'transparent',
                      color: previewTextColor,
                      fontSize: previewFontSize,
                      fontFamily: currentFontFamily.family,
                    }}
                  >
                    <MarkdownPreview
                      content={deferredMarkdown}
                      attachmentFolder={attachmentFolder}
                      currentFilePath={currentFilePath}
                      components={markdownPreviewComponents}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="jm-preview-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto px-4 py-5">
                <div className="jm-preview-paper-shell jm-preview-paper-shell--prose">
                  <article
                    ref={previewSectionRef}
                    className="jm-preview-paper jm-markdown-preview jm-preview-paper--prose jm-markdown-preview--prose"
                    style={{
                      backgroundColor: previewBgColor,
                      color: previewTextColor,
                      fontSize: previewFontSize,
                      fontFamily: currentFontFamily.family,
                    }}
                  >
                    <MarkdownPreview
                      content={deferredMarkdown}
                      attachmentFolder={attachmentFolder}
                      currentFilePath={currentFilePath}
                      components={markdownPreviewComponents}
                    />
                  </article>
                </div>
              </div>
            )
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">
              <PDFPreview
                content={deferredMarkdown}
                attachmentFolder={attachmentFolder}
                fontFamily={currentFontFamily.family}
                fontSize={previewFontSize}
                layoutPreset={layoutPreset}
                pageRef={previewSectionRef}
              />
            </div>
          )}
        </section>
      </main>

        {previewVisible && previewMode === 'markdown' && (
          <PreviewColorPicker
            previewBgColor={previewBgColor}
            previewBgColorIndex={previewBgColorIndex}
            showMenu={showPreviewBgColorMenu}
            onToggleMenu={() => setShowPreviewBgColorMenu((prev) => !prev)}
            onColorSelect={(index) => {
              setPreviewBgColorIndex(index);
              setShowPreviewBgColorMenu(false);
            }}
            onReset={() => {
              setPreviewBgColorIndex(null);
              setShowPreviewBgColorMenu(false);
            }}
          />
        )}

      </div>

      <DragNoticeOverlay dragOperation={dragOperation} draggedPath={draggedPath} getBaseName={getBaseName} />

      <GlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        currentFolder={currentFolder}
        folderContents={folderContents}
        onOpenFile={(path) => fileOps.openFileInEditor(path, { revealInSidebar: true })}
        getSubfolderContents={fileOps.getSubfolderContents}
      />

      <ConfirmDialog
        {...dialogProps}
        onConfirm={handleNoticeConfirm}
        onSecondary={handleNoticeSecondary}
        onCancel={handleNoticeCancel}
      />
    </div>
  );
}

export default App;
