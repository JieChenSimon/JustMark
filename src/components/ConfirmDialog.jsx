/**
 * Confirmation Dialog Component
 * Mac-style modal dialog for confirmation actions
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
  position = null
}) {
  if (!isOpen) return null;

  // 计算对话框位置
  const getDialogPosition = () => {
    if (!position) return {};

    // 确保对话框不会超出屏幕边界
    const dialogWidth = 200; // 更紧凑的宽度
    const dialogHeight = 100;
    const padding = 10;

    let x = position.x + 10; // 在鼠标右侧显示
    let y = position.y;

    // 防止超出右边界
    if (x + dialogWidth > window.innerWidth - padding) {
      x = position.x - dialogWidth - 10; // 显示在鼠标左侧
    }

    // 防止超出底部边界
    if (y + dialogHeight > window.innerHeight - padding) {
      y = window.innerHeight - dialogHeight - padding;
    }

    // 防止超出左边界和顶部边界
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    return {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`
    };
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Transparent overlay to capture clicks outside */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-3 w-[200px] animate-scale-in pointer-events-auto"
        style={position ? getDialogPosition() : {}}
      >
        {/* Title */}
        <h3 className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {title}
        </h3>

        {/* Message */}
        <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-2.5 leading-snug">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={onCancel}
            className="px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-2 py-0.5 text-[10px] font-medium text-white rounded shadow-sm transition-colors ${isDangerous
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
              }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
