#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
swift build -c release
APP="build/Focus Pill.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp .build/release/FocusPill "$APP/Contents/MacOS/FocusPill"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>local.athulya.focuspill</string>
  <key>CFBundleName</key><string>Focus Pill</string>
  <key>CFBundleExecutable</key><string>FocusPill</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
  <key>NSSupportsAutomaticTermination</key><false/>
  <key>NSSupportsSuddenTermination</key><false/>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign -s - --force "$APP" >/dev/null
echo "built $APP"
