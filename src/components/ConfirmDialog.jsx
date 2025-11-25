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
    const dialogWidth = 240; // 减小宽度
    const dialogHeight = 150;
    const padding = 10;

    let x = position.x;
    let y = position.y;

    // 防止超出右边界
    if (x + dialogWidth > window.innerWidth - padding) {
      x = window.innerWidth - dialogWidth - padding;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl rounded-xl shadow-[0_20px_60px_rgb(0,0,0,0.3)] dark:shadow-[0_20px_60px_rgb(0,0,0,0.6)] border border-gray-200/30 dark:border-gray-600/30 p-4 w-[240px] animate-scale-in"
        style={position ? getDialogPosition() : {}}
      >
        {/* Title */}
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
          {title}
        </h3>

        {/* Message */}
        <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-700/50 hover:bg-gray-200/60 dark:hover:bg-gray-600/60 rounded-md transition-all duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1 text-[11px] font-medium text-white rounded-md transition-all duration-200 shadow-sm ${
              isDangerous
                ? 'bg-red-500/90 hover:bg-red-600/90'
                : 'bg-blue-500/90 hover:bg-blue-600/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
