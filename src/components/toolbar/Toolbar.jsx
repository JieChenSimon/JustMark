import { memo } from 'react';

const Toolbar = memo(({ 
  onNew, 
  onOpen, 
  onSave, 
  onExport,
  isDark,
  onToggleDark,
  fontSize,
  onFontSizeChange,
  currentFile 
}) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
      <button onClick={onNew} className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
        New
      </button>
      <button onClick={onOpen} className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
        Open
      </button>
      <button onClick={onSave} className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
        Save
      </button>
      <button onClick={onExport} className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
        Export PDF
      </button>
      
      <div className="flex-1" />
      
      {currentFile && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {currentFile.split('/').pop()}
        </span>
      )}
      
      <button onClick={onToggleDark} className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
        {isDark ? '☀️' : '🌙'}
      </button>
      
      <select 
        value={fontSize} 
        onChange={(e) => onFontSizeChange(Number(e.target.value))}
        className="px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
      >
        <option value={12}>12px</option>
        <option value={14}>14px</option>
        <option value={16}>16px</option>
        <option value={18}>18px</option>
        <option value={20}>20px</option>
      </select>
    </div>
  );
});

Toolbar.displayName = 'Toolbar';

export default Toolbar;
