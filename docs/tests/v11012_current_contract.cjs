const fs=require('fs');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8')),i=fs.readFileSync('index.html','utf8'),wf=fs.readFileSync('src/v10/v1060-simple-workflow.js','utf8'),rv=fs.readFileSync('src/v10/review-learning-v101.js','utf8'),m=JSON.parse(fs.readFileSync('MANIFEST_SHA256.json','utf8')),rt=fs.readFileSync('src/runtime-v740.js','utf8');
const required=['docs/tests/idb-lite-v11010.cjs','docs/tests/v11010_kb_dedupe_persistence_e2e.cjs','docs/tests/v11010_production_replay_smoke.cjs','docs/tests/idb-lite-v11012.cjs','docs/tests/v11012_manifest_cas_behavior.cjs','docs/tests/v11012_browser_x07_e2e.cjs','docs/tests/v11012_verify_export.py','docs/fixtures/stage-a-cn-unknown-orders-seed-0x1041E2E.xlsx','docs/fixtures/2026-08-13-order-100-reviewed-cn.xlsx'];
const checks=[
 h.currentVersion==='11.0.12',i.includes('data-release="11.0.12"'),
 i.includes('v1060-simple-workflow.js?v=11.0.12-cas-v5-001'),i.includes('review-learning-v101.js?v=11.0.12-ooxml-row-001'),
 wf.includes("const VERSION='11.0.12'"),rv.includes("const VERSION='11.0.12'"),
 wf.includes('manifestBegin'),wf.includes('manifestCas'),wf.includes("transaction(STORE,'readwrite')"),
 wf.includes("localStatus:'INVALID_RESULT'"),wf.includes("localStatus:'NO_APPLICABLE_DATA'"),
 wf.includes("typeof values[Symbol.iterator]==='function'"),wf.includes('expectedRuleIds'),
 m['src/workers/import.worker.bundle.js']!==undefined,m['src/knowledge-base.js']!==undefined,
 m['docs/fixtures/stage-a-cn-unknown-orders-seed-0x1041E2E.xlsx']!==undefined,
 m['docs/fixtures/2026-08-13-order-100-reviewed-cn.xlsx']!==undefined,
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 rt.includes('paymentFormula=`SUM(H${firstDynamic}:H${totalRow-1})`'),
 required.every(p=>fs.existsSync(p))
];
if(checks.some(x=>!x)){console.error('V11.0.12 CURRENT CONTRACT FAIL',{checks});process.exit(1)}
console.log('V11.0.12 CURRENT CONTRACT PASS');
