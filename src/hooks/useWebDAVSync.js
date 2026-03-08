import { useState } from 'react';
import { createDirectory, downloadFile, uploadFile } from '../utils/webdav';

export default function useWebDAVSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const syncToWebDAV = async (remotePath, content) => {
    setSyncing(true);
    try {
      const normalizedPath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
      const lastSlashIndex = normalizedPath.lastIndexOf('/');
      const directoryPath = lastSlashIndex > 0 ? normalizedPath.substring(0, lastSlashIndex) : '/';

      if (directoryPath && directoryPath !== '/') {
        await createDirectory(directoryPath);
      }

      await uploadFile(null, normalizedPath, content);
      setLastSync(new Date());
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  };

  const syncFromWebDAV = async (remotePath) => {
    setSyncing(true);
    try {
      const normalizedPath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
      const content = await downloadFile(normalizedPath);
      setLastSync(new Date());
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  };

  return { syncing, lastSync, syncToWebDAV, syncFromWebDAV };
}
