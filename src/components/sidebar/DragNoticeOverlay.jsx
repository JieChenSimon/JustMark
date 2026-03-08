export default function DragNoticeOverlay({ dragOperation, draggedPath, getBaseName }) {
  if (!draggedPath) {
    return null;
  }

  return (
    <div className="fixed left-4 bottom-4 z-40 pointer-events-none">
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/78 dark:bg-slate-900/78 px-3.5 py-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {dragOperation === 'copy' ? 'Copy Item' : 'Move Item'}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-slate-800 dark:text-slate-100">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100/90 dark:bg-slate-800/90">
            {dragOperation === 'copy' ? '➕' : '↘'}
          </span>
          <span className="max-w-[240px] truncate font-medium">{getBaseName(draggedPath)}</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
          {dragOperation === 'copy' ? 'Drop on a folder to copy.' : 'Drop on a folder to move.'} Press Esc to cancel.
        </div>
      </div>
    </div>
  );
}
