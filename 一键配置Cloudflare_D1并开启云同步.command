#!/bin/zsh
set -euo pipefail
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SOURCE_DIR"

EXPECTED_VERSION="7.1.4"
DB_NAME="write-settlement-rules"

echo "=================================================="
echo "WRITE V7.1.4 Cloudflare D1 初始化 / 校验"
echo "=================================================="

LOCAL_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
[ "$LOCAL_VERSION" = "$EXPECTED_VERSION" ] || {
  echo "❌ 版本错误：$LOCAL_VERSION"
  read -n 1 "?按任意键关闭..."
  exit 1
}

npx wrangler whoami

DB_JSON="$(npx wrangler d1 list --json 2>/dev/null || echo '[]')"
DB_ID="$(printf '%s' "$DB_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 try{
   const x=JSON.parse(s),a=Array.isArray(x)?x:(x.result||[]);
   const d=a.find(v=>v.name==="write-settlement-rules");
   if(d)process.stdout.write(d.uuid||d.id||"");
 }catch(e){}
})')"

if [ -z "$DB_ID" ]; then
  CREATE_OUT="$(npx wrangler d1 create "$DB_NAME" --location weur 2>&1)"
  echo "$CREATE_OUT"
  DB_ID="$(printf '%s' "$CREATE_OUT" | grep -Eo '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' | tail -1 || true)"
fi

[ -n "$DB_ID" ] || {
  echo "❌ 无法取得 D1 database_id"
  read -n 1 "?按任意键关闭..."
  exit 1
}

echo "✅ D1: $DB_ID"
npx wrangler d1 execute "$DB_NAME" --remote --file="cloudflare/d1-schema.sql" --yes
VERIFY_OUT="$(npx wrangler d1 execute "$DB_NAME" --remote --command='SELECT name FROM sqlite_master WHERE type="table" AND name="write_rules";' --yes)"
echo "$VERIFY_OUT"
printf '%s' "$VERIFY_OUT" | grep -q "write_rules" || {
  echo "❌ write_rules 表校验失败"
  read -n 1 "?按任意键关闭..."
  exit 1
}
echo "✅ D1 Schema 与 write_rules 正常"

echo "继续执行统一发布器..."
exec "$SOURCE_DIR/一键更新到GitHub并部署Cloudflare.command"
