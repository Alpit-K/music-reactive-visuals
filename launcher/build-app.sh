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
echo "Built $HOME/Applications/VJ.app"
