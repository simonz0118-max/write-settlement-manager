#!/bin/zsh
set -u
set -o pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_VERSION="7.1.7"
BASE_VERSION="7.1.6"
PROJECT="write-settlement-manager"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
DB_NAME="write-settlement-rules"
BINDING="WRITE_RULES_DB"
RELEASE_TIME="2026-08-09 23:30"
CACHE_TAG="7.1.7-2330"

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

echo "=================================================="
echo "WRITE Settlement Manager V7.1.7"
echo "发布器参数级预检修复版"
echo "=================================================="

cd "$SOURCE_DIR" || fail "无法进入升级包目录"

for cmd in git npx node curl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "缺少必要命令：$cmd"
done

echo ""
echo "[1/8] clone → checkout → pull 干净 GitHub main..."
TMP_ROOT="$(mktemp -d /tmp/write-v717.XXXXXX)" || fail "无法创建临时目录"
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
echo "[2/8] 覆盖 V7.1.7 新版发布器 + 版本/日志元数据..."

cp "$SOURCE_DIR/一键更新到GitHub并部署Cloudflare.command" \
   "$WORK_DIR/一键更新到GitHub并部署Cloudflare.command" || fail "写入新版发布器失败"
chmod +x "$WORK_DIR/一键更新到GitHub并部署Cloudflare.command" 2>/dev/null || true

mkdir -p "$WORK_DIR/docs/tests"
cp "$SOURCE_DIR/docs/tests/TEST_RESULTS_V7_1_7.md" \
   "$WORK_DIR/docs/tests/TEST_RESULTS_V7_1_7.md" || fail "写入 V7.1.7 自检报告失败"
cp "$SOURCE_DIR/升级说明_请先看.txt" \
   "$WORK_DIR/升级说明_请先看.txt" || fail "写入升级说明失败"

node <<'NODE'
const fs = require("fs");

const VERSION = "7.1.7";
const RELEASE_TIME = "2026-08-09 23:30";
const CACHE_TAG = "7.1.7-2330";

function mustRead(path) {
  if (!fs.existsSync(path)) throw new Error(`缺少文件: ${path}`);
  return fs.readFileSync(path, "utf8");
}
function write(path, text) {
  fs.writeFileSync(path, text.endsWith("\n") ? text : text + "\n");
}

{
  let s = mustRead("index.html");
  s = s.replace(/data-release="7\.1\.6"/g, 'data-release="7.1.7"');
  s = s.replace(/<small>v7\.1\.6<\/small>/g, '<small>v7.1.7</small>');
  s = s.replace(/id="historyCurrentVersion">v7\.1\.6</g, 'id="historyCurrentVersion">v7.1.7<');
  s = s.replace(/v=7\.1\.6-[0-9]+/g, `v=${CACHE_TAG}`);
  s = s.replace(/WRITE v7\.1\.6/g, "WRITE v7.1.7");
  if (!s.includes('data-release="7.1.7"')) throw new Error("index.html data-release 更新失败");
  write("index.html", s);
}

for (const path of [
  "src/app.js",
  "src/app.bundle.js",
  "src/styles.css",
  "src/workers/import.worker.bundle.js"
]) {
  if (!fs.existsSync(path)) continue;
  const before = mustRead(path);
  const after = before.replace(/7\.1\.6/g, "7.1.7");
  write(path, after);
}

{
  const path = "assets/release-history.json";
  const data = JSON.parse(mustRead(path));
  const current = {
    version: VERSION,
    time: RELEASE_TIME,
    title: "发布器参数级预检修复",
    sections: [
      {
        label: "发布器修复",
        items: [
          "修复V7.1.6发布前预检误报：不再全文搜索发布脚本中的`--config`文字。",
          "Pages部署参数改为结构化数组，只检查真正传给Wrangler的`--config`或`--config=...`参数。"
        ]
      },
      {
        label: "发布流程",
        items: [
          "继续固定clone→pull→覆盖新版→生成唯一根wrangler.jsonc→发布前自检→GitHub→Cloudflare Pages。",
          "实际Pages命令保持为`npx wrangler pages deploy . --project-name=write-settlement-manager --branch=main`。",
          "Wrangler输出中的pages.dev地址去重后必须恰好一个，才进入线上验证。"
        ]
      },
      {
        label: "强验证",
        items: [
          "线上唯一deployment必须返回data-release=v7.1.7。",
          "`/api/rules/sync`必须返回ok:true，否则发布判定失败。",
          "解压升级目录无需.git；发布始终使用临时干净Git仓库。"
        ]
      },
      {
        label: "业务保护",
        items: [
          "不修改订单统计、CN FACT模板逻辑、FACT自动生成/学习、数量守恒、会计结算、未知商品过滤、规则学习、IndexedDB/D1、黑白模式。"
        ]
      }
    ]
  };
  const historyItem = {
    version: VERSION,
    time: RELEASE_TIME,
    title: "修复发布器全文搜索--config导致的必然误判",
    items: [
      "删除V7.1.6对发布脚本自身的全文`--config`扫描。",
      "仅检查真正的Wrangler Pages部署参数数组，注释、说明文字和CHANGELOG出现`--config`不会触发失败。",
      "真实部署参数出现`--config`或`--config=...`仍会立即中止。",
      "固定clone→pull→覆盖新版→唯一根wrangler.jsonc→自检→GitHub→Pages顺序。",
      "唯一deployment URL强校验、data-release=v7.1.7强校验、D1同步API ok:true强校验全部保留。",
      "本版不修改结算、FACT和规则学习业务逻辑。"
    ]
  };
  data.current = current;
  data.history = Array.isArray(data.history) ? data.history.filter(x => x && x.version !== VERSION) : [];
  data.history.unshift(historyItem);
  write(path, JSON.stringify(data, null, 2));
  write("src/release-meta.js", "window.WRITE_RELEASE_META = " + JSON.stringify(data) + ";");
}

{
  const path = "CHANGELOG.md";
  let s = mustRead(path);
  if (!/^## v7\.1\.7\b/m.test(s)) {
    const entry =
`## v7.1.7 — ${RELEASE_TIME} (Europe/Paris)
- 修复 V7.1.6 发布脚本在 Cloudflare Pages 配置预检阶段的误判。
- 删除对发布脚本全文搜索 \`--config\` 的逻辑；改为只检查真正传给 Wrangler Pages deploy 的参数数组。
- 注释、说明文字、CHANGELOG 中出现 \`--config\` 不再触发失败；真实部署参数出现 \`--config\` / \`--config=...\` 仍会中止。
- 发布流程固定：clone → pull → 覆盖新版 → 唯一根 wrangler.jsonc → 自检 → GitHub → Pages → 唯一 deployment → 版本/API 强验证。
- 不修改订单、CN FACT、数量守恒、会计报表、未知商品过滤、规则学习及 IndexedDB/D1 业务逻辑。

`;
    s = entry + s;
  }
  write(path, s);
}

write("RELEASE.txt",
`WRITE Settlement Manager V7.1.7
Release: ${RELEASE_TIME}

V7.1.7 只修发布器：
- 不再全文扫描脚本中的 --config
- 只检查真实 Wrangler Pages deploy 参数
- 唯一根 wrangler.jsonc
- WRITE_RULES_DB / write-settlement-rules 自动绑定
- 唯一 deployment URL 强校验
- data-release=v7.1.7 强校验
- /api/rules/sync ok:true 强校验
- 业务核心零逻辑修改
`);

if (fs.existsSync("PACKAGE_README.md")) {
  let s = mustRead("PACKAGE_README.md");
  s = s.replace(/^# WRITE Settlement Manager V7\.1\.6/m, "# WRITE Settlement Manager V7.1.7");
  s = s.replace(/当前正式版本：\*\*V7\.1\.6\*\*/g, "当前正式版本：**V7.1.7**");
  write("PACKAGE_README.md", s);
}

for (const path of ["README.md", "README_CN.md"]) {
  if (!fs.existsSync(path)) continue;
  let s = mustRead(path);
  s = s.replace(/Current release: \*\*V7\.1\.6\*\*/g, "Current release: **V7.1.7**");
  s = s.replace(/V7\.1\.6 已用 FACT-/g, "V7.1.7 已用 FACT-");
  s = s.replace(/## Current release — v7\.1\.6/g, "## Current release — v7.1.7");
  s = s.replace(/## 当前版本 — v7\.1\.6/g, "## 当前版本 — v7.1.7");
  s = s.replace(/### V7\.1\.6 highlights/g, "### V7.1.7 highlights");
  s = s.replace(/### V7\.1\.6 重点/g, "### V7.1.7 重点");
  write(path, s);
}
NODE
PATCH_CODE=$?
[ $PATCH_CODE -eq 0 ] || fail "V7.1.7 版本/日志补丁失败"

echo "✅ V7.1.7 新版元数据、弹窗日志、历史更新、RELEASE 已同步"

echo ""
echo "[3/8] 查询 D1 并生成唯一根 wrangler.jsonc..."

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
CODE=$?
[ $CODE -eq 0 ] || fail "生成根目录 wrangler.jsonc 失败"
[ ! -f "wrangler.toml" ] || fail "检测到冲突配置 wrangler.toml"
grep -q '"binding": "WRITE_RULES_DB"' wrangler.jsonc || fail "wrangler.jsonc 缺少 WRITE_RULES_DB"
grep -q '"database_name": "write-settlement-rules"' wrangler.jsonc || fail "wrangler.jsonc D1 名称错误"
grep -q "$DB_ID" wrangler.jsonc || fail "D1 database_id 写入失败"
echo "✅ 唯一根 Wrangler 配置完成"

echo ""
echo "[4/8] 发布前完整自检..."

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

grep -q '"version": "7.1.7"' assets/release-history.json || fail "历史更新 JSON 未同步 v7.1.7"
grep -q 'v7.1.7' CHANGELOG.md || fail "CHANGELOG 未同步 v7.1.7"
grep -q 'V7.1.7' RELEASE.txt || fail "RELEASE 未同步 v7.1.7"

DEPLOY_ARGS=(
  pages
  deploy
  .
  "--project-name=$PROJECT"
  --branch=main
)

if contains_config_arg "${DEPLOY_ARGS[@]}"; then
  fail "真实 Wrangler Pages deploy 参数意外包含禁止的 --config"
fi

if ! contains_config_arg pages deploy . --config bad.jsonc; then
  fail "参数级 --config 检测器自检失败"
fi
if ! contains_config_arg pages deploy . --config=bad.jsonc; then
  fail "参数级 --config=... 检测器自检失败"
fi

echo "✅ 发布器参数级预检通过（说明文字中的 --config 不参与判断）"
echo "✅ 代码 / 日志 / D1 / 关键资产自检通过"

echo ""
echo "[5/8] 提交 GitHub..."
git add -A || fail "git add 失败"

if git diff --cached --quiet; then
  echo "ℹ️ GitHub main 已经是相同 V7.1.7 内容"
else
  COMMIT_OUT="$(git commit -m "Deploy WRITE v7.1.7" 2>&1)"
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
echo "说明：Pages 部署禁止自定义 --config 参数；此文字不会被误判。"

if contains_config_arg "${DEPLOY_ARGS[@]}"; then
  fail "真实部署参数意外包含 --config"
fi
[ ! -f wrangler.toml ] || fail "存在第二 Wrangler 配置"
[ -f wrangler.jsonc ] || fail "唯一根 wrangler.jsonc 不存在"
echo "✅ 真实部署参数通过；Pages 将读取当前目录唯一根 wrangler.jsonc"

echo ""
echo "[7/8] 部署 Cloudflare Pages..."
echo "执行：npx wrangler pages deploy . --project-name=$PROJECT --branch=main"

set +e
DEPLOY_OUT="$(npx wrangler "${DEPLOY_ARGS[@]}" 2>&1)"
DEPLOY_CODE=$?
set -e

echo "--------------- Wrangler 输出 ---------------"
echo "$DEPLOY_OUT"
echo "--------------- 输出结束 --------------------"
echo "Wrangler exit code: $DEPLOY_CODE"

[ $DEPLOY_CODE -eq 0 ] || fail "Cloudflare Pages 部署失败。上方是完整 Wrangler 错误。"

DEPLOY_URLS="$(printf '%s' "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.pages\.dev' | sort -u || true)"
DEPLOY_URL_COUNT="$(printf '%s\n' "$DEPLOY_URLS" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
[ "$DEPLOY_URL_COUNT" = "1" ] || {
  echo "检测到的 pages.dev URL："
  echo "$DEPLOY_URLS"
  fail "要求回读唯一 deployment URL，但实际检测到 $DEPLOY_URL_COUNT 个"
}
DEPLOY_URL="$(printf '%s\n' "$DEPLOY_URLS" | head -1)"
echo "✅ 唯一 Deployment: $DEPLOY_URL"

echo ""
echo "[8/8] 在线版本 + D1 API 强验证..."
VERIFIED=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  REMOTE_HTML="$(curl -fsSL "${DEPLOY_URL}/?verify=$(date +%s)-$i" 2>/dev/null || true)"
  if printf '%s' "$REMOTE_HTML" | grep -q 'data-release="7.1.7"'; then
    VERIFIED="yes"
    break
  fi
  sleep 2
done
[ "$VERIFIED" = "yes" ] || fail "唯一 deployment 未确认 data-release=v7.1.7"
echo "✅ 线上版本确认：v7.1.7"

set +e
SYNC_BODY="$(curl -fsSL "${DEPLOY_URL}/api/rules/sync" 2>&1)"
SYNC_CODE=$?
set -e
if [ $SYNC_CODE -ne 0 ]; then
  echo "$SYNC_BODY"
  fail "规则云同步 API 无法访问"
fi

printf '%s' "$SYNC_BODY" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' || {
  echo "$SYNC_BODY"
  fail "规则云同步 API 未返回 ok:true"
}
echo "✅ Cloudflare D1 云同步 API 正常"

echo ""
echo "=================================================="
echo "✅ WRITE V7.1.7 全部发布检查通过"
echo "GitHub: https://github.com/simonz0118-max/write-settlement-manager"
echo "Deployment: $DEPLOY_URL"
echo "正式域名: https://f.neovora.co/"
echo "D1: $DB_NAME / $BINDING"
echo "=================================================="
pause_close
