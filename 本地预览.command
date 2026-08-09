#!/bin/zsh
set -e
cd "$(dirname "$0")"
PORT=4173
echo "WRITE Settlement Manager 本地预览"
echo "浏览器打开：http://127.0.0.1:${PORT}/"
python3 -m http.server ${PORT}
