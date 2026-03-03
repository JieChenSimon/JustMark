import { useEffect, useRef } from 'react';

export function useAutoSave(markdown, currentFilePath, hasUnsavedChanges, autoSaveEnabled, handleSave) {
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (!autoSaveEnabled || !currentFilePath || !hasUnsavedChanges) return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        timeoutRef.current = setTimeout(() => {
            handleSave();
        }, 3000);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [markdown, currentFilePath, hasUnsavedChanges, autoSaveEnabled, handleSave]);
}
