#!/bin/zsh
set -e
cd "$(dirname "$0")"
PORT=4173
echo "WRITE Settlement Manager local preview"
echo "Open: http://127.0.0.1:${PORT}/"
python3 -m http.server ${PORT}
