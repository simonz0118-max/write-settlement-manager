# WRITE Settlement Manager V7.1.8 深度自检

目标：修复 V7.1.7 Pages Functions 已上传但 `/api/rules/sync` 返回 404。

## V7.1.8 新增硬性检查

- 升级包无需 `.git`；正式发布始终 clone GitHub main 到临时目录
- 允许升级起点仅 v7.1.7 / v7.1.8
- 根 `_routes.json` 固定 `include: ["/api/*"]`、`exclude: []`
- `functions/api/rules/sync.js` 必须存在
- 发布前执行 `wrangler pages functions build`
- 必须生成非空 Worker
- 必须生成非空 routes JSON
- 编译后的路由规则必须覆盖 `/api/rules/sync`
- 不允许编译路由排除 `/api/rules/sync`
- 唯一根 `wrangler.jsonc`
- 禁止 `wrangler.toml`
- Pages deploy 真实参数数组禁止 `--config` / `--config=...`
- GitHub commit/push 只发生在全部 preflight 通过之后
- Cloudflare deployment URL 去重后必须恰好一个
- deployment 必须回读 `data-release="7.1.8"`
- `/api/rules/sync` 必须 HTTP 200
- API JSON 必须包含 `ok:true`
- API 失败必须打印 HTTP 状态和 response body
- 正式域名额外复核，但不因传播延迟否定已经通过的唯一 deployment

## 业务核心保护

V7.1.8 不改变订单统计、CN FACT 模板逻辑、FACT 自动生成/学习、数量守恒、
会计结算报表、未知商品过滤、规则学习、IndexedDB、Cloudflare D1 数据结构、
离线能力以及黑白模式。

## Cloudflare 官方依据

Pages Functions 使用 `/functions` 文件结构生成路由；
`_routes.json` 控制哪些请求进入 Functions；
Wrangler 提供 `pages functions build` 和 `--output-routes-path` 用于构建并输出路由配置。

## macOS 兼容性补充

- 不依赖 `seq`
- 重试循环使用 zsh/POSIX 算术 `while`
- API curl stderr、HTTP 状态与 response body 失败时直接输出到终端
