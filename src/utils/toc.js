const HEADING_PATTERN = /^(#{1,6})\s+(.*\S)\s*$/;

export function slugifyHeading(text) {
  const normalized = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'section';
}

export function createUniqueHeadingId(text, counts) {
  const baseSlug = slugifyHeading(text);
  const nextCount = (counts.get(baseSlug) || 0) + 1;
  counts.set(baseSlug, nextCount);
  return nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`;
}

export function extractTocHeadings(content) {
  const lines = String(content || '').split('\n');
  const counts = new Map();

  return lines.reduce((items, line, index) => {
    const match = line.match(HEADING_PATTERN);
    if (!match) {
      return items;
    }

    const [, hashes, rawTitle] = match;
    const text = rawTitle.replace(/\s+#+\s*$/, '').trim();
    if (!text) {
      return items;
    }

    items.push({
      id: createUniqueHeadingId(text, counts),
      text,
      level: hashes.length,
      line: index,
    });
    return items;
  }, []);
}

export function flattenReactNodeText(node) {
  if (node == null || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenReactNodeText).join('');
  }

  if (typeof node === 'object' && 'props' in node) {
    return flattenReactNodeText(node.props?.children);
  }

  return '';
}

export function getLineStartOffset(content, lineIndex) {
  const lines = String(content || '').split('\n');
  const clampedIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
  let offset = 0;

  for (let index = 0; index < clampedIndex; index += 1) {
    offset += lines[index].length + 1;
  }

  return offset;
}
