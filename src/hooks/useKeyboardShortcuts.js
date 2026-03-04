import { useEffect } from 'react';

export const useKeyboardShortcuts = (handlers) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      const key = e.key.toLowerCase();
      const withShift = e.shiftKey;

      // Cmd+N - New File
      if (key === 'n' && !withShift && handlers.onNew) {
        e.preventDefault();
        handlers.onNew();
      }
      // Cmd+O - Open File
      else if (key === 'o' && !withShift && handlers.onOpen) {
        e.preventDefault();
        handlers.onOpen();
      }
      // Cmd+S - Save
      else if (key === 's' && !withShift && handlers.onSave) {
        e.preventDefault();
        handlers.onSave();
      }
      // Cmd+Shift+S - Save As
      else if (key === 's' && withShift && handlers.onSaveAs) {
        e.preventDefault();
        handlers.onSaveAs();
      }
      // Cmd+W - Close File
      else if (key === 'w' && !withShift && handlers.onClose) {
        e.preventDefault();
        handlers.onClose();
      }
      // Cmd+B - Bold
      else if (key === 'b' && !withShift && handlers.onBold) {
        e.preventDefault();
        handlers.onBold();
      }
      // Cmd+I - Italic
      else if (key === 'i' && !withShift && handlers.onItalic) {
        e.preventDefault();
        handlers.onItalic();
      }
      // Cmd+U - Underline (strikethrough in markdown)
      else if (key === 'u' && !withShift && handlers.onStrikethrough) {
        e.preventDefault();
        handlers.onStrikethrough();
      }
      // Cmd+K - Insert Link
      else if (key === 'k' && !withShift && handlers.onLink) {
        e.preventDefault();
        handlers.onLink();
      }
      // Cmd+Shift+V - Paste Plain Text
      else if (key === 'v' && withShift && handlers.onPastePlain) {
        e.preventDefault();
        handlers.onPastePlain();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};
