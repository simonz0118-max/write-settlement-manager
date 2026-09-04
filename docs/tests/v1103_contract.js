const fs=require('fs');
const i=fs.readFileSync('index.html','utf8');
const j=fs.readFileSync('src/v10/v1103-workspace-layout-fix.js','utf8');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const x=[
 i.includes('data-release="11.0.3"'),
 i.includes('v1103-workspace-layout-fix.js?v=11.0.3-001'),
 j.includes('workspace.clientWidth'),
 j.includes("setProperty('width',px(row),'important')"),
 j.includes('ResizeObserver'),
 j.includes("attributeFilter:['class']"),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 h.currentVersion==='11.0.3'
];
if(x.some(v=>!v)){console.error('V11.0.3 CONTRACT FAIL',x);process.exit(1)}
console.log('V11.0.3 MEASURED LAYOUT CONTRACT PASS');
