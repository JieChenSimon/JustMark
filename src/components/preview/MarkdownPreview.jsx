import { memo, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { loadRemarkMath, loadRehypeKatex } from '../../utils/lazyImports';

const BASE_REMARK_PLUGINS = [remarkGfm];
const MATH_PATTERN = /(^|[^\\])(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/m;
const KATEX_OPTIONS = { strict: false, trust: true, throwOnError: false };

const MarkdownPreview = memo(({ content, components, attachmentFolder }) => {
  const [mathPlugins, setMathPlugins] = useState(null);

  const processedMarkdown = useMemo(() => {
    if (!attachmentFolder || !content.includes('![')) return content;
    return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return match;
      }
      const fullPath = `${attachmentFolder}/${src}`;
      return `![${alt}](${fullPath})`;
    });
  }, [content, attachmentFolder]);

  const hasMath = useMemo(() => MATH_PATTERN.test(processedMarkdown), [processedMarkdown]);

  useEffect(() => {
    if (!hasMath || mathPlugins) return;

    let cancelled = false;

    Promise.all([loadRemarkMath(), loadRehypeKatex()]).then(([remarkMathModule, rehypeKatexModule]) => {
      if (!cancelled) {
        setMathPlugins({
          remarkMath: remarkMathModule.default,
          rehypeKatex: rehypeKatexModule.default
        });
      }
    }).catch((error) => {
      console.error('加载数学渲染插件失败:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [hasMath, mathPlugins]);

  const remarkPlugins = hasMath && mathPlugins
    ? [mathPlugins.remarkMath, remarkGfm]
    : BASE_REMARK_PLUGINS;
  const rehypePlugins = hasMath && mathPlugins
    ? [[mathPlugins.rehypeKatex, KATEX_OPTIONS]]
    : [];

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {processedMarkdown}
    </ReactMarkdown>
  );
}, (prev, next) =>
  prev.content === next.content &&
  prev.attachmentFolder === next.attachmentFolder
);

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview;
