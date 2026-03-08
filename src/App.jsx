import { useState, useRef, useDeferredValue, useCallback } from 'react';
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
import { useAppMenu } from './hooks/useAppMenu';
import { useSidebarDragAndDrop } from './hooks/useSidebarDragAndDrop';
import { useSidebarSelection } from './hooks/useSidebarSelection';
import { useDocumentLifecycle } from './hooks/useDocumentLifecycle';
import { useInlineCreate } from './hooks/useInlineCreate';
import { useNoticeDialog } from './hooks/useNoticeDialog';
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';
import AppToolbar from './components/Header/AppToolbar';
import EditorArea from './components/EditorArea';
import StatusBar from './components/StatusBar';
import MarkdownPreview from './components/preview/MarkdownPreview';
import { useExportManager } from './components/Export/ExportManager';
import DragNoticeOverlay from './components/sidebar/DragNoticeOverlay';
import SidebarPanel from './components/sidebar/SidebarPanel';
import ConfirmDialog from './components/ConfirmDialog';
import { parseTags, sortEntries, getTagColor } from './utils/fileHelpers';
import { bringAllToFront, openDocumentWindow, openPreferencesWindow } from './utils/windows';

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
  const [previewVisible, setPreviewVisible] = useLocalStorage('previewVisible', true);
  const [sidebarVisible, setSidebarVisible] = useLocalStorage('sidebarVisible', false);
  const [dragNotice, setDragNotice] = useState(null);

  const inlineCreateInputRef = useRef(null);
  const previewSectionRef = useRef(null);
  const editorAreaRef = useRef(null);
  const sidebarRef = useRef(null);
  const closeBypassRef = useRef(false);
  const deferredMarkdown = useDeferredValue(markdown);
  const appWindow = getCurrentWindow();

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

  const handleNewWindow = useCallback(() => {
    openDocumentWindow();
  }, []);

  const {
    selectedSidebarPath,
    selectSidebarPath,
    activateSidebarEntry,
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
    onLink: () => handleFormatText('link')
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
    setHasUnsavedChanges,
  });

  useAppMenu({
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
        console.error('Failed to paste plain text:', error);
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
  }, recentFiles);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} jm-window`} style={{ color: appTextColor }}>
      <div className="jm-shell">
        <AppToolbar
          currentFilePath={currentFilePath}
          currentFolder={currentFolder}
          hasUnsavedChanges={hasUnsavedChanges}
          previewVisible={previewVisible}
          sidebarVisible={sidebarVisible}
          isExporting={isExporting}
          onNew={() => requestActionWithUnsavedGuard(async () => handleNewFile())}
          onOpen={() => requestActionWithUnsavedGuard(async () => fileOps.handleOpenFile())}
          onSave={fileOps.handleSave}
          onExportPDF={handleExportPDF}
          onExportDOCX={handleExportDOCX}
          onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
          onTogglePreview={() => setPreviewVisible(!previewVisible)}
          onDecreaseFontSize={decreaseFontSize}
          onIncreaseFontSize={increaseFontSize}
          onCloseWindow={handleCloseWindow}
          onMinimizeWindow={handleMinimizeWindow}
          onToggleMaximizeWindow={handleToggleMaximizeWindow}
        />

        <main className="flex-1 flex overflow-hidden p-3 gap-3">
        {sidebarVisible && (
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
          />
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

        <StatusBar currentFilePath={currentFilePath} chars={chars} words={words} lines={lines} />
      </div>

      <DragNoticeOverlay dragOperation={dragOperation} draggedPath={draggedPath} getBaseName={getBaseName} />

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
