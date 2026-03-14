import { invoke } from '@tauri-apps/api/core';

export const WEBDAV_CONFIG_KEY = 'webdav_config';

const normalizeFolder = (folder = '/') => {
  const trimmed = (folder || '/').trim();

  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const normalizeConfig = (input) => {
  if (!input) {
    return null;
  }

  return {
    url: input.url?.trim() || '',
    username: input.username?.trim() || '',
    password: input.password || '',
    folder: normalizeFolder(input.folder),
    connected: Boolean(input.connected),
  };
};

export const readSavedWebDAVConfig = () => {
  try {
    const raw = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (!raw) {
      return null;
    }

    return normalizeConfig(JSON.parse(raw));
  } catch (error) {
    console.error('[WebDAV] Failed to read saved config:', error);
    return null;
  }
};

export const saveWebDAVConfig = (input) => {
  const config = normalizeConfig(input);
  localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('justmark:webdav-config-changed', { detail: config }));
  return config;
};

export const clearWebDAVConfig = () => {
  localStorage.removeItem(WEBDAV_CONFIG_KEY);
  window.dispatchEvent(new CustomEvent('justmark:webdav-config-changed', { detail: null }));
};

export const initWebDAV = (url, username, password, folder = '/') => {
  try {
    const config = normalizeConfig({ url, username, password, folder, connected: true });

    if (!config.url || !config.username || !config.password) {
      return { success: false, error: 'URL, username, and password are required.' };
    }

    return { success: true, config };
  } catch (error) {
    console.error('[WebDAV] Init failed:', error);
    return { success: false, error: error.message };
  }
};

const resolveConfig = (overrideConfig) => {
  const config = overrideConfig ? normalizeConfig(overrideConfig) : readSavedWebDAVConfig();

  if (!config?.connected || !config.url || !config.username || !config.password) {
    throw new Error('WebDAV not initialized');
  }

  return config;
};

export const hasWebDAVClient = () => {
  const config = readSavedWebDAVConfig();
  return Boolean(config?.connected && config.url && config.username && config.password);
};

export const testConnection = async (overrideConfig) => {
  const config = resolveConfig(overrideConfig);
  return await invoke('webdav_test_connection', { config });
};

export const listFiles = async (remotePath, overrideConfig) => {
  const config = resolveConfig(overrideConfig);
  const pathConfig = { ...config, folder: normalizeFolder(remotePath || config.folder) };
  return await invoke('webdav_list_files', { config: pathConfig });
};

export const uploadFile = async (localPath, remotePath, content, overrideConfig) => {
  const config = resolveConfig(overrideConfig);
  return await invoke('webdav_upload_file', { config, remotePath, content });
};

export const downloadFile = async (remotePath, overrideConfig) => {
  const config = resolveConfig(overrideConfig);
  return await invoke('webdav_download_file', { config, remotePath });
};

export const deleteFile = async (remotePath) => {
  throw new Error('Not implemented yet');
};

export const createDirectory = async (remotePath, overrideConfig) => {
  const config = resolveConfig(overrideConfig);
  return await invoke('webdav_create_directory', { config, remotePath });
};
