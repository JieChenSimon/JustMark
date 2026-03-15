import { invoke } from '@tauri-apps/api/core';

export const WEBDAV_CONFIG_KEY = 'webdav_config';
export const WEBDAV_CONFIG_CHANGED_EVENT = 'justmark:webdav-config-changed';

let cachedConfig = null;
let cachedConfigRaw = null;
let hasLoadedConfig = false;

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

const applyCachedConfig = (rawValue) => {
  hasLoadedConfig = true;
  cachedConfigRaw = rawValue;

  if (!rawValue) {
    cachedConfig = null;
    return null;
  }

  try {
    cachedConfig = normalizeConfig(JSON.parse(rawValue));
    return cachedConfig;
  } catch (error) {
    console.error('[WebDAV] Failed to read saved config:', error);
    cachedConfig = null;
    return null;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === WEBDAV_CONFIG_KEY) {
      applyCachedConfig(event.newValue);
    }
  });

  window.addEventListener(WEBDAV_CONFIG_CHANGED_EVENT, (event) => {
    applyCachedConfig(JSON.stringify(event.detail));
  });
}

export const readSavedWebDAVConfig = () => {
  if (hasLoadedConfig) {
    return cachedConfig;
  }

  return applyCachedConfig(localStorage.getItem(WEBDAV_CONFIG_KEY));
};

export const prepareWebDAVConfig = (url, username, password, folder = '/') => {
  try {
    const config = normalizeConfig({ url, username, password, folder, connected: true });

    if (!config.url || !config.username || !config.password) {
      return { success: false, error: 'URL, username, and password are required.' };
    }

    return { success: true, config };
  } catch (error) {
    console.error('[WebDAV] Config validation failed:', error);
    return { success: false, error: error.message };
  }
};

export const saveWebDAVConfig = (input) => {
  const config = normalizeConfig(input);
  const nextRaw = JSON.stringify(config);
  const previousRaw = cachedConfigRaw ?? localStorage.getItem(WEBDAV_CONFIG_KEY);

  if (previousRaw === nextRaw) {
    applyCachedConfig(nextRaw);
    return config;
  }

  localStorage.setItem(WEBDAV_CONFIG_KEY, nextRaw);
  applyCachedConfig(nextRaw);
  window.dispatchEvent(new CustomEvent(WEBDAV_CONFIG_CHANGED_EVENT, { detail: config }));
  return config;
};

export const clearWebDAVConfig = () => {
  localStorage.removeItem(WEBDAV_CONFIG_KEY);
  hasLoadedConfig = true;
  cachedConfig = null;
  cachedConfigRaw = null;
  window.dispatchEvent(new CustomEvent(WEBDAV_CONFIG_CHANGED_EVENT, { detail: null }));
};

export const initWebDAV = (url, username, password, folder = '/') => {
  return prepareWebDAVConfig(url, username, password, folder);
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
  const config = resolveConfig();
  return await invoke('webdav_delete_file', { config, remotePath });
};

export const createDirectory = async (remotePath, overrideConfig) => {
  const config = resolveConfig(overrideConfig);
  return await invoke('webdav_create_directory', { config, remotePath });
};
