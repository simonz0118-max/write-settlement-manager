const fs=require('fs');
const i=fs.readFileSync('index.html','utf8'),c=fs.readFileSync('src/v10/v1105-sidebar-coordinate-fix.css','utf8');
const x=[
i.includes('data-release="11.0.5"'),
c.includes('margin-left:var(--v1105-side)!important'),
c.includes('width:calc(100% - var(--v1105-side))!important'),
c.includes('#v10614SettingsNav>span:last-child'),
c.includes('background:#eee8de!important'),
i.includes('v1064-export-authority.js?v=10.6.6-001')
];
if(x.some(v=>!v)){console.error('V11.0.5 CONTRACT FAIL',x);process.exit(1)}
console.log('V11.0.5 SHELL CONTRACT PASS');
