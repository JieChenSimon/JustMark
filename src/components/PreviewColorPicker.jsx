import { BACKGROUND_COLORS } from '../constants/theme.js';

/**
 * 预览区颜色选择器组件
 * 显示在预览区右下角的圆形毛玻璃按钮，用于独立控制预览区颜色
 */
export default function PreviewColorPicker({
  previewBgColor,
  previewBgColorIndex,
  showMenu,
  onToggleMenu,
  onColorSelect,
  onReset
}) {
  return (
    <div className="absolute bottom-6 right-6 z-10">
      <div className="relative">
        {/* 圆形颜色按钮 */}
        <button
          onClick={onToggleMenu}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200/50 dark:border-gray-600/50"
          title="预览区颜色"
        >
          <div
            className="w-4 h-4 rounded-full border-2 border-white dark:border-gray-600"
            style={{ backgroundColor: previewBgColor }}
          ></div>
        </button>

        {/* 颜色选择菜单 - 从下往上展开 */}
        {showMenu && (
          <div className="absolute bottom-10 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-600/50 p-3 min-w-[240px]">
            {/* 重置选项 */}
            <button
              onClick={onReset}
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 text-gray-700 dark:text-gray-300 mb-2 border-b border-gray-200 dark:border-gray-600"
            >
              <span className="font-medium">跟随主题</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">
                使用当前主题颜色
              </span>
            </button>

            {/* 颜色选项列表 */}
            <div className="space-y-1">
              {BACKGROUND_COLORS.map((color, index) => (
                <button
                  key={index}
                  onClick={() => onColorSelect(index)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    previewBgColorIndex === index
                      ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-md border-2 border-gray-300 dark:border-gray-600 flex-shrink-0"
                    style={{ backgroundColor: color.bg }}
                  ></div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {color.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {color.description}
                    </div>
                  </div>
                  {previewBgColorIndex === index && (
                    <svg
                      className="w-4 h-4 text-blue-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
