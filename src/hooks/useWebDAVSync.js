import { useState, useCallback, useRef } from 'react';
import { readDir, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { hasWebDAVClient, readSavedWebDAVConfig, uploadFile, listFiles, createDirectory } from '../utils/webdav';

export function useWebDAVSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const cancelRef = useRef(false);

  const readDirRecursive = async (dirPath, baseDir) => {
    const results = [];
    const entries = await readDir(dirPath);

    for (const entry of entries) {
      // 跳过隐藏文件和文件夹（以.开头）
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = `${dirPath}/${entry.name}`;
      const relativePath = fullPath.replace(baseDir, '').replace(/^\//, '');

      if (entry.isDirectory) {
        const subResults = await readDirRecursive(fullPath, baseDir);
        results.push(...subResults);
      } else if (entry.isFile && /\.(md|markdown|txt)$/i.test(entry.name)) {
        results.push({
          name: entry.name,
          path: fullPath,
          relativePath: relativePath
        });
      }
    }

    return results;
  };

  const startSync = useCallback(async () => {
    if (!hasWebDAVClient()) {
      console.warn('[Sync] WebDAV未配置');
      return;
    }

    let currentFolder = localStorage.getItem('currentFolder');
    if (!currentFolder) {
      console.warn('[Sync] 请先打开一个文件夹');
      return;
    }

    currentFolder = currentFolder.replace(/^"(.*)"$/, '$1');

    setIsSyncing(true);
    setSyncProgress(0);
    cancelRef.current = false;

    try {
      const pathExists = await exists(currentFolder);
      if (!pathExists) {
        console.error('[Sync] 路径不存在');
        return;
      }

      const config = readSavedWebDAVConfig();
      if (!config) {
        console.warn('[Sync] WebDAV配置无效');
        return;
      }

      const remoteFolder = (config.folder || '/').replace(/\/$/, '');

      const files = await readDirRecursive(currentFolder, currentFolder);
      console.log('[Sync] Total files found:', files.length);
      console.log('[Sync] First 3 files:', JSON.stringify(files.slice(0, 3), null, 2));

      if (files.length === 0) {
        console.warn('[Sync] 无可同步文件');
        setIsSyncing(false);
        return;
      }

      // 获取远程文件列表用于增量同步
      let remoteFiles = {};
      try {
        const remoteList = await listFiles(remoteFolder);
        remoteFiles = Object.fromEntries(remoteList.map(f => [f.name, f]));
      } catch (e) {
        console.warn('[Sync] 无法获取远程文件列表，将上传所有文件');
      }

      // 收集需要创建的目录
      const dirsToCreate = new Set();
      for (const file of files) {
        const dirPath = file.relativePath.split('/').slice(0, -1).join('/');
        if (dirPath) {
          let currentPath = '';
          for (const dir of dirPath.split('/')) {
            currentPath = currentPath ? `${currentPath}/${dir}` : dir;
            dirsToCreate.add(`${remoteFolder}/${currentPath}`);
          }
        }
      }

      // 创建目录
      for (const dir of dirsToCreate) {
        try {
          await createDirectory(dir);
        } catch (e) {
          // 目录可能已存在
        }
      }

      let uploadCount = 0;
      for (let i = 0; i < files.length; i++) {
        if (cancelRef.current) {
          console.log('[Sync] 已取消同步');
          break;
        }

        const file = files[i];
        const remotePath = `${remoteFolder}/${file.relativePath}`;

        try {
          const content = await readTextFile(file.path);
          await uploadFile(file.path, remotePath, content);
          uploadCount++;
          setSyncProgress(Math.round(((i + 1) / files.length) * 100));
        } catch (error) {
          console.error(`[Sync] 上传失败: ${file.name}`, error);
          // 继续上传其他文件
        }
      }

      if (cancelRef.current) {
        console.log(`[Sync] 已取消，已上传 ${uploadCount}/${files.length} 个文件`);
      } else {
        console.log(`[Sync] 完成！上传 ${uploadCount} 个文件`);
      }
    } catch (error) {
      console.error('[Sync] Failed:', error);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      }, 500);
    }
  }, []);

  const cancelSync = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return { isSyncing, syncProgress, startSync, cancelSync };
}
