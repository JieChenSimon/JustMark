import { useState, useCallback, useRef, useEffect } from 'react';
import { readDir, readTextFile, exists, stat, mkdir, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { ensureWebDAVConfigLoaded, hasWebDAVClient, uploadFile, listFiles, createDirectory, downloadFile, deleteFile } from '../utils/webdav';
import { useSettings } from './useSettings';

const WEBDAV_SYNC_STATE_KEY = 'webdav_sync_state_v2';
const SYNC_TOLERANCE_MS = 2000;

const buildSnapshotKey = ({ currentFolder, remoteFolder, url, username }) => (
  JSON.stringify({
    currentFolder,
    remoteFolder,
    url,
    username,
  })
);

const normalizeRemoteFolderBase = (folder = '/') => {
  const trimmed = (folder || '/').trim().replace(/\/+$/, '');
  return trimmed && trimmed !== '/' ? trimmed : '';
};

const joinRemotePath = (base, relativePath) => {
  const normalizedBase = normalizeRemoteFolderBase(base);
  return normalizedBase ? `${normalizedBase}/${relativePath}` : `/${relativePath}`;
};

const getParentPath = (path) => {
  const index = path.lastIndexOf('/');
  return index > 0 ? path.slice(0, index) : '';
};

const ensureLocalParentDir = async (filePath) => {
  const parent = getParentPath(filePath);
  if (parent) {
    await mkdir(parent, { recursive: true });
  }
};

const safeDecodeRemotePath = (path) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

const isTextSyncFile = (name) => /\.(md|markdown|txt)$/i.test(name);

const readAllSyncSnapshots = () => {
  try {
    return JSON.parse(localStorage.getItem(WEBDAV_SYNC_STATE_KEY) || '{}');
  } catch (error) {
    console.error('[Sync] Failed to read sync snapshots:', error);
    return {};
  }
};

const writeAllSyncSnapshots = (snapshots) => {
  localStorage.setItem(WEBDAV_SYNC_STATE_KEY, JSON.stringify(snapshots));
};

const createLocalSignature = (fileStat) => JSON.stringify({
  size: fileStat.size,
  mtime: fileStat.mtime ? new Date(fileStat.mtime).toISOString() : null,
});

const createRemoteSignature = (remoteFile) => JSON.stringify({
  size: remoteFile.size ?? 0,
  mtime: remoteFile.last_modified ?? null,
});

const parseSignature = (signature) => {
  if (!signature) {
    return null;
  }

  try {
    return JSON.parse(signature);
  } catch {
    return null;
  }
};

const signaturesCloseEnough = (localSignature, remoteSignature) => {
  const local = parseSignature(localSignature);
  const remote = parseSignature(remoteSignature);

  if (!local || !remote) {
    return false;
  }

  const localTime = local.mtime ? Date.parse(local.mtime) : null;
  const remoteTime = remote.mtime ? Date.parse(remote.mtime) : null;

  if (local.size !== remote.size) {
    return false;
  }

  if (localTime === null || remoteTime === null) {
    return false;
  }

  return Math.abs(localTime - remoteTime) <= SYNC_TOLERANCE_MS;
};

const signaturesMatch = (previousSignature, currentSignature) => (
  previousSignature === currentSignature || signaturesCloseEnough(previousSignature, currentSignature)
);

const createEmptySummary = () => ({
  uploadedNew: 0,
  uploadedUpdated: 0,
  downloadedNew: 0,
  downloadedUpdated: 0,
  deletedRemote: 0,
  deletedLocal: 0,
  skipped: 0,
  conflicts: [],
});

const createSummaryMessage = (summary) => {
  const parts = [];

  if (summary.uploadedNew) parts.push(`${summary.uploadedNew} uploaded`);
  if (summary.uploadedUpdated) parts.push(`${summary.uploadedUpdated} revised`);
  if (summary.downloadedNew) parts.push(`${summary.downloadedNew} downloaded`);
  if (summary.downloadedUpdated) parts.push(`${summary.downloadedUpdated} revised`);
  if (summary.deletedRemote) parts.push(`${summary.deletedRemote} deleted`);
  if (summary.conflicts.length) parts.push(`${summary.conflicts.length} conflicts`);

  return parts.length > 0 ? parts.join(' · ') : 'No changes';
};

const createConflictCopyPath = (filePath) => {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const extensionIndex = filePath.lastIndexOf('.');
  if (extensionIndex === -1) {
    return `${filePath}.remote-conflict-${timestamp}`;
  }

  return `${filePath.slice(0, extensionIndex)}.remote-conflict-${timestamp}${filePath.slice(extensionIndex)}`;
};

const toSnapshotEntry = (localFile, remoteFile) => ({
  localSignature: localFile?.signature ?? null,
  remoteSignature: remoteFile?.signature ?? null,
});

export function useWebDAVSync(currentFolder) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSyncSummary, setLastSyncSummary] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const cancelRef = useRef(false);
  const autoSyncKeyRef = useRef(null);
  const { syncMode, autoSyncOnLaunch } = useSettings();
  const isBackupMode = syncMode === 'backup' || syncMode === 'upload-only';

  const readDirRecursive = async (dirPath, baseDir) => {
    const results = [];
    const entries = await readDir(dirPath);

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = `${dirPath}/${entry.name}`;
      const relativePath = fullPath.replace(baseDir, '').replace(/^\//, '');

      if (entry.isDirectory) {
        const subResults = await readDirRecursive(fullPath, baseDir);
        results.push(...subResults);
      } else if (entry.isFile && isTextSyncFile(entry.name)) {
        const fileStat = await stat(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          relativePath,
          signature: createLocalSignature(fileStat),
          mtimeMs: fileStat.mtime ? new Date(fileStat.mtime).getTime() : 0,
          size: fileStat.size,
        });
      }
    }

    return results;
  };

  const listRemoteFilesRecursive = useCallback(async (remoteFolder) => {
    const files = [];
    const queue = [normalizeRemoteFolderBase(remoteFolder) || '/'];
    const visited = new Set();
    const rootPath = normalizeRemoteFolderBase(remoteFolder) || '/';

    while (queue.length > 0) {
      const batch = queue.splice(0, Math.min(queue.length, 5));
      const batchResults = await Promise.all(
        batch.map(async (currentPath) => {
          if (!currentPath || visited.has(currentPath)) return null;
          visited.add(currentPath);
          return { path: currentPath, entries: await listFiles(currentPath) };
        })
      );

      for (const result of batchResults) {
        if (!result) continue;
        const { entries } = result;

        for (const entry of entries) {
          const decodedPath = safeDecodeRemotePath(entry.path);
          const normalizedPath = decodedPath.replace(/\/+$/, '') || '/';

          if (normalizedPath === result.path.replace(/\/+$/, '') || normalizedPath === rootPath.replace(/\/+$/, '')) {
            continue;
          }

          if (entry.is_directory) {
            queue.push(normalizedPath);
            continue;
          }

          if (!isTextSyncFile(entry.name || normalizedPath)) {
            continue;
          }

          const relativePath = rootPath === '/'
            ? normalizedPath.replace(/^\//, '')
            : normalizedPath.replace(new RegExp(`^${rootPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`), '');

          files.push({
            name: entry.name,
            path: normalizedPath,
            relativePath,
            signature: createRemoteSignature(entry),
            mtimeMs: entry.last_modified ? Date.parse(entry.last_modified) : 0,
            size: entry.size ?? 0,
          });
        }
      }
    }

    return files;
  }, []);

  const startSync = useCallback(async () => {
    if (!hasWebDAVClient()) {
      console.warn('[Sync] WebDAV未配置');
      setLastSyncSummary('WebDAV not configured');
      return;
    }

    let currentFolder = localStorage.getItem('currentFolder');
    if (!currentFolder) {
      console.warn('[Sync] 请先打开一个文件夹');
      setLastSyncSummary('Open a folder first');
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
        setLastSyncSummary('Local folder missing');
        return;
      }

      const config = await ensureWebDAVConfigLoaded();
      if (!config) {
        console.warn('[Sync] WebDAV配置无效');
        setLastSyncSummary('Invalid WebDAV config');
        return;
      }

      const remoteFolder = normalizeRemoteFolderBase(config.folder) || '/';
      const snapshotKey = buildSnapshotKey({
        currentFolder,
        remoteFolder,
        url: config.url,
        username: config.username,
      });

      const allSnapshots = readAllSyncSnapshots();
      const previousSnapshot = allSnapshots[snapshotKey] || {};
      const nextSnapshot = {};
      const summary = createEmptySummary();

      const localFiles = await readDirRecursive(currentFolder, currentFolder);
      const remoteFiles = await listRemoteFilesRecursive(remoteFolder);

      // If remote is empty and we have a previous snapshot, reset local state
      if (remoteFiles.length === 0 && Object.keys(previousSnapshot).length > 0) {
        console.log('[Sync] Remote is empty, resetting local snapshot');
        allSnapshots[snapshotKey] = {};
        writeAllSyncSnapshots(allSnapshots);
      }

      const localByRelativePath = Object.fromEntries(localFiles.map((file) => [file.relativePath, file]));
      const remoteByRelativePath = Object.fromEntries(remoteFiles.map((file) => [file.relativePath, file]));
      const trackedPaths = new Set([
        ...Object.keys(previousSnapshot),
        ...Object.keys(localByRelativePath),
        ...Object.keys(remoteByRelativePath),
      ]);

      const operations = [];

      for (const relativePath of trackedPaths) {
        const localFile = localByRelativePath[relativePath] || null;
        const remoteFile = remoteByRelativePath[relativePath] || null;
        const previousEntry = previousSnapshot[relativePath] || null;
        const localChanged = localFile ? !previousEntry || !signaturesMatch(previousEntry.localSignature, localFile.signature) : false;
        const remoteChanged = remoteFile ? !previousEntry || !signaturesMatch(previousEntry.remoteSignature, remoteFile.signature) : false;

        if (localFile && remoteFile) {
          if (!previousEntry) {
            if (signaturesCloseEnough(localFile.signature, remoteFile.signature)) {
              nextSnapshot[relativePath] = toSnapshotEntry(localFile, remoteFile);
              summary.skipped += 1;
              continue;
            }

            if (localFile.mtimeMs > remoteFile.mtimeMs + SYNC_TOLERANCE_MS) {
              operations.push({ type: 'upload', relativePath, localFile, remoteFile, isNew: true });
            } else if (remoteFile.mtimeMs > localFile.mtimeMs + SYNC_TOLERANCE_MS) {
              operations.push({ type: 'download', relativePath, localFile, remoteFile, isNew: true });
            } else {
              operations.push({ type: 'conflict', relativePath, localFile, remoteFile });
            }
            continue;
          }

          if (localChanged && remoteChanged) {
            if (signaturesCloseEnough(localFile.signature, remoteFile.signature)) {
              nextSnapshot[relativePath] = toSnapshotEntry(localFile, remoteFile);
              summary.skipped += 1;
            } else {
              operations.push({ type: 'conflict', relativePath, localFile, remoteFile });
            }
          } else if (localChanged) {
            operations.push({ type: 'upload', relativePath, localFile, remoteFile, isNew: false });
          } else if (remoteChanged) {
            operations.push({ type: 'download', relativePath, localFile, remoteFile, isNew: false });
          } else {
            nextSnapshot[relativePath] = toSnapshotEntry(localFile, remoteFile);
            summary.skipped += 1;
          }
          continue;
        }

        if (localFile && !remoteFile) {
          operations.push({
            type: 'upload',
            relativePath,
            localFile,
            remoteFile: null,
            isNew: !previousEntry || !previousEntry.remoteSignature,
          });
          continue;
        }

        if (!localFile && remoteFile) {
          if (isBackupMode) {
            nextSnapshot[relativePath] = {
              localSignature: null,
              remoteSignature: remoteFile.signature,
            };
            summary.skipped += 1;
          } else if (!previousEntry || !previousEntry.localSignature) {
            operations.push({ type: 'download', relativePath, localFile: null, remoteFile });
          } else if (remoteChanged) {
            operations.push({ type: 'download', relativePath, localFile: null, remoteFile });
          } else {
            // Phase 0 safety stop: never infer a remote delete from a missing local file.
            nextSnapshot[relativePath] = {
              localSignature: null,
              remoteSignature: remoteFile.signature,
            };
            summary.skipped += 1;
          }
        }
      }

      const dirsToCreate = new Set();
      for (const file of localFiles) {
        const dirPath = file.relativePath.split('/').slice(0, -1).join('/');
        if (!dirPath) {
          continue;
        }

        let currentPath = '';
        for (const dir of dirPath.split('/')) {
          currentPath = currentPath ? `${currentPath}/${dir}` : dir;
          dirsToCreate.add(joinRemotePath(remoteFolder, currentPath));
        }
      }

      for (const dir of dirsToCreate) {
        try {
          await createDirectory(dir);
        } catch {
          // Directory may already exist remotely.
        }
      }

      if (operations.length === 0) {
        allSnapshots[snapshotKey] = nextSnapshot;
        writeAllSyncSnapshots(allSnapshots);
        setSyncProgress(100);
        setLastSyncSummary('No changes');
        console.log('[Sync] No changes detected');
        return;
      }

      console.log('[Sync] Operations:', operations.map(op => `${op.type}: ${op.relativePath}`).join(', '));

      const BATCH_SIZE = 10;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        if (cancelRef.current) {
          console.log('[Sync] 已取消同步');
          break;
        }

        const batch = operations.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (operation) => {
          const remotePath = joinRemotePath(remoteFolder, operation.relativePath);
          const localPath = `${currentFolder}/${operation.relativePath}`;

          try {
            if (operation.type === 'upload') {
              const content = await readTextFile(operation.localFile.path);
              await uploadFile(operation.localFile.path, remotePath, content);
              if (operation.isNew) {
                summary.uploadedNew += 1;
              } else {
                summary.uploadedUpdated += 1;
              }
              nextSnapshot[operation.relativePath] = toSnapshotEntry(operation.localFile, {
                ...operation.remoteFile,
                path: remotePath,
                signature: operation.localFile.signature,
              });
            } else if (operation.type === 'download') {
              const content = await downloadFile(remotePath);
              await ensureLocalParentDir(localPath);
              await writeTextFile(localPath, content);
              const localStat = await stat(localPath);
              const downloadedLocal = {
                path: localPath,
                relativePath: operation.relativePath,
                signature: createLocalSignature(localStat),
              };
              if (operation.isNew) {
                summary.downloadedNew += 1;
              } else {
                summary.downloadedUpdated += 1;
              }
              nextSnapshot[operation.relativePath] = {
                localSignature: downloadedLocal.signature,
                remoteSignature: operation.remoteFile.signature,
              };
            } else if (operation.type === 'deleteRemote') {
              await deleteFile(remotePath);
              summary.deletedRemote += 1;
            } else if (operation.type === 'deleteLocal') {
              await remove(localPath);
              summary.deletedLocal += 1;
            } else if (operation.type === 'conflict') {
              const remoteContent = await downloadFile(remotePath);
              const conflictPath = createConflictCopyPath(localPath);
              await ensureLocalParentDir(conflictPath);
              await writeTextFile(conflictPath, remoteContent);
              summary.conflicts.push({ relativePath: operation.relativePath, conflictPath });
              nextSnapshot[operation.relativePath] = toSnapshotEntry(operation.localFile, operation.remoteFile);
            }
          } catch (error) {
            console.error(`[Sync] Operation failed for ${operation.relativePath}:`, error);
          }
        }));

        setSyncProgress(Math.round(((i + batch.length) / operations.length) * 100));
        setLastSyncSummary(createSummaryMessage(summary));
      }

      if (!cancelRef.current) {
        allSnapshots[snapshotKey] = nextSnapshot;
        writeAllSyncSnapshots(allSnapshots);
      }

      const message = createSummaryMessage(summary);
      setLastSyncSummary(message);
      setLastSyncAt(Date.now());
      console.log('[Sync] Summary:', message);

      if (summary.conflicts.length > 0) {
        const conflictLines = summary.conflicts
          .slice(0, 5)
          .map((item) => `${item.relativePath} -> ${item.conflictPath.split('/').pop()}`)
          .join('\n');

        window.alert(
          `WebDAV sync finished with ${summary.conflicts.length} conflict(s).\n\nRemote copies were saved next to your local files:\n${conflictLines}`
        );
      }
    } catch (error) {
      console.error('[Sync] Failed:', error);
      setLastSyncSummary(error instanceof Error ? error.message : 'Sync failed');
      setLastSyncAt(Date.now());
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      }, 500);
    }
  }, [isBackupMode, listRemoteFilesRecursive]);

  useEffect(() => {
    if (!autoSyncOnLaunch || !currentFolder || isSyncing || !hasWebDAVClient()) {
      return;
    }

    let cancelled = false;

    void ensureWebDAVConfigLoaded().then((config) => {
      if (!config || cancelled) {
        return;
      }

      const autoKey = buildSnapshotKey({
        currentFolder,
        remoteFolder: normalizeRemoteFolderBase(config.folder) || '/',
        url: config.url,
        username: config.username,
      });

      if (autoSyncKeyRef.current === autoKey) {
        return;
      }

      autoSyncKeyRef.current = autoKey;
      void startSync();
    });

    return () => {
      cancelled = true;
    };
  }, [autoSyncOnLaunch, currentFolder, isSyncing, startSync]);

  const cancelSync = useCallback(() => {
    cancelRef.current = true;
  }, []);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  return { isSyncing, syncProgress, startSync, cancelSync, lastSyncSummary, lastSyncAt, syncMode };
}
