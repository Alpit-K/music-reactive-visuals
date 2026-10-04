#!/bin/zsh
# dj-vj session launcher (design §7). Started by VJ.app; logs to logs/launcher.log.
# Never touches rekordbox or the FLX4: only the Mac default output, which it restores on exit.
set -u
REPO=${0:A:h:h}
AUDIO=$REPO/launcher/bin/vj-audio
PORT=8765
SESSION=$(date +%Y%m%d-%H%M%S)
PROFILE=$HOME/.dj-vj/chrome-profile
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
STALE_S=30   # a drawing page logs every 5 s; this long without a log means a crashed tab or a hung page

dialog() { osascript -e "display dialog \"$1\" with title \"dj-vj\" buttons {\"OK\"} default button 1" >/dev/null; }
log() { print -r -- "$(date +%T) $*"; }

# 1. Pre-flight (read-only).
[[ -x $AUDIO ]] || { dialog "Launcher not built. Run launcher/build-app.sh."; exit 1; }
[[ -f $REPO/engine/dist/index.html ]] || { dialog "Engine not built. Run launcher/build-app.sh."; exit 1; }
rate=$($AUDIO rate "BlackHole 2ch") || { dialog "BlackHole 2ch is not installed or not visible."; exit 1; }
[[ $rate == 44100 ]] || { dialog "BlackHole 2ch is at $rate Hz. Set it to 44100 Hz in Audio MIDI Setup — a mismatch makes master play fast."; exit 1; }
screens=$(osascript -l JavaScript -e 'ObjC.import("AppKit"); $.NSScreen.screens.count')
(( screens >= 2 )) || { dialog "No projector connected."; exit 1; }
pgrep -xq rekordbox || dialog "rekordbox is not running. Start it, then turn PC MASTER OUT on."

# 2. Audio output, restored on any exit.
PREV=$($AUDIO get)
# A session that died without restoring leaves the output on BlackHole: restore to the one saved before it.
if [[ $PREV == "BlackHole 2ch" && -f $HOME/.dj-vj/output-before ]]; then
  PREV=$(<$HOME/.dj-vj/output-before)
else
  mkdir -p $HOME/.dj-vj && print -r -- "$PREV" > $HOME/.dj-vj/output-before
fi
log "session $SESSION; previous output: $PREV"
CAFF_PID= SERVER_PID= CHROME_PID=
cleanup() {
  [[ -n $CHROME_PID ]] && kill $CHROME_PID 2>/dev/null
  [[ -n $SERVER_PID ]] && kill $SERVER_PID 2>/dev/null
  [[ -n $CAFF_PID ]] && kill $CAFF_PID 2>/dev/null
  $AUDIO set "$PREV" && log "output restored to $PREV"
}
# zsh resumes the script after an INT/TERM trap, so those exit; the EXIT trap then cleans up once.
trap cleanup EXIT
trap 'exit 130' INT TERM
$AUDIO set "BlackHole 2ch" || { dialog "Could not switch the output to BlackHole."; exit 1; }
dialog "Turn PC MASTER OUT on in rekordbox (off and on again if it already is)."

# 3–4. Keep the display awake; start the server.
caffeinate -d & CAFF_PID=$!
uv run "$REPO/server/serve.py" --port $PORT --root "$REPO/engine/dist" --logs "$REPO/logs" & SERVER_PID=$!
for i in {1..50}; do curl -sf "http://localhost:$PORT/health" >/dev/null && break; sleep 0.2; done
curl -sf "http://localhost:$PORT/health" >/dev/null || { dialog "The dj-vj server did not start. See logs/launcher.log."; exit 1; }

# 5. Chrome on the projector: the second screen's left edge (top-left coordinates).
X=$(osascript -l JavaScript -e 'ObjC.import("AppKit"); const s = $.NSScreen.screens; s.objectAtIndex(1).frame.origin.x')
# Ordinary fullscreen, not --kiosk, so Cmd-Ctrl-F leaves and re-enters it. Kiosk hid two bars that it shows:
# the toolbar (Chrome's Mac default is to keep it in fullscreen) and the "unsupported command-line flag" warning
# that --use-fake-ui-for-media-stream raises. So the profile hides the toolbar and grants the mic to this page.
python3 - "$PROFILE/Default/Preferences" $PORT <<'EOF'
import json, os, sys
path, port = sys.argv[1], sys.argv[2]
os.makedirs(os.path.dirname(path), exist_ok=True)
p = json.load(open(path)) if os.path.exists(path) else {}
p.setdefault("browser", {})["show_fullscreen_toolbar"] = False
mic = p.setdefault("profile", {}).setdefault("content_settings", {}).setdefault("exceptions", {}).setdefault("media_stream_mic", {})
mic[f"http://localhost:{port},*"] = {"setting": 1}
json.dump(p, open(path, "w"))
EOF
launch_chrome() {
  "$CHROME" --user-data-dir="$PROFILE" --start-fullscreen --hide-crash-restore-bubble --window-position="${X%.*},0" \
    --autoplay-policy=no-user-gesture-required \
    --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling \
    --no-first-run --no-default-browser-check \
    "http://localhost:$PORT/index.html?autostart=1&session=$SESSION" >/dev/null 2>&1 &
  CHROME_PID=$! LAUNCHED=$SECONDS
  log "chrome started ($CHROME_PID)"
}
launch_chrome

# 6. Watchdog: relaunch Chrome if it dies, or if the page stops logging while Chrome lives on
# (a renderer crash leaves "Aw, Snap!" on the wall). The session ends when the server exits on /quit.
while kill -0 $SERVER_PID 2>/dev/null; do
  if ! kill -0 $CHROME_PID 2>/dev/null; then
    log "chrome exited without quit; relaunching"
    launch_chrome
  elif (( SECONDS - LAUNCHED > STALE_S )) && age=$(curl -sf "http://localhost:$PORT/age") && (( ${age%.*} > STALE_S )); then
    log "page silent for ${age}s; relaunching chrome"
    kill $CHROME_PID 2>/dev/null
    for i in {1..10}; do kill -0 $CHROME_PID 2>/dev/null || break; sleep 0.5; done
    kill -9 $CHROME_PID 2>/dev/null
    launch_chrome
  fi
  sleep 2
done
log "server stopped (quit); ending session"
