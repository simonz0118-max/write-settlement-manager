#!/bin/zsh
set -e
PROJECT="write-settlement-manager"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

printf "\nWRITE Settlement Manager v5.2.2.2.2 — Cloudflare Pages 自动更新\n"
printf "========================================================\n\n"

if ! command -v brew >/dev/null 2>&1; then
  open "https://brew.sh/"
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
  echo "正在安装 Node.js（只需一次）..."
  brew install node
fi
WRANGLER=(npx --yes wrangler@latest)
if ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
  echo "即将打开 Cloudflare 官方授权页面。"
  "${WRANGLER[@]}" login
fi

DEPLOY_DIR="$ROOT/.cloudflare-deploy"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp "$ROOT/index.html" "$DEPLOY_DIR/index.html"
cp -R "$ROOT/src" "$DEPLOY_DIR/src"
cp -R "$ROOT/assets" "$DEPLOY_DIR/assets"
cat > "$DEPLOY_DIR/_headers" <<'HEADERS'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
HEADERS

"${WRANGLER[@]}" pages project create "$PROJECT" --production-branch main >/dev/null 2>&1 || true
LOG="$ROOT/cloudflare-deploy.log"
echo "正在上传 V5 到 Cloudflare Pages..."
"${WRANGLER[@]}" pages deploy "$DEPLOY_DIR" --project-name "$PROJECT" --branch main --commit-message "WRITE Settlement Manager v5.2.2.2.2" | tee "$LOG"
rm -rf "$DEPLOY_DIR"

echo "\n✅ Cloudflare V5.2.1 更新完成"
echo "https://write-settlement-manager.pages.dev/"
open "https://write-settlement-manager.pages.dev/"
