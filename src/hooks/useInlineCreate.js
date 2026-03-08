import { useCallback, useState } from 'react';

export function useInlineCreate({ fileOps, inputRef }) {
  const [inlineCreate, setInlineCreate] = useState(null);
  const [inlineCreateName, setInlineCreateName] = useState('');

  const startInlineCreate = useCallback((basePath, type) => {
    setInlineCreate({ basePath, parentPath: basePath, type });
    setInlineCreateName('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [inputRef]);

  const cancelInlineCreate = useCallback(() => {
    setInlineCreate(null);
    setInlineCreateName('');
  }, []);

  const confirmInlineCreate = useCallback(async () => {
    if (!inlineCreate || !inlineCreateName.trim()) return;

    await fileOps.createEntry(`${inlineCreate.basePath}/${inlineCreateName.trim()}`, inlineCreate.type === 'folder');
    cancelInlineCreate();
  }, [cancelInlineCreate, fileOps, inlineCreate, inlineCreateName]);

  return {
    inlineCreate,
    inlineCreateName,
    setInlineCreateName,
    startInlineCreate,
    cancelInlineCreate,
    confirmInlineCreate,
  };
}
