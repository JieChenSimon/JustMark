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
 * 保存状态到 localStorage
 * @param {string} key - 存储键名
 * @param {*} value - 要保存的值
 */
export const saveState = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`保存状态失败 (${key}):`, error);
  }
};
