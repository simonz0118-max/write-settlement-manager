const fs=require('fs'),vm=require('vm'),assert=require('assert');const s=fs.readFileSync(process.argv[2],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(s,c);const A=c.WRITE_V10_ATOMS;
let a=A.parseSourceItem({productName:'Coffret Cadeau Deluxe',quantity:1},{sourceItemKey:'1'})[0];assert.equal(a.family,'PAID_GIFT_BOX');assert.equal(a.role,'PACKAGE');
a=A.parseSourceItem({productName:'Échantillon premium',quantity:1},{sourceItemKey:'2'})[0];assert.equal(a.family,'PAID_SAMPLE');assert.equal(a.role,'PACKAGE');
a=A.parseSourceItem({productName:'Coffret cadeau - 100% off',quantity:1},{sourceItemKey:'3'})[0];assert.equal(a.role,'FREE_GIFT');
a=A.parseSourceItem({productName:'Savon offert',quantity:1},{sourceItemKey:'4'})[0];assert.equal(a.role,'FREE_GIFT');
console.log('V10 P0-1 paid gift/sample/free evidence PASS');