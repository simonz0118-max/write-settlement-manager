const fs=require('fs');
const i=fs.readFileSync('index.html','utf8');
const c=fs.readFileSync('src/v10/v10613-hero-copy-reset.css','utf8');
const j=fs.readFileSync('src/v10/v10613-hero-copy-reset.js','utf8');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const x=[
 i.includes('data-release="10.6.13"'),
 i.includes('v10612-css-authority.css?v=10.6.12-001'),
 i.includes('v10613-hero-copy-reset.css?v=10.6.13-001'),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 c.includes("content:'☰'!important"),
 c.includes('backdrop-filter:none!important'),
 !j.includes('appendChild'),
 h.currentVersion==='10.6.13'&&h.current.version==='10.6.13'
];
if(x.some(v=>!v)){console.error('V10.6.13 CONTRACT FAIL',x);process.exit(1)}
console.log('V10.6.13 ROOT CAUSE CONTRACT PASS');
