import {
  IconDocument,
  IconExport,
  IconFolder,
  IconMinus,
  IconPlus,
  IconPreview,
  IconSave,
  IconSidebar,
  IconWindowClose,
  IconWindowMaximize,
  IconWindowMinimize
} from '../icons/AppIcons';
import { HEADER_HEIGHT } from '../../constants/theme';

export default function AppToolbar({
  currentFilePath,
  currentFolder,
  hasUnsavedChanges,
  previewVisible,
  sidebarVisible,
  isExporting,
  onNew,
  onOpen,
  onSave,
  onExportPDF,
  onExportDOCX,
  onToggleSidebar,
  onTogglePreview,
  onDecreaseFontSize,
  onIncreaseFontSize,
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
        <div className="jm-toolbar-group">
          <button onClick={onNew} className="jm-button jm-button-primary"><IconDocument className="mr-1.5 h-4 w-4" />New</button>
          <button onClick={onOpen} className="jm-button"><IconFolder className="mr-1.5 h-4 w-4" />Open</button>
          <button onClick={onSave} className="jm-button"><IconSave className="mr-1.5 h-4 w-4" />Save</button>
        </div>
      </div>

      <div className="flex-1 flex justify-center px-4">
        <div className="jm-title-badge max-w-[420px]">
          <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <IconDocument className="h-4 w-4" />
          </div>
          <div className="min-w-0 text-center">
            <div className="truncate text-[12px] font-semibold text-slate-800">
              {currentFilePath ? currentFilePath.split('/').pop() : 'Untitled'}
            </div>
            <div className="truncate text-[10px] text-slate-500">
              {hasUnsavedChanges ? 'Edited, not yet saved' : currentFolder ? currentFolder.split('/').pop() : 'JustMark Document'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="jm-toolbar-group">
          <button onClick={onExportPDF} disabled={isExporting || !previewVisible} className="jm-button disabled:opacity-50"><IconExport className="mr-1.5 h-4 w-4" />PDF</button>
          <button onClick={onExportDOCX} disabled={isExporting} className="jm-button disabled:opacity-50"><IconExport className="mr-1.5 h-4 w-4" />Word</button>
        </div>
        <div className="jm-toolbar-group">
          <button onClick={onToggleSidebar} className="jm-button"><IconSidebar className="mr-1.5 h-4 w-4" />{sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}</button>
          <button onClick={onTogglePreview} className="jm-button"><IconPreview className="mr-1.5 h-4 w-4" />{previewVisible ? 'Hide Preview' : 'Show Preview'}</button>
          <button onClick={onDecreaseFontSize} className="jm-button"><IconMinus className="h-4 w-4" /></button>
          <button onClick={onIncreaseFontSize} className="jm-button"><IconPlus className="h-4 w-4" /></button>
        </div>
      </div>
    </header>
  );
}
