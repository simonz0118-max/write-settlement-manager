const fs=require('fs');
const i=fs.readFileSync('index.html','utf8');
const c=fs.readFileSync('src/v10/v1104-layout-root-fix.css','utf8');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const x=[
 i.includes('data-release="11.0.4"'),
 i.includes('v1104-layout-root-fix.css?v=11.0.4-001'),
 !i.includes('v1103-workspace-layout-fix.js'),
 c.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'),
 c.includes('transform:none!important'),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 h.currentVersion==='11.0.4'
];
if(x.some(v=>!v)){console.error('V11.0.4 CONTRACT FAIL',x);process.exit(1)}
console.log('V11.0.4 ROOT LAYOUT CONTRACT PASS');
