#!/bin/zsh
set -u
set -o pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_VERSION="7.1.6"
PROJECT="write-settlement-manager"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
DB_NAME="write-settlement-rules"
BINDING="WRITE_RULES_DB"

fail() {
  echo ""
  echo "❌ $1"
  echo ""
  read -n 1 "?按任意键关闭..."
  exit 1
}

run_checked() {
  local label="$1"
  shift
  echo "→ $label"
  "$@"
  local code=$?
  [ $code -eq 0 ] || fail "$label 失败（exit code: $code）"
}

echo "=================================================="
echo "WRITE Settlement Manager V7.1.6"
echo "Cloudflare Pages 根配置稳定发布版"
echo "=================================================="

cd "$SOURCE_DIR" || fail "无法进入升级包目录"

LOCAL_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
[ "$LOCAL_VERSION" = "$EXPECTED_VERSION" ] || fail "本地版本错误：期待 $EXPECTED_VERSION，实际 $LOCAL_VERSION"
echo "✅ 升级包版本：v$LOCAL_VERSION"

for cmd in git npx node rsync curl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "缺少必要命令：$cmd"
done

echo ""
echo "[1/8] 克隆干净 GitHub main..."
TMP_ROOT="$(mktemp -d /tmp/write-v716.XXXXXX)" || fail "无法创建临时目录"
WORK_DIR="$TMP_ROOT/repo"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

run_checked "克隆 GitHub" git clone "$REPO_URL" "$WORK_DIR"
cd "$WORK_DIR" || fail "无法进入临时仓库"
run_checked "切换 main" git checkout main
run_checked "更新 main" git pull --ff-only origin main
echo "✅ Git 工作区干净且最新"

echo ""
echo "[2/8] 覆盖 V7.1.6 新版..."
rsync -a --delete   --exclude='.git/'   --exclude='.DS_Store'   "$SOURCE_DIR/" "$WORK_DIR/" || fail "同步新版失败"
cd "$WORK_DIR" || fail "无法返回工作区"

# Cloudflare's experimental download command previously created this file.
# Pages should use ONE root config only.
rm -f wrangler.toml
echo "✅ 已清理历史 wrangler.toml，统一使用根目录 wrangler.jsonc"

echo ""
echo "[3/8] 查询现有 D1 并生成唯一根配置..."
DB_JSON="$(npx wrangler d1 list --json 2>&1)"
DB_CODE=$?
if [ $DB_CODE -ne 0 ]; then
  echo "$DB_JSON"
  fail "读取 D1 列表失败（exit code: $DB_CODE）"
fi

DB_ID="$(printf '%s' "$DB_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 try{
  const x=JSON.parse(s),a=Array.isArray(x)?x:(x.result||[]);
  const d=a.find(v=>v.name==="write-settlement-rules");
  if(d)process.stdout.write(d.uuid||d.id||"");
 }catch(e){}
})')"
[ -n "$DB_ID" ] || fail "Cloudflare 中找不到 write-settlement-rules"
echo "✅ D1 database_id: $DB_ID"

node - "$DB_ID" <<'NODE'
const fs=require("fs"),id=process.argv[2];
const cfg={
  name:"write-settlement-manager",
  pages_build_output_dir:".",
  compatibility_date:"2026-08-09",
  d1_databases:[{
    binding:"WRITE_RULES_DB",
    database_name:"write-settlement-rules",
    database_id:id
  }]
};
fs.writeFileSync("wrangler.jsonc",JSON.stringify(cfg,null,2)+"\n");
NODE
CODE=$?
[ $CODE -eq 0 ] || fail "生成根目录 wrangler.jsonc 失败"
[ ! -f "wrangler.toml" ] || fail "检测到第二个 Wrangler 配置 wrangler.toml"
grep -q '"binding": "WRITE_RULES_DB"' wrangler.jsonc || fail "缺少 WRITE_RULES_DB"
grep -q "$DB_ID" wrangler.jsonc || fail "D1 database_id 写入失败"
echo "✅ 唯一根 Wrangler 配置完成"

echo ""
echo "[4/8] 发布前完整自检..."
CHECK_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
[ "$CHECK_VERSION" = "$EXPECTED_VERSION" ] || fail "工作区版本错误：$CHECK_VERSION"

run_checked "app.bundle.js" node --check src/app.bundle.js
run_checked "knowledge-base.js" node --check src/knowledge-base.js
run_checked "import.worker.bundle.js" node --check src/workers/import.worker.bundle.js
run_checked "release-meta.js" node --check src/release-meta.js
run_checked "Cloudflare sync Function" node --check functions/api/rules/sync.js

[ -f "cloudflare/d1-schema.sql" ] || fail "缺少 D1 Schema"
[ -f "_headers" ] || fail "缺少 _headers"
[ -f "wrangler.jsonc" ] || fail "缺少根 wrangler.jsonc"
[ ! -f "wrangler.toml" ] || fail "存在冲突 Wrangler 配置"
echo "✅ 代码 / FACT资产 / Cloudflare 配置自检通过"

echo ""
echo "[5/8] 提交 GitHub..."
git add -A || fail "git add 失败"
if git diff --cached --quiet; then
  echo "ℹ️ GitHub 已经是相同版本"
else
  COMMIT_OUT="$(git commit -m "Deploy WRITE v7.1.6" 2>&1)"
  COMMIT_CODE=$?
  echo "$COMMIT_OUT"
  [ $COMMIT_CODE -eq 0 ] || fail "git commit 失败（exit code: $COMMIT_CODE）"

  PUSH_OUT="$(git push origin main 2>&1)"
  PUSH_CODE=$?
  echo "$PUSH_OUT"
  [ $PUSH_CODE -eq 0 ] || fail "git push 失败（exit code: $PUSH_CODE）"
fi
echo "✅ GitHub main 已更新"

echo ""
echo "[6/8] Cloudflare Pages 配置预检..."
echo "根配置：$WORK_DIR/wrangler.jsonc"
echo "Pages 不支持 --config 自定义路径，因此本版本明确禁止 --config。"
if grep -R -- '--config' "一键更新到GitHub并部署Cloudflare.command" >/dev/null 2>&1; then
  fail "发布脚本意外包含 --config"
fi
echo "✅ Pages 将自动读取当前目录 wrangler.jsonc"

echo ""
echo "[7/8] 部署 Cloudflare Pages..."
echo "执行：npx wrangler pages deploy . --project-name=$PROJECT --branch=main"

set +e
DEPLOY_OUT="$(npx wrangler pages deploy . --project-name="$PROJECT" --branch=main 2>&1)"
DEPLOY_CODE=$?
set -e

echo "--------------- Wrangler 输出 ---------------"
echo "$DEPLOY_OUT"
echo "--------------- 输出结束 --------------------"
echo "Wrangler exit code: $DEPLOY_CODE"

[ $DEPLOY_CODE -eq 0 ] || fail "Cloudflare Pages 部署失败。上方是完整 Wrangler 错误。"

DEPLOY_URL="$(printf '%s' "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.pages\.dev' | tail -1 || true)"
[ -n "$DEPLOY_URL" ] || fail "部署成功但无法解析唯一 deployment URL"
echo "✅ Deployment: $DEPLOY_URL"

echo ""
echo "[8/8] 在线版本 + D1 API 强验证..."
VERIFIED=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  REMOTE_HTML="$(curl -fsSL "${DEPLOY_URL}/?verify=$(date +%s)-$i" 2>/dev/null || true)"
  if printf '%s' "$REMOTE_HTML" | grep -q 'data-release="7.1.6"'; then
    VERIFIED="yes"
    break
  fi
  sleep 2
done
[ "$VERIFIED" = "yes" ] || fail "唯一 deployment 不是 v7.1.6"
echo "✅ 线上版本确认：v7.1.6"

set +e
SYNC_BODY="$(curl -fsSL "${DEPLOY_URL}/api/rules/sync" 2>&1)"
SYNC_CODE=$?
set -e
if [ $SYNC_CODE -ne 0 ]; then
  echo "$SYNC_BODY"
  fail "规则云同步 API 无法访问"
fi
printf '%s' "$SYNC_BODY" | grep -q '"ok":true' || {
  echo "$SYNC_BODY"
  fail "规则云同步 API 未返回 ok:true"
}
echo "✅ Cloudflare D1 云同步 API 正常"

echo ""
echo "=================================================="
echo "✅ WRITE V7.1.6 全部发布检查通过"
echo "GitHub: https://github.com/simonz0118-max/write-settlement-manager"
echo "Deployment: $DEPLOY_URL"
echo "正式域名: https://f.neovora.co/"
echo "D1: $DB_NAME / $BINDING"
echo "=================================================="
read -n 1 "?按任意键关闭..."
