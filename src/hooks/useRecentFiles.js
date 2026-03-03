import { useState, useEffect } from 'react';

const MAX_RECENT_FILES = 10;

export function useRecentFiles() {
    const [recentFiles, setRecentFiles] = useState(() => {
        try {
            const saved = localStorage.getItem('recentFiles');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
    }, [recentFiles]);

    const addRecentFile = (filePath) => {
        if (!filePath) return;
        setRecentFiles(prev => {
            const filtered = prev.filter(f => f !== filePath);
            return [filePath, ...filtered].slice(0, MAX_RECENT_FILES);
        });
    };

    const clearRecentFiles = () => setRecentFiles([]);

    return { recentFiles, addRecentFile, clearRecentFiles };
}
