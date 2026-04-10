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
    <div className="fixed bottom-6 right-6 z-10">
      <div className="relative">
        {/* Color Picker Button */}
        <button
          onClick={onToggleMenu}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/8 bg-white/76 backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-colors duration-200 hover:bg-white/90 dark:border-white/10 dark:bg-neutral-900/76 dark:hover:bg-neutral-800/88"
          title="Preview Background Color"
        >
          <div
            className="h-4 w-4 rounded-full border-2 border-white/90 dark:border-neutral-700"
            style={{ backgroundColor: previewBgColor }}
          ></div>
        </button>

        {/* Color Selection Menu */}
        {showMenu && (
          <div className="absolute bottom-10 right-0 min-w-[240px] rounded-xl border border-black/8 bg-white/92 p-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/92">
            {/* Reset Option */}
            <button
              onClick={onReset}
              className="mb-2 w-full rounded-lg border-b border-black/6 px-3 py-2 text-left text-sm text-gray-700 transition-colors duration-200 hover:bg-black/4 dark:border-white/8 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <span className="font-medium">Follow Theme</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Use current theme color
              </span>
            </button>

            {/* Color Options List */}
            <div className="space-y-1">
              {BACKGROUND_COLORS.map((color, index) => (
                <button
                  key={index}
                  onClick={() => onColorSelect(index)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200 ${previewBgColorIndex === index
                      ? 'bg-blue-50/80 ring-1 ring-blue-400/50 dark:bg-blue-900/20 dark:ring-blue-400/35'
                      : 'hover:bg-black/4 dark:hover:bg-white/5'
                    }`}
                >
                  <div
                    className="h-5 w-5 flex-shrink-0 rounded-md border border-black/10 dark:border-white/10"
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
