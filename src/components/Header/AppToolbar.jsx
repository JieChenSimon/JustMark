import {
  IconDocument,
  IconMoon,
  IconSun,
  IconWindowClose,
  IconWindowMaximize,
  IconWindowMinimize
} from '../icons/AppIcons';
import { HEADER_HEIGHT } from '../../constants/theme';

export default function AppToolbar({
  currentFilePath,
  currentFolder,
  hasUnsavedChanges,
  isDarkMode,
  onToggleTheme,
  onCloseWindow,
  onMinimizeWindow,
  onToggleMaximizeWindow
}) {
  return (
    <header className={`jm-toolbar ${HEADER_HEIGHT}`} data-tauri-drag-region>
      <div className="flex items-center gap-3">
        <div className="jm-traffic-lights">
          <button className="jm-traffic-dot bg-[#ff5f57] flex items-center justify-center text-[8px] text-[#7a1d1d]" onClick={onCloseWindow}>
            <IconWindowClose className="h-2 w-2" />
          </button>
          <button className="jm-traffic-dot bg-[#febc2e] flex items-center justify-center text-[8px] text-[#7a5516]" onClick={onMinimizeWindow}>
            <IconWindowMinimize className="h-2 w-2" />
          </button>
          <button className="jm-traffic-dot bg-[#28c840] flex items-center justify-center text-[8px] text-[#14532d]" onClick={onToggleMaximizeWindow}>
            <IconWindowMaximize className="h-2 w-2" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex justify-center px-4">
        <div className="jm-title-badge max-w-[360px] gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg text-black/30 dark:text-white/28">
            <IconDocument className="h-4 w-4" />
          </div>
          <div className="min-w-0 text-center">
            <div className="truncate text-[12px] font-medium text-[color:var(--jm-text)]">
              {currentFilePath ? currentFilePath.split('/').pop() : 'Untitled'}
            </div>
            <div className="truncate text-[10px] text-black/32 dark:text-white/28">
              {hasUnsavedChanges ? 'Unsaved changes' : currentFolder ? currentFolder.split('/').pop() : 'Writing Space'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onToggleTheme} className="jm-button" title={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
          {isDarkMode ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
