const fs=require('fs');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8')),v=h.currentVersion;
const i=fs.readFileSync('index.html','utf8'),review=fs.readFileSync('src/v10/review-learning-v101.js','utf8'),rt=fs.readFileSync('src/runtime-v740.js','utf8'),wf=fs.readFileSync('src/v10/v1060-simple-workflow.js','utf8');
const checks=[i.includes(`data-release="${v}"`),i.includes('v1064-export-authority.js?v=10.6.6-001'),i.includes('review-learning-v101.js?v=11.0.8-ooxml-r2'),review.includes("if(origin==='FR')continue"),rt.includes('paymentFormula=`SUM(H${firstDynamic}:H${totalRow-1})`'),wf.includes('saveManifest(pack.next);'),fs.existsSync('docs/fixtures/x07-reviewed-53-sanitized.xlsx'),fs.existsSync('MANIFEST_SHA256.json')];
if(checks.some(x=>!x)){console.error('CURRENT CONTRACT FAIL',{v,checks});process.exit(1)}
console.log('CURRENT CONTRACT PASS',v);
