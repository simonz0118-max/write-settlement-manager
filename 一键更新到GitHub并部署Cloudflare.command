#!/bin/zsh
set -u
set -o pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_VERSION="7.1.5"
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
echo "WRITE Settlement Manager V7.1.5"
echo "稳定发布器：GitHub + Cloudflare Pages + D1"
echo "=================================================="

cd "$SOURCE_DIR" || fail "无法进入升级包目录"

LOCAL_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
[ "$LOCAL_VERSION" = "$EXPECTED_VERSION" ] || fail "本地版本不一致：期待 $EXPECTED_VERSION，实际 $LOCAL_VERSION"
echo "✅ 升级包版本：v$LOCAL_VERSION"

for cmd in git npx node rsync curl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "缺少必要命令：$cmd"
done

echo ""
echo "[1/8] 准备全新 GitHub 工作区..."
TMP_ROOT="$(mktemp -d /tmp/write-v715.XXXXXX)" || fail "无法创建临时目录"
WORK_DIR="$TMP_ROOT/repo"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

run_checked "克隆 GitHub 正式仓库" git clone "$REPO_URL" "$WORK_DIR"
cd "$WORK_DIR" || fail "无法进入临时 Git 仓库"
run_checked "切换 main" git checkout main
run_checked "同步远程最新 main" git pull --ff-only origin main
echo "✅ Git 仓库为最新干净 main"

echo ""
echo "[2/8] 保存仓库中已存在的 D1 配置..."
PRESERVED_WRANGLER="$TMP_ROOT/preserved-wrangler.jsonc"
if [ -f "wrangler.jsonc" ] && ! grep -q "__WRITE_D1_DATABASE_ID__" "wrangler.jsonc"; then
  cp "wrangler.jsonc" "$PRESERVED_WRANGLER" || fail "保存 wrangler.jsonc 失败"
  echo "✅ 已保存现有 Wrangler / D1 配置"
else
  echo "ℹ️ 仓库没有可直接复用的 Wrangler 配置"
fi

echo ""
echo "[3/8] 覆盖 V7.1.5 新版文件..."
rsync -a --delete   --exclude='.git/'   --exclude='.DS_Store'   --exclude='wrangler.jsonc'   "$SOURCE_DIR/" "$WORK_DIR/" || fail "同步新版文件失败"
cd "$WORK_DIR" || fail "无法回到 Git 工作区"

if [ -f "$PRESERVED_WRANGLER" ]; then
  cp "$PRESERVED_WRANGLER" "wrangler.jsonc" || fail "恢复 Wrangler 配置失败"
fi

echo ""
echo "[4/8] 获取 Cloudflare Pages 真实配置并校验 D1..."
DB_JSON="$(npx wrangler d1 list --json 2>&1)"
DB_LIST_CODE=$?
if [ $DB_LIST_CODE -ne 0 ]; then
  echo "$DB_JSON"
  fail "读取 Cloudflare D1 列表失败（exit code: $DB_LIST_CODE）"
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

# Use Cloudflare's actual project config when available.
DOWNLOADED_CONFIG="$TMP_ROOT/pages-wrangler.jsonc"
CONFIG_OUT="$(npx wrangler pages download config "$PROJECT" --force --config="$DOWNLOADED_CONFIG" 2>&1)"
CONFIG_CODE=$?
echo "$CONFIG_OUT"

if [ -f "$DOWNLOADED_CONFIG" ]; then
  cp "$DOWNLOADED_CONFIG" wrangler.jsonc || fail "复制 Pages 配置失败"
elif [ -f "wrangler.jsonc" ]; then
  echo "ℹ️ 当前 Wrangler 版本未按指定路径写出配置，继续使用仓库有效 wrangler.jsonc"
elif [ $CONFIG_CODE -ne 0 ]; then
  fail "下载 Pages 项目配置失败（exit code: $CONFIG_CODE）"
else
  fail "Pages 配置命令没有生成配置文件"
fi

node - "$DB_ID" <<'NODE'
const fs=require("fs"),id=process.argv[2],path="wrangler.jsonc";
if(!fs.existsSync(path))throw new Error("wrangler.jsonc 不存在");
let raw=fs.readFileSync(path,"utf8");
let clean=raw.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");
let cfg=JSON.parse(clean);
cfg.name=cfg.name||"write-settlement-manager";
cfg.pages_build_output_dir=cfg.pages_build_output_dir||".";
cfg.compatibility_date=cfg.compatibility_date||"2026-08-09";
const list=Array.isArray(cfg.d1_databases)?cfg.d1_databases:[];
cfg.d1_databases=list.filter(x=>x&&x.binding!=="WRITE_RULES_DB");
cfg.d1_databases.push({
  binding:"WRITE_RULES_DB",
  database_name:"write-settlement-rules",
  database_id:id
});
fs.writeFileSync(path,JSON.stringify(cfg,null,2)+"\n");
NODE
PATCH_CODE=$?
[ $PATCH_CODE -eq 0 ] || fail "写入 D1 Binding 失败（exit code: $PATCH_CODE）"
grep -q '"binding": "WRITE_RULES_DB"' wrangler.jsonc || fail "Wrangler 配置缺少 WRITE_RULES_DB"
grep -q "$DB_ID" wrangler.jsonc || fail "Wrangler 配置 database_id 不正确"
echo "✅ Pages 配置 + D1 Binding 已确认"

echo ""
echo "[5/8] 发布前完整自检..."
CHECK_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
[ "$CHECK_VERSION" = "$EXPECTED_VERSION" ] || fail "Git 工作区版本异常：$CHECK_VERSION"
run_checked "检查 app.bundle.js" node --check src/app.bundle.js
run_checked "检查 knowledge-base.js" node --check src/knowledge-base.js
run_checked "检查 import.worker.bundle.js" node --check src/workers/import.worker.bundle.js
run_checked "检查 release-meta.js" node --check src/release-meta.js
run_checked "检查 Cloudflare sync Function" node --check functions/api/rules/sync.js
[ -f "cloudflare/d1-schema.sql" ] || fail "缺少 D1 Schema"
[ -f "_headers" ] || fail "缺少 Cloudflare _headers"
echo "✅ 发布前全部自检通过"

echo ""
echo "[6/8] 提交 GitHub..."
git add -A || fail "git add 失败"
if git diff --cached --quiet; then
  echo "ℹ️ GitHub 已经包含相同版本文件，无需提交"
else
  COMMIT_OUT="$(git commit -m "Deploy WRITE v7.1.5" 2>&1)"
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
echo "[7/8] 部署 Cloudflare Pages..."
echo "执行：npx wrangler pages deploy . --project-name=$PROJECT --branch=main --config=wrangler.jsonc"

set +e
DEPLOY_OUT="$(npx wrangler pages deploy . --project-name="$PROJECT" --branch=main --config=wrangler.jsonc 2>&1)"
DEPLOY_CODE=$?
set -e

echo "--------------- Wrangler 输出 ---------------"
echo "$DEPLOY_OUT"
echo "--------------- 输出结束 --------------------"
echo "Wrangler exit code: $DEPLOY_CODE"

[ $DEPLOY_CODE -eq 0 ] || fail "Cloudflare Pages 部署失败。上方已完整显示 Wrangler 错误。"

DEPLOY_URL="$(printf '%s' "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.pages\.dev' | tail -1 || true)"
[ -n "$DEPLOY_URL" ] || fail "部署返回成功，但没有找到唯一 Pages deployment URL"
echo "✅ Deployment: $DEPLOY_URL"

echo ""
echo "[8/8] 在线回读版本 + 云同步 API..."
VERIFIED=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  REMOTE_HTML="$(curl -fsSL "${DEPLOY_URL}/?verify=$(date +%s)-$i" 2>/dev/null || true)"
  if printf '%s' "$REMOTE_HTML" | grep -q 'data-release="7.1.5"'; then
    VERIFIED="yes"
    break
  fi
  sleep 2
done
[ "$VERIFIED" = "yes" ] || fail "唯一 deployment 回读不是 v7.1.5"
echo "✅ 线上版本确认：v7.1.5"

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
  fail "规则云同步 API 有响应，但没有返回 ok:true"
}
echo "✅ Cloudflare D1 云同步 API 正常"

echo ""
echo "=================================================="
echo "✅ WRITE V7.1.5 全部发布检查通过"
echo "GitHub: https://github.com/simonz0118-max/write-settlement-manager"
echo "Deployment: $DEPLOY_URL"
echo "正式域名: https://f.neovora.co/"
echo "D1: $DB_NAME / $BINDING"
echo "=================================================="
read -n 1 "?按任意键关闭..."
