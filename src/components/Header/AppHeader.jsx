import { FONT_OPTIONS, BACKGROUND_COLORS } from '../../constants/theme';

const AppHeader = ({
  currentFilePath,
  hasUnsavedChanges,
  isDarkMode,
  fontIndex,
  bgColorIndex,
  showFontMenu,
  showBgColorMenu,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onToggleTheme,
  onIncreaseFontSize,
  onDecreaseFontSize,
  onFontChange,
  onBgColorChange,
  onToggleFontMenu,
  onToggleBgColorMenu,
  onToggleSidebar,
  onTogglePreview,
  appBgColor,
  appTextColor
}) => {
  return (
    <div style={{ backgroundColor: appBgColor, color: appTextColor }}
      className="h-12 flex items-center justify-between px-4 border-b border-gray-700">
      <div className="flex items-center gap-2">
        <button onClick={onNew} className="px-3 py-1 hover:bg-gray-700 rounded">新建</button>
        <button onClick={onOpen} className="px-3 py-1 hover:bg-gray-700 rounded">打开</button>
        <button onClick={onSave} className="px-3 py-1 hover:bg-gray-700 rounded">保存</button>
        <button onClick={onSaveAs} className="px-3 py-1 hover:bg-gray-700 rounded">另存为</button>
      </div>

      <div className="flex-1 text-center">
        {currentFilePath ? (
          <span>{currentFilePath.split('/').pop()}{hasUnsavedChanges ? ' *' : ''}</span>
        ) : (
          <span>未命名文档</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onToggleSidebar} className="px-3 py-1 hover:bg-gray-700 rounded">侧边栏</button>
        <button onClick={onTogglePreview} className="px-3 py-1 hover:bg-gray-700 rounded">预览</button>
        <button onClick={onToggleTheme} className="px-3 py-1 hover:bg-gray-700 rounded">
          {isDarkMode ? '🌙' : '☀️'}
        </button>
        <button onClick={onDecreaseFontSize} className="px-2 py-1 hover:bg-gray-700 rounded">A-</button>
        <button onClick={onIncreaseFontSize} className="px-2 py-1 hover:bg-gray-700 rounded">A+</button>

        <div className="relative">
          <button onClick={onToggleFontMenu} className="px-3 py-1 hover:bg-gray-700 rounded">
            字体
          </button>
          {showFontMenu && (
            <div className="absolute right-0 mt-2 bg-gray-800 rounded shadow-lg p-2 z-50">
              {FONT_OPTIONS.map((size, idx) => (
                <button key={idx} onClick={() => onFontChange(idx)}
                  className={`block w-full text-left px-3 py-1 hover:bg-gray-700 ${fontIndex === idx ? 'bg-gray-700' : ''}`}>
                  {size}px
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={onToggleBgColorMenu} className="px-3 py-1 hover:bg-gray-700 rounded">
            背景
          </button>
          {showBgColorMenu && (
            <div className="absolute right-0 mt-2 bg-gray-800 rounded shadow-lg p-2 z-50">
              {BACKGROUND_COLORS.map((color, idx) => (
                <button key={idx} onClick={() => onBgColorChange(idx)}
                  className={`block w-full text-left px-3 py-1 hover:bg-gray-700 ${bgColorIndex === idx ? 'bg-gray-700' : ''}`}>
                  {color.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
