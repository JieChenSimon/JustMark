export const TAG_COLORS = [
  { name: 'red', color: '#FF3B30' },
  { name: 'orange', color: '#FF9500' },
  { name: 'yellow', color: '#FFCC00' },
  { name: 'green', color: '#34C759' },
  { name: 'blue', color: '#007AFF' },
  { name: 'purple', color: '#AF52DE' },
  { name: 'gray', color: '#8E8E93' }
];

export const getTagColor = (tagName) => {
  const hash = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[hash % TAG_COLORS.length].color;
};

export const EDITABLE_FILE_EXTENSIONS = new Set(['md', 'markdown', 'txt']);

export const getFileExtension = (filePath = '') => {
  const fileName = filePath.split('/').pop() || '';
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex >= 0 ? fileName.slice(lastDotIndex + 1).toLowerCase() : '';
};

export const isEditableFile = (filePath) => EDITABLE_FILE_EXTENSIONS.has(getFileExtension(filePath));

export const parseTags = (content) => {
  const tagRegex = /#[\u4e00-\u9fa5a-zA-Z0-9_-]+/g;
  const matches = content.match(tagRegex);
  return matches ? [...new Set(matches)] : [];
};

export const sortEntries = (entries, sortBy = 'name') => {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });
};
