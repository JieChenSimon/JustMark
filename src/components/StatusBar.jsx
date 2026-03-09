export default function StatusBar({ currentFilePath, chars, words, lines }) {
  return (
    <footer className="jm-statusbar absolute bottom-0 left-0 right-0 pointer-events-none">
      <div className="flex items-center justify-between px-4 pb-1.5 text-[9px]">
        <div className="truncate text-slate-400/60 dark:text-slate-500/60 font-medium max-w-[40%]">
          {currentFilePath ? currentFilePath.split('/').pop() : 'Untitled'}
        </div>
        <div className="flex items-center gap-2 text-slate-400/60 dark:text-slate-500/60">
          <span className="tabular-nums">{chars.toLocaleString()}</span>
          <span>·</span>
          <span className="tabular-nums">{words.toLocaleString()}w</span>
          <span>·</span>
          <span className="tabular-nums">{lines.toLocaleString()}L</span>
        </div>
      </div>
    </footer>
  );
}
