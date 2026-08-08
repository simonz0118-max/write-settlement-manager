#!/bin/zsh
set -e

REPO="simonz0118-max/write-settlement-manager"
REMOTE="https://github.com/${REPO}.git"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

clear
printf "\nWRITE Settlement Manager — GitHub 自动发布\n"
printf "==========================================\n\n"

if ! command -v brew >/dev/null 2>&1; then
  echo "未检测到 Homebrew。请先安装 Homebrew 后重新双击本文件。"
  open "https://brew.sh/"
  read "?按回车退出..."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "正在安装 GitHub CLI（只需一次）..."
  brew install gh
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "\n即将打开 GitHub 官方网页登录。"
  echo "请在浏览器完成授权，然后回到此窗口。\n"
  gh auth login --hostname github.com --git-protocol https --web
fi

gh auth setup-git >/dev/null 2>&1 || true

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "无法访问 GitHub 仓库：$REPO"
  read "?按回车退出..."
  exit 1
fi

if [ ! -d .git ]; then
  git init -q
fi

git checkout -B main >/dev/null 2>&1
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

# 让重复运行也能安全更新已存在的仓库。
git fetch origin main >/dev/null 2>&1 || true
if git show-ref --verify --quiet refs/remotes/origin/main; then
  git reset origin/main >/dev/null
fi

LOGIN="$(gh api user --jq .login)"
ID="$(gh api user --jq .id)"
git config user.name "$LOGIN"
git config user.email "${ID}+${LOGIN}@users.noreply.github.com"

git add -A
if git diff --cached --quiet; then
  echo "没有新的代码变化，跳过 commit。"
else
  git commit -m "Deploy WRITE Settlement Manager v4.1" >/dev/null
fi

echo "正在推送到 GitHub..."
git push -u origin main

echo "\n✅ GitHub 发布完成"
echo "https://github.com/$REPO"
open "https://github.com/$REPO"
read "?按回车关闭窗口..."
