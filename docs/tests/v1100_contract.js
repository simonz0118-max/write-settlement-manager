const fs=require('fs');
const i=fs.readFileSync('index.html','utf8'),c=fs.readFileSync('src/v10/v1100-ui-integrity.css','utf8'),j=fs.readFileSync('src/v10/v1100-ui-integrity.js','utf8'),h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const x=[
 i.includes('data-release="11.0"'),i.includes('v11.0 Production'),
 i.includes('v1100-ui-integrity.css?v=11.0.0-001'),i.includes('v1100-ui-integrity.js?v=11.0.0-001'),
 c.includes('#v10614SettingsNav')&&c.includes('font-size:14px!important'),
 j.includes("icon(set,'settings','v10612-nav-icon')"),
 j.includes("icon(document.getElementById('chooseButton'),'upload'"),
 j.includes("icon(document.getElementById('heroExportButton'),'file'"),
 j.includes("icon(document.getElementById('heroImportButton'),'upload'"),
 i.includes('v10612-css-authority.js?v=10.6.15-copy-001'),
 i.includes('v10614-settings-earth.js?v=10.6.14-001'),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 h.currentVersion==='11.0'&&h.current.version==='11.0'
];
if(x.some(v=>!v)){console.error('V11.0 CONTRACT FAIL',x);process.exit(1)}
console.log('V11.0 PRODUCTION CONTRACT PASS');
