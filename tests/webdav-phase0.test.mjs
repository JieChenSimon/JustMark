import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const readSource = async (relativePath) => {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return await readFile(url, 'utf8');
};

const functionBody = (source, marker, functionName) => {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${functionName} not found`);

  const braceStart = source.indexOf('{', start);
  assert.notEqual(braceStart, -1, `${functionName} body not found`);

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(braceStart + 1, index);
    }
  }

  throw new Error(`Unclosed function body for ${functionName}`);
};

test('WebDAV config no longer persists runtime connection state', async () => {
  const [webdavSource, preferencesSource] = await Promise.all([
    readSource('src/utils/webdav.js'),
    readSource('src/components/PreferencesWindow.jsx'),
  ]);

  assert.ok(
    !webdavSource.includes('connected: Boolean(input.connected)'),
    'saveable WebDAV config should not persist connected as a stored field'
  );

  assert.ok(
    !/saveWebDAVConfig\(\s*\{\s*\.\.\.result\.config,\s*connected:\s*true\s*\}\s*\)/s.test(preferencesSource),
    'preferences UI should not force connected into saved WebDAV config'
  );

  assert.ok(
    !/savedConfig\.connected/.test(preferencesSource),
    'preferences UI should not read a persisted connected flag back into the runtime state'
  );
});

test('WebDAV config persists password metadata instead of raw password storage calls', async () => {
  const webdavSource = await readSource('src/utils/webdav.js');
  const persistedBody = functionBody(webdavSource, 'const toPersistedConfig =', 'toPersistedConfig');

  assert.match(webdavSource, /invoke\('webdav_save_password'/);
  assert.match(webdavSource, /invoke\('webdav_get_password'/);
  assert.match(webdavSource, /passwordSaved:\s*Boolean\(config\.passwordSaved\)/);
  assert.ok(
    !/password:\s*config\.password/.test(persistedBody),
    'persisted WebDAV config should not serialize the raw password'
  );
});

test('WebDAV config validation rejects query-string URLs before reaching Rust', async () => {
  const source = await readSource('src/utils/webdav.js');
  const body = functionBody(source, 'export const prepareWebDAVConfig =', 'prepareWebDAVConfig');

  assert.match(body, /new URL\(config\.url\)/);
  assert.match(body, /must not include query strings or fragments/);
});

test('WebDAV delete command preserves base path', async () => {
  const source = await readSource('src-tauri/src/webdav_command.rs');
  const body = functionBody(source, 'pub async fn webdav_delete_file', 'webdav_delete_file');

  assert.match(body, /build_path\s*\(\s*&base_path\s*,\s*&remote_path\s*\)/);
  assert.match(body, /delete\s*\(\s*&full_path\s*\)/);
});

test('WebDAV command layer rejects unsafe path traversal', async () => {
  const source = await readSource('src-tauri/src/webdav_command.rs');

  assert.match(source, /Path traversal is not allowed\./);
  assert.match(source, /normalize_remote_path/);
});

test('upload-only mode no longer schedules destructive remote deletion', async () => {
  const source = await readSource('src/hooks/useWebDAVSync.js');

  assert.ok(
    !/else if \(syncMode === 'upload-only'\)\s*\{\s*operations\.push\(\{\s*type:\s*'deleteRemote'/s.test(source),
    'upload-only mode should not translate missing remote files into deleteRemote operations'
  );
});
