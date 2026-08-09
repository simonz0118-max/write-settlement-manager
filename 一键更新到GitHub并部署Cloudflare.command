#!/bin/zsh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="7.0.10"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
PROJECT_NAME="write-settlement-manager"
TMP_DIR="$(mktemp -d -t write-settlement-publish.XXXXXX)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "=================================================="
echo "WRITE Settlement Manager V${VERSION}"
echo "GitHub + Cloudflare 一键升级"
echo "=================================================="
echo ""

echo "[1/4] 正在获取 GitHub 最新 main..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR/repo"

echo ""
echo "[2/4] 正在同步 V${VERSION} 文件..."
rsync -a --delete \
  --exclude ".git/" \
  --exclude ".DS_Store" \
  --exclude "__MACOSX/" \
  "$ROOT/" "$TMP_DIR/repo/"

cd "$TMP_DIR/repo"
git add -A

if git diff --cached --quiet; then
  echo "GitHub 已经是当前 V${VERSION} 文件，无需重复提交。"
else
  git commit -m "Release v${VERSION}"
  git push origin main
fi

echo ""
echo "[3/4] GitHub 更新完成。"
echo "https://github.com/simonz0118-max/write-settlement-manager"

echo ""
echo "[4/4] 正在部署 Cloudflare Pages..."
cd "$ROOT"
npx wrangler pages deploy . \
  --project-name="$PROJECT_NAME" \
  --branch=main

echo ""
echo "=================================================="
echo "V${VERSION} 升级完成"
echo "GitHub: https://github.com/simonz0118-max/write-settlement-manager"
echo "网站: https://write-settlement-manager.pages.dev/"
echo "=================================================="
read "?按回车键关闭..."
