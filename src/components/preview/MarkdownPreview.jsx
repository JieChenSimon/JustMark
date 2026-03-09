import { memo, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { loadRemarkMath, loadRehypeKatex } from '../../utils/lazyImports';
import { convertFileSrc } from '@tauri-apps/api/core';

const BASE_REMARK_PLUGINS = [remarkGfm];
const MATH_PATTERN = /(^|[^\\])(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/m;
const KATEX_OPTIONS = { strict: false, trust: true, throwOnError: false };

const MarkdownPreview = memo(({ content, components, attachmentFolder, currentFilePath }) => {
  const [mathPlugins, setMathPlugins] = useState(null);

  const imageComponent = useMemo(() => {
    const baseDir = currentFilePath ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : '';

    return ({ src, alt, ...props }) => {
      if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('asset://')) {
        return <img src={src} alt={alt} {...props} />;
      }

      let fullPath;
      if (src.startsWith('/')) {
        fullPath = src;
      } else if (baseDir) {
        fullPath = `${baseDir}/${src}`;
      } else if (attachmentFolder) {
        fullPath = `${attachmentFolder}/${src}`;
      } else {
        return <img src={src} alt={alt} {...props} />;
      }

      const tauriPath = convertFileSrc(fullPath);
      return <img src={tauriPath} alt={alt} {...props} />;
    };
  }, [attachmentFolder, currentFilePath]);

  const mergedComponents = useMemo(() => ({
    ...components,
    img: imageComponent
  }), [components, imageComponent]);

  const hasMath = useMemo(() => MATH_PATTERN.test(content), [content]);

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
      components={mergedComponents}
    >
      {content}
    </ReactMarkdown>
  );
}, (prev, next) =>
  prev.content === next.content &&
  prev.attachmentFolder === next.attachmentFolder &&
  prev.currentFilePath === next.currentFilePath
);

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview;
