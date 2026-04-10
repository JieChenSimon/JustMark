import { useState, useEffect } from 'react';
import { loadSavedState, saveState, subscribeToStoredState } from '../utils/storage';

const MAX_RECENT_FILES = 10;
const MAX_RECENT_FOLDERS = 8;
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
    const [recentFolders, setRecentFolders] = useState(() => loadSavedState('recentFolders', []));

    useEffect(() => {
        saveState('recentFiles', recentFiles);
    }, [recentFiles]);

    useEffect(() => {
        saveState('recentFolders', recentFolders);
    }, [recentFolders]);

    useEffect(() => subscribeToStoredState('recentFiles', setRecentFiles), []);
    useEffect(() => subscribeToStoredState('recentFolders', setRecentFolders), []);

    const addRecentFile = (filePath) => {
        if (!filePath) return;
        setRecentFiles(prev => {
            const filtered = prev.filter(f => f !== filePath);
            return [filePath, ...filtered].slice(0, MAX_RECENT_FILES);
        });
    };

    const addRecentFolder = (folderPath) => {
        if (!folderPath) return;
        setRecentFolders(prev => {
            const filtered = prev.filter(path => path !== folderPath);
            return [folderPath, ...filtered].slice(0, MAX_RECENT_FOLDERS);
        });
    };

    const clearRecentFiles = () => setRecentFiles([]);
    const clearRecentFolders = () => setRecentFolders([]);
    const clearRecentHistory = () => {
        setRecentFiles([]);
        setRecentFolders([]);
    };

    const replaceRecentFilePath = (fromPath, toPath) => {
        setRecentFiles(prev => {
            const next = prev.map(path => updatePathPrefix(path, fromPath, toPath));
            return [...new Set(next)].slice(0, MAX_RECENT_FILES);
        });

        setRecentFolders(prev => {
            const next = prev.map(path => updatePathPrefix(path, fromPath, toPath));
            return [...new Set(next)].slice(0, MAX_RECENT_FOLDERS);
        });
    };

    const removeRecentFilePrefix = (prefix) => {
        setRecentFiles(prev => prev.filter(path => !isPathWithinPrefix(path, prefix)));
        setRecentFolders(prev => prev.filter(path => !isPathWithinPrefix(path, prefix)));
    };

    return {
        recentFiles,
        recentFolders,
        addRecentFile,
        addRecentFolder,
        clearRecentFiles,
        clearRecentFolders,
        clearRecentHistory,
        replaceRecentFilePath,
        removeRecentFilePrefix
    };
}
