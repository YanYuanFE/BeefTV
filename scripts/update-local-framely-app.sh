#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGED_APP="$ROOT_DIR/backend/cmd/desktop/build/bin/Framely.app"
INSTALLED_APP="/Applications/Framely.app"
# Pre-rename install; Framely migrates its data dir on first launch, so it must not be running.
LEGACY_APP="/Applications/BeefTV.app"

cleanup_staged_app() {
  if [[ -d "$STAGED_APP" && ! -L "$STAGED_APP" ]]; then
    find "$STAGED_APP" -depth -delete
  fi
}
trap cleanup_staged_app EXIT

"$ROOT_DIR/scripts/build-framely-release.sh"

if [[ ! -x "$STAGED_APP/Contents/MacOS/Framely" ]]; then
  echo "Built Framely.app is incomplete: $STAGED_APP" >&2
  exit 1
fi
codesign --verify --deep --strict "$STAGED_APP"
if [[ -e "$INSTALLED_APP" && ( ! -d "$INSTALLED_APP" || -L "$INSTALLED_APP" ) ]]; then
  echo "Refusing to replace unexpected target: $INSTALLED_APP" >&2
  exit 1
fi

osascript -e 'tell application id "com.wails.framely" to quit' 2>/dev/null || true
for _ in 1 2 3 4 5; do
  pgrep -f '^/Applications/Framely.app/Contents/MacOS/Framely$' >/dev/null || break
  sleep 1
done
if pgrep -f '^/Applications/Framely.app/Contents/MacOS/Framely$' >/dev/null; then
  echo "Framely is still running. Save your work and quit before updating." >&2
  exit 1
fi

osascript -e 'tell application id "com.wails.beeftv" to quit' 2>/dev/null || true
for _ in 1 2 3 4 5; do
  pgrep -x BeefTV >/dev/null || break
  sleep 1
done
if pgrep -x BeefTV >/dev/null; then
  echo "BeefTV (pre-rename app) is still running. Quit it so Framely can migrate its data." >&2
  exit 1
fi

mkdir -p "$INSTALLED_APP"
rsync -a --delete "$STAGED_APP/" "$INSTALLED_APP/"
codesign --verify --deep --strict "$INSTALLED_APP"

echo "Updated the canonical local app: $INSTALLED_APP"
if [[ -d "$LEGACY_APP" ]]; then
  echo "The pre-rename app is still installed at $LEGACY_APP. After Framely starts and shows your projects, you can delete it."
fi
