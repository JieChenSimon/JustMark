import { useState, useEffect, useCallback } from 'react';
import { FONT_OPTIONS, FONT_FAMILIES, BACKGROUND_COLORS } from '../constants/theme';

/**
 * 从 localStorage 加载保存的状态
 */
const loadSavedState = (key, defaultValue) => {
    try {
        const saved = localStorage.getItem(key);
        if (saved !== null) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error(`加载状态失败 (${key}):`, error);
    }
    return defaultValue;
};

const saveState = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`保存状态失败 (${key}):`, error);
    }
};

/**
 * 主题管理 Hook
 * 管理暗黑模式、字体、字号、背景色等视觉相关状态
 */
export function useTheme() {
    const [isDarkMode, setIsDarkMode] = useState(() => loadSavedState('isDarkMode', false));
    const [fontIndex, setFontIndex] = useState(() => loadSavedState('fontIndex', 1));
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
    useEffect(() => { saveState('fontIndex', fontIndex); }, [fontIndex]);
    useEffect(() => { saveState('fontFamilyIndex', fontFamilyIndex); }, [fontFamilyIndex]);
    useEffect(() => {
        saveState('bgColorIndex', bgColorIndex);
        setPreviewBgColorIndex(null);
    }, [bgColorIndex]);
    useEffect(() => { saveState('previewBgColorIndex', previewBgColorIndex); }, [previewBgColorIndex]);

    // 派生值
    const currentFont = FONT_OPTIONS[fontIndex];
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
        setFontIndex(prev => Math.min(prev + 1, FONT_OPTIONS.length - 1));
    }, []);

    const decreaseFontSize = useCallback(() => {
        setFontIndex(prev => Math.max(prev - 1, 0));
    }, []);

    return {
        // 状态
        isDarkMode, setIsDarkMode,
        fontIndex, setFontIndex,
        fontFamilyIndex, setFontFamilyIndex,
        bgColorIndex, setBgColorIndex,
        previewBgColorIndex, setPreviewBgColorIndex,

        // UI 菜单
        showFontMenu, setShowFontMenu,
        showBgColorMenu, setShowBgColorMenu,
        showPreviewBgColorMenu, setShowPreviewBgColorMenu,
        showBgColorWarning, setShowBgColorWarning,

        // 派生值
        currentFont,
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
