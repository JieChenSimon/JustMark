import { useState, useEffect, useCallback } from 'react';
import { FONT_OPTIONS, FONT_FAMILIES, BACKGROUND_COLORS } from '../constants/theme';
import { loadSavedState, saveState, subscribeToStoredState } from '../utils/storage';

/**
 * 主题管理 Hook
 * 管理暗黑模式、字体、字号、背景色等视觉相关状态
 */
export function useTheme() {
    const [isDarkMode, setIsDarkMode] = useState(() => loadSavedState('isDarkMode', false));
    const [editorFontIndex, setEditorFontIndex] = useState(() => loadSavedState('editorFontIndex', loadSavedState('fontIndex', 1)));
    const [previewFontIndex, setPreviewFontIndex] = useState(() => loadSavedState('previewFontIndex', Math.max(0, loadSavedState('fontIndex', 1) - 1)));
    const [fontFamilyIndex, setFontFamilyIndex] = useState(() => loadSavedState('fontFamilyIndex', 1));
    const [bgColorIndex, setBgColorIndex] = useState(() => loadSavedState('bgColorIndex', 0));
    const [previewBgColorIndex, setPreviewBgColorIndex] = useState(() => loadSavedState('previewBgColorIndex', null));

    // UI 菜单状态
    const [showFontMenu, setShowFontMenu] = useState(false);
    const [showBgColorMenu, setShowBgColorMenu] = useState(false);
    const [showPreviewBgColorMenu, setShowPreviewBgColorMenu] = useState(false);
    const [showBgColorWarning, setShowBgColorWarning] = useState(false);

    // 持久化
    useEffect(() => { saveState('isDarkMode', isDarkMode); }, [isDarkMode]);
    useEffect(() => { saveState('editorFontIndex', editorFontIndex); }, [editorFontIndex]);
    useEffect(() => { saveState('previewFontIndex', previewFontIndex); }, [previewFontIndex]);
    useEffect(() => { saveState('fontFamilyIndex', fontFamilyIndex); }, [fontFamilyIndex]);
    useEffect(() => { saveState('bgColorIndex', bgColorIndex); }, [bgColorIndex]);
    useEffect(() => { saveState('previewBgColorIndex', previewBgColorIndex); }, [previewBgColorIndex]);
    useEffect(() => subscribeToStoredState('isDarkMode', setIsDarkMode), []);
    useEffect(() => subscribeToStoredState('editorFontIndex', setEditorFontIndex), []);
    useEffect(() => subscribeToStoredState('previewFontIndex', setPreviewFontIndex), []);
    useEffect(() => subscribeToStoredState('fontFamilyIndex', setFontFamilyIndex), []);
    useEffect(() => subscribeToStoredState('bgColorIndex', setBgColorIndex), []);
    useEffect(() => subscribeToStoredState('previewBgColorIndex', setPreviewBgColorIndex), []);

    // 派生值
    const currentEditorFont = FONT_OPTIONS[editorFontIndex];
    const currentPreviewFont = FONT_OPTIONS[previewFontIndex];
    const currentFontFamily = FONT_FAMILIES[fontFamilyIndex];
    const currentBgColor = BACKGROUND_COLORS[bgColorIndex];

    const appBgColor = isDarkMode ? '#1A1A1A' : currentBgColor.bg;
    const appTextColor = isDarkMode ? '#E5E7EB' : currentBgColor.text;

    const previewColor = previewBgColorIndex !== null ? BACKGROUND_COLORS[previewBgColorIndex] : null;
    const previewBgColor = previewColor ? previewColor.bg : appBgColor;
    const previewTextColor = previewColor ? previewColor.text : appTextColor;

    const toggleTheme = useCallback(() => {
        requestAnimationFrame(() => {
            setIsDarkMode(prev => !prev);
        });
    }, []);

    const increaseFontSize = useCallback(() => {
        setEditorFontIndex(prev => Math.min(prev + 1, FONT_OPTIONS.length - 1));
    }, []);

    const decreaseFontSize = useCallback(() => {
        setEditorFontIndex(prev => Math.max(prev - 1, 0));
    }, []);

    return {
        // 状态
        isDarkMode, setIsDarkMode,
        fontIndex: editorFontIndex, setFontIndex: setEditorFontIndex,
        editorFontIndex, setEditorFontIndex,
        previewFontIndex, setPreviewFontIndex,
        fontFamilyIndex, setFontFamilyIndex,
        bgColorIndex, setBgColorIndex,
        previewBgColorIndex, setPreviewBgColorIndex,

        // UI 菜单
        showFontMenu, setShowFontMenu,
        showBgColorMenu, setShowBgColorMenu,
        showPreviewBgColorMenu, setShowPreviewBgColorMenu,
        showBgColorWarning, setShowBgColorWarning,

        // 派生值
        currentFont: currentEditorFont,
        currentEditorFont,
        currentPreviewFont,
        currentFontFamily,
        currentBgColor,
        appBgColor,
        appTextColor,
        previewBgColor,
        previewTextColor,

        // 操作
        toggleTheme,
        increaseFontSize,
        decreaseFontSize,
    };
}
