import { readFile } from '@tauri-apps/plugin-fs';
import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function FilePreview({ filePath }) {
  const [error, setError] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const renderTasks = [];

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        setPages([]);

        const bytes = await readFile(filePath);
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const renderedPages = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) {
            break;
          }

          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderTask = page.render({ canvasContext: context, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;

          renderedPages.push({
            pageNumber,
            dataUrl: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height,
          });
        }

        if (!cancelled) {
          setPages(renderedPages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task.cancel());
    };
  }, [filePath]);

  if (error) {
    return <div className="p-4">加载失败: {error}</div>;
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-500 dark:text-slate-300">正在加载 PDF...</div>;
  }

  return (
    <div className="h-full overflow-y-auto px-[2px] py-[2px]">
      <div className="mx-auto flex w-full flex-col gap-3">
        {pages.map((page) => (
          <figure
            key={`${filePath}-${page.pageNumber}`}
            className="overflow-hidden bg-white dark:bg-slate-900"
          >
            <img
              src={page.dataUrl}
              alt={`PDF page ${page.pageNumber}`}
              className="block h-auto w-full"
              width={page.width}
              height={page.height}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
