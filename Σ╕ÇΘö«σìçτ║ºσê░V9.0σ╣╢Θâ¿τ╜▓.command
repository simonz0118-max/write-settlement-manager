#!/bin/zsh
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
PROJECT="write-settlement-manager"
DOMAIN="https://f.neovora.co"
GOLDEN_SHA="5ca789528560587ee27ce66a16aac77d4bd8f77e8086e400e2d33a7203ae9576"
TMP="$(mktemp -d /tmp/write-v900-acceptance.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

run(){ echo "→ $1"; shift; "$@"; }
fail(){ echo "❌ $1" >&2; exit 1; }

for command_name in git node npx curl shasum; do
  command -v "$command_name" >/dev/null 2>&1 || fail "缺少命令：$command_name"
done

echo "[1/8] 校验升级包完整性"
node - "$SOURCE_DIR" <<'NODE'
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.argv[2],manifest=JSON.parse(fs.readFileSync(path.join(root,'MANIFEST_SHA256.json'),'utf8'));
for(const [name,expected] of Object.entries(manifest)){
  const file=path.join(root,name);if(!fs.existsSync(file))throw new Error(`缺少 ${name}`);
  const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(actual!==expected)throw new Error(`哈希不一致 ${name}`);
}
console.log(`MANIFEST PASS: ${Object.keys(manifest).length} files`);
NODE

echo "[2/8] 获取 GitHub main"
run "clone" git clone --branch main --single-branch "$REPO_URL" "$TMP/repo"
cd "$TMP/repo"
run "fast-forward" git pull --ff-only origin main

echo "[3/8] 应用生产验收修复"
run "patch" node "$SOURCE_DIR/patch-v900.js" "$TMP/repo" "$SOURCE_DIR"

echo "[4/8] 发布硬门"
T="$SOURCE_DIR/docs/tests"
node "$T/v900_orders_only_contract.js" data/v9/V9_PRODUCTION_CONTRACT.json
node "$T/v900_unknown_never_lost.js" src/v8/human-workflow.js src/v9/autonomous-fact-engine.js
node "$T/v900_no_phantom_template_rows.js" src/v8/human-workflow.js src/v9/autonomous-fact-engine.js
node "$T/v900_exact_price_only.js" src/v8/human-workflow.js src/v9/autonomous-fact-engine.js
node "$T/v900_template_hash.js" assets/FACT_TEMPLATE_UNIFIED_V2.xlsx "$GOLDEN_SHA"
node "$T/v900_red_review_xml.js" src/v9/golden-template-runtime.js
node "$T/v900_learning_contract.js" src/v9/learning-store.js
node docs/tests/v900_production_takeover.js index.html
node docs/tests/v900_fulfillment_identity.js src/v8/human-workflow.js src/v9/autonomous-fact-engine.js
node docs/tests/v900_classification_coverage.js src/v8/human-workflow.js
node docs/tests/v900_cloud_rule_serialization.js src/v8/semantic-core.js src/v8/rule-store.js
node docs/tests/v900_namespace_prefix_import.js
node docs/tests/v900_formula_cache_isolation.js
for file in src/app.bundle.js src/runtime-v740.js src/universal-source-v759.js src/v8/human-workflow.js src/v8/rule-store.js src/v9/*.js src/workers/*.js; do node --check "$file"; done

echo "[5/8] GitHub main"
git add -A
if ! git diff --cached --quiet; then
  git commit -m "Fix WRITE v9.0 production acceptance defects"
  git push origin main
else
  echo "main 已包含全部验收修复"
fi

echo "[6/8] Cloudflare 身份"
run "wrangler whoami" npx --yes wrangler whoami

echo "[7/8] Cloudflare Pages 部署"
run "pages deploy" npx --yes wrangler pages deploy . --project-name="$PROJECT" --branch=main

echo "[8/8] 正式域名与 D1 验证"
verified=""
for attempt in {1..45}; do
  html="$(curl -fsSL --connect-timeout 8 --max-time 20 "$DOMAIN/?verify=$(date +%s)-$attempt" || true)"
  if print -r -- "$html" | grep -q 'data-release="9.0.0"' && print -r -- "$html" | grep -q 'v9/autonomous-fact-engine.js'; then
    verified="yes"
    break
  fi
  sleep 4
done
[[ "$verified" = "yes" ]] || fail "正式域名未更新到验收版 V9.0.0"

api="$(curl -fsSL --connect-timeout 8 --max-time 20 -H 'content-type: application/json' -d '{"semanticV8":true,"rules":[]}' "$DOMAIN/api/rules/sync")"
print -r -- "$api" | grep -q '"ok":true' || fail "D1 规则同步 API 未通过"

echo "✅ V9.0 生产验收修复、GitHub、Cloudflare 和 D1 全部完成"
