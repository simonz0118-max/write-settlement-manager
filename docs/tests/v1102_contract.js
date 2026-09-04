const fs=require('fs');
const i=fs.readFileSync('index.html','utf8');
const c=fs.readFileSync('src/v10/v1102-layout-toggle-version.css','utf8');
const j0=fs.readFileSync('src/v10/v1100-ui-integrity.js','utf8');
const j1=fs.readFileSync('src/v10/v1101-light-theme-hotfix.js','utf8');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const x=[
 i.includes('data-release="11.0.2"'),
 i.includes('v1102-layout-toggle-version.css?v=11.0.2-001'),
 c.includes('width:min(100%,1040px)!important'),
 c.includes("content:'☰'!important")&&c.includes("content:'‹'!important"),
 j0.includes('v11.0.2 Production')&&!j0.includes("x.textContent='v11.0 Production'"),
 j1.includes('v11.0.2 Production')&&!j1.includes("x.textContent='v11.0.1 Production'"),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 h.currentVersion==='11.0.2'&&h.current.version==='11.0.2'
];
if(x.some(v=>!v)){console.error('V11.0.2 CONTRACT FAIL',x);process.exit(1)}
console.log('V11.0.2 UI CLOSURE CONTRACT PASS');
