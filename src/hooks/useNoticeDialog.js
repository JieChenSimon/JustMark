import { useCallback, useMemo } from 'react';

export function useNoticeDialog({
  confirmReplacementNotice,
  fileOps,
  getBaseName,
  notice,
  onClearUnsavedAction,
  onConfirmUnsavedAction,
  onSaveAndConfirmUnsavedAction,
  setNotice,
  unsavedNotice,
}) {
  const requestDeleteEntryNotice = useCallback((targetPath) => {
    setNotice({
      mode: 'delete-entry',
      title: 'Move to Trash?',
      message: `“${getBaseName(targetPath)}” will be removed from this workspace immediately. This action cannot be undone.`,
      targetPath,
    });
  }, [getBaseName]);

  const activeNotice = notice || unsavedNotice;

  const handleConfirm = useCallback(async () => {
    if (!activeNotice) {
      return;
    }

    if (activeNotice.mode === 'unsaved-document') {
      await onConfirmUnsavedAction();
      return;
    }

    if (activeNotice.mode === 'delete-entry') {
      try {
        await fileOps.deleteEntry(activeNotice.targetPath);
        setNotice(null);
      } catch (error) {
        setNotice({
          mode: 'info',
          title: 'Delete Failed',
          message: error?.message || 'The selected item could not be deleted.',
        });
      }
      return;
    }

    if (!activeNotice.mode.startsWith('replace')) {
      setNotice(null);
      return;
    }

    await confirmReplacementNotice(activeNotice);
  }, [activeNotice, confirmReplacementNotice, fileOps, onConfirmUnsavedAction]);

  const handleSecondary = useCallback(async () => {
    if (activeNotice?.mode === 'unsaved-document') {
      await onSaveAndConfirmUnsavedAction();
    }
  }, [activeNotice?.mode, onSaveAndConfirmUnsavedAction]);

  const handleCancel = useCallback(() => {
    if (activeNotice?.mode === 'unsaved-document') {
      onClearUnsavedAction();
      return;
    }

    setNotice(null);
  }, [activeNotice?.mode, onClearUnsavedAction]);

  const dialogProps = useMemo(() => ({
    isOpen: Boolean(activeNotice),
    title: activeNotice?.title || '',
    message: activeNotice?.message || '',
    confirmText:
      activeNotice?.mode === 'unsaved-document'
        ? "Don't Save"
        : activeNotice?.mode?.startsWith('replace')
          ? 'Replace'
          : activeNotice?.mode === 'delete-entry'
            ? 'Delete'
            : 'OK',
    cancelText: 'Cancel',
    hideCancel: !(activeNotice?.mode?.startsWith('replace') || activeNotice?.mode === 'unsaved-document' || activeNotice?.mode === 'delete-entry'),
    secondaryText: activeNotice?.mode === 'unsaved-document' ? 'Save' : null,
    isDangerous: activeNotice?.mode?.startsWith('replace') || activeNotice?.mode === 'delete-entry',
    position: null,
  }), [activeNotice]);

  return {
    requestDeleteEntryNotice,
    dialogProps,
    handleConfirm,
    handleSecondary,
    handleCancel,
  };
}
