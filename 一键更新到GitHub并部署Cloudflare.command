#!/bin/zsh
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_VERSION="7.1.4"
PROJECT="write-settlement-manager"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
DB_NAME="write-settlement-rules"
BINDING="WRITE_RULES_DB"

echo "=================================================="
echo "WRITE Settlement Manager V7.1.4"
echo "稳定版 GitHub + Cloudflare Pages 一键发布"
echo "=================================================="

cd "$SOURCE_DIR"

LOCAL_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
if [ "$LOCAL_VERSION" != "$EXPECTED_VERSION" ]; then
  echo "❌ 本地版本不一致：期待 $EXPECTED_VERSION，实际 $LOCAL_VERSION"
  read -n 1 "?按任意键关闭..."
  exit 1
fi
echo "✅ 升级包版本：v$LOCAL_VERSION"

for cmd in git npx node rsync curl; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "❌ 缺少必要命令：$cmd"
    read -n 1 "?按任意键关闭..."
    exit 1
  }
done

echo ""
echo "[1/7] 准备干净 GitHub 工作区..."
TMP_ROOT="$(mktemp -d /tmp/write-v714.XXXXXX)"
WORK_DIR="$TMP_ROOT/repo"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

git clone "$REPO_URL" "$WORK_DIR"
cd "$WORK_DIR"
git checkout main

# IMPORTANT: pull/rebase happens BEFORE package files are copied.
git pull --ff-only origin main
echo "✅ Git 仓库已更新到远程最新 main"

echo ""
echo "[2/7] 保存现有 D1 配置..."
PRESERVED_WRANGLER="$TMP_ROOT/wrangler.jsonc"
if [ -f "wrangler.jsonc" ] && ! grep -q "__WRITE_D1_DATABASE_ID__" "wrangler.jsonc"; then
  cp "wrangler.jsonc" "$PRESERVED_WRANGLER"
  echo "✅ 已保存仓库中的有效 D1 Binding"
fi

echo ""
echo "[3/7] 覆盖 V7.1.4 新版文件..."
rsync -a --delete   --exclude='.git/'   --exclude='.DS_Store'   --exclude='wrangler.jsonc'   "$SOURCE_DIR/" "$WORK_DIR/"

cd "$WORK_DIR"

# Restore previously valid config.
if [ -f "$PRESERVED_WRANGLER" ]; then
  cp "$PRESERVED_WRANGLER" "wrangler.jsonc"
fi

# If still no valid config, rebuild it from the existing D1 database.
if [ ! -f "wrangler.jsonc" ] || grep -q "__WRITE_D1_DATABASE_ID__" "wrangler.jsonc"; then
  echo "正在从 Cloudflare 自动恢复 WRITE_RULES_DB Binding..."
  DB_JSON="$(npx wrangler d1 list --json 2>/dev/null || echo '[]')"
  DB_ID="$(printf '%s' "$DB_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{
    const x=JSON.parse(s), a=Array.isArray(x)?x:(x.result||[]);
    const d=a.find(v=>v.name==="write-settlement-rules");
    if(d)process.stdout.write(d.uuid||d.id||"");
  }catch(e){}
})')"

  if [ -n "$DB_ID" ]; then
    node - "$DB_ID" <<'NODE'
const fs=require("fs"),id=process.argv[2];
fs.writeFileSync("wrangler.jsonc",JSON.stringify({
  name:"write-settlement-manager",
  pages_build_output_dir:".",
  compatibility_date:"2026-08-09",
  d1_databases:[{
    binding:"WRITE_RULES_DB",
    database_name:"write-settlement-rules",
    database_id:id
  }]
},null,2)+"\n");
NODE
    echo "✅ WRITE_RULES_DB 已恢复：$DB_ID"
  else
    echo "⚠️ 未找到 write-settlement-rules。将按 Local-first 模式发布。"
    rm -f wrangler.jsonc
  fi
fi

echo ""
echo "[4/7] 发布前强制自检..."
CHECK_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
[ "$CHECK_VERSION" = "$EXPECTED_VERSION" ] || {
  echo "❌ 同步到 Git 工作区后的版本错误：$CHECK_VERSION"
  read -n 1 "?按任意键关闭..."
  exit 1
}

node --check src/app.bundle.js
node --check src/knowledge-base.js
node --check src/workers/import.worker.bundle.js
node --check src/release-meta.js
node --check functions/api/rules/sync.js

if [ -f "wrangler.jsonc" ]; then
  if grep -q "__WRITE_D1_DATABASE_ID__" "wrangler.jsonc"; then
    echo "❌ wrangler.jsonc 仍包含占位 database_id"
    read -n 1 "?按任意键关闭..."
    exit 1
  fi
  grep -q '"binding": "WRITE_RULES_DB"' "wrangler.jsonc" || {
    echo "❌ wrangler.jsonc 缺少 WRITE_RULES_DB Binding"
    read -n 1 "?按任意键关闭..."
    exit 1
  }
fi

git status --short
echo "✅ 发布前代码与配置自检通过"

echo ""
echo "[5/7] 提交并推送 GitHub..."
git add -A
if git diff --cached --quiet; then
  echo "GitHub 当前内容已经是 V7.1.4，无需重复提交。"
else
  git commit -m "Deploy WRITE v7.1.4"
  git push origin main
fi
echo "✅ GitHub 完成"

echo ""
echo "[6/7] 部署 Cloudflare Pages..."
if [ -f "wrangler.jsonc" ]; then
  DEPLOY_OUT="$(npx wrangler pages deploy . --project-name="$PROJECT" --branch=main --config=wrangler.jsonc 2>&1)"
else
  DEPLOY_OUT="$(npx wrangler pages deploy . --project-name="$PROJECT" --branch=main 2>&1)"
fi
echo "$DEPLOY_OUT"

DEPLOY_URL="$(printf '%s' "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.pages\.dev' | tail -1 || true)"
if [ -z "$DEPLOY_URL" ]; then
  echo "❌ Wrangler 未返回本次唯一 deployment URL"
  read -n 1 "?按任意键关闭..."
  exit 1
fi

echo ""
echo "[7/7] 在线回读并验证实际版本..."
VERIFIED=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  REMOTE_HTML="$(curl -fsSL "${DEPLOY_URL}/?verify=$(date +%s)-$i" 2>/dev/null || true)"
  if printf '%s' "$REMOTE_HTML" | grep -q 'data-release="7.1.4"'; then
    VERIFIED="yes"
    break
  fi
  sleep 2
done

if [ "$VERIFIED" != "yes" ]; then
  echo "❌ Cloudflare 上传完成，但实际 deployment 不是 v7.1.4"
  echo "Deployment: $DEPLOY_URL"
  read -n 1 "?按任意键关闭..."
  exit 1
fi

echo "✅ Cloudflare 唯一部署地址确认：v7.1.4"

# Cloud API endpoint check: 200 means D1 active; 503 means published but binding unavailable.
SYNC_STATUS="$(curl -sS -o "$TMP_ROOT/sync.json" -w '%{http_code}' "${DEPLOY_URL}/api/rules/sync" || true)"
if [ "$SYNC_STATUS" = "200" ]; then
  echo "✅ 规则云同步 API 可访问"
elif [ "$SYNC_STATUS" = "503" ]; then
  echo "⚠️ 页面部署成功，但 D1 Binding 未生效；WebApp 将保持 Local-first。"
else
  echo "⚠️ 云同步 API HTTP $SYNC_STATUS；不影响本地结算。"
fi

echo ""
echo "=================================================="
echo "✅ WRITE V7.1.4 发布完成"
echo "GitHub: https://github.com/simonz0118-max/write-settlement-manager"
echo "Deployment: $DEPLOY_URL"
echo "正式域名: https://f.neovora.co/"
echo "=================================================="
read -n 1 "?按任意键关闭..."
