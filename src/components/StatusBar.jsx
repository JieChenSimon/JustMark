export default function StatusBar({ currentFilePath, chars, words, lines }) {
  return (
    <footer className="jm-statusbar">
      <div className="flex items-center justify-between px-4 py-2 text-[11px]">
        <div className="truncate text-slate-500">
          {currentFilePath || 'Untitled document'}
        </div>
        <div className="whitespace-nowrap text-slate-500">
          {chars} characters · {words} words · {lines} lines
        </div>
      </div>
    </footer>
  );
}
