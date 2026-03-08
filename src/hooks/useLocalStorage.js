import { useState, useEffect } from 'react';
import { loadSavedState, saveState, subscribeToStoredState } from '../utils/storage';

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => loadSavedState(key, defaultValue));

  useEffect(() => {
    saveState(key, value);
  }, [key, value]);

  useEffect(() => subscribeToStoredState(key, setValue), [key]);

  return [value, setValue];
}
