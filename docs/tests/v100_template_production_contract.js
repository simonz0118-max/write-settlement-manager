const fs=require('fs'),assert=require('assert');
const runtime=fs.readFileSync(process.argv[2],'utf8');
const exportRuntime=fs.readFileSync(process.argv[3],'utf8');
const html=fs.readFileSync(process.argv[4],'utf8');

assert(/parcelCount/.test(runtime),'FACT patcher must write parcel total');
assert(/priceComplete/.test(runtime),'runtime must distinguish complete from incomplete pricing');
assert(/needsReview=!!r\?\.needsReview\|\|!priceComplete/.test(runtime),'incomplete pricing must remain review-required');
for(const [name,token] of [['COGS','c===null?'],['Shipping','s===null?'],['Unit total','u===null?'],['Amount','a===null?']])
  assert(runtime.includes(token),`${name} must emit a blank cell when unresolved`);
assert(/actualXfCount\s*=\s*xfs\.length/.test(runtime),'review style must derive from actual cellXfs entries');
assert(/PRICE_REVIEW_STYLE\s*=\s*actualXfCount/.test(runtime),'red center style must be dynamically appended');
assert(/PRICE_REVIEW_STYLE_LEFT\s*=\s*actualXfCount\s*\+\s*1/.test(runtime),'red left style must be dynamically appended');
assert(/FFFF0000/.test(runtime),'review style must use red font');
assert(/single XLSX delivery/.test(exportRuntime),'production export contract is a single XLSX delivery');
for(const token of ['goldenFactForRows','accountingReport','mergeFactAndAccounting','downloadProductionPackage'])
  assert(exportRuntime.includes(token),`missing XLSX production export token: ${token}`);
assert(!/buildPdfBlob|buildPdfBytes/.test(exportRuntime),'deprecated PDF path must not be a production requirement');
assert.equal((html.match(/src\/v10\/runtime\.js/g)||[]).length,1,'V10 runtime loaded once');
assert(html.indexOf('src/v9/golden-template-runtime.js')<html.indexOf('src/v10/production-adapter.js'),'V10 production adapter must install after V9');
console.log('V10.5 pricing-state + template/XLSX production contract PASS');
