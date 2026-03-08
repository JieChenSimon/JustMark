import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const bundleMacOsDir = path.resolve('src-tauri/target/release/bundle/macos');

try {
  const entries = await readdir(bundleMacOsDir, { withFileTypes: true });
  const staleArtifacts = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.dmg'))
    .map((entry) => path.join(bundleMacOsDir, entry.name));

  await Promise.all(staleArtifacts.map((artifactPath) => rm(artifactPath, { force: true })));

  if (staleArtifacts.length > 0) {
    console.log(`Removed ${staleArtifacts.length} stale DMG artifact(s) from ${bundleMacOsDir}`);
  }
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
}
