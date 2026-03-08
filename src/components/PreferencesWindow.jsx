import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { BACKGROUND_COLORS, FONT_FAMILIES, FONT_OPTIONS } from '../constants/theme';

const PREFERENCE_SECTIONS = [
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Tune reading contrast, typography, and theme behavior across every JustMark window.'
  },
  {
    id: 'files',
    title: 'Files',
    description: 'Defaults that affect markdown attachments, file browsing, and save behavior.'
  }
];

function PreferenceSection({ id, title, description, children }) {
  return (
    <section id={id} className="rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white/90 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function PreferenceRow({ label, hint, control }) {
  return (
    <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
      <div>
        <div className="text-[12px] font-medium text-slate-800">{label}</div>
        {hint ? <div className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</div> : null}
      </div>
      <div>{control}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-blue-500' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  );
}

export default function PreferencesWindow() {
  const appWindow = getCurrentWindow();
  const {
    isDarkMode,
    setIsDarkMode,
    fontIndex,
    setFontIndex,
    fontFamilyIndex,
    setFontFamilyIndex,
    bgColorIndex,
    setBgColorIndex
  } = useTheme();
  const {
    attachmentFolder,
    setAttachmentFolder,
    autoSaveEnabled,
    setAutoSaveEnabled,
    fileSortBy,
    setFileSortBy
  } = useSettings();

  useEffect(() => {
    void appWindow.setTitle('Settings');
  }, [appWindow]);

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-8 pt-6">
        <header className="mb-6 border-b border-[rgba(15,23,42,0.08)] pb-4">
          <div className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900">Settings</div>
          <p className="mt-1 text-[12px] text-slate-500">Application-wide preferences for writing, appearance, and files.</p>
        </header>

        <main className="grid flex-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white/86 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Preferences
            </div>
            <nav className="space-y-1">
              {PREFERENCE_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-[12px] px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-[#edf3ff] hover:text-[#1d4ed8]"
                >
                  {section.title}
                </a>
              ))}
            </nav>
            <div className="mt-5 rounded-[14px] border border-slate-200/80 bg-[#f8f9fb] px-3 py-2.5">
              <div className="text-[11px] font-medium text-slate-700">JustMark</div>
              <div className="mt-1 text-[10px] leading-5 text-slate-500">
                Your settings apply instantly across all open document windows.
              </div>
            </div>
          </aside>

          <div className="space-y-5">
          <PreferenceSection
            id="appearance"
            title="Appearance"
            description={PREFERENCE_SECTIONS[0].description}
          >
            <PreferenceRow
              label="Appearance"
              hint="Choose the app-wide color appearance."
              control={(
                <select
                  value={isDarkMode ? 'dark' : 'light'}
                  onChange={(event) => setIsDarkMode(event.target.value === 'dark')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              )}
            />
            <PreferenceRow
              label="Text Size"
              hint="Affects both the editor and preview."
              control={(
                <select
                  value={fontIndex}
                  onChange={(event) => setFontIndex(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400"
                >
                  {FONT_OPTIONS.map((option, index) => (
                    <option key={option.label} value={index}>{option.name}</option>
                  ))}
                </select>
              )}
            />
            <PreferenceRow
              label="Font Family"
              hint="Choose the default writing font."
              control={(
                <select
                  value={fontFamilyIndex}
                  onChange={(event) => setFontFamilyIndex(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400"
                >
                  {FONT_FAMILIES.map((option, index) => (
                    <option key={option.name} value={index}>{option.nameZh}</option>
                  ))}
                </select>
              )}
            />
            <PreferenceRow
              label="Reading Background"
              hint="Set the default paper tint used in the workspace."
              control={(
                <div className="grid grid-cols-2 gap-2">
                  {BACKGROUND_COLORS.map((option, index) => (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => setBgColorIndex(index)}
                      className={`rounded-2xl border px-3 py-2 text-left transition ${
                        bgColorIndex === index ? 'border-blue-400 ring-2 ring-blue-400/20' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: option.bg, color: option.text }}
                    >
                      <div className="text-[11px] font-semibold">{option.name}</div>
                      <div className="mt-1 text-[10px] opacity-70">{option.description}</div>
                    </button>
                  ))}
                </div>
              )}
            />
          </PreferenceSection>

          <PreferenceSection
            id="files"
            title="Files"
            description={PREFERENCE_SECTIONS[1].description}
          >
            <PreferenceRow
              label="Attachment Folder"
              hint="Used for Obsidian-style image references."
              control={(
                <input
                  type="text"
                  value={attachmentFolder}
                  onChange={(event) => setAttachmentFolder(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400"
                  placeholder="00- Attachment"
                />
              )}
            />
            <PreferenceRow
              label="Sort Files By"
              hint="Applies to the sidebar explorer."
              control={(
                <select
                  value={fileSortBy}
                  onChange={(event) => setFileSortBy(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 outline-none transition focus:border-blue-400"
                >
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                  <option value="modified">Modified Time</option>
                </select>
              )}
            />
            <PreferenceRow
              label="Auto Save"
              hint="Persist changes automatically after editing named documents."
              control={<Toggle checked={autoSaveEnabled} onChange={setAutoSaveEnabled} />}
            />
          </PreferenceSection>
          </div>
        </main>
      </div>
    </div>
  );
}
