const fs=require('fs');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const i=fs.readFileSync('index.html','utf8');
const wf=fs.readFileSync('src/v10/v1060-simple-workflow.js','utf8');
const rv=fs.readFileSync('src/v10/review-learning-v101.js','utf8');
const rt=fs.readFileSync('src/runtime-v740.js','utf8');
const meta=fs.readFileSync('src/release-meta.js','utf8');
const m=JSON.parse(fs.readFileSync('MANIFEST_SHA256.json','utf8'));
const required=[
 'docs/tests/idb-lite-v11010.cjs',
 'docs/tests/v11010_kb_dedupe_persistence_e2e.cjs',
 'docs/tests/v11010_production_replay_smoke.cjs',
 'docs/tests/idb-lite-v11013.cjs',
 'docs/tests/v11013_manifest_cas_behavior.cjs',
 'docs/tests/v11013_ooxml_row_contract.cjs',
 'docs/tests/v11013_browser_x07_e2e.cjs',
 'docs/tests/v11013_verify_export.py',
 'docs/tests/v11013_payment_negative_gate.py',
 'docs/tests/v11013_all_js_syntax.py',
 'docs/fixtures/stage-a-cn-unknown-orders-seed-0x1041E2E.xlsx',
 'docs/fixtures/2026-08-13-order-100-reviewed-cn.xlsx'
];
const checks=[
 h.currentVersion==='11.0.13',
 i.includes('data-release="11.0.13"'),
 i.includes('v11.0.13 Production'),
 wf.includes("const VERSION='11.0.12'"),
 rv.includes("const VERSION='11.0.12'"),
 wf.includes('manifestBegin')&&wf.includes('manifestCas'),
 wf.includes("localStatus:'INVALID_RESULT'")&&wf.includes("localStatus:'NO_APPLICABLE_DATA'"),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 rt.includes('paymentFormula=`SUM(H${firstDynamic}:H${totalRow-1})`'),
 !meta.endsWith('\\\\n'),
 m['src/release-meta.js']!==undefined,
 m['src/workers/import.worker.bundle.js']!==undefined,
 required.every(p=>fs.existsSync(p))
];
if(checks.some(x=>!x)){console.error('V11.0.13 CURRENT CONTRACT FAIL',{checks});process.exit(1)}
console.log('V11.0.13 CURRENT CONTRACT PASS');
