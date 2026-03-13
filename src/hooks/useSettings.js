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
    const [showHiddenFiles, setShowHiddenFiles] = useState(() => loadSavedState('showHiddenFiles', false));
    const [hiddenFilesWhitelist, setHiddenFilesWhitelist] = useState(() => loadSavedState('hiddenFilesWhitelist', []));

    useEffect(() => { saveState('attachmentFolder', attachmentFolder); }, [attachmentFolder]);
    useEffect(() => { saveState('autoSaveEnabled', autoSaveEnabled); }, [autoSaveEnabled]);
    useEffect(() => { saveState('fileSortBy', fileSortBy); }, [fileSortBy]);
    useEffect(() => { saveState('showHiddenFiles', showHiddenFiles); }, [showHiddenFiles]);
    useEffect(() => { saveState('hiddenFilesWhitelist', hiddenFilesWhitelist); }, [hiddenFilesWhitelist]);
    useEffect(() => subscribeToStoredState('attachmentFolder', setAttachmentFolder), []);
    useEffect(() => subscribeToStoredState('autoSaveEnabled', setAutoSaveEnabled), []);
    useEffect(() => subscribeToStoredState('fileSortBy', setFileSortBy), []);
    useEffect(() => subscribeToStoredState('showHiddenFiles', setShowHiddenFiles), []);
    useEffect(() => subscribeToStoredState('hiddenFilesWhitelist', setHiddenFilesWhitelist), []);

    return {
        attachmentFolder, setAttachmentFolder,
        autoSaveEnabled, setAutoSaveEnabled,
        fileSortBy, setFileSortBy,
        showHiddenFiles, setShowHiddenFiles,
        hiddenFilesWhitelist, setHiddenFilesWhitelist,
    };
}
