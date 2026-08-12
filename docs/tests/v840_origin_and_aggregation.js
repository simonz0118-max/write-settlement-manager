const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');const c={window:null};c.window=c;vm.createContext(c);vm.runInContext(src,c);const H=c.WRITE_HUMAN_WORKFLOW_V84;
const r1=H.buildRecord({orderId:'1',country:'FRANCE',notes:'法国仓库发',lineItems:[{productName:'Savon',quantity:2}]},{});
const r2=H.buildRecord({orderId:'2',country:'FRANCE',fulfillmentOrigin:'CN',lineItems:[{productName:'Savon',quantity:2}]},{});
assert.equal(r1.origin.origin,'FR');assert.equal(r2.origin.origin,'CN');
const a=H.aggregate([r1,r2]);assert.equal(a.packageRows.length,2);assert(a.packageRows.some(x=>x.origin==='FR'));assert(a.packageRows.some(x=>x.origin==='CN'));
console.log('V8.4 fulfillment-origin-first aggregation PASS');