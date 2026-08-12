const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');const c={window:null};c.window=c;vm.createContext(c);vm.runInContext(src,c);const H=c.WRITE_HUMAN_WORKFLOW_V84;
const r=H.buildRecord({orderId:'S1',country:'FRANCE',lineItems:[
 {productName:'Savon - Citron',quantity:1},{productName:'Savon - Arbre à thé',quantity:1},
 {productName:'Baume',quantity:1},{productName:'Sachet moussant exfoliant',quantity:1}
]},{});
const cfg=H.configuration(r);
assert(/Savon \*2/.test(cfg.description));assert(/Baume/.test(cfg.description));assert(!/Sachet/.test(cfg.description));
assert.equal(r.items.find(x=>x.family==='SOAP_GIFT_POUCH').componentRole,'FREE_GIFT');
console.log('V8.4 soap package/gift behavior PASS');