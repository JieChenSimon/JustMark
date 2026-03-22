import { invoke } from '@tauri-apps/api/core';

export const WEBDAV_CONFIG_KEY = 'webdav_config';
export const WEBDAV_CONFIG_CHANGED_EVENT = 'justmark:webdav-config-changed';

let cachedConfig = null;
let cachedConfigRaw = null;
let hasLoadedConfig = false;

const buildCredentialId = ({ url = '', username = '', folder = '/' }) => (
  `${url.trim()}|${username.trim()}|${normalizeFolder(folder)}`
);

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

  const normalized = {
    url: input.url?.trim() || '',
    username: input.username?.trim() || '',
    password: input.password || '',
    folder: normalizeFolder(input.folder),
    credentialId: input.credentialId?.trim() || '',
    passwordSaved: Boolean(input.passwordSaved || input.password),
  };

  return {
    ...normalized,
    credentialId: normalized.credentialId || buildCredentialId(normalized),
  };
};

const toPersistedConfig = (config) => {
  if (!config) {
    return null;
  }

  return {
    url: config.url,
    username: config.username,
    folder: config.folder,
    credentialId: config.credentialId,
    passwordSaved: Boolean(config.passwordSaved),
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

const hydrateConfigPassword = async (config) => {
  if (!config?.passwordSaved || config.password || !config.credentialId) {
    return config;
  }

  try {
    const password = await invoke('webdav_get_password', { credentialId: config.credentialId });
    if (!password) {
      return { ...config, passwordSaved: false };
    }

    return { ...config, password };
  } catch (error) {
    console.error('[WebDAV] Failed to read secure password:', error);
    return config;
  }
};

const persistCachedConfig = (config) => {
  const persistedConfig = toPersistedConfig(config);
  const nextRaw = JSON.stringify(persistedConfig);
  localStorage.setItem(WEBDAV_CONFIG_KEY, nextRaw);
  applyCachedConfig(nextRaw);
  window.dispatchEvent(new CustomEvent(WEBDAV_CONFIG_CHANGED_EVENT, { detail: config }));
  return config;
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === WEBDAV_CONFIG_KEY) {
      applyCachedConfig(event.newValue);
    }
  });

  window.addEventListener(WEBDAV_CONFIG_CHANGED_EVENT, (event) => {
    hasLoadedConfig = true;
    cachedConfig = normalizeConfig(event.detail);
    cachedConfigRaw = event.detail ? JSON.stringify(toPersistedConfig(event.detail)) : null;
  });
}

export const readSavedWebDAVConfig = () => {
  if (hasLoadedConfig) {
    return cachedConfig;
  }

  return applyCachedConfig(localStorage.getItem(WEBDAV_CONFIG_KEY));
};

export const ensureWebDAVConfigLoaded = async () => {
  const baseConfig = readSavedWebDAVConfig();
  if (!baseConfig) {
    return null;
  }

  if (baseConfig.password && cachedConfigRaw?.includes('"password"')) {
    try {
      await saveWebDAVConfig(baseConfig);
      return cachedConfig;
    } catch (error) {
      console.error('[WebDAV] Failed to migrate legacy password to secure storage:', error);
      return baseConfig;
    }
  }

  if (baseConfig.password || !baseConfig.passwordSaved) {
    return baseConfig;
  }

  const hydratedConfig = await hydrateConfigPassword(baseConfig);
  cachedConfig = hydratedConfig;
  return hydratedConfig;
};

export const prepareWebDAVConfig = (url, username, password, folder = '/') => {
  try {
    const config = normalizeConfig({ url, username, password, folder });

    if (!config.url || !config.username || !config.password) {
      return { success: false, error: 'URL, username, and password are required.' };
    }

    const parsedUrl = new URL(config.url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { success: false, error: 'WebDAV URL must start with http:// or https://.' };
    }

    if (parsedUrl.search || parsedUrl.hash) {
      return { success: false, error: 'WebDAV URL must not include query strings or fragments.' };
    }

    if (!config.folder.startsWith('/')) {
      return { success: false, error: 'WebDAV folder must be an absolute path.' };
    }

    return { success: true, config };
  } catch (error) {
    console.error('[WebDAV] Config validation failed:', error);
    return { success: false, error: error.message };
  }
};

export const saveWebDAVConfig = async (input) => {
  const config = normalizeConfig(input);
  const previousRaw = cachedConfigRaw ?? localStorage.getItem(WEBDAV_CONFIG_KEY);
  const previousConfig = previousRaw ? normalizeConfig(JSON.parse(previousRaw)) : null;
  const nextPersistedRaw = JSON.stringify(toPersistedConfig(config));

  if (!config?.password) {
    throw new Error('WebDAV password is required before saving configuration.');
  }

  await invoke('webdav_save_password', { credentialId: config.credentialId, password: config.password });

  if (previousConfig?.credentialId && previousConfig.credentialId !== config.credentialId) {
    try {
      await invoke('webdav_delete_password', { credentialId: previousConfig.credentialId });
    } catch (error) {
      console.warn('[WebDAV] Failed to remove old secure password:', error);
    }
  }

  if (previousRaw === nextPersistedRaw) {
    cachedConfig = config;
    cachedConfigRaw = nextPersistedRaw;
    return config;
  }

  return persistCachedConfig(config);
};

export const clearWebDAVConfig = () => {
  const existingConfig = readSavedWebDAVConfig();
  if (existingConfig?.credentialId) {
    void invoke('webdav_delete_password', { credentialId: existingConfig.credentialId }).catch((error) => {
      console.warn('[WebDAV] Failed to clear secure password:', error);
    });
  }

  localStorage.removeItem(WEBDAV_CONFIG_KEY);
  hasLoadedConfig = true;
  cachedConfig = null;
  cachedConfigRaw = null;
  window.dispatchEvent(new CustomEvent(WEBDAV_CONFIG_CHANGED_EVENT, { detail: null }));
};

export const initWebDAV = (url, username, password, folder = '/') => {
  return prepareWebDAVConfig(url, username, password, folder);
};

const resolveConfig = async (overrideConfig) => {
  const config = overrideConfig
    ? normalizeConfig(overrideConfig)
    : await ensureWebDAVConfigLoaded();

  if (!config?.url || !config.username || !config.password) {
    throw new Error('WebDAV not initialized');
  }

  return config;
};

export const hasWebDAVClient = () => {
  const config = readSavedWebDAVConfig();
  return Boolean(config?.url && config.username && (config.password || config.passwordSaved));
};

export const testConnection = async (overrideConfig) => {
  const config = await resolveConfig(overrideConfig);
  return await invoke('webdav_test_connection', { config });
};

export const listFiles = async (remotePath, overrideConfig) => {
  const config = await resolveConfig(overrideConfig);
  const pathConfig = { ...config, folder: normalizeFolder(remotePath || config.folder) };
  return await invoke('webdav_list_files', { config: pathConfig });
};

export const uploadFile = async (localPath, remotePath, content, overrideConfig) => {
  const config = await resolveConfig(overrideConfig);
  return await invoke('webdav_upload_file', { config, remotePath, content });
};

export const downloadFile = async (remotePath, overrideConfig) => {
  const config = await resolveConfig(overrideConfig);
  return await invoke('webdav_download_file', { config, remotePath });
};

export const deleteFile = async (remotePath) => {
  const config = await resolveConfig();
  return await invoke('webdav_delete_file', { config, remotePath });
};

export const createDirectory = async (remotePath, overrideConfig) => {
  const config = await resolveConfig(overrideConfig);
  return await invoke('webdav_create_directory', { config, remotePath });
};
