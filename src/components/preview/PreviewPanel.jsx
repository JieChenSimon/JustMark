import { useMemo } from 'react';
import MarkdownPreview from './MarkdownPreview';

const PreviewPanel = ({
  markdown,
  attachmentFolder,
  previewBgColor,
  previewTextColor,
  currentFont,
  currentFontFamily,
  previewSectionRef,
  markdownComponents
}) => {
  const processedMarkdown = useMemo(() => {
    if (!attachmentFolder) return markdown;
    return markdown.replace(
      /!\[\[([^\]]+)\]\]/g,
      (match, filename) => {
        const imagePath = `${attachmentFolder}/${filename}`;
        const encodedPath = imagePath.split('/').map(part => encodeURIComponent(part)).join('/');
        return `![](${encodedPath})`;
      }
    );
  }, [markdown, attachmentFolder]);

  return (
    <div
      ref={previewSectionRef}
      style={{
        backgroundColor: previewBgColor,
        color: previewTextColor,
        fontSize: `${currentFont}px`,
        fontFamily: currentFontFamily
      }}
      className="flex-1 overflow-y-auto p-8"
    >
      <div className="prose prose-invert max-w-none">
        <MarkdownPreview
          content={processedMarkdown}
          components={markdownComponents}
          attachmentFolder={attachmentFolder}
        />
      </div>
    </div>
  );
};

export default PreviewPanel;
