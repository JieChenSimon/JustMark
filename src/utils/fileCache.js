const fileTreeCache = new Map();
const FILE_CACHE_TTL = 5000;
const TREE_DEBUG_PATTERN = /00- 雅思-口语|Hu et al\.|面签英语/;

const normalizePath = (path = '') => path.endsWith('/') ? path.slice(0, -1) : path;

const isDirectChild = (parentPath, childPath) => {
  const normalizedParent = normalizePath(parentPath);
  const normalizedChild = normalizePath(childPath);

  if (!normalizedChild.startsWith(`${normalizedParent}/`)) {
    return false;
  }

  const relativePath = normalizedChild.slice(normalizedParent.length + 1);
  return relativePath.length > 0 && !relativePath.includes('/');
};

export const getCachedFileTree = async (path, readDirFn, maxAge = FILE_CACHE_TTL) => {
  const cached = fileTreeCache.get(path);
  if (cached && Date.now() - cached.timestamp < maxAge) {
    if (import.meta.env.DEV && TREE_DEBUG_PATTERN.test(path)) {
      console.log('[tree-cache] hit', path, cached.data.map((entry) => entry.path));
    }
    return cached.data;
  }

  const entries = await readDirFn(path);
  const normalizedEntries = entries
    .map((entry) => ({
      ...entry,
      path: entry.path || `${normalizePath(path)}/${entry.name}`
    }));
  const data = normalizedEntries
    .filter((entry) => isDirectChild(path, entry.path));

  if (import.meta.env.DEV && (TREE_DEBUG_PATTERN.test(path) || normalizedEntries.some((entry) => TREE_DEBUG_PATTERN.test(entry.path)))) {
    console.groupCollapsed(`[tree-cache] readDir ${path}`);
    console.table(normalizedEntries.map((entry) => ({
      name: entry.name,
      path: entry.path,
      isDirectory: entry.isDirectory,
      directChild: isDirectChild(path, entry.path),
    })));
    console.log('[tree-cache] filtered', data.map((entry) => entry.path));
    console.groupEnd();
  }

  fileTreeCache.set(path, { data, timestamp: Date.now() });
  return data;
};

export const invalidateCache = (path) => {
  if (path) {
    fileTreeCache.delete(path);
  } else {
    fileTreeCache.clear();
  }
};

export const getCacheStats = () => ({
  size: fileTreeCache.size,
  keys: Array.from(fileTreeCache.keys())
});
