import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageJsonPath = resolve(workspaceRoot, 'package.json');
const cargoTomlPath = resolve(workspaceRoot, 'src-tauri', 'Cargo.toml');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const packageVersion = packageJson.version;

if (typeof packageVersion !== 'string' || packageVersion.length === 0) {
  throw new Error('package.json version is missing.');
}

const cargoToml = readFileSync(cargoTomlPath, 'utf8');
const nextCargoToml = cargoToml.replace(
  /(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m,
  `$1${packageVersion}$2`,
);

if (nextCargoToml === cargoToml) {
  console.log(`[version:sync] Cargo.toml already matches ${packageVersion}`);
} else {
  writeFileSync(cargoTomlPath, nextCargoToml);
  console.log(`[version:sync] Synced Cargo.toml to ${packageVersion}`);
}
