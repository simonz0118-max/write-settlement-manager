#!/bin/zsh
set -u
set -o pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_URL="https://github.com/simonz0118-max/write-settlement-manager.git"
PROJECT="write-settlement-manager"
EXPECTED="10.0.1"

pause_close(){ [ "${WRITE_NONINTERACTIVE:-0}" = "1" ] || { echo; read -n 1 "?按任意键关闭..."; }; }
fail(){ echo "❌ $1"; pause_close; exit 1; }
trap 'pause_close' EXIT

echo "WRITE Settlement Manager V10.0.1 生产版一键部署"
for cmd in git node npx curl shasum; do command -v "$cmd" >/dev/null 2>&1 || fail "缺少命令：$cmd"; done
cd "$SOURCE_DIR" || fail "无法进入部署包"
node docs/tests/v100_production_contract.js src/v10/billable-atom.js src/v10/production-core.js || fail "生产统计合同失败"
node docs/tests/v100_template_production_contract.js src/runtime-v740.js src/v10/export-runtime.js index.html || fail "模板接线合同失败"
node docs/tests/v100_stress_accuracy.js src/v10/billable-atom.js src/v10/production-core.js || fail "压力测试失败"
grep -q 'data-release="10.0.1"' index.html || fail "版本标识不是 V10.0.1"

TEMP_ROOT="$(mktemp -d /tmp/write-v100.XXXXXX)" || fail "无法创建临时目录"
REPO_DIR="$TEMP_ROOT/repo"
cleanup(){ rm -rf "$TEMP_ROOT"; }
trap 'cleanup; pause_close' EXIT
git clone "$REPO_URL" "$REPO_DIR" || fail "克隆 GitHub 失败"
cd "$REPO_DIR" || fail "无法进入 GitHub 仓库"
git checkout main || fail "切换 main 失败"
rsync -a --delete --exclude='.git/' --exclude='docs/e2e-exports/' "$SOURCE_DIR/" "$REPO_DIR/" || fail "覆盖生产文件失败"
node docs/tests/v100_production_contract.js src/v10/billable-atom.js src/v10/production-core.js || fail "覆盖后统计合同失败"
node docs/tests/v100_template_production_contract.js src/runtime-v740.js src/v10/export-runtime.js index.html || fail "覆盖后模板合同失败"
git add -A || fail "git add 失败"
if ! git diff --cached --quiet; then git commit -m "Deploy WRITE V10.0.1 FACT grid hotfix" || fail "提交失败"; git push origin main || fail "推送失败"; fi
npx wrangler pages deploy . --project-name="$PROJECT" --branch=main || fail "Cloudflare Pages 部署失败"
URL="https://$PROJECT.pages.dev"
for i in 1 2 3 4 5; do BODY="$(curl -fsSL "$URL/?verify=$(date +%s)-$i" 2>/dev/null || true)"; printf '%s' "$BODY" | grep -q 'data-release="10.0.1"' && { echo "✅ V10.0.1 已上线：$URL"; exit 0; }; sleep 3; done
fail "部署已执行，但在线版本验证未通过"
