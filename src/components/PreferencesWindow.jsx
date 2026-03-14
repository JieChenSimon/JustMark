import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { BACKGROUND_COLORS, FONT_FAMILIES, FONT_OPTIONS } from '../constants/theme';
import { initWebDAV, readSavedWebDAVConfig, saveWebDAVConfig, testConnection } from '../utils/webdav';

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
  },
  {
    id: 'sync',
    title: 'Sync',
    description: 'Configure WebDAV synchronization for your documents.'
  }
];

function PreferenceSection({ id, title, description, children, statusIndicator }) {
  return (
    <section id={id} className="border-b border-gray-200/80 pb-6">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
          {statusIndicator}
        </div>
        {description ? <p className="mt-1 text-[12px] text-slate-600">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PreferenceRow({ label, hint, control }) {
  return (
    <div className="grid gap-3 md:grid-cols-[200px_minmax(0,1fr)] md:items-start md:py-2">
      <div className="pt-1.5">
        <div className="text-[13px] font-medium text-slate-900">{label}</div>
        {hint ? <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{hint}</div> : null}
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
      className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-[#007AFF]' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
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
    setFileSortBy,
    showHiddenFiles,
    setShowHiddenFiles,
    hiddenFilesWhitelist,
    setHiddenFilesWhitelist
  } = useSettings();

  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [webdavFolder, setWebdavFolder] = useState('/');
  const [webdavStatus, setWebdavStatus] = useState('');
  const [webdavConnected, setWebdavConnected] = useState(false);
  const [newWhitelistItem, setNewWhitelistItem] = useState('');

  useEffect(() => {
    const savedConfig = readSavedWebDAVConfig();
    if (savedConfig) {
      setWebdavUrl(savedConfig.url || '');
      setWebdavUsername(savedConfig.username || '');
      setWebdavPassword(savedConfig.password || '');
      setWebdavFolder(savedConfig.folder || '/');
      setWebdavConnected(savedConfig.connected || false);
    }
  }, []);

  const handleWebDAVConnect = async () => {
    setWebdavStatus('Connecting...');

    const result = initWebDAV(webdavUrl, webdavUsername, webdavPassword, webdavFolder);
    if (!result.success) {
      setWebdavConnected(false);
      setWebdavStatus('❌ Failed: ' + result.error);
      return;
    }

    try {
      await testConnection(result.config);

      const config = saveWebDAVConfig({ ...result.config, connected: true });
      setWebdavConnected(true);
      setWebdavStatus('✅ Connected');
      setTimeout(() => setWebdavStatus(''), 3000);
    } catch (error) {
      console.error('[Connect] Test failed:', error);
      setWebdavConnected(false);
      setWebdavStatus(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#ececec] text-slate-900">
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <header className="border-b border-gray-300/50 bg-white/95 px-6 py-3 backdrop-blur-sm">
          <div className="text-[15px] font-semibold text-slate-900">Settings</div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
          <aside className="border-r border-gray-300/50 bg-white/60 backdrop-blur-sm">
            <nav className="space-y-0.5 px-3 py-4">
              {PREFERENCE_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-md px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-gray-200/60"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-h-0 overflow-y-auto bg-white/40 backdrop-blur-sm">
            <div className="space-y-6 px-8 py-6">
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
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
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
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
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
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
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
                    <div className="grid grid-cols-2 gap-2 max-w-md">
                      {BACKGROUND_COLORS.map((option, index) => (
                        <button
                          key={option.name}
                          type="button"
                          onClick={() => setBgColorIndex(index)}
                          className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                            bgColorIndex === index ? 'border-[#007AFF] ring-2 ring-[#007AFF]/30' : 'border-gray-300 hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: option.bg, color: option.text }}
                        >
                          <div className="text-[12px] font-semibold">{option.name}</div>
                          <div className="mt-0.5 text-[11px] opacity-70">{option.description}</div>
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
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
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
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
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
                <PreferenceRow
                  label="Show Hidden Files"
                  hint="Display files and folders starting with a dot (e.g., .git, .DS_Store)."
                  control={<Toggle checked={showHiddenFiles} onChange={setShowHiddenFiles} />}
                />
                {!showHiddenFiles && (
                  <PreferenceRow
                    label="Hidden Files Whitelist"
                    hint="Specific hidden files/folders to always show (e.g., .obsidian)."
                    control={(
                      <div className="w-full max-w-md space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newWhitelistItem}
                            onChange={(e) => setNewWhitelistItem(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newWhitelistItem.trim()) {
                                e.preventDefault();
                                const item = newWhitelistItem.trim();
                                if (!hiddenFilesWhitelist.includes(item)) {
                                  setHiddenFilesWhitelist([...hiddenFilesWhitelist, item]);
                                }
                                setNewWhitelistItem('');
                              }
                            }}
                            className="flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
                            placeholder=".obsidian"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const item = newWhitelistItem.trim();
                              if (item && !hiddenFilesWhitelist.includes(item)) {
                                setHiddenFilesWhitelist([...hiddenFilesWhitelist, item]);
                                setNewWhitelistItem('');
                              }
                            }}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-900 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
                          >
                            Add
                          </button>
                        </div>
                        {hiddenFilesWhitelist.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {hiddenFilesWhitelist.map((item) => (
                              <div
                                key={item}
                                className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-[12px] text-slate-700"
                              >
                                <span className="font-mono">{item}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHiddenFilesWhitelist(hiddenFilesWhitelist.filter((i) => i !== item));
                                  }}
                                  className="text-slate-400 hover:text-slate-600"
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  />
                )}
              </PreferenceSection>

              <PreferenceSection
                id="sync"
                title="Sync"
                description={PREFERENCE_SECTIONS[2].description}
                statusIndicator={
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${webdavConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-[11px] text-slate-500">
                      {webdavConnected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                }
              >
                <PreferenceRow
                  label="Server URL"
                  hint="WebDAV server address (https://...)"
                  control={(
                    <input
                      type="text"
                      value={webdavUrl}
                      onChange={(e) => setWebdavUrl(e.target.value)}
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
                      placeholder="https://example.com/webdav"
                    />
                  )}
                />
                <PreferenceRow
                  label="Username"
                  hint="WebDAV account username"
                  control={(
                    <input
                      type="text"
                      value={webdavUsername}
                      onChange={(e) => setWebdavUsername(e.target.value)}
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
                      placeholder="username"
                    />
                  )}
                />
                <PreferenceRow
                  label="Password"
                  hint="WebDAV account password"
                  control={(
                    <input
                      type="password"
                      value={webdavPassword}
                      onChange={(e) => setWebdavPassword(e.target.value)}
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
                      placeholder="••••••••"
                    />
                  )}
                />
                <PreferenceRow
                  label="Remote Folder"
                  hint="Remote path for syncing documents"
                  control={(
                    <input
                      type="text"
                      value={webdavFolder}
                      onChange={(e) => setWebdavFolder(e.target.value)}
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-gray-400 focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
                      placeholder="/Documents"
                    />
                  )}
                />
                <PreferenceRow
                  label="Connection"
                  hint="Test and save WebDAV configuration"
                  control={(
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleWebDAVConnect}
                        className="rounded-md bg-[#007AFF] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#0051D5]"
                      >
                        Connect
                      </button>
                      {webdavStatus && <span className="text-[12px] text-slate-600">{webdavStatus}</span>}
                    </div>
                  )}
                />
              </PreferenceSection>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
