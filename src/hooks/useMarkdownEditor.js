import { useCallback } from 'react';

export const useMarkdownEditor = ({ markdown, setMarkdown, markdownRef }) => {
  const handleMarkdownChange = useCallback((e) => {
    const newValue = e.target.value;
    setMarkdown(newValue);
    markdownRef.current = newValue;
  }, [setMarkdown, markdownRef]);

  const handleFormatText = useCallback((format) => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);
    let newText;
    let newCursorPos = start;

    switch (format) {
      case 'bold':
        newText = markdown.substring(0, start) + `**${selectedText}**` + markdown.substring(end);
        newCursorPos = start + 2;
        break;
      case 'italic':
        newText = markdown.substring(0, start) + `*${selectedText}*` + markdown.substring(end);
        newCursorPos = start + 1;
        break;
      case 'strikethrough':
        newText = markdown.substring(0, start) + `~~${selectedText}~~` + markdown.substring(end);
        newCursorPos = start + 2;
        break;
      case 'code':
        newText = markdown.substring(0, start) + `\`${selectedText}\`` + markdown.substring(end);
        newCursorPos = start + 1;
        break;
      case 'link':
        newText = markdown.substring(0, start) + `[${selectedText}](url)` + markdown.substring(end);
        newCursorPos = start + selectedText.length + 3;
        break;
      case 'h1':
        newText = markdown.substring(0, start) + `# ${selectedText}` + markdown.substring(end);
        newCursorPos = start + 2;
        break;
      case 'h2':
        newText = markdown.substring(0, start) + `## ${selectedText}` + markdown.substring(end);
        newCursorPos = start + 3;
        break;
      case 'h3':
        newText = markdown.substring(0, start) + `### ${selectedText}` + markdown.substring(end);
        newCursorPos = start + 4;
        break;
      case 'quote':
        newText = markdown.substring(0, start) + `> ${selectedText}` + markdown.substring(end);
        newCursorPos = start + 2;
        break;
      case 'ul':
        newText = markdown.substring(0, start) + `- ${selectedText}` + markdown.substring(end);
        newCursorPos = start + 2;
        break;
      case 'ol':
        newText = markdown.substring(0, start) + `1. ${selectedText}` + markdown.substring(end);
        newCursorPos = start + 3;
        break;
      case 'task':
        newText = markdown.substring(0, start) + `- [ ] ${selectedText}` + markdown.substring(end);
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
  }, [markdown, setMarkdown, markdownRef]);

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
