const fs=require('fs');
const i=fs.readFileSync('index.html','utf8');
const j=fs.readFileSync('src/v10/v10612-css-authority.js','utf8');
const h=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
const n='导入订单、云端AI分类统计、自我学习进化。越用越聪明的系统。';
const o='导入订单、生成统计、审核学习。把复杂流程留给系统。';
const x=[
 i.includes('data-release=\"10.6.15\"'),
 i.includes('v10612-css-authority.js?v=10.6.15-copy-001'),
 j.includes(n),
 !j.includes(o),
 i.includes('v10614-settings-earth.js?v=10.6.14-001'),
 i.includes('v1064-export-authority.js?v=10.6.6-001'),
 h.currentVersion==='10.6.15'&&h.current.version==='10.6.15'
];
if(x.some(v=>!v)){console.error('V10.6.15 CONTRACT FAIL',x);process.exit(1)}
console.log('V10.6.15 HERO COPY CONTRACT PASS');
