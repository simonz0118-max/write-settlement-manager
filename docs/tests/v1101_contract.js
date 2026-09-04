const fs=require('fs');
const i=fs.readFileSync('index.html','utf8'),c=fs.readFileSync('src/v10/v1101-light-theme-hotfix.css','utf8'),j=fs.readFileSync('src/v10/v1101-light-theme-hotfix.js','utf8'),h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const x=[
 i.includes('data-release="11.0.1"'),i.includes('v11.0.1 Production'),
 i.includes('v1101-light-theme-hotfix.css?v=11.0.1-001'),i.includes('v1101-light-theme-hotfix.js?v=11.0.1-001'),
 c.includes('html[data-theme="light"] body.write-v1101'),
 c.includes('#f1ede4')&&c.includes('#a7613d')&&c.includes('#707a50')&&c.includes('#a5523d'),
 c.includes('background:transparent!important'),
 i.includes('v1100-ui-integrity.js?v=11.0.0-001'),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 h.currentVersion==='11.0.1'&&h.current.version==='11.0.1'
];
if(x.some(v=>!v)){console.error('V11.0.1 CONTRACT FAIL',x);process.exit(1)}
console.log('V11.0.1 LIGHT THEME CONTRACT PASS');
