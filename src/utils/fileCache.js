const fileTreeCache = new Map();
const FILE_CACHE_TTL = 5000;

export const getCachedFileTree = async (path, readDirFn, maxAge = FILE_CACHE_TTL) => {
  const cached = fileTreeCache.get(path);
  if (cached && Date.now() - cached.timestamp < maxAge) {
    return cached.data;
  }

  const data = await readDirFn(path);
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
