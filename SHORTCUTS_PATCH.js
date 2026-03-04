// Enhanced keyboard shortcuts for JustMark
// Add these functions to App.jsx

// Text formatting handler
const handleFormatText = useCallback((format) => {
  const textarea = editorAreaRef.current?.getTextareaElement();
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = markdown.substring(start, end);
  const before = markdown.substring(0, start);
  const after = markdown.substring(end);

  let newText, newCursorPos;

  switch (format) {
    case 'bold':
      if (selectedText) {
        newText = `${before}**${selectedText}**${after}`;
        newCursorPos = end + 4;
      } else {
        newText = `${before}****${after}`;
        newCursorPos = start + 2;
      }
      break;
    case 'italic':
      if (selectedText) {
        newText = `${before}*${selectedText}*${after}`;
        newCursorPos = end + 2;
      } else {
        newText = `${before}**${after}`;
        newCursorPos = start + 1;
      }
      break;
    case 'strikethrough':
      if (selectedText) {
        newText = `${before}~~${selectedText}~~${after}`;
        newCursorPos = end + 4;
      } else {
        newText = `${before}~~~~${after}`;
        newCursorPos = start + 2;
      }
      break;
    case 'link':
      if (selectedText) {
        newText = `${before}[${selectedText}](url)${after}`;
        newCursorPos = end + 3;
      } else {
        newText = `${before}[text](url)${after}`;
        newCursorPos = start + 1;
      }
      break;
    default:
      return;
  }

  setMarkdown(newText);
  setHasUnsavedChanges(true);
  
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
}, [markdown, editorAreaRef]);

// Close current file
const handleCloseFile = useCallback(() => {
  if (hasUnsavedChanges) {
    const confirmed = confirm('当前文档有未保存的更改，确定要关闭吗？');
    if (!confirmed) return;
  }
  setMarkdown('');
  setCurrentFilePath(null);
  setHasUnsavedChanges(false);
}, [hasUnsavedChanges]);

// REPLACE the existing keyboard shortcut useEffect (around line 520-550) with this:
/*
useEffect(() => {
  const handleKeyDown = (e) => {
    if (inlineCreate) return;

    const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    if (cmdOrCtrl) {
      const key = e.key.toLowerCase();
      const withShift = e.shiftKey;

      if (key === 'n' && !withShift) {
        e.preventDefault();
        handleNew({ fromHotkey: true });
      } else if (key === 'o' && !withShift) {
        e.preventDefault();
        handleOpen();
      } else if (key === 's' && !withShift) {
        e.preventDefault();
        handleSave();
      } else if (key === 's' && withShift) {
        e.preventDefault();
        handleSaveAs();
      } else if (key === 'w' && !withShift) {
        e.preventDefault();
        handleCloseFile();
      } else if (key === 'b' && !withShift) {
        e.preventDefault();
        handleFormatText('bold');
      } else if (key === 'i' && !withShift) {
        e.preventDefault();
        handleFormatText('italic');
      } else if (key === 'u' && !withShift) {
        e.preventDefault();
        handleFormatText('strikethrough');
      } else if (key === 'k' && !withShift) {
        e.preventDefault();
        handleFormatText('link');
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [hasUnsavedChanges, currentFilePath, markdown, inlineCreate, handleFormatText, handleCloseFile]);
*/
