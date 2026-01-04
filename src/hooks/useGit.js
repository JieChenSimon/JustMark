import { useState, useEffect, useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';

/**
 * Git Hook - 使用 Tauri 的 shell 插件执行 git 命令
 * 提供 macOS 风格的 Git 集成功能
 */
export function useGit(repositoryPath) {
  const [status, setStatus] = useState(null);
  const [branch, setBranch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isGitRepo, setIsGitRepo] = useState(false); // New state to track if it's a git repo

  // 执行 git 命令
  const executeGitCommand = useCallback(async (args) => {
    if (!repositoryPath) {
      throw new Error('No repository path specified');
    }

    try {
      const command = Command.create('git', args, {
        cwd: repositoryPath
      });

      const output = await command.execute();

      if (output.code !== 0) {
        throw new Error(output.stderr || 'Git command failed');
      }

      return output.stdout;
    } catch (err) {
      // Silently handle git errors (likely not a git repository)
      console.debug('Git command failed:', err.message);
      throw err;
    }
  }, [repositoryPath]);

  // 获取当前分支
  const getCurrentBranch = useCallback(async () => {
    try {
      const output = await executeGitCommand(['branch', '--show-current']);
      return output.trim();
    } catch (err) {
      console.error('Failed to get current branch:', err);
      return '';
    }
  }, [executeGitCommand]);

  // 获取 Git 状态
  const getStatus = useCallback(async () => {
    if (!repositoryPath) return null;

    setIsLoading(true);
    setError(null);

    try {
      // 获取状态信息
      const output = await executeGitCommand(['status', '--porcelain', '-u']);
      const branchName = await getCurrentBranch();

      // 解析状态
      const files = output.split('\n').filter(line => line.trim()).map(line => {
        const status = line.substring(0, 2);
        const filePath = line.substring(3);

        return {
          path: filePath,
          status: parseFileStatus(status),
          statusCode: status
        };
      });

      const statusData = {
        branch: branchName,
        files,
        modified: files.filter(f => f.status === 'modified' || f.status === 'staged'),
        untracked: files.filter(f => f.status === 'untracked'),
        staged: files.filter(f => f.statusCode.charAt(0) !== ' ' && f.statusCode.charAt(0) !== '?'),
        hasChanges: files.length > 0
      };

      setStatus(statusData);
      setBranch(branchName);
      setIsGitRepo(true);
      return statusData;
    } catch (err) {
      // Silently ignore git errors for non-git repositories
      console.debug('Not a git repository:', repositoryPath);
      setStatus(null);
      setIsGitRepo(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [repositoryPath, executeGitCommand, getCurrentBranch]);

  // 暂存文件
  const stageFile = useCallback(async (filePath) => {
    try {
      await executeGitCommand(['add', filePath]);
      await getStatus();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [executeGitCommand, getStatus]);

  // 取消暂存文件
  const unstageFile = useCallback(async (filePath) => {
    try {
      await executeGitCommand(['reset', 'HEAD', filePath]);
      await getStatus();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [executeGitCommand, getStatus]);

  // 暂存所有文件
  const stageAll = useCallback(async () => {
    try {
      await executeGitCommand(['add', '-A']);
      await getStatus();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [executeGitCommand, getStatus]);

  // 取消暂存所有文件
  const unstageAll = useCallback(async () => {
    try {
      await executeGitCommand(['reset', 'HEAD']);
      await getStatus();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [executeGitCommand, getStatus]);

  // 提交更改
  const commit = useCallback(async (message) => {
    if (!message || !message.trim()) {
      setError('Commit message is required');
      return false;
    }

    try {
      await executeGitCommand(['commit', '-m', message]);
      await getStatus();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [executeGitCommand, getStatus]);

  // 丢弃更改
  const discardChanges = useCallback(async (filePath) => {
    try {
      await executeGitCommand(['checkout', '--', filePath]);
      await getStatus();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [executeGitCommand, getStatus]);

  // 获取提交历史
  const getLog = useCallback(async (limit = 10) => {
    if (!repositoryPath) return [];

    try {
      const output = await executeGitCommand([
        'log',
        `--max-count=${limit}`,
        '--pretty=format:%H%n%an%n%ae%n%at%n%s%n%b%n---END---'
      ]);

      const commits = [];
      const entries = output.split('---END---').filter(e => e.trim());

      for (const entry of entries) {
        const lines = entry.trim().split('\n');
        if (lines.length >= 5) {
          commits.push({
            hash: lines[0],
            author: lines[1],
            email: lines[2],
            timestamp: parseInt(lines[3]) * 1000,
            subject: lines[4],
            body: lines.slice(5).join('\n').trim()
          });
        }
      }

      return commits;
    } catch (err) {
      console.error('Failed to get log:', err);
      return [];
    }
  }, [repositoryPath, executeGitCommand]);

  // 初始加载和自动刷新
  useEffect(() => {
    if (repositoryPath) {
      getStatus();

      // 每3秒自动检测更改
      const interval = setInterval(() => {
        getStatus();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [repositoryPath, getStatus]);

  return {
    status,
    branch,
    isLoading,
    error,
    getStatus,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    commit,
    discardChanges,
    getLog
  };
}

// 解析文件状态代码
function parseFileStatus(statusCode) {
  const x = statusCode.charAt(0); // 暂存区状态
  const y = statusCode.charAt(1); // 工作区状态

  if (x === '?' && y === '?') return 'untracked';
  if (x === 'A') return 'added';
  if (x === 'M') return 'staged';
  if (x === 'D') return 'deleted';
  if (y === 'M') return 'modified';
  if (y === 'D') return 'deleted';

  return 'unknown';
}

// 获取状态颜色（遵循 Apple 设计规范）
export function getStatusColor(status) {
  switch (status) {
    case 'added':
    case 'untracked':
      return '#34C759'; // Apple Green
    case 'modified':
    case 'staged':
      return '#FF9F0A'; // Apple Orange
    case 'deleted':
      return '#FF3B30'; // Apple Red
    default:
      return '#8E8E93'; // Apple Gray
  }
}

// 获取状态标签
export function getStatusLabel(status) {
  switch (status) {
    case 'added':
      return 'A';
    case 'untracked':
      return 'U';
    case 'modified':
      return 'M';
    case 'staged':
      return 'S';
    case 'deleted':
      return 'D';
    default:
      return '?';
  }
}
