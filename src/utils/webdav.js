import { createClient } from 'webdav';

let client = null;

export const initWebDAV = (url, username, password) => {
  try {
    client = createClient(url, {
      username,
      password
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const uploadFile = async (localPath, remotePath, content) => {
  if (!client) throw new Error('WebDAV not initialized');
  await client.putFileContents(remotePath, content);
};

export const downloadFile = async (remotePath) => {
  if (!client) throw new Error('WebDAV not initialized');
  return await client.getFileContents(remotePath, { format: 'text' });
};

export const listFiles = async (remotePath = '/') => {
  if (!client) throw new Error('WebDAV not initialized');
  return await client.getDirectoryContents(remotePath);
};

export const deleteFile = async (remotePath) => {
  if (!client) throw new Error('WebDAV not initialized');
  await client.deleteFile(remotePath);
};

export const createDirectory = async (remotePath) => {
  if (!client) throw new Error('WebDAV not initialized');
  await client.createDirectory(remotePath);
};
