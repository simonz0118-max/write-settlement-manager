#!/bin/zsh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="6.5.11"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
PROJECT_NAME="write-settlement-manager"
TMP_DIR="$(mktemp -d -t write-settlement-publish.XXXXXX)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "=============================================="
echo "WRITE Settlement Manager v${VERSION}"
echo "GitHub + Cloudflare deployment"
echo "=============================================="

echo ""
echo "[1/4] Fetching latest GitHub main..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR/repo"

echo ""
echo "[2/4] Syncing current release into GitHub checkout..."
rsync -a --delete \
  --exclude ".git/" \
  --exclude ".DS_Store" \
  --exclude "__MACOSX/" \
  "$ROOT/" "$TMP_DIR/repo/"

cd "$TMP_DIR/repo"
git add -A

if git diff --cached --quiet; then
  echo "GitHub already contains these files; no commit needed."
else
  git commit -m "Release v${VERSION}"
  git push origin main
fi

echo ""
echo "[3/4] GitHub update complete."
echo "https://github.com/simonz0118-max/write-settlement-manager"

echo ""
echo "[4/4] Deploying current release to Cloudflare Pages..."
cd "$ROOT"
npx wrangler pages deploy . \
  --project-name="$PROJECT_NAME" \
  --branch=main

echo ""
echo "=============================================="
echo "V${VERSION} deployment complete"
echo "GitHub: https://github.com/simonz0118-max/write-settlement-manager"
echo "Website: https://write-settlement-manager.pages.dev/"
echo "=============================================="
read "?Press Enter to close..."
