const fs=require('fs');
const idx=fs.readFileSync('index.html','utf8');
const a=fs.readFileSync('src/v10/v1064-export-authority.js','utf8');
const checks=[
 ['authority loaded',idx.includes('v1064-export-authority.js?v=10.6.6-001')],
 ['chooser exists',a.includes('function chooseSheets()')],
 ['FACT fixed',a.includes("done(['FACT',...Array.from(d.querySelectorAll('[data-sheet]:checked'))")],
 ['optional sheets',a.includes("['01_结算总览','02_订单明细','03_商品汇总','04_审计记录']")],
 ['learning source',a.includes("'WRITE_LEARNING_SOURCE'")],
 ['structured result',a.includes('workbooks:books.length')&&a.includes('files,selected')],
 ['cancel structured',a.includes('cancelled:true,workbooks:0,files:[],selected:[]')]
];
const bad=checks.filter(x=>!x[1]);if(bad.length){console.error('V10.6.4 BEHAVIOR COMPAT FAIL',bad.map(x=>x[0]));process.exit(1)}
console.log('V10.6.4 BEHAVIOR COMPAT PASS');
