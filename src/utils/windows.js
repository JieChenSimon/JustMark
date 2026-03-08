import { Window } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const PREFERENCES_WINDOW_LABEL = 'preferences';

export async function openPreferencesWindow() {
  const existingWindow = await WebviewWindow.getByLabel(PREFERENCES_WINDOW_LABEL);
  if (existingWindow) {
    await existingWindow.show();
    await existingWindow.unminimize();
    await existingWindow.setFocus();
    return existingWindow;
  }

  const preferencesWindow = new WebviewWindow(PREFERENCES_WINDOW_LABEL, {
    title: 'Settings',
    url: `${window.location.pathname || '/'}#preferences`,
    width: 720,
    height: 560,
    minWidth: 640,
    minHeight: 480,
    center: true,
    resizable: true,
    maximizable: false,
    minimizable: false,
    visible: true,
    decorations: true,
    titleBarStyle: 'visible'
  });

  void preferencesWindow.once('tauri://error', (event) => {
    console.error('创建 Settings 窗口失败:', event.payload);
  });

  return preferencesWindow;
}

export function openDocumentWindow() {
  const label = `document-${Date.now()}`;
  const documentWindow = new WebviewWindow(label, {
    title: 'JustMark',
    url: window.location.pathname || '/',
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    center: true,
    resizable: true,
    titleBarStyle: 'Overlay',
    hiddenTitle: true,
    decorations: true
  });

  void documentWindow.once('tauri://error', (event) => {
    console.error('创建新窗口失败:', event.payload);
  });

  return documentWindow;
}

export async function bringAllToFront() {
  const windows = await Window.getAll();
  await Promise.all(windows.map(async (currentWindow) => {
    if (await currentWindow.isMinimized()) {
      await currentWindow.unminimize();
    }
    if (!(await currentWindow.isVisible())) {
      await currentWindow.show();
    }
    await currentWindow.setFocus();
  }));
}
