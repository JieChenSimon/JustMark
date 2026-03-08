export const STORAGE_SYNC_EVENT = 'justmark:storage-update';

/**
 * 从 localStorage 加载保存的状态
 * @param {string} key - 存储键名
 * @param {*} defaultValue - 默认值
 * @returns {*} 保存的值或默认值
 */
export const loadSavedState = (key, defaultValue) => {
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

/**
 * 保存状态到 localStorage，并同步给其他窗口与当前窗口。
 * @param {string} key - 存储键名
 * @param {*} value - 要保存的值
 */
export const saveState = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT, {
      detail: { key, value }
    }));
  } catch (error) {
    console.error(`保存状态失败 (${key}):`, error);
  }
};

/**
 * 订阅某个 key 的存储变化，兼容跨窗口和同窗口同步。
 * @param {string} key
 * @param {(value: any) => void} callback
 * @returns {() => void}
 */
export const subscribeToStoredState = (key, callback) => {
  const handleStorage = (event) => {
    if (event.key !== key || event.newValue === null) return;

    try {
      callback(JSON.parse(event.newValue));
    } catch (error) {
      console.error(`同步状态失败 (${key}):`, error);
    }
  };

  const handleCustomUpdate = (event) => {
    if (event.detail?.key !== key) return;
    callback(event.detail.value);
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(STORAGE_SYNC_EVENT, handleCustomUpdate);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(STORAGE_SYNC_EVENT, handleCustomUpdate);
  };
};
