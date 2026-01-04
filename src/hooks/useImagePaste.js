import { invoke } from '@tauri-apps/api/core';

/**
 * Custom hook for handling image paste from clipboard
 * @param {string} currentFolder - Current working folder path
 * @param {string} currentFilePath - Current file path
 * @returns {object} - Object with handlePaste function
 */
export const useImagePaste = (currentFolder, currentFilePath) => {
    /**
     * Handles pasting an image from clipboard
     * @param {string} base64Data - Base64 encoded image data (without data:image/png;base64, prefix)
     * @returns {Promise<string|null>} - Relative path to the saved image or null if failed
     */
    const handlePaste = async (base64Data) => {
        // Check if user has saved a file or opened a folder
        if (!currentFolder && !currentFilePath) {
            console.warn('Please save the file first before pasting images');
            alert('请先保存文件或打开文件夹，然后再粘贴图片。\nPlease save the file or open a folder before pasting images.');
            return null;
        }

        // Determine the folder path
        const folderPath = currentFolder ||
            currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));

        // Generate unique filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/[-:]/g, '')
            .replace(/\..+/, '')
            .replace('T', '_');
        const filename = `image_${timestamp}.png`;

        try {
            // Call Tauri command to save the image
            const relativePath = await invoke('save_image_from_clipboard', {
                base64Data,
                folderPath,
                filename
            });

            console.log('Image saved successfully:', relativePath);
            return relativePath;
        } catch (error) {
            console.error('Failed to save image:', error);
            alert(`保存图片失败：${error}\nFailed to save image: ${error}`);
            return null;
        }
    };

    return { handlePaste };
};
