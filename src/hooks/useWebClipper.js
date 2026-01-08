import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { extractUrlFromText, htmlToMarkdown, formatClippedContent } from '../utils/webClipper';

/**
 * Hook for web clipping functionality
 * @returns {{clipUrl: Function, isClipping: boolean, error: string|null}}
 */
export function useWebClipper() {
    const [isClipping, setIsClipping] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Clips the content from a URL and returns formatted markdown
     * @param {string} url - The URL to clip
     * @returns {Promise<string>} - The clipped markdown content
     */
    const clipUrl = useCallback(async (url) => {
        setIsClipping(true);
        setError(null);

        try {
            // Validate URL
            const extractedUrl = extractUrlFromText(url);
            if (!extractedUrl) {
                throw new Error('No valid URL found in selection');
            }

            console.log('📎 Clipping URL:', extractedUrl);

            // Fetch HTML content via Tauri command
            const html = await invoke('fetch_url_content', { url: extractedUrl });
            console.log('📄 Fetched HTML length:', html.length);

            // Convert HTML to Markdown
            const { title, markdown, excerpt } = htmlToMarkdown(html, extractedUrl);
            console.log('📝 Converted to markdown, title:', title);

            // Format with metadata
            const formattedContent = formatClippedContent(markdown, {
                title,
                sourceUrl: extractedUrl,
                clipDate: new Date().toLocaleString('zh-CN'),
                excerpt,
            });

            return formattedContent;
        } catch (err) {
            console.error('❌ Clip error:', err);
            const errorMessage = err.message || String(err);
            setError(errorMessage);
            throw err;
        } finally {
            setIsClipping(false);
        }
    }, []);

    /**
     * Clips URL from selected text and replaces it in the textarea
     * @param {HTMLTextAreaElement} textareaElement - The textarea element
     * @param {string} currentMarkdown - Current markdown content
     * @param {Function} setMarkdown - Function to update markdown
     * @param {Function} setHasUnsavedChanges - Function to mark changes
     */
    const clipFromSelection = useCallback(async (
        textareaElement,
        currentMarkdown,
        setMarkdown,
        setHasUnsavedChanges
    ) => {
        if (!textareaElement) {
            setError('No editor available');
            return;
        }

        const start = textareaElement.selectionStart;
        const end = textareaElement.selectionEnd;
        const selectedText = currentMarkdown.substring(start, end);

        if (!selectedText.trim()) {
            setError('Please select a URL first');
            return;
        }

        try {
            const clippedContent = await clipUrl(selectedText);

            // Replace selection with clipped content
            const newMarkdown =
                currentMarkdown.substring(0, start) +
                clippedContent +
                currentMarkdown.substring(end);

            setMarkdown(newMarkdown);
            setHasUnsavedChanges(true);

            // Move cursor to end of inserted content
            setTimeout(() => {
                textareaElement.focus();
                const newCursorPos = start + clippedContent.length;
                textareaElement.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);

            return clippedContent;
        } catch (err) {
            // Error is already set by clipUrl
            throw err;
        }
    }, [clipUrl]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        clipUrl,
        clipFromSelection,
        isClipping,
        error,
        clearError,
    };
}
