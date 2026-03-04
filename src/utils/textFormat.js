// Text formatting helpers for markdown
export const formatText = {
  bold: (text, selection) => {
    const { start, end } = selection;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    if (selectedText) {
      return {
        text: `${before}**${selectedText}**${after}`,
        cursorPos: end + 4
      };
    }
    return {
      text: `${before}****${after}`,
      cursorPos: start + 2
    };
  },

  italic: (text, selection) => {
    const { start, end } = selection;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    if (selectedText) {
      return {
        text: `${before}*${selectedText}*${after}`,
        cursorPos: end + 2
      };
    }
    return {
      text: `${before}**${after}`,
      cursorPos: start + 1
    };
  },

  strikethrough: (text, selection) => {
    const { start, end } = selection;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    if (selectedText) {
      return {
        text: `${before}~~${selectedText}~~${after}`,
        cursorPos: end + 4
      };
    }
    return {
      text: `${before}~~~~${after}`,
      cursorPos: start + 2
    };
  },

  link: (text, selection) => {
    const { start, end } = selection;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    if (selectedText) {
      return {
        text: `${before}[${selectedText}](url)${after}`,
        cursorPos: end + 3
      };
    }
    return {
      text: `${before}[text](url)${after}`,
      cursorPos: start + 1
    };
  }
};
