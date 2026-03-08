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

  if (headings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-xs">
        当前文档无标题
      </div>
    );
  }

  return (
    <nav className="space-y-0.5">
      {headings.map((heading, idx) => (
        <button
          key={idx}
          onClick={() => onHeadingClick(heading.line)}
          className="block w-full text-left text-[11px] py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
});

TableOfContents.displayName = 'TableOfContents';

export default TableOfContents;
