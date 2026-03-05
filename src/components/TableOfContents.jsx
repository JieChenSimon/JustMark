import { memo, useMemo } from 'react';

const TableOfContents = memo(({ markdown, onHeadingClick }) => {
  const headings = useMemo(() => {
    const lines = markdown.split('\n');
    const result = [];
    
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        result.push({ level, text, id, line: index });
      }
    });
    
    return result;
  }, [markdown]);

  if (headings.length === 0) return null;

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">目录</h3>
      <nav className="space-y-1">
        {headings.map((heading, idx) => (
          <button
            key={idx}
            onClick={() => onHeadingClick(heading.line)}
            className="block w-full text-left text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
          >
            <span className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
              {heading.text}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
});

TableOfContents.displayName = 'TableOfContents';

export default TableOfContents;
