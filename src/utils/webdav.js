import { invoke } from '@tauri-apps/api/core';

let config = null;

export const initWebDAV = (url, username, password, folder = '/') => {
  try {
    config = { url, username, password, folder };
    console.log('[WebDAV] Config saved:', { url, username, folder });
    return { success: true };
  } catch (error) {
    console.error('[WebDAV] Init failed:', error);
    return { success: false, error: error.message };
  }
};

export const hasWebDAVClient = () => config !== null;

export const testConnection = async () => {
  if (!config) throw new Error('WebDAV not initialized');
  return await invoke('webdav_test_connection', { config });
};

export const listFiles = async (remotePath) => {
  if (!config) throw new Error('WebDAV not initialized');
  const pathConfig = { ...config, folder: remotePath || config.folder };
  return await invoke('webdav_list_files', { config: pathConfig });
};

export const uploadFile = async (localPath, remotePath, content) => {
  if (!config) throw new Error('WebDAV not initialized');
  return await invoke('webdav_upload_file', { config, remotePath, content });
};

export const downloadFile = async (remotePath) => {
  if (!config) throw new Error('WebDAV not initialized');
  return await invoke('webdav_download_file', { config, remotePath });
};

export const deleteFile = async (remotePath) => {
  throw new Error('Not implemented yet');
};

export const createDirectory = async (remotePath) => {
  if (!config) throw new Error('WebDAV not initialized');
  return await invoke('webdav_create_directory', { config, remotePath });
};
