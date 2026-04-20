#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="${JUSTMARK_CLI_INSTALL_DIR:-$HOME/.local/bin}"
INSTALL_PATH="$INSTALL_DIR/justmark"

cd "$ROOT_DIR"

swift build -c release --product justmark

mkdir -p "$INSTALL_DIR"
cp ".build/arm64-apple-macosx/release/justmark" "$INSTALL_PATH"
chmod 755 "$INSTALL_PATH"

echo "Installed justmark to $INSTALL_PATH"
