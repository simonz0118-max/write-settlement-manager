#!/bin/zsh
set -e

PROJECT="write-settlement-manager"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

clear
printf "\nWRITE Settlement Manager — Cloudflare Pages 自动部署\n"
printf "======================================================\n\n"

if ! command -v brew >/dev/null 2>&1; then
  echo "未检测到 Homebrew。请先安装 Homebrew 后重新双击本文件。"
  open "https://brew.sh/"
  read "?按回车退出..."
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
  echo "正在安装 Node.js（Cloudflare 官方 Wrangler 需要，只需一次）..."
  brew install node
fi

WRANGLER=(npx --yes wrangler@latest)

if ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
  echo "\n即将打开 Cloudflare 官方网页登录。"
  echo "请登录你的 Cloudflare 账户并允许 Wrangler 访问，然后回到此窗口。\n"
  "${WRANGLER[@]}" login
fi

# 只部署真正运行所需的静态文件，README/测试报告不会公开。
DEPLOY_DIR="$ROOT/.cloudflare-deploy"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp "$ROOT/index.html" "$DEPLOY_DIR/index.html"
cp -R "$ROOT/src" "$DEPLOY_DIR/src"
cat > "$DEPLOY_DIR/_headers" <<'HEADERS'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()
HEADERS

# 若项目已存在，create 会失败；这是正常情况，继续部署即可。
echo "检查 Cloudflare Pages 项目..."
"${WRANGLER[@]}" pages project create "$PROJECT" --production-branch main >/dev/null 2>&1 || true

echo "开始上传到 Cloudflare Pages..."
LOG="$ROOT/cloudflare-deploy.log"
"${WRANGLER[@]}" pages deploy "$DEPLOY_DIR" --project-name "$PROJECT" --branch main --commit-message "WRITE Settlement Manager v4.1" | tee "$LOG"

URL=$(grep -Eo 'https://[^ ]+\.pages\.dev[^ ]*' "$LOG" | tail -1 | sed 's/[[:punct:]]$//' || true)
rm -rf "$DEPLOY_DIR"

echo "\n✅ Cloudflare 部署完成"
if [ -n "$URL" ]; then
  echo "$URL"
  open "$URL"
else
  echo "请查看上方 Wrangler 输出中的 pages.dev 地址。"
fi
read "?按回车关闭窗口..."
