#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/bea/Desktop/Catastro"
SOURCE_PLIST="$ROOT/scripts/com.bea.catastro.daily-refresh.plist"
TARGET_PLIST="$HOME/Library/LaunchAgents/com.bea.catastro.daily-refresh.plist"
LABEL="com.bea.catastro.daily-refresh"

mkdir -p "$HOME/Library/LaunchAgents"

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)" "$TARGET_PLIST" >/dev/null 2>&1 || true
fi

cp "$SOURCE_PLIST" "$TARGET_PLIST"
launchctl bootstrap "gui/$(id -u)" "$TARGET_PLIST"

echo "Instalado $LABEL en $TARGET_PLIST"
launchctl print "gui/$(id -u)/$LABEL" | sed -n '1,80p'
