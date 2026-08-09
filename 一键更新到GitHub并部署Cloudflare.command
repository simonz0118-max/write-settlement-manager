#!/bin/zsh
set -u
set -o pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_VERSION="7.1.8"
BASE_VERSION="7.1.7"
PROJECT="write-settlement-manager"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
DB_NAME="write-settlement-rules"
BINDING="WRITE_RULES_DB"
RELEASE_TIME="2026-08-09 23:38"
CACHE_TAG="7.1.8-2338"
CUSTOM_DOMAIN="https://f.neovora.co"

pause_close() {
  if [ "${WRITE_NONINTERACTIVE:-0}" != "1" ]; then
    echo ""
    read -n 1 "?按任意键关闭..."
  fi
}

fail() {
  echo ""
  echo "❌ $1"
  echo ""
  pause_close
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

contains_config_arg() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --config|--config=*) return 0 ;;
    esac
  done
  return 1
}

http_get_json_check() {
  local url="$1"
  local attempts="${2:-10}"
  local i=1
  local body status tmp errtmp curl_code errbody

  while [ $i -le "$attempts" ]; do
    tmp="$(mktemp /tmp/write-v718-http-body.XXXXXX)" || return 1
    errtmp="$(mktemp /tmp/write-v718-http-err.XXXXXX)" || {
      rm -f "$tmp"
      return 1
    }

    status="$(curl -sS -L --connect-timeout 10 --max-time 30 \
      -o "$tmp" -w '%{http_code}' \
      "${url}?verify=$(date +%s)-$i" 2>"$errtmp")"
    curl_code=$?
    body="$(cat "$tmp" 2>/dev/null || true)"
    errbody="$(cat "$errtmp" 2>/dev/null || true)"
    rm -f "$tmp" "$errtmp"

    if [ $curl_code -eq 0 ] && [ "$status" = "200" ] && \
       printf '%s' "$body" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
      printf '%s' "$body"
      return 0
    fi

    echo "  API尝试 $i/$attempts → HTTP=${status:-curl_error} curl=$curl_code" >&2
    [ -n "$errbody" ] && echo "  curl: $(printf '%s' "$errbody" | head -c 500)" >&2
    [ -n "$body" ] && echo "  Response: $(printf '%s' "$body" | head -c 500)" >&2

    i=$((i + 1))
    sleep 2
  done
  return 1
}

echo "=================================================="
echo "WRITE Settlement Manager V7.1.8"
echo "Pages Functions 路由强验证修复版"
echo "=================================================="

cd "$SOURCE_DIR" || fail "无法进入升级包目录"

for cmd in git npx node curl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "缺少必要命令：$cmd"
done

echo ""
echo "[1/9] clone → checkout → pull 干净 GitHub main..."
TMP_ROOT="$(mktemp -d /tmp/write-v718.XXXXXX)" || fail "无法创建临时目录"
WORK_DIR="$TMP_ROOT/repo"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

run_checked "克隆 GitHub" git clone "$REPO_URL" "$WORK_DIR"
cd "$WORK_DIR" || fail "无法进入临时仓库"
run_checked "切换 main" git checkout main
run_checked "更新 main" git pull --ff-only origin main

BASE_ONLINE="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
case "$BASE_ONLINE" in
  "$BASE_VERSION"|"$EXPECTED_VERSION") ;;
  *) fail "GitHub main 版本不是允许的升级起点：期待 $BASE_VERSION 或 $EXPECTED_VERSION，实际 $BASE_ONLINE" ;;
esac
echo "✅ GitHub main 起点：v$BASE_ONLINE"

echo ""
echo "[2/9] 覆盖 V7.1.8 发布器 + Functions 路由配置 + 版本日志..."

cp "$SOURCE_DIR/一键更新到GitHub并部署Cloudflare.command" \
   "$WORK_DIR/一键更新到GitHub并部署Cloudflare.command" || fail "写入新版发布器失败"
chmod +x "$WORK_DIR/一键更新到GitHub并部署Cloudflare.command" 2>/dev/null || true

mkdir -p "$WORK_DIR/docs/tests"
cp "$SOURCE_DIR/docs/tests/TEST_RESULTS_V7_1_8.md" \
   "$WORK_DIR/docs/tests/TEST_RESULTS_V7_1_8.md" || fail "写入 V7.1.8 自检报告失败"
cp "$SOURCE_DIR/升级说明_请先看.txt" \
   "$WORK_DIR/升级说明_请先看.txt" || fail "写入升级说明失败"

# 显式路由：仅 /api/* 进入 Pages Functions。
# 这样静态页面继续直接由 Pages Assets 服务，不增加无意义 Functions 调用。
cat > "$WORK_DIR/_routes.json" <<'ROUTES'
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
ROUTES

node <<'NODE'
const fs = require("fs");
const VERSION = "7.1.8";
const RELEASE_TIME = "2026-08-09 23:38";
const CACHE_TAG = "7.1.8-2338";

function mustRead(path) {
  if (!fs.existsSync(path)) throw new Error(`缺少文件: ${path}`);
  return fs.readFileSync(path, "utf8");
}
function write(path, text) {
  fs.writeFileSync(path, text.endsWith("\n") ? text : text + "\n");
}

{
  let s = mustRead("index.html");
  s = s.replace(/data-release="7\.1\.7"/g, 'data-release="7.1.8"');
  s = s.replace(/<small>v7\.1\.7<\/small>/g, '<small>v7.1.8</small>');
  s = s.replace(/id="historyCurrentVersion">v7\.1\.7</g, 'id="historyCurrentVersion">v7.1.8<');
  s = s.replace(/v=7\.1\.7-[0-9]+/g, `v=${CACHE_TAG}`);
  s = s.replace(/WRITE v7\.1\.7/g, "WRITE v7.1.8");
  if (!s.includes('data-release="7.1.8"')) throw new Error("index.html data-release 更新失败");
  write("index.html", s);
}

for (const path of [
  "src/app.js",
  "src/app.bundle.js",
  "src/styles.css",
  "src/workers/import.worker.bundle.js"
]) {
  if (!fs.existsSync(path)) continue;
  write(path, mustRead(path).replace(/7\.1\.7/g, "7.1.8"));
}

{
  const path = "assets/release-history.json";
  const data = JSON.parse(mustRead(path));
  data.current = {
    version: VERSION,
    time: RELEASE_TIME,
    title: "Pages Functions 路由强验证修复",
    sections: [
      {
        label: "根因修复",
        items: [
          "V7.1.7 页面与Pages部署成功，但/api/rules/sync在线返回404；API源码本身不会返回404，问题锁定在Pages Functions路由层。",
          "新增根_routes.json，明确include=/api/*、exclude=[]，只让API请求进入Pages Functions。"
        ]
      },
      {
        label: "部署前验证",
        items: [
          "发布前运行wrangler pages functions build并输出编译后的_routes.json。",
          "只有编译路由确认覆盖/api/rules/sync后，才允许提交GitHub和部署Cloudflare。"
        ]
      },
      {
        label: "在线验证",
        items: [
          "部署后同时检查唯一pages.dev deployment的data-release=v7.1.8。",
          "API验证记录HTTP状态码与响应正文；必须HTTP 200且JSON ok:true。",
          "正式域名f.neovora.co也进行版本与API复核；deployment成功是硬条件，正式域名复核作为发布完成确认。"
        ]
      },
      {
        label: "业务保护",
        items: [
          "不修改订单统计、CN FACT、FACT自动生成/学习、数量守恒、会计结算、未知商品过滤、规则学习、IndexedDB/D1及主题逻辑。"
        ]
      }
    ]
  };

  const item = {
    version: VERSION,
    time: RELEASE_TIME,
    title: "修复Pages Functions API路由404并增加编译路由强验证",
    items: [
      "新增根_routes.json：仅/api/*进入Pages Functions。",
      "发布前使用wrangler pages functions build生成Worker和routes产物。",
      "编译后必须证明/api/rules/sync被路由规则覆盖，否则发布立即中止。",
      "部署后API检查升级为HTTP状态码+响应正文+ok:true三重验证。",
      "继续保持唯一wrangler.jsonc、D1自动绑定、唯一deployment URL和data-release强验证。",
      "本版不修改结算、FACT和规则学习业务逻辑。"
    ]
  };

  data.history = Array.isArray(data.history) ? data.history.filter(x => x && x.version !== VERSION) : [];
  data.history.unshift(item);
  write(path, JSON.stringify(data, null, 2));
  write("src/release-meta.js", "window.WRITE_RELEASE_META = " + JSON.stringify(data) + ";");
}

{
  const path = "CHANGELOG.md";
  let s = mustRead(path);
  if (!/^## v7\.1\.8\b/m.test(s)) {
    s =
`## v7.1.8 — ${RELEASE_TIME} (Europe/Paris)
- 修复 V7.1.7 Cloudflare Pages 部署成功但 \`/api/rules/sync\` 在线返回 404。
- 新增根 \`_routes.json\`：\`include=["/api/*"]\`，明确只让 API 路径进入 Pages Functions。
- 发布前执行 \`wrangler pages functions build\` 并生成路由产物；必须验证 \`/api/rules/sync\` 被路由覆盖后才能提交和部署。
- 在线 API 验证升级为 HTTP 状态码 + response body + \`ok:true\` 三重检查。
- 不修改订单、CN FACT、数量守恒、会计报表、未知商品过滤、规则学习及 IndexedDB/D1 业务逻辑。

` + s;
  }
  write(path, s);
}

write("RELEASE.txt",
`WRITE Settlement Manager V7.1.8
Release: ${RELEASE_TIME}

Pages Functions API 路由修复：
- explicit root _routes.json
- include /api/*
- predeploy pages functions build
- compiled route verification for /api/rules/sync
- HTTP 200 + JSON ok:true online verification
- unique root wrangler.jsonc
- WRITE_RULES_DB / write-settlement-rules
- business logic unchanged
`);

if (fs.existsSync("PACKAGE_README.md")) {
  let s = mustRead("PACKAGE_README.md");
  s = s.replace(/^# WRITE Settlement Manager V7\.1\.7/m, "# WRITE Settlement Manager V7.1.8");
  s = s.replace(/当前正式版本：\*\*V7\.1\.7\*\*/g, "当前正式版本：**V7.1.8**");
  write("PACKAGE_README.md", s);
}

for (const path of ["README.md", "README_CN.md"]) {
  if (!fs.existsSync(path)) continue;
  let s = mustRead(path);
  s = s.replace(/Current release: \*\*V7\.1\.7\*\*/g, "Current release: **V7.1.8**");
  s = s.replace(/V7\.1\.7 已用 FACT-/g, "V7.1.8 已用 FACT-");
  s = s.replace(/## Current release — v7\.1\.7/g, "## Current release — v7.1.8");
  s = s.replace(/## 当前版本 — v7\.1\.7/g, "## 当前版本 — v7.1.8");
  s = s.replace(/### V7\.1\.7 highlights/g, "### V7.1.8 highlights");
  s = s.replace(/### V7\.1\.7 重点/g, "### V7.1.8 重点");
  write(path, s);
}
NODE
PATCH_CODE=$?
[ $PATCH_CODE -eq 0 ] || fail "V7.1.8 版本/日志补丁失败"

echo "✅ V7.1.8 路由配置、元数据、弹窗、历史、CHANGELOG、RELEASE 已同步"

echo ""
echo "[3/9] 查询 D1 并生成唯一根 wrangler.jsonc..."

rm -f wrangler.toml

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
[ $? -eq 0 ] || fail "生成根 wrangler.jsonc 失败"

[ ! -f wrangler.toml ] || fail "存在冲突 wrangler.toml"
grep -q '"binding": "WRITE_RULES_DB"' wrangler.jsonc || fail "缺少 WRITE_RULES_DB"
grep -q '"database_name": "write-settlement-rules"' wrangler.jsonc || fail "D1 database_name 错误"
grep -q "$DB_ID" wrangler.jsonc || fail "D1 database_id 写入失败"
echo "✅ 唯一根 Wrangler 配置完成"

echo ""
echo "[4/9] 编译 Pages Functions 并验证真实路由..."

[ -f functions/api/rules/sync.js ] || fail "缺少 functions/api/rules/sync.js"
[ -f _routes.json ] || fail "缺少显式 _routes.json"

node <<'NODE'
const fs=require("fs");
const r=JSON.parse(fs.readFileSync("_routes.json","utf8"));
if(r.version!==1) throw new Error("_routes.json version必须为1");
if(!Array.isArray(r.include) || !r.include.includes("/api/*")) throw new Error("_routes.json必须include /api/*");
if(!Array.isArray(r.exclude)) throw new Error("_routes.json exclude必须为数组");
if(r.exclude.some(x => x==="/api/*" || x==="/api/rules/sync")) throw new Error("_routes.json错误排除了API");
NODE
[ $? -eq 0 ] || fail "_routes.json 结构验证失败"

FUNCTION_WORKER="$TMP_ROOT/pages-functions-worker.js"
FUNCTION_ROUTES="$TMP_ROOT/pages-functions-routes.json"

set +e
FUNCTION_BUILD_OUT="$(npx wrangler pages functions build functions \
  --outfile="$FUNCTION_WORKER" \
  --output-routes-path="$FUNCTION_ROUTES" \
  --project-directory="$WORK_DIR" 2>&1)"
FUNCTION_BUILD_CODE=$?
set -e

echo "--------------- Functions build 输出 ---------------"
echo "$FUNCTION_BUILD_OUT"
echo "----------------------------------------------------"

[ $FUNCTION_BUILD_CODE -eq 0 ] || fail "Pages Functions 编译失败（exit code: $FUNCTION_BUILD_CODE）"
[ -s "$FUNCTION_WORKER" ] || fail "Functions build 未生成 Worker"
[ -s "$FUNCTION_ROUTES" ] || fail "Functions build 未生成 routes JSON"

node - "$FUNCTION_ROUTES" <<'NODE'
const fs=require("fs");
const p=process.argv[2];
const r=JSON.parse(fs.readFileSync(p,"utf8"));
const include=Array.isArray(r.include)?r.include:[];
const exclude=Array.isArray(r.exclude)?r.exclude:[];
function globMatch(rule,path){
  if(rule===path)return true;
  if(rule.endsWith("*")) return path.startsWith(rule.slice(0,-1));
  return false;
}
const target="/api/rules/sync";
const included=include.some(x=>globMatch(x,target));
const excluded=exclude.some(x=>globMatch(x,target));
if(!included || excluded){
  console.error(JSON.stringify(r,null,2));
  throw new Error(`编译路由没有覆盖 ${target}`);
}
console.log("✅ 编译路由确认覆盖",target);
NODE
[ $? -eq 0 ] || fail "编译后的 Pages Functions 路由验证失败"

echo "✅ Functions源码 → Worker编译 → API路由 三层检查通过"

echo ""
echo "[5/9] 发布前完整业务保护自检..."

CHECK_VERSION="$(grep -Eo 'data-release="[0-9.]+"' index.html | head -1 | cut -d'"' -f2 || true)"
[ "$CHECK_VERSION" = "$EXPECTED_VERSION" ] || fail "工作区版本错误：$CHECK_VERSION"

for f in \
  src/app.bundle.js \
  src/knowledge-base.js \
  src/release-meta.js \
  src/workers/import.worker.bundle.js \
  functions/api/rules/sync.js \
  cloudflare/d1-schema.sql \
  assets/release-history.json \
  _routes.json \
  RELEASE.txt \
  CHANGELOG.md
do
  [ -f "$f" ] || fail "关键文件缺失：$f"
done

run_checked "app.bundle.js" node --check src/app.bundle.js
run_checked "knowledge-base.js" node --check src/knowledge-base.js
run_checked "import.worker.bundle.js" node --check src/workers/import.worker.bundle.js
run_checked "release-meta.js" node --check src/release-meta.js
run_checked "Cloudflare sync Function" node --check functions/api/rules/sync.js

grep -q '"version": "7.1.8"' assets/release-history.json || fail "历史更新未同步 v7.1.8"
grep -q 'v7.1.8' CHANGELOG.md || fail "CHANGELOG 未同步 v7.1.8"
grep -q 'V7.1.8' RELEASE.txt || fail "RELEASE 未同步 v7.1.8"

DEPLOY_ARGS=(
  pages
  deploy
  .
  "--project-name=$PROJECT"
  --branch=main
)

contains_config_arg "${DEPLOY_ARGS[@]}" && fail "真实 Pages deploy 参数包含禁止的 --config"
contains_config_arg pages deploy . --config bad.jsonc || fail "--config 检测器失效"
contains_config_arg pages deploy . --config=bad.jsonc || fail "--config= 检测器失效"

echo "✅ 发布前业务保护、自检、真实部署参数全部通过"

echo ""
echo "[6/9] 提交 GitHub..."
git add -A || fail "git add 失败"

if git diff --cached --quiet; then
  echo "ℹ️ GitHub main 已经是相同 V7.1.8 内容"
else
  COMMIT_OUT="$(git commit -m "Deploy WRITE v7.1.8" 2>&1)"
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
echo "[7/9] Cloudflare Pages 最终配置预检..."
[ -f wrangler.jsonc ] || fail "缺少唯一根 wrangler.jsonc"
[ ! -f wrangler.toml ] || fail "存在第二 Wrangler 配置"
[ -f _routes.json ] || fail "缺少 _routes.json"
contains_config_arg "${DEPLOY_ARGS[@]}" && fail "真实部署参数出现 --config"

echo "✅ root wrangler.jsonc"
echo "✅ root _routes.json → /api/*"
echo "✅ pages functions build 路由已验证"
echo "✅ deploy 参数无 --config"

echo ""
echo "[8/9] 部署 Cloudflare Pages..."
echo "执行：npx wrangler pages deploy . --project-name=$PROJECT --branch=main"

set +e
DEPLOY_OUT="$(npx wrangler "${DEPLOY_ARGS[@]}" 2>&1)"
DEPLOY_CODE=$?
set -e

echo "--------------- Wrangler 输出 ---------------"
echo "$DEPLOY_OUT"
echo "--------------- 输出结束 --------------------"
echo "Wrangler exit code: $DEPLOY_CODE"

[ $DEPLOY_CODE -eq 0 ] || fail "Cloudflare Pages 部署失败"

DEPLOY_URLS="$(printf '%s' "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.pages\.dev' | sort -u || true)"
DEPLOY_URL_COUNT="$(printf '%s\n' "$DEPLOY_URLS" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
[ "$DEPLOY_URL_COUNT" = "1" ] || {
  echo "$DEPLOY_URLS"
  fail "要求唯一 deployment URL，实际检测到 $DEPLOY_URL_COUNT 个"
}
DEPLOY_URL="$(printf '%s\n' "$DEPLOY_URLS" | head -1)"
echo "✅ 唯一 Deployment: $DEPLOY_URL"

echo ""
echo "[9/9] 线上版本 + API + D1 强验证..."

VERSION_OK=""
i=1
while [ $i -le 10 ]; do
  REMOTE_HTML="$(curl -fsSL "${DEPLOY_URL}/?verify=$(date +%s)-$i" 2>/dev/null || true)"
  if printf '%s' "$REMOTE_HTML" | grep -q 'data-release="7.1.8"'; then
    VERSION_OK="yes"
    break
  fi
  echo "  版本确认尝试 $i/10"
  i=$((i + 1))
  sleep 2
done
[ "$VERSION_OK" = "yes" ] || fail "唯一 deployment 未确认 data-release=v7.1.8"
echo "✅ Deployment 在线版本：v7.1.8"

echo "→ 验证 Deployment API: ${DEPLOY_URL}/api/rules/sync"
API_BODY="$(http_get_json_check "${DEPLOY_URL}/api/rules/sync" 10)"
[ $? -eq 0 ] || fail "Deployment /api/rules/sync 未达到 HTTP 200 + ok:true"
echo "✅ Deployment API：HTTP 200 + ok:true"
echo "✅ D1 Binding 可用"

echo "→ 复核正式域名：$CUSTOM_DOMAIN"
DOMAIN_VERSION=""
i=1
while [ $i -le 10 ]; do
  REMOTE_HTML="$(curl -fsSL "${CUSTOM_DOMAIN}/?verify=$(date +%s)-$i" 2>/dev/null || true)"
  if printf '%s' "$REMOTE_HTML" | grep -q 'data-release="7.1.8"'; then
    DOMAIN_VERSION="yes"
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$DOMAIN_VERSION" = "yes" ]; then
  echo "✅ 正式域名版本：v7.1.8"
  if DOMAIN_API_BODY="$(http_get_json_check "${CUSTOM_DOMAIN}/api/rules/sync" 5)"; then
    echo "✅ 正式域名 API：HTTP 200 + ok:true"
  else
    echo "⚠️ Deployment 已全部通过，但正式域名 API 尚未同步；请稍后刷新正式域名。"
  fi
else
  echo "⚠️ Deployment 已全部通过，但正式域名暂未回读到 v7.1.8。"
fi

echo ""
echo "=================================================="
echo "✅ WRITE V7.1.8 核心发布验证全部通过"
echo "GitHub: https://github.com/simonz0118-max/write-settlement-manager"
echo "Deployment: $DEPLOY_URL"
echo "正式域名: $CUSTOM_DOMAIN"
echo "D1: $DB_NAME / $BINDING"
echo "=================================================="
pause_close
