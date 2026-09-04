const fs=require('fs');const p='src/v10/v1063-export-selection.js';const s=fs.readFileSync(p,'utf8');
for(const x of ["document.addEventListener('click',intercept,true)",'stopImmediatePropagation','01_结算总览','02_订单明细','03_商品汇总','04_审计记录','WRITE_LEARNING_SOURCE','pruneWorkbook'])if(!s.includes(x))throw Error('missing '+x);
console.log('PASS v1063 export selection contract');
