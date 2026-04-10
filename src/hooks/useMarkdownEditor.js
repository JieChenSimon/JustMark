import { useCallback } from 'react';

export const useMarkdownEditor = ({ markdown, setMarkdown, markdownRef, textareaRef }) => {
  const handleMarkdownChange = useCallback((e) => {
    const newValue = e.target.value;
    setMarkdown(newValue);
    markdownRef.current = newValue;
  }, [setMarkdown, markdownRef]);

  const handleFormatText = useCallback((format) => {
    const textarea = textareaRef?.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let newText;
    let newCursorPos = start;

    const currentValue = textarea.value;
    switch (format) {
      case 'bold':
        newText = currentValue.substring(0, start) + `**${selectedText}**` + currentValue.substring(end);
        newCursorPos = start + 2;
        break;
      case 'italic':
        newText = currentValue.substring(0, start) + `*${selectedText}*` + currentValue.substring(end);
        newCursorPos = start + 1;
        break;
      case 'strikethrough':
        newText = currentValue.substring(0, start) + `~~${selectedText}~~` + currentValue.substring(end);
        newCursorPos = start + 2;
        break;
      case 'code':
        newText = currentValue.substring(0, start) + `\`${selectedText}\`` + currentValue.substring(end);
        newCursorPos = start + 1;
        break;
      case 'link':
        newText = currentValue.substring(0, start) + `[${selectedText}](url)` + currentValue.substring(end);
        newCursorPos = start + selectedText.length + 3;
        break;
      case 'h1':
        newText = currentValue.substring(0, start) + `# ${selectedText}` + currentValue.substring(end);
        newCursorPos = start + 2;
        break;
      case 'h2':
        newText = currentValue.substring(0, start) + `## ${selectedText}` + currentValue.substring(end);
        newCursorPos = start + 3;
        break;
      case 'h3':
        newText = currentValue.substring(0, start) + `### ${selectedText}` + currentValue.substring(end);
        newCursorPos = start + 4;
        break;
      case 'quote':
        newText = currentValue.substring(0, start) + `> ${selectedText}` + currentValue.substring(end);
        newCursorPos = start + 2;
        break;
      case 'ul':
        newText = currentValue.substring(0, start) + `- ${selectedText}` + currentValue.substring(end);
        newCursorPos = start + 2;
        break;
      case 'ol':
        newText = currentValue.substring(0, start) + `1. ${selectedText}` + currentValue.substring(end);
        newCursorPos = start + 3;
        break;
      case 'task':
        newText = currentValue.substring(0, start) + `- [ ] ${selectedText}` + currentValue.substring(end);
        newCursorPos = start + 6;
        break;
      default:
        return;
    }

    setMarkdown(newText);
    markdownRef.current = newText;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [setMarkdown, markdownRef]);

  const handleImagePasted = useCallback((imageMarkdown, textareaElement) => {
    if (!textareaElement) return;
    const start = textareaElement.selectionStart;
    const end = textareaElement.selectionEnd;
    const currentText = markdownRef.current;
    const newText = currentText.substring(0, start) + imageMarkdown + currentText.substring(end);
    setMarkdown(newText);
    markdownRef.current = newText;
    setTimeout(() => {
      const newPos = start + imageMarkdown.length;
      textareaElement.setSelectionRange(newPos, newPos);
      textareaElement.focus();
    }, 0);
  }, [setMarkdown, markdownRef]);

  return {
    handleMarkdownChange,
    handleFormatText,
    handleImagePasted
  };
};
