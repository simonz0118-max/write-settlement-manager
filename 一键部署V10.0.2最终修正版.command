#!/bin/zsh
set -u
set -o pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
PROJECT="write-settlement-manager"
CUSTOM_DOMAIN="https://f.neovora.co"
EXPECTED="10.0.2"

PAUSED=0
pause_close(){
  [ "${WRITE_NONINTERACTIVE:-0}" = "1" ] && return 0
  [ "$PAUSED" = "1" ] && return 0
  PAUSED=1
  echo
  read -n 1 "?按任意键关闭..." || true
}
fail(){ echo "❌ $1"; pause_close; exit 1; }
cleanup(){ [ -n "${TEMP_ROOT:-}" ] && [ -d "${TEMP_ROOT:-}" ] && rm -rf "$TEMP_ROOT" || true; }
trap 'cleanup' EXIT

version_from_index(){
  sed -n 's/.*data-release="\([0-9][0-9.]*\)".*/\1/p' "$1" | head -1
}
assert_version(){
  local file="$1" actual
  actual="$(version_from_index "$file")"
  [ "$actual" = "$EXPECTED" ] || fail "版本标识不一致：期望 $EXPECTED，实际 ${actual:-未找到}（$file）"
}
run(){ local label="$1"; shift; echo "→ $label"; "$@" || fail "$label 失败"; }

echo "=================================================="
echo "WRITE Settlement Manager V10.0.2 最终修正版一键部署"
echo "Export + Production UI + Deployment Gate Hotfix"
echo "=================================================="

for cmd in git node npx curl shasum rsync sed grep; do
  command -v "$cmd" >/dev/null 2>&1 || fail "缺少命令：$cmd"
done

cd "$SOURCE_DIR" || fail "无法进入部署包"

echo "[1/10] 本地版本与文件完整性预检..."
assert_version index.html
grep -q "version:'10.0.2'" src/release-v100.js || fail "src/release-v100.js 版本不是 10.0.2"
grep -q "const VERSION='10.0.2'" src/v10/export-runtime.js || fail "export-runtime 版本不是 10.0.2"
grep -q "const VERSION='10.0.2'" src/v10/runtime.js || fail "runtime 版本不是 10.0.2"
run "export-runtime syntax" node --check src/v10/export-runtime.js
run "runtime syntax" node --check src/v10/runtime.js

echo "[2/10] V10 生产合同..."
run "production contract" node docs/tests/v100_production_contract.js src/v10/billable-atom.js src/v10/production-core.js
run "template/production wiring" node docs/tests/v100_template_production_contract.js src/runtime-v740.js src/v10/export-runtime.js index.html

echo "[3/10] 50k 级压力与零遗漏回归..."
run "stress accuracy" node docs/tests/v100_stress_accuracy.js src/v10/billable-atom.js src/v10/production-core.js

echo "[4/10] Golden FACT 样式保护检查..."
# V10.0.2 必须动态使用模板真实 cellXfs 基线，禁止再硬编码 89。
if grep -RIn --exclude='*.md' --exclude='*.json' --exclude='*.command' -E 'PRICE_REVIEW_STYLE[[:space:]]*=[[:space:]]*89|redStyle(Index)?[[:space:]]*[:=][[:space:]]*89' src/v10 src/runtime-v740.js 2>/dev/null | grep -q .; then
  fail "检测到旧的 FACT 样式 89 硬编码"
fi
grep -q 'function ensureProductionRedStyleXml' src/runtime-v740.js || fail "runtime-v740 缺少动态 FACT 红字样式注入"
grep -q 'PRICE_REVIEW_STYLE=xfCount' src/runtime-v740.js || fail "FACT 红字 style index 未从实际 cellXfs count 动态推导"

echo "[5/10] 生产 UI 清理检查..."
# 核心历史逻辑可以保留，但生产首页不得重新挂载旧 Shadow 调试面板。
for token in v85MultiDatasetPanel v86BatchScorePanel v87ClosurePanel v88AutoExtractPanel v9ProductionPanel; do
  if grep -q "$token" index.html; then fail "生产 index.html 仍包含旧 Shadow UI：$token"; fi
done

if [ "${WRITE_DEPLOY_DRY_RUN:-0}" = "1" ]; then
  echo "✅ DRY RUN PASS：本地部署前检查全部通过，未连接 GitHub/Cloudflare。"
  exit 0
fi

echo "[6/10] 克隆 GitHub main..."
TEMP_ROOT="$(mktemp -d /tmp/write-v1002.XXXXXX)" || fail "无法创建临时目录"
REPO_DIR="$TEMP_ROOT/repo"
run "克隆 GitHub" git clone "$REPO_URL" "$REPO_DIR"
cd "$REPO_DIR" || fail "无法进入 GitHub 仓库"
run "切换 main" git checkout main
run "拉取 main" git pull --ff-only origin main

# 只允许从已知 V10 生产基线升级，避免误覆盖未来版本。
CURRENT="$(version_from_index index.html)"
case "$CURRENT" in
  10.0.0|10.0.1|10.0.2) ;;
  *) fail "GitHub main 版本不在允许升级范围：${CURRENT:-未找到}" ;;
esac

echo "[7/10] 覆盖 V10.0.2 修复文件并二次验收..."
run "同步部署包" rsync -a --delete --exclude='.git/' --exclude='docs/e2e-exports/' "$SOURCE_DIR/" "$REPO_DIR/"
assert_version index.html
run "覆盖后 production contract" node docs/tests/v100_production_contract.js src/v10/billable-atom.js src/v10/production-core.js
run "覆盖后 template contract" node docs/tests/v100_template_production_contract.js src/runtime-v740.js src/v10/export-runtime.js index.html
run "覆盖后 export-runtime syntax" node --check src/v10/export-runtime.js

# 避免因本机未配置 Git identity 导致部署卡死。
git config user.name >/dev/null 2>&1 || git config user.name "WRITE Deployment"
git config user.email >/dev/null 2>&1 || git config user.email "write-deploy@users.noreply.github.com"

echo "[8/10] 提交 GitHub main..."
git add -A || fail "git add 失败"
if ! git diff --cached --quiet; then
  run "git commit" git commit -m "Deploy WRITE V10.0.2 export/UI/deploy-gate hotfix"
  run "git push" git push origin main
else
  echo "ℹ️ GitHub main 已经是相同内容，无需重复提交。"
fi
COMMIT="$(git rev-parse HEAD)"
echo "Git commit: $COMMIT"

echo "[9/10] Cloudflare Pages 部署..."
if ! npx --yes wrangler whoami >/dev/null 2>&1; then
  echo "Cloudflare 登录状态无效，启动网页登录..."
  run "wrangler login" npx --yes wrangler login
fi
run "Cloudflare Pages deploy" npx --yes wrangler pages deploy . --project-name="$PROJECT" --branch=main

echo "[10/10] 正式线上版本验证..."
verify_url(){
  local base="$1" body i
  for i in {1..45}; do
    body="$(curl -fsSL --connect-timeout 8 --max-time 20 "$base/?verify=$(date +%s)-$i" 2>/dev/null || true)"
    if printf '%s' "$body" | grep -q "data-release=\"$EXPECTED\""; then
      echo "✅ 已验证：$base → V$EXPECTED"
      return 0
    fi
    echo "  等待 CDN 更新 $i/45..."
    sleep 4
  done
  return 1
}

PAGES_URL="https://$PROJECT.pages.dev"
verify_url "$PAGES_URL" || fail "Pages 正式版本验证失败"
# 自定义域名验证失败时也视为部署失败，避免 pages.dev 新但正式域名仍旧。
verify_url "$CUSTOM_DOMAIN" || fail "正式域名 $CUSTOM_DOMAIN 未更新到 V$EXPECTED"

echo "=================================================="
echo "✅ WRITE V10.0.2 最终修正版部署完成"
echo "✅ 版本检查已修复：不再误查 10.0.1"
echo "✅ FACT 导出样式使用动态 cellXfs 基线"
echo "✅ 生产 UI Shadow 面板清理保护已启用"
echo "✅ Git commit: $COMMIT"
echo "✅ 正式域名: $CUSTOM_DOMAIN"
echo "=================================================="
pause_close
