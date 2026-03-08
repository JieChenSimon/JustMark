import { useCallback, useEffect, useState } from 'react';

export function useUnsavedChangesGuard({
  appWindow,
  closeBypassRef,
  hasUnsavedChanges,
  onCloseWindow,
  onSaveDocument,
}) {
  const [pendingAction, setPendingAction] = useState(null);
  const [unsavedNotice, setUnsavedNotice] = useState(null);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
    setUnsavedNotice(null);
  }, []);

  const requestActionWithUnsavedGuard = useCallback((action, notice = null) => {
    if (!hasUnsavedChanges) {
      void action();
      return;
    }

    setPendingAction(() => action);
    setUnsavedNotice(
      notice || {
        mode: 'unsaved-document',
        title: 'Save Changes?',
        message: 'This document has unsaved changes. You can save before continuing, or continue without saving.',
      }
    );
  }, [hasUnsavedChanges]);

  const confirmPendingAction = useCallback(async () => {
    const action = pendingAction;
    clearPendingAction();
    if (action) {
      await action();
    }
  }, [clearPendingAction, pendingAction]);

  const saveAndConfirmPendingAction = useCallback(async () => {
    const saved = await onSaveDocument();
    if (!saved) {
      return false;
    }

    const action = pendingAction;
    clearPendingAction();
    if (action) {
      await action();
    }

    return true;
  }, [clearPendingAction, onSaveDocument, pendingAction]);

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
        await onCloseWindow();
      });
      setUnsavedNotice({
        mode: 'unsaved-document',
        title: 'Save Changes Before Closing?',
        message: 'This document has unsaved changes. You can save before closing, or close without saving.',
      });
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [appWindow, closeBypassRef, hasUnsavedChanges, onCloseWindow]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    unsavedNotice,
    requestActionWithUnsavedGuard,
    confirmPendingAction,
    saveAndConfirmPendingAction,
    clearPendingAction,
  };
}
