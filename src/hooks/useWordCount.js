import { useMemo } from 'react';

export function useWordCount(text) {
  return useMemo(() => {
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    
    return { chars, charsNoSpaces, words, lines };
  }, [text]);
}
