const fs=require('fs');
const i=fs.readFileSync('index.html','utf8');
const c=fs.readFileSync('src/v10/v10614-settings-earth.css','utf8');
const j=fs.readFileSync('src/v10/v10614-settings-earth.js','utf8');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const x=[
 i.includes('data-release="10.6.14"'),
 i.includes('v10613-hero-copy-reset.css?v=10.6.13-001'),
 i.includes('v10614-settings-earth.css?v=10.6.14-001'),
 j.includes('v10614SettingsNav')&&j.includes('chooseReviewFolder'),
 c.includes('button:not(:disabled):active')&&c.includes('scale(.985)'),
 c.includes('#c27b4f')&&c.includes('#8c9567')&&c.includes('#b45f48'),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 h.currentVersion==='10.6.14'&&h.current.version==='10.6.14'
];
if(x.some(v=>!v)){console.error('V10.6.14 CONTRACT FAIL',x);process.exit(1)}
console.log('V10.6.14 SETTINGS EARTH CONTRACT PASS');
