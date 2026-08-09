# V7.1.6 深度自检

{
  "node:src/knowledge-base.js": true,
  "node:src/app.bundle.js": true,
  "node:src/release-meta.js": true,
  "node:src/workers/import.worker.bundle.js": true,
  "node:functions/api/rules/sync.js": true,
  "deploy_has_no_config": true,
  "no_download_config": true,
  "deletes_toml": true,
  "root_jsonc": true,
  "d1_binding": true,
  "version_marker": true,
  "fact_template_preserved": true,
  "error_capture": true,
  "api_verify": true,
  "critical_order": true,
  "git_simulation": true,
  "schema_sqlite": true
}

关键修复：Pages deploy 不再使用 --config；删除 wrangler.toml；唯一根 wrangler.jsonc。
