const fs=require('fs'),vm=require('vm'),assert=require('assert');const h=fs.readFileSync(process.argv[2],'utf8'),s=fs.readFileSync(process.argv[3],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(h,c);vm.runInContext(s,c);const A=c.WRITE_V10_ATOMS;
const x=A.parseSourceItem({productName:'Savon *2 + Serviette *1 + Baume *1',quantity:1},{sourceItemKey:'S1'});
assert.equal(x.length,3);assert.deepEqual(Array.from(x,x=>x.multiplicity),[2,1,1]);assert(x.some(a=>a.family==='SOAP'));assert(x.some(a=>a.family==='SOAP_TOWEL'));assert(x.some(a=>a.family==='SOAP_BALM'));
const y=A.parseSourceItem({productName:'Savon *2 + Baume *1 + Ongles *1 + Serviette *1'},{sourceItemKey:'S2'});assert.equal(y.length,4);
console.log('V10 P0-2 multi-entity BillableAtom PASS');