import { useState } from 'react';
import { loadDocx, loadHtml2Canvas, loadJsPDF } from '../../utils/lazyImports';

export const useExportManager = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async (previewRef, fileName = 'document.pdf') => {
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        loadHtml2Canvas(),
        loadJsPDF()
      ]);

      const element = previewRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
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
