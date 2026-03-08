import { useEffect, useRef } from 'react';
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';

const formatRecentFileLabel = (path) => {
  const segments = path.split('/').filter(Boolean);
  const fileName = segments.at(-1) || path;
  const parentName = segments.at(-2);

  return parentName ? `${fileName} — ${parentName}` : fileName;
};

export function useAppMenu(actions, recentFiles) {
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    let cancelled = false;

    const setupMenu = async () => {
      try {
        const openRecentSubmenu = await Submenu.new({
          text: 'Open Recent',
          items: recentFiles.length > 0
            ? [
                ...await Promise.all(recentFiles.map((path, index) => MenuItem.new({
                  text: formatRecentFileLabel(path),
                  id: `file-open-recent-${index}`,
                  action: () => actionsRef.current.openRecentFile?.(path)
                }))),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await MenuItem.new({
                  text: 'Clear Menu',
                  id: 'file-open-recent-clear',
                  action: () => actionsRef.current.clearRecentFiles?.()
                })
              ]
            : [
                await MenuItem.new({
                  text: 'No Recent Documents',
                  id: 'file-open-recent-empty',
                  enabled: false
                })
              ]
        });

        const appSubmenu = await Submenu.new({
          text: 'JustMark',
          items: [
            await PredefinedMenuItem.new({
              item: {
                About: {
                  name: 'JustMark',
                  version: '0.1.1',
                  copyright: 'Simon Chen'
                }
              }
            }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Services' }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Hide' }),
            await PredefinedMenuItem.new({ item: 'HideOthers' }),
            await PredefinedMenuItem.new({ item: 'ShowAll' }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Preferences...', id: 'app-preferences', accelerator: 'CmdOrCtrl+,', action: () => actionsRef.current.openPreferences?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Quit' })
          ]
        });

        const fileSubmenu = await Submenu.new({
          text: 'File',
          items: [
            await MenuItem.new({ text: 'New', id: 'file-new', accelerator: 'CmdOrCtrl+N', action: () => actionsRef.current.newDocument?.() }),
            await MenuItem.new({ text: 'New Window', id: 'file-new-window', accelerator: 'CmdOrCtrl+Shift+N', action: () => actionsRef.current.newWindow?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Open...', id: 'file-open', accelerator: 'CmdOrCtrl+O', action: () => actionsRef.current.openFile?.() }),
            await MenuItem.new({ text: 'Open Folder...', id: 'file-open-folder', accelerator: 'CmdOrCtrl+Shift+O', action: () => actionsRef.current.openFolder?.() }),
            openRecentSubmenu,
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Save', id: 'file-save', accelerator: 'CmdOrCtrl+S', action: () => actionsRef.current.save?.() }),
            await MenuItem.new({ text: 'Save As...', id: 'file-save-as', accelerator: 'CmdOrCtrl+Shift+S', action: () => actionsRef.current.saveAs?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Export as PDF…', id: 'file-export-pdf', action: () => actionsRef.current.exportPDF?.() }),
            await MenuItem.new({ text: 'Export as Word…', id: 'file-export-docx', action: () => actionsRef.current.exportDOCX?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Close Window', id: 'file-close', accelerator: 'CmdOrCtrl+W', action: () => actionsRef.current.closeWindow?.() })
          ]
        });

        const editSubmenu = await Submenu.new({
          text: 'Edit',
          items: [
            await PredefinedMenuItem.new({ item: 'Undo' }),
            await PredefinedMenuItem.new({ item: 'Redo' }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'Cut' }),
            await PredefinedMenuItem.new({ item: 'Copy' }),
            await PredefinedMenuItem.new({ item: 'Paste' }),
            await MenuItem.new({ text: 'Paste and Match Style', id: 'edit-paste-plain', accelerator: 'CmdOrCtrl+Shift+V', action: () => actionsRef.current.pastePlainText?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Find…', id: 'edit-find', accelerator: 'CmdOrCtrl+F', action: () => actionsRef.current.openFind?.() }),
            await MenuItem.new({ text: 'Find Next', id: 'edit-find-next', accelerator: 'CmdOrCtrl+G', action: () => actionsRef.current.findNext?.() }),
            await MenuItem.new({ text: 'Find Previous', id: 'edit-find-previous', accelerator: 'CmdOrCtrl+Shift+G', action: () => actionsRef.current.findPrevious?.() }),
            await MenuItem.new({ text: 'Replace…', id: 'edit-replace', accelerator: 'CmdOrCtrl+Alt+F', action: () => actionsRef.current.openReplace?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await PredefinedMenuItem.new({ item: 'SelectAll' })
          ]
        });

        const viewSubmenu = await Submenu.new({
          text: 'View',
          items: [
            await MenuItem.new({ text: 'Toggle Sidebar', id: 'view-sidebar', accelerator: 'CmdOrCtrl+\\', action: () => actionsRef.current.toggleSidebar?.() }),
            await MenuItem.new({ text: 'Toggle Preview', id: 'view-preview', accelerator: 'CmdOrCtrl+Shift+\\', action: () => actionsRef.current.togglePreview?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Increase Text Size', id: 'view-font-increase', accelerator: 'CmdOrCtrl+=', action: () => actionsRef.current.increaseFont?.() }),
            await MenuItem.new({ text: 'Decrease Text Size', id: 'view-font-decrease', accelerator: 'CmdOrCtrl+-', action: () => actionsRef.current.decreaseFont?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Toggle Appearance', id: 'view-theme', accelerator: 'CmdOrCtrl+Alt+T', action: () => actionsRef.current.toggleTheme?.() })
          ]
        });

        const windowSubmenu = await Submenu.new({
          text: 'Window',
          items: [
            await PredefinedMenuItem.new({ item: 'Minimize' }),
            await MenuItem.new({ text: 'Zoom', id: 'window-zoom', accelerator: 'Ctrl+Cmd+F', action: () => actionsRef.current.maximizeWindow?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Bring All to Front', id: 'window-bring-all-to-front', action: () => actionsRef.current.bringAllToFront?.() }),
            await PredefinedMenuItem.new({ item: 'Separator' }),
            await MenuItem.new({ text: 'Close', id: 'window-close', accelerator: 'CmdOrCtrl+W', action: () => actionsRef.current.closeWindow?.() })
          ]
        });

        const helpSubmenu = await Submenu.new({
          text: 'Help',
          items: [
            await MenuItem.new({
              text: 'JustMark Help',
              id: 'help-justmark'
            })
          ]
        });

        const appMenu = await Menu.new({
          items: [appSubmenu, fileSubmenu, editSubmenu, viewSubmenu, windowSubmenu, helpSubmenu]
        });

        if (cancelled) return;

        await appMenu.setAsAppMenu();
        await helpSubmenu.setAsHelpMenuForNSApp().catch(() => {});
        await windowSubmenu.setAsWindowsMenuForNSApp().catch(() => {});
      } catch (error) {
        console.error('Failed to initialize app menu:', error);
      }
    };

    void setupMenu();

    return () => {
      cancelled = true;
    };
  }, [recentFiles]);
}
