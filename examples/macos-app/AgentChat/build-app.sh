#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/.build/arm64-apple-macosx/debug"
APP_BUNDLE="$SCRIPT_DIR/.build/AgentChat.app"
CONTENTS="$APP_BUNDLE/Contents"

echo "Building AgentChat..."
cd "$SCRIPT_DIR"
swift build

echo "Creating app bundle..."
rm -rf "$APP_BUNDLE"
mkdir -p "$CONTENTS/MacOS"
mkdir -p "$CONTENTS/Resources"

cp "$BUILD_DIR/AgentChat" "$CONTENTS/MacOS/AgentChat"
cp "$SCRIPT_DIR/AgentChat/Info.plist" "$CONTENTS/Info.plist"

echo "App bundle created at: $APP_BUNDLE"
echo ""
echo "Run with:"
echo "  open $APP_BUNDLE"
