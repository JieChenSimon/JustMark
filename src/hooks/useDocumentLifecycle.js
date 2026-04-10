import { useCallback, useEffect, useRef } from 'react';

const AUTO_SAVE_DELAY_MS = 2000;

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
}) {
  const debounceTimerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const flushAutoSaveRef = useRef(null);

  const isEditableTextPath = useCallback((path) => !path || /\.(md|markdown|txt)$/i.test(path), []);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const flushAutoSave = useCallback(async (reason = 'manual') => {
    clearDebounceTimer();

    if (!autoSaveEnabled || !hasUnsavedChanges || !currentFilePath || !isEditableTextPath(currentFilePath)) {
      return false;
    }

    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      return false;
    }

    saveInFlightRef.current = true;

    try {
      await fileOps.handleSave();
      if (savedMarkdownRef) {
        savedMarkdownRef.current = markdown;
      }
      return true;
    } catch (error) {
      console.error(`[useDocumentLifecycle] Auto-save failed (${reason}):`, error);
      return false;
    } finally {
      saveInFlightRef.current = false;

      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        const nextFlush = flushAutoSaveRef.current;
        if (nextFlush) {
          void nextFlush('queued');
        }
      }
    }
  }, [
    autoSaveEnabled,
    clearDebounceTimer,
    currentFilePath,
    fileOps,
    hasUnsavedChanges,
    isEditableTextPath,
    markdown,
    savedMarkdownRef,
  ]);

  useEffect(() => {
    flushAutoSaveRef.current = flushAutoSave;
  }, [flushAutoSave]);

  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges || !currentFilePath || !isEditableTextPath(currentFilePath)) {
      clearDebounceTimer();
      return undefined;
    }

    debounceTimerRef.current = setTimeout(() => {
      void flushAutoSave('debounce');
    }, AUTO_SAVE_DELAY_MS);

    return clearDebounceTimer;
  }, [
    autoSaveEnabled,
    clearDebounceTimer,
    currentFilePath,
    flushAutoSave,
    hasUnsavedChanges,
    isEditableTextPath,
    markdown,
  ]);

  useEffect(() => {
    if (!autoSaveEnabled || typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        void flushAutoSave('visibilitychange');
      }
    };

    const handlePageHide = () => {
      void flushAutoSave('pagehide');
    };

    const handleBeforeUnload = () => {
      void flushAutoSave('beforeunload');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [autoSaveEnabled, flushAutoSave]);

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
