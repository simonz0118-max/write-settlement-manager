#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const repo=path.resolve(process.argv[2]||'');
const pkg=path.resolve(process.argv[3]||'');
if(!repo||!pkg)throw new Error('usage: node patch-v900.js <repo> <package>');

const files=[
  'CHANGELOG.md',
  'V9.0_RELEASE_MANIFEST.json',
  'assets/release-history.json',
  'docs/tests/v900_classification_coverage.js',
  'docs/tests/v900_cloud_rule_serialization.js',
  'docs/tests/v900_formula_cache_isolation.js',
  'docs/tests/v900_fulfillment_identity.js',
  'docs/tests/v900_namespace_prefix_import.js',
  'docs/tests/v900_production_takeover.js',
  'index.html',
  'src/app.bundle.js',
  'src/release-meta.js',
  'src/runtime-v740.js',
  'src/universal-source-v759.js',
  'src/v8/human-workflow.js',
  'src/v8/rule-store.js',
  'src/v9/autonomous-fact-engine.js',
  'src/v9/golden-template-runtime.js',
  'src/v9/learning-store.js',
  'src/v9/production-audit-runtime.js',
  'src/v9/review-runtime.js',
  'src/workers/import.worker.bundle.js',
  'src/workers/import.worker.js',
  'src/workers/import.worker.v758.js',
];

const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const must=(condition,message)=>{if(!condition)throw new Error(message)};
must(fs.existsSync(path.join(repo,'index.html')),'目标不是 WRITE Settlement Manager 仓库');
must(/data-release="9\.0\.0"/.test(fs.readFileSync(path.join(repo,'index.html'),'utf8')),'目标 main 必须为 V9.0.0');

for(const relative of files){
  const source=path.join(pkg,relative),target=path.join(repo,relative);
  must(fs.existsSync(source),`升级包缺少 ${relative}`);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(source,target);
  must(sha(source)===sha(target),`复制校验失败 ${relative}`);
}

const html=fs.readFileSync(path.join(repo,'index.html'),'utf8');
const order=['universal-source-v759.js','v9/learning-store.js','v8/human-workflow.js','v9/autonomous-fact-engine.js','v9/golden-template-runtime.js'];
let prior=-1;
for(const token of order){const index=html.indexOf(token);must(index>prior,`生产脚本顺序错误 ${token}`);prior=index}
must(/import\.worker\.v758\.js\?v=9\.0\.0-002/.test(fs.readFileSync(path.join(repo,'src/universal-source-v759.js'),'utf8')),'Worker 缓存版本未更新');
console.log(`V9.0 production acceptance patch complete: ${files.length} files`);
