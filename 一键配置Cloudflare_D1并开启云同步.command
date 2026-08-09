#!/bin/zsh
set -euo pipefail
PROJECT="write-settlement-manager"
DB_NAME="write-settlement-rules"
BINDING="WRITE_RULES_DB"
CONFIG="wrangler.jsonc"
SCHEMA="cloudflare/d1-schema.sql"
cd "$(dirname "$0")"

echo "=================================================="
echo "WRITE Settlement Manager V7.1.1"
echo "Cloudflare D1 全自动配置 + Pages 部署"
echo "=================================================="

command -v npx >/dev/null 2>&1 || { echo "❌ 未找到 npx / Node.js"; read -n 1 "?按任意键关闭..."; exit 1; }
[ -f "$SCHEMA" ] || { echo "❌ 缺少 $SCHEMA"; read -n 1 "?按任意键关闭..."; exit 1; }

echo "[1/7] 检查 Cloudflare 登录..."
npx wrangler whoami

echo "[2/7] 查找或创建 D1：$DB_NAME"
DB_JSON="$(npx wrangler d1 list --json 2>/dev/null || echo '[]')"
DB_ID="$(printf '%s' "$DB_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 try{const x=JSON.parse(s),a=Array.isArray(x)?x:(x.result||[]),d=a.find(v=>v.name==="write-settlement-rules");if(d)process.stdout.write(d.uuid||d.id||"")}catch(e){}
})')"

if [ -z "$DB_ID" ]; then
  CREATE_OUT="$(npx wrangler d1 create "$DB_NAME" --location weur 2>&1)"
  echo "$CREATE_OUT"
  DB_ID="$(printf '%s' "$CREATE_OUT" | grep -Eo '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' | tail -1 || true)"
fi

if [ -z "$DB_ID" ]; then
  DB_JSON="$(npx wrangler d1 list --json)"
  DB_ID="$(printf '%s' "$DB_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const x=JSON.parse(s),a=Array.isArray(x)?x:(x.result||[]),d=a.find(v=>v.name==="write-settlement-rules");if(d)process.stdout.write(d.uuid||d.id||"")
})')"
fi

[ -n "$DB_ID" ] || { echo "❌ 无法取得 D1 database_id"; read -n 1 "?按任意键关闭..."; exit 1; }
echo "✅ D1 ID: $DB_ID"

echo "[3/7] 自动写入 WRITE_RULES_DB Binding..."
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

echo "[4/7] 初始化远程数据库..."
npx wrangler d1 execute "$DB_NAME" --remote --file="$SCHEMA" --yes

echo "[5/7] 验证 write_rules..."
npx wrangler d1 execute "$DB_NAME" --remote --command='SELECT name FROM sqlite_master WHERE type="table" AND name="write_rules";' --yes

echo "[6/7] 更新 GitHub..."
git add .
if ! git diff --cached --quiet; then
  git commit -m "V7.1.1 configure Cloudflare D1 sync"
fi
git pull --rebase origin main || true
git push origin main

echo "[7/7] 使用 D1 Binding 重新部署 Pages..."
npx wrangler pages deploy . --project-name="$PROJECT" --branch=main --config="$CONFIG"

echo ""
echo "=================================================="
echo "✅ D1 云同步已经启用"
echo "数据库：$DB_NAME"
echo "Binding：$BINDING"
echo "正式站：https://f.neovora.co/"
echo "=================================================="
echo "打开 规则学习；应自动变为「云端已连接」。"
read -n 1 "?按任意键关闭..."
