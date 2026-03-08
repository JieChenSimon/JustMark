// 缓存动态导入，避免重复初始化重型模块。
const moduleCache = new Map();

const loadCachedModule = (key, loader) => {
  if (!moduleCache.has(key)) {
    moduleCache.set(key, loader());
  }

  return moduleCache.get(key);
};

export const loadHtml2Canvas = () => loadCachedModule('html2canvas', () => import('html2canvas'));
export const loadJsPDF = () => loadCachedModule('jspdf', () => import('jspdf'));
export const loadDocx = () => loadCachedModule('docx', () => import('docx'));
export const loadMermaid = () => loadCachedModule('mermaid', () => import('mermaid'));
export const loadRemarkMath = () => loadCachedModule('remark-math', () => import('remark-math'));
export const loadRehypeKatex = () => loadCachedModule('rehype-katex', () => import('rehype-katex'));
