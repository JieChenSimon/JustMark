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
  onSecondary,
  isDangerous = false,
  position = null,
  hideCancel = false,
  secondaryText = null
}) {
  if (!isOpen) return null;
  const isSheet = position === null;

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
        className={`absolute inset-0 pointer-events-auto ${isSheet ? 'bg-transparent' : 'bg-[rgba(236,240,244,0.22)] backdrop-blur-[10px]'}`}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className={`pointer-events-auto ${isSheet
          ? 'absolute left-1/2 top-5 w-[420px] -translate-x-1/2 rounded-b-[18px] border border-t-0 border-slate-200/80 bg-white/96 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.16)]'
          : 'relative w-[240px] rounded-[20px] border border-slate-200/70 bg-white/88 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/88 animate-scale-in'}`}
        style={position ? getDialogPosition() : undefined}
      >
        {/* Title */}
        <h3 className="mb-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>

        {/* Message */}
        <p className="mb-4 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
          {message}
        </p>

        {/* Actions */}
        <div className={`flex gap-2 ${isSheet ? 'justify-start' : 'justify-end'}`}>
          {!hideCancel && (
            <button
              onClick={onCancel}
              className="jm-button px-3 py-1.5 text-[11px] text-slate-600 dark:text-gray-300"
            >
              {cancelText}
            </button>
          )}
          {secondaryText && onSecondary && (
            <button
              onClick={onSecondary}
              className="jm-button px-3 py-1.5 text-[11px] text-slate-600 dark:text-gray-300"
            >
              {secondaryText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`jm-button px-3 py-1.5 text-[11px] font-semibold text-white ${isDangerous
                ? 'bg-gradient-to-b from-red-400 to-red-500 hover:from-red-500 hover:to-red-600'
                : 'jm-button-accent'
              }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
