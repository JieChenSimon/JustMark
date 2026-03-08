import { useState, useEffect } from 'react';
import { loadSavedState, saveState, subscribeToStoredState } from '../utils/storage';

/**
 * 设置管理 Hook
 * 管理 Obsidian 兼容的 attachment 文件夹等配置
 */
export function useSettings() {
    const [attachmentFolder, setAttachmentFolder] = useState(() => loadSavedState('attachmentFolder', '00- Attachment'));
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => loadSavedState('autoSaveEnabled', true));
    const [fileSortBy, setFileSortBy] = useState(() => loadSavedState('fileSortBy', 'name'));

    useEffect(() => { saveState('attachmentFolder', attachmentFolder); }, [attachmentFolder]);
    useEffect(() => { saveState('autoSaveEnabled', autoSaveEnabled); }, [autoSaveEnabled]);
    useEffect(() => { saveState('fileSortBy', fileSortBy); }, [fileSortBy]);
    useEffect(() => subscribeToStoredState('attachmentFolder', setAttachmentFolder), []);
    useEffect(() => subscribeToStoredState('autoSaveEnabled', setAutoSaveEnabled), []);
    useEffect(() => subscribeToStoredState('fileSortBy', setFileSortBy), []);

    return {
        attachmentFolder, setAttachmentFolder,
        autoSaveEnabled, setAutoSaveEnabled,
        fileSortBy, setFileSortBy,
    };
}
