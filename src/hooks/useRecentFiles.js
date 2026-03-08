import { useState, useEffect } from 'react';
import { loadSavedState, saveState, subscribeToStoredState } from '../utils/storage';

const MAX_RECENT_FILES = 10;
const updatePathPrefix = (path, fromPath, toPath) => {
    if (path === fromPath) return toPath;
    if (path.startsWith(`${fromPath}/`)) {
        return `${toPath}${path.slice(fromPath.length)}`;
    }
    return path;
};
const isPathWithinPrefix = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`);

export function useRecentFiles() {
    const [recentFiles, setRecentFiles] = useState(() => loadSavedState('recentFiles', []));

    useEffect(() => {
        saveState('recentFiles', recentFiles);
    }, [recentFiles]);

    useEffect(() => subscribeToStoredState('recentFiles', setRecentFiles), []);

    const addRecentFile = (filePath) => {
        if (!filePath) return;
        setRecentFiles(prev => {
            const filtered = prev.filter(f => f !== filePath);
            return [filePath, ...filtered].slice(0, MAX_RECENT_FILES);
        });
    };

    const clearRecentFiles = () => setRecentFiles([]);

    const replaceRecentFilePath = (fromPath, toPath) => {
        setRecentFiles(prev => {
            const next = prev.map(path => updatePathPrefix(path, fromPath, toPath));
            return [...new Set(next)].slice(0, MAX_RECENT_FILES);
        });
    };

    const removeRecentFilePrefix = (prefix) => {
        setRecentFiles(prev => prev.filter(path => !isPathWithinPrefix(path, prefix)));
    };

    return { recentFiles, addRecentFile, clearRecentFiles, replaceRecentFilePath, removeRecentFilePrefix };
}
