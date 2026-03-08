import { BACKGROUND_COLORS, FONT_FAMILIES, FONT_OPTIONS } from '../constants/theme';

export default function PreferencesDialog({
  isOpen,
  onClose,
  attachmentFolder,
  onAttachmentFolderChange,
  autoSaveEnabled,
  onAutoSaveChange,
  fileSortBy,
  onFileSortChange,
  isDarkMode,
  onThemeChange,
  fontIndex,
  onFontIndexChange,
  fontFamilyIndex,
  onFontFamilyIndexChange,
  bgColorIndex,
  onBgColorIndexChange
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(236,240,244,0.26)] backdrop-blur-[14px]">
      <div className="w-full max-w-2xl rounded-[24px] border border-slate-200/70 bg-white/88 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/88">
        <div className="flex items-center justify-between border-b border-slate-200/70 pb-4 dark:border-slate-700/70">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Preferences</h2>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              调整文稿、阅读和工作区的默认行为。
            </p>
          </div>
          <button onClick={onClose} className="jm-button px-3 py-1 text-[11px]">
            完成
          </button>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200/60 bg-slate-50/75 p-3 dark:border-slate-700/60 dark:bg-slate-950/30">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sections</div>
            <div className="mt-3 space-y-1 text-[12px] text-slate-600 dark:text-slate-300">
              <div className="rounded-xl bg-white/75 px-3 py-2 shadow-sm dark:bg-slate-800/60">Documents</div>
              <div className="rounded-xl px-3 py-2">Reading</div>
              <div className="rounded-xl px-3 py-2">Workspace</div>
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 dark:border-slate-700/70 dark:bg-slate-950/30">
              <h3 className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">Documents</h3>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-200">Attachment Folder</span>
                  <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">
                    Obsidian 风格图片引用使用的默认目录名。
                  </span>
                  <input
                    type="text"
                    value={attachmentFolder}
                    onChange={(event) => onAttachmentFolderChange(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-[12px] text-slate-800 outline-none ring-0 transition focus:border-blue-400 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                    placeholder="00- Attachment"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700/70 dark:bg-slate-900/40">
                  <div>
                    <div className="text-[11px] font-medium text-slate-800 dark:text-slate-100">Auto Save</div>
                    <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      文件已命名时，在编辑后自动持久化更改。
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={autoSaveEnabled}
                    onClick={() => onAutoSaveChange(!autoSaveEnabled)}
                    className={`relative h-6 w-11 rounded-full transition ${autoSaveEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${autoSaveEnabled ? 'left-[22px]' : 'left-0.5'}`}
                    />
                  </button>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-200">Sort Files By</span>
                  <select
                    value={fileSortBy}
                    onChange={(event) => onFileSortChange(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                  >
                    <option value="name">Name</option>
                    <option value="type">Type</option>
                    <option value="modified">Modified Time</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 dark:border-slate-700/70 dark:bg-slate-950/30">
              <h3 className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">Reading</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-200">Appearance</span>
                  <select
                    value={isDarkMode ? 'dark' : 'light'}
                    onChange={(event) => onThemeChange(event.target.value === 'dark')}
                    className="mt-2 w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-200">Text Size</span>
                  <select
                    value={fontIndex}
                    onChange={(event) => onFontIndexChange(Number(event.target.value))}
                    className="mt-2 w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                  >
                    {FONT_OPTIONS.map((option, index) => (
                      <option key={option.label} value={index}>{option.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-200">Font Family</span>
                  <select
                    value={fontFamilyIndex}
                    onChange={(event) => onFontFamilyIndexChange(Number(event.target.value))}
                    className="mt-2 w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                  >
                    {FONT_FAMILIES.map((option, index) => (
                      <option key={option.name} value={index}>{option.nameZh}</option>
                    ))}
                  </select>
                </label>

                <div className="md:col-span-2">
                  <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-200">Reading Background</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {BACKGROUND_COLORS.map((option, index) => (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() => onBgColorIndexChange(index)}
                        className={`rounded-2xl border px-3 py-2 text-left transition ${
                          bgColorIndex === index
                            ? 'border-blue-400 ring-2 ring-blue-400/30'
                            : 'border-slate-200/80 dark:border-slate-700/80'
                        }`}
                        style={{ backgroundColor: option.bg, color: option.text }}
                      >
                        <div className="text-[11px] font-semibold">{option.name}</div>
                        <div className="mt-1 text-[10px] opacity-75">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
