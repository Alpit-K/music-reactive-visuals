#!/bin/zsh
# Builds everything a session needs and writes ~/Applications/VJ.app (design §7: one icon).
set -eu
REPO=${0:A:h:h}
mkdir -p "$REPO/launcher/bin" "$REPO/logs" "$HOME/Applications"
swiftc -O "$REPO/launcher/audio.swift" -o "$REPO/launcher/bin/vj-audio"
# Re-sign ad hoc: on macOS 27 the linker's own signature got vj-audio killed (exit 137) on every run.
codesign -f -s - "$REPO/launcher/bin/vj-audio"
(cd "$REPO/engine" && npm ci && npm run build)
chmod +x "$REPO/launcher/vj.sh"
# A login shell (-l) reads ~/.zprofile, so the app finds uv and friends on the same PATH as Terminal.
osacompile -o "$HOME/Applications/VJ.app" -e \
  "do shell script \"/bin/zsh -l '$REPO/launcher/vj.sh' >> '$REPO/logs/launcher.log' 2>&1 &\""
# Icon: draw it, pack every size into applet.icns. osacompile's Assets.car holds the stock script icon and
# macOS prefers it (via CFBundleIconName) over applet.icns, so both go. Editing the bundle breaks its
# ad hoc signature, hence the re-sign; touch makes Finder and the Dock notice the change.
APP="$HOME/Applications/VJ.app"
swiftc -O "$REPO/launcher/icon.swift" -o "$REPO/launcher/bin/vj-icon"
codesign -f -s - "$REPO/launcher/bin/vj-icon"
ICONSET="$REPO/launcher/bin/VJ.iconset"
rm -rf "$ICONSET" && mkdir "$ICONSET"
"$REPO/launcher/bin/vj-icon" "$REPO/launcher/bin/icon.png"
for s in 16 32 128 256 512; do
  sips -z $s $s "$REPO/launcher/bin/icon.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$REPO/launcher/bin/icon.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/applet.icns"
rm -f "$APP/Contents/Resources/Assets.car"
plutil -remove CFBundleIconName "$APP/Contents/Info.plist" 2>/dev/null || true
codesign -f -s - "$APP"
touch "$APP"
echo "Built $HOME/Applications/VJ.app"
