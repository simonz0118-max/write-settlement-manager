#!/bin/zsh
set -e

cd "$(dirname "$0")"

# Find a free localhost TCP port automatically so an older WRITE instance
# cannot block this version with "Address already in use".
PORT=$(python3 - <<'PY'
import socket
for port in range(4173, 4274):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", port))
    except OSError:
        s.close()
        continue
    s.close()
    print(port)
    break
else:
    raise SystemExit("No free local port found in range 4173-4273")
PY
)

URL="http://127.0.0.1:${PORT}/index.html"

echo ""
echo "WRITE Settlement Manager v5.2"
echo "----------------------------------------"
echo "Local server: ${URL}"
echo "Keep this Terminal window open while using the app."
echo "Press Control-C to stop the server."
echo ""

# Open only after the server has had a moment to bind.
(sleep 0.8; open "$URL") &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
