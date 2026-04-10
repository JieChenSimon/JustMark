import { useEffect, useRef, useState } from 'react';
import MarkdownPreview from './MarkdownPreview';

const A4_WIDTH_PX = 794;

export default function PDFPreview({
  content,
  attachmentFolder,
  fontFamily,
  fontSize,
  layoutPreset = 'prose',
  pageRef,
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;

      const horizontalPadding = layoutPreset === 'code' ? 36 : 48;
      const availableWidth = Math.max(container.clientWidth - horizontalPadding, 320);
      setScale(Math.min(1, availableWidth / A4_WIDTH_PX));
    };

    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);
    const container = containerRef.current;
    if (container) {
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [layoutPreset]);

  return (
    <div ref={containerRef} className="jm-pdf-canvas">
      <div className={`jm-preview-paper-shell ${layoutPreset === 'code' ? 'jm-preview-paper-shell--code' : 'jm-preview-paper-shell--prose'}`}>
        <div className="jm-pdf-scale-shell" style={{ transform: `scale(${scale})` }}>
          <article
            id="print-target"
            ref={pageRef}
            className={`jm-pdf-page jm-markdown-preview ${layoutPreset === 'code' ? 'jm-preview-paper--code jm-markdown-preview--code' : 'jm-preview-paper--prose jm-markdown-preview--prose'}`}
            style={{ fontFamily, fontSize }}
          >
            <MarkdownPreview content={content} attachmentFolder={attachmentFolder} />
          </article>
        </div>
      </div>
    </div>
  );
}
