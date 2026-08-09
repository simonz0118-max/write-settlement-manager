# V7.1.7 深度自检

目标：只修复 V7.1.6 发布器的 `--config` 误判，不修改结算业务核心。

## 交付前检查项目

- 升级包根目录无 `.git`
- 主脚本语法结构检查
- 禁止回归 V7.1.6 的“全文搜索自身脚本中的 --config”
- `contains_config_arg` 只检查真实参数数组
- 正常 Pages deploy 参数不含 `--config`
- `--config bad.jsonc` 必须被检测
- `--config=bad.jsonc` 必须被检测
- 固定发布顺序：clone → checkout → pull → 覆盖新版 → D1/wrangler → preflight → GitHub → Pages → verify
- 部署命令等价于 `npx wrangler pages deploy . --project-name=write-settlement-manager --branch=main`
- Wrangler stdout/stderr 与 exit code完整保留
- pages.dev URL 去重并要求唯一
- 强验证 `data-release="7.1.7"`
- 强验证 `/api/rules/sync` 返回 `ok:true`
- 删除 `wrangler.toml`，仅允许根 `wrangler.jsonc`
- D1 固定：`write-settlement-rules` / `WRITE_RULES_DB`
- CHANGELOG / 系统更新弹窗 / 历史更新 / RELEASE 同步
- 不修改订单统计、CN FACT、FACT学习、数量守恒、会计报表、未知商品过滤、IndexedDB/D1、主题逻辑

注意：交付环境没有用户的 Cloudflare CLI 登录态，因此真实线上部署只能由升级脚本在用户 Mac 上执行，并由脚本自身完成线上三重强验证。
