import { useEffect } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';

export const useFileDrop = (onFileOpen) => {
  useEffect(() => {
    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      
      // Only accept markdown files
      if (!file.name.endsWith('.md')) {
        alert('Only .md files are supported');
        return;
      }

      try {
        const content = await readTextFile(file.path);
        onFileOpen(file.path, content);
      } catch (error) {
        console.error('Failed to read dropped file:', error);
        alert('Failed to open file');
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);

    return () => {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [onFileOpen]);
};
