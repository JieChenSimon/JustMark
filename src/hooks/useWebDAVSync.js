import { useState, useEffect } from 'react';
import { uploadFile, downloadFile, listFiles } from '../utils/webdav';

export default function useWebDAVSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const syncToWebDAV = async (filename, content) => {
    setSyncing(true);
    try {
      await uploadFile(null, `/JustMark/${filename}`, content);
      setLastSync(new Date());
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  };

  const syncFromWebDAV = async (filename) => {
    setSyncing(true);
    try {
      const content = await downloadFile(`/JustMark/${filename}`);
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
