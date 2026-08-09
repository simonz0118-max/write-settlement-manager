#!/bin/zsh
set -u
set -o pipefail
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SOURCE_DIR" || exit 1
EXPECTED_VERSION="7.1.6"
DB_NAME="write-settlement-rules"

fail() {
  echo ""
  echo "❌ $1"
  read -n 1 "?按任意键关闭..."
  exit 1
}

LOCAL_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
[ "$LOCAL_VERSION" = "$EXPECTED_VERSION" ] || fail "版本错误：$LOCAL_VERSION"

echo "=================================================="
echo "WRITE V7.1.6 D1 初始化 / 校验"
echo "=================================================="

WHO="$(npx wrangler whoami 2>&1)"; CODE=$?; echo "$WHO"
[ $CODE -eq 0 ] || fail "Wrangler 登录检查失败"

DB_JSON="$(npx wrangler d1 list --json 2>&1)"; CODE=$?
[ $CODE -eq 0 ] || { echo "$DB_JSON"; fail "D1 列表读取失败"; }

DB_ID="$(printf '%s' "$DB_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 try{const x=JSON.parse(s),a=Array.isArray(x)?x:(x.result||[]),d=a.find(v=>v.name==="write-settlement-rules");if(d)process.stdout.write(d.uuid||d.id||"")}catch(e){}
})')"

if [ -z "$DB_ID" ]; then
  CREATE="$(npx wrangler d1 create "$DB_NAME" --location weur 2>&1)"; CODE=$?; echo "$CREATE"
  [ $CODE -eq 0 ] || fail "D1 创建失败"
  DB_ID="$(printf '%s' "$CREATE" | grep -Eo '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' | tail -1 || true)"
fi
[ -n "$DB_ID" ] || fail "无法取得 D1 database_id"

SCHEMA_OUT="$(npx wrangler d1 execute "$DB_NAME" --remote --file="cloudflare/d1-schema.sql" --yes 2>&1)"; CODE=$?; echo "$SCHEMA_OUT"
[ $CODE -eq 0 ] || fail "D1 Schema 执行失败"

VERIFY_OUT="$(npx wrangler d1 execute "$DB_NAME" --remote --command='SELECT name FROM sqlite_master WHERE type="table" AND name="write_rules";' --yes 2>&1)"; CODE=$?; echo "$VERIFY_OUT"
[ $CODE -eq 0 ] || fail "D1 表验证失败"
printf '%s' "$VERIFY_OUT" | grep -q "write_rules" || fail "write_rules 表不存在"
echo "✅ D1 正常"

exec "$SOURCE_DIR/一键更新到GitHub并部署Cloudflare.command"
