import { useState, useEffect } from 'react';

const loadSavedState = (key, defaultValue) => {
    try {
        const saved = localStorage.getItem(key);
        if (saved !== null) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return defaultValue;
};

const saveState = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
};

/**
 * 设置管理 Hook
 * 管理 Obsidian 兼容的 attachment 文件夹等配置
 */
export function useSettings() {
    const [attachmentFolder, setAttachmentFolder] = useState(() => loadSavedState('attachmentFolder', '00- Attachment'));
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => loadSavedState('autoSaveEnabled', true));
    const [fileSortBy, setFileSortBy] = useState(() => loadSavedState('fileSortBy', 'name'));

    useEffect(() => { saveState('attachmentFolder', attachmentFolder); }, [attachmentFolder]);
    useEffect(() => { saveState('autoSaveEnabled', autoSaveEnabled); }, [autoSaveEnabled]);
    useEffect(() => { saveState('fileSortBy', fileSortBy); }, [fileSortBy]);

    return {
        attachmentFolder, setAttachmentFolder,
        showSettingsDialog, setShowSettingsDialog,
        autoSaveEnabled, setAutoSaveEnabled,
        fileSortBy, setFileSortBy,
    };
}
