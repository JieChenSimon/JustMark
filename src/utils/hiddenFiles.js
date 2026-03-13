/**
 * 判断文件或文件夹是否应该被隐藏
 * @param {string} name - 文件或文件夹名称
 * @param {boolean} showHiddenFiles - 是否显示隐藏文件
 * @param {string[]} whitelist - 白名单列表
 * @returns {boolean} - true 表示应该隐藏
 */
export function shouldHideFile(name, showHiddenFiles, whitelist = []) {
  // 如果设置为显示所有隐藏文件，则不隐藏
  if (showHiddenFiles) {
    return false;
  }

  // 检查是否以 . 开头
  if (!name.startsWith('.')) {
    return false;
  }

  // 检查是否在白名单中
  return !whitelist.includes(name);
}

/**
 * 过滤文件列表，移除应该隐藏的文件
 * @param {Array} entries - 文件列表
 * @param {boolean} showHiddenFiles - 是否显示隐藏文件
 * @param {string[]} whitelist - 白名单列表
 * @returns {Array} - 过滤后的文件列表
 */
export function filterHiddenFiles(entries, showHiddenFiles, whitelist = []) {
  return entries.filter(entry => {
    return !shouldHideFile(entry.name, showHiddenFiles, whitelist);
  });
}
