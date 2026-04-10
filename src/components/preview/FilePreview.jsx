import { readFile } from '@tauri-apps/plugin-fs';
import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

const PDF_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

(async () => {
  try {
    const res = await fetch('/pdf.worker.min.mjs');
    if (!res.ok) throw new Error('not found');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;
  }
})();

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

        const batchSize = 5;
        const renderPage = async (pdf, pageNumber) => {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderTask = page.render({ canvasContext: context, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;

          return {
            pageNumber,
            dataUrl: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height,
          };
        };

        const scheduleBatch = async (startPage, renderedPages) => {
          if (cancelled || startPage > pdf.numPages) {
            if (!cancelled) {
              setPages(renderedPages);
            }
            return;
          }

          const endPage = Math.min(startPage + batchSize - 1, pdf.numPages);
          const batchPromises = [];
          for (let i = startPage; i <= endPage; i += 1) {
            batchPromises.push(renderPage(pdf, i));
          }

          const batchResults = await Promise.all(batchPromises);
          renderedPages.push(...batchResults);

          if (!cancelled) {
            setPages([...renderedPages]);
          }

          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => scheduleBatch(endPage + 1, renderedPages));
          } else {
            setTimeout(() => scheduleBatch(endPage + 1, renderedPages), 0);
          }
        };

        scheduleBatch(1, []);
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
