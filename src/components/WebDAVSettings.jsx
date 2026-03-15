import { useState } from 'react';
import { prepareWebDAVConfig, saveWebDAVConfig, testConnection } from '../utils/webdav';

export default function WebDAVSettings({ initialConfig, onClose, onSave }) {
  const [url, setUrl] = useState(initialConfig?.url || '');
  const [username, setUsername] = useState(initialConfig?.username || '');
  const [password, setPassword] = useState(initialConfig?.password || '');
  const [status, setStatus] = useState('');

  const handleConnect = async () => {
    const result = prepareWebDAVConfig(url, username, password);
    if (!result.success) {
      setStatus('❌ 连接失败: ' + result.error);
      return;
    }

    try {
      await testConnection(result.config);
      const config = saveWebDAVConfig({ ...result.config, connected: true });
      setStatus('✅ 连接成功');
      onSave?.(config);
      setTimeout(onClose, 1000);
    } catch (error) {
      setStatus(`❌ 连接失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
        <h2 className="text-xl font-bold mb-4">WebDAV 设置</h2>
        
        <input
          type="text"
          placeholder="服务器地址 (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-2 mb-3 border rounded dark:bg-gray-700"
        />
        
        <input
          type="text"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 mb-3 border rounded dark:bg-gray-700"
        />
        
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-3 border rounded dark:bg-gray-700"
        />
        
        {status && <p className="mb-3 text-sm">{status}</p>}
        
        <div className="flex gap-2">
          <button onClick={handleConnect} className="flex-1 bg-blue-500 text-white p-2 rounded">
            连接
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-300 p-2 rounded">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
