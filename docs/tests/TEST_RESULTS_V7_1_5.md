# V7.1.5 深度自检

{
  "node:src/knowledge-base.js": true,
  "node:src/app.bundle.js": true,
  "node:src/release-meta.js": true,
  "node:src/workers/import.worker.bundle.js": true,
  "node:functions/api/rules/sync.js": true,
  "critical_order": true,
  "deploy_error_capture": true,
  "pages_real_config": true,
  "sync_api_hardcheck": true,
  "version_marker": true,
  "fact_template_preserved": true,
  "local_git_simulation": true,
  "schema_sqlite": true
}

关键流程：clone → pull → rsync → Pages真实配置 → D1注入 → preflight → GitHub → Pages → deployment版本 → sync API
