# V7.1.4 Release Regression

## Static checks
{
  "node:src/knowledge-base.js": true,
  "node:src/app.bundle.js": true,
  "node:src/release-meta.js": true,
  "node:src/workers/import.worker.bundle.js": true,
  "node:functions/api/rules/sync.js": true,
  "order clone<pull<rsync<add<push<deploy": true,
  "version marker": true,
  "preflight": true,
  "d1 preserve": true,
  "remote verify": true,
  "sync api check": true,
  "local git simulation": true
}

## Critical Git workflow
clone -> checkout -> pull --ff-only -> preserve D1 -> copy release -> preflight -> add/commit/push -> deploy

A local bare-repository simulation was executed successfully:
- package directory had no .git: PASS
- clone clean repo: PASS
- pull before file overwrite: PASS
- preserve wrangler D1 config: PASS
- overwrite new release: PASS
- commit after overwrite: PASS
- push main: PASS

## Runtime assets
- app.bundle.js syntax: PASS
- knowledge-base.js syntax: PASS
- import worker syntax: PASS
- release-meta.js syntax: PASS
- Cloudflare sync function syntax: PASS
