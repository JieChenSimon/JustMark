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
     * Insert text at selection using execCommand to support undo
     * Falls back to direct manipulation if execCommand fails
     */
    const insertTextWithUndo = (textarea, text) => {
        // Focus the textarea first
        textarea.focus();

        // Try using execCommand for undo support
        // This is deprecated but still works in most browsers and maintains undo stack
        const success = document.execCommand('insertText', false, text);

        if (!success) {
            // Fallback: Use InputEvent (modern approach)
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // Create and dispatch an InputEvent
            const inputEvent = new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: text,
                bubbles: true,
                cancelable: true,
            });

            const dispatched = textarea.dispatchEvent(inputEvent);

            if (!dispatched || inputEvent.defaultPrevented) {
                // Last resort: direct value manipulation (no undo support)
                const currentValue = textarea.value;
                textarea.value = currentValue.substring(0, start) + text + currentValue.substring(end);

                // Trigger input event for React state sync
                const event = new Event('input', { bubbles: true });
                textarea.dispatchEvent(event);
            }
        }

        return true;
    };

    /**
     * Clips URL from selected text and replaces it in the textarea
     * Uses execCommand to maintain undo history
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

            // Ensure the selection is still valid
            textareaElement.focus();
            textareaElement.setSelectionRange(start, end);

            // Use insertTextWithUndo for undo support
            insertTextWithUndo(textareaElement, clippedContent);

            // Update React state to sync
            setMarkdown(textareaElement.value);
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
