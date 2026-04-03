#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "[verify:voice] ERROR: $1" >&2
  exit 1
}

echo "[verify:voice] Checking native speech setup..."

if ! grep -q '"@capacitor-community/speech-recognition"' package.json; then
  fail "package.json is missing @capacitor-community/speech-recognition."
fi

if [ ! -d "node_modules/@capacitor-community/speech-recognition" ]; then
  fail "node_modules/@capacitor-community/speech-recognition is missing. Run: npm install"
fi

if [ ! -f "android/capacitor.settings.gradle" ]; then
  fail "android/capacitor.settings.gradle was not found. Add/sync Android platform first."
fi

if ! grep -qi 'speech-recognition' android/capacitor.settings.gradle; then
  fail "Android plugin sync missing in android/capacitor.settings.gradle. Run: npx cap sync android"
fi

if [ ! -f "android/app/capacitor.build.gradle" ]; then
  fail "android/app/capacitor.build.gradle was not found."
fi

if ! grep -qi 'speech-recognition' android/app/capacitor.build.gradle; then
  fail "Android plugin dependency missing in android/app/capacitor.build.gradle. Run: npx cap sync android"
fi

ASSET_DIR="android/app/src/main/assets/public/assets"
if [ ! -d "$ASSET_DIR" ]; then
  fail "Android web assets were not found at $ASSET_DIR. Run: npm run build && npx cap sync android"
fi

if command -v rg >/dev/null 2>&1; then
  if ! rg -q "Voice mode:|Run voice self-test|Voice status:" "$ASSET_DIR"; then
    fail "AI Companion voice diagnostics markers were not found in Android assets. Ensure latest web build was synced."
  fi
else
  if ! grep -R -E -q "Voice mode:|Run voice self-test|Voice status:" "$ASSET_DIR"; then
    fail "AI Companion voice diagnostics markers were not found in Android assets. Ensure latest web build was synced."
  fi
fi

echo "[verify:voice] OK: Native speech dependency, Android sync, and diagnostics assets are in place."
