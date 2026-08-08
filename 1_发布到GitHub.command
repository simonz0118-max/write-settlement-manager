#!/bin/zsh
set -e
REPO="simonz0118-max/write-settlement-manager"
REMOTE="https://github.com/${REPO}.git"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

printf "\nWRITE Settlement Manager v5.2 — GitHub 自动更新\n"
printf "==============================================\n\n"

if ! command -v brew >/dev/null 2>&1; then
  echo "未检测到 Homebrew，正在打开安装页面。"
  open "https://brew.sh/"
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "正在安装 GitHub CLI（只需一次）..."
  brew install gh
fi
if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "即将打开 GitHub 官方授权页面。"
  gh auth login --hostname github.com --git-protocol https --web
fi
gh auth setup-git >/dev/null 2>&1 || true
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "无法访问 GitHub 仓库：$REPO"
  exit 1
fi

if [ ! -d .git ]; then git init -q; fi
git checkout -B main >/dev/null 2>&1
if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "$REMOTE"; else git remote add origin "$REMOTE"; fi

git fetch origin main >/dev/null 2>&1 || true
if git show-ref --verify --quiet refs/remotes/origin/main; then
  # 将线上版本作为基线，再覆盖为当前 V5 文件，避免产生无关历史冲突。
  git reset origin/main >/dev/null
fi

LOGIN="$(gh api user --jq .login)"
ID="$(gh api user --jq .id)"
git config user.name "$LOGIN"
git config user.email "${ID}+${LOGIN}@users.noreply.github.com"

git add -A
if git diff --cached --quiet; then
  echo "GitHub 已经是最新 V5，无需重复提交。"
else
  git commit -m "Release WRITE Settlement Manager v5.2" >/dev/null
fi

echo "正在推送 V5 到 GitHub main..."
git push -u origin main

echo "\n✅ GitHub V5.2 更新完成"
echo "https://github.com/$REPO"
