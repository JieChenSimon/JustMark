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
 * 窗口面板管理 Hook
 * 管理侧边栏和编辑器/预览区的拖拽调整宽度
 */
export function useWindowManager() {
    const [sidebarWidth, setSidebarWidth] = useState(() => loadSavedState('sidebarWidth', 224));
    const [editorWidth, setEditorWidth] = useState(() => loadSavedState('editorWidth', 50));
    const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
    const [isDraggingEditor, setIsDraggingEditor] = useState(false);

    // 持久化
    useEffect(() => { saveState('sidebarWidth', sidebarWidth); }, [sidebarWidth]);
    useEffect(() => { saveState('editorWidth', editorWidth); }, [editorWidth]);

    // 侧边栏拖动
    useEffect(() => {
        if (!isDraggingSidebar) return;

        document.body.classList.add('dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        let animationFrameId = null;

        const handleMouseMove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                const newWidth = e.clientX;
                if (newWidth >= 150 && newWidth <= 400) {
                    setSidebarWidth(newWidth);
                }
            });
        };

        const handleMouseUp = () => {
            setIsDraggingSidebar(false);
            document.body.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };

        document.addEventListener('mousemove', handleMouseMove, { passive: false });
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isDraggingSidebar]);

    // 编辑器/预览区拖动
    useEffect(() => {
        if (!isDraggingEditor) return;

        document.body.classList.add('dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        let animationFrameId = null;

        const handleMouseMove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                const container = document.querySelector('main');
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
                if (newPercent >= 20 && newPercent <= 80) {
                    setEditorWidth(newPercent);
                }
            });
        };

        const handleMouseUp = () => {
            setIsDraggingEditor(false);
            document.body.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };

        document.addEventListener('mousemove', handleMouseMove, { passive: false });
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isDraggingEditor]);

    return {
        sidebarWidth, setSidebarWidth,
        editorWidth, setEditorWidth,
        isDraggingSidebar, setIsDraggingSidebar,
        isDraggingEditor, setIsDraggingEditor,
    };
}
