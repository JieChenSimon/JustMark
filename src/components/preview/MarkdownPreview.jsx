import { memo, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { loadRemarkMath, loadRehypeKatex, loadRehypeRaw, loadRehypeSanitize } from '../../utils/lazyImports';
import { convertFileSrc } from '@tauri-apps/api/core';

const BASE_REMARK_PLUGINS = [remarkGfm];
const MATH_PATTERN = /(^|[^\\])(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/m;
const HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;
const KATEX_OPTIONS = { strict: false, trust: true, throwOnError: false };
const METADATA_BLOCK_PATTERN = /(^|\n)---\s*\n((?:[A-Za-z][^:\n]{0,40}:\s.*(?:\n|$))+)\s*---(?=\n|$)/g;
const LABEL_LINE_PATTERN = /^([A-Za-z][A-Za-z0-9 /&_-]{0,38}|[\u4e00-\u9fa5][\u4e00-\u9fa5A-Za-z0-9 /&_-]{0,28})\s*:\s*(.*)$/;

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const renderMetadataValue = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '<span class="jm-meta-empty">—</span>';
  }

  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    const safeUrl = escapeHtml(trimmed);
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a>`;
  }

  return escapeHtml(trimmed);
};

const transformMetadataBlocks = (input) => input.replace(METADATA_BLOCK_PATTERN, (_match, prefix, block) => {
  const rows = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const dividerIndex = line.indexOf(':');
      if (dividerIndex === -1) return null;

      const rawKey = line.slice(0, dividerIndex).trim();
      const rawValue = line.slice(dividerIndex + 1).trim();

      if (!rawKey) return null;

      return `
<div class="jm-meta-row">
  <dt class="jm-meta-label">${escapeHtml(rawKey)}</dt>
  <dd class="jm-meta-value">${renderMetadataValue(rawValue)}</dd>
</div>`;
    })
    .filter(Boolean)
    .join('');

  if (!rows) {
    return `${prefix}---\n${block}---`;
  }

  return `${prefix}<dl class="jm-meta-block">${rows}
</dl>`;
});

const flattenNodeText = (node) => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenNodeText).join('');
  }

  if (node?.props?.children) {
    return flattenNodeText(node.props.children);
  }

  return '';
};

const normalizeInlineSpacing = (text) => text
  .replace(/([,:;])(?!\s|$)/g, '$1 ')
  .replace(/\s{2,}/g, ' ')
  .trim();

const buildTextBlockComponent = (BaseComponent) => function PreviewTextBlock({ children, ...props }) {
  const rawText = flattenNodeText(children).replace(/\s+/g, ' ').trim();
  const labelMatch = rawText.match(LABEL_LINE_PATTERN);

  if (labelMatch) {
    const [, label, remainder] = labelMatch;
    const normalizedLabel = label.trim();

    return (
      <BaseComponent className="jm-preview-field" {...props}>
        <span className="jm-preview-field-label">{normalizedLabel}:</span>
        {remainder ? (
          <span className="jm-preview-field-value">{normalizeInlineSpacing(remainder)}</span>
        ) : (
          <span className="jm-preview-field-empty">—</span>
        )}
      </BaseComponent>
    );
  }

  return <BaseComponent {...props}>{children}</BaseComponent>;
};

const MarkdownPreview = memo(({ content, components, attachmentFolder, currentFilePath }) => {
  const [mathPlugins, setMathPlugins] = useState(null);
  const [htmlPlugins, setHtmlPlugins] = useState(null);
  const transformedContent = useMemo(() => transformMetadataBlocks(content), [content]);

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
    img: imageComponent,
    p: buildTextBlockComponent(components?.p || 'p'),
    li: buildTextBlockComponent(components?.li || 'li')
  }), [components, imageComponent]);

  const hasMath = useMemo(() => MATH_PATTERN.test(transformedContent), [transformedContent]);
  const hasHtml = useMemo(() => HTML_PATTERN.test(transformedContent), [transformedContent]);

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
      if (!cancelled) {
        setMathPlugins(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hasMath, mathPlugins]);

  useEffect(() => {
    if (!hasHtml || htmlPlugins) return;

    let cancelled = false;

    Promise.all([loadRehypeRaw(), loadRehypeSanitize()]).then(([rehypeRawModule, rehypeSanitizeModule]) => {
      if (!cancelled) {
        const { defaultSchema } = rehypeSanitizeModule;
        const sanitizeSchema = {
          ...defaultSchema,
          attributes: {
            ...defaultSchema.attributes,
            '*': [...(defaultSchema.attributes?.['*'] || []), 'className'],
            a: [...(defaultSchema.attributes?.a || []), 'target', 'rel'],
            td: [...(defaultSchema.attributes?.td || []), 'colSpan', 'rowSpan', 'align'],
            th: [...(defaultSchema.attributes?.th || []), 'colSpan', 'rowSpan', 'align'],
            code: [...(defaultSchema.attributes?.code || []), 'className'],
            pre: [...(defaultSchema.attributes?.pre || []), 'className']
          }
        };

        setHtmlPlugins({
          rehypeRaw: rehypeRawModule.default,
          rehypeSanitize: rehypeSanitizeModule.default,
          sanitizeSchema
        });
      }
    }).catch((error) => {
      console.error('加载 HTML 渲染插件失败:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [hasHtml, htmlPlugins]);

  const remarkPlugins = hasMath && mathPlugins
    ? [mathPlugins.remarkMath, remarkGfm]
    : BASE_REMARK_PLUGINS;
  const rehypePlugins = useMemo(() => {
    const plugins = [];

    if (hasHtml && htmlPlugins) {
      plugins.push(htmlPlugins.rehypeRaw);
      plugins.push([htmlPlugins.rehypeSanitize, htmlPlugins.sanitizeSchema]);
    }

    if (hasMath && mathPlugins) {
      plugins.push([mathPlugins.rehypeKatex, KATEX_OPTIONS]);
    }

    return plugins;
  }, [hasHtml, htmlPlugins, hasMath, mathPlugins]);

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={mergedComponents}
    >
      {transformedContent}
    </ReactMarkdown>
  );
}, (prev, next) =>
  prev.content === next.content &&
  prev.attachmentFolder === next.attachmentFolder &&
  prev.currentFilePath === next.currentFilePath &&
  prev.components === next.components
);

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview;
