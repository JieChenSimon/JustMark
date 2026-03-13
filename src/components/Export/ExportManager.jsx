import { useState } from 'react';
import { loadDocx, loadHtml2Canvas, loadJsPDF } from '../../utils/lazyImports';
import { fetch } from '@tauri-apps/plugin-http';

export const useExportManager = () => {
  const [isExporting, setIsExporting] = useState(false);

  // 将跨域图片转换为 base64
  const convertCrossOriginImages = async (element) => {
    const images = element.querySelectorAll('img');
    const conversions = [];

    for (const img of images) {
      const src = img.src;
      // 检查是否是跨域图片
      if (src && !src.startsWith(window.location.origin) && !src.startsWith('data:') && !src.startsWith('blob:')) {
        conversions.push(
          (async () => {
            try {
              // 使用 Tauri 的 HTTP 插件下载图片
              const response = await fetch(src, {
                method: 'GET',
              });

              if (response.ok) {
                const blob = await response.blob();

                // 使用 FileReader 转换为 base64
                const base64 = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });

                // 替换图片 src
                img.src = base64;
              }
            } catch (error) {
              console.warn('Failed to convert image:', src, error);
              // 转换失败时，添加占位样式
              img.style.opacity = '0.3';
              img.style.border = '2px dashed #ccc';
            }
          })()
        );
      }
    }

    // 等待所有图片转换完成
    await Promise.all(conversions);
  };

  const exportToPDF = async (previewRef, fileName = 'document.pdf') => {
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        loadHtml2Canvas(),
        loadJsPDF()
      ]);

      const element = previewRef.current;
      if (!element) {
        throw new Error('Preview surface is not ready');
      }

      // 克隆元素以避免修改原始 DOM
      const clonedElement = element.cloneNode(true);
      document.body.appendChild(clonedElement);
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';

      try {
        // 转换所有跨域图片
        await convertCrossOriginImages(clonedElement);

        const canvas = await html2canvas(clonedElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;

        pdf.addImage(imgData, 'PNG', imgX, 0, imgWidth * ratio, imgHeight * ratio);
        pdf.save(fileName);
      } finally {
        // 清理克隆的元素
        document.body.removeChild(clonedElement);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const exportToDOCX = async (markdown, fileName = 'document.docx') => {
    setIsExporting(true);
    try {
      const { Document, Packer, Paragraph, TextRun } = await loadDocx();

      const doc = new Document({
        sections: [{
          children: markdown.split('\n').map(line =>
            new Paragraph({ children: [new TextRun(line)] })
          )
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, exportToPDF, exportToDOCX };
};
