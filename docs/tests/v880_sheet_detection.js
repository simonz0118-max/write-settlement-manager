const fs=require('fs'),vm=require('vm'),assert=require('assert');const s=fs.readFileSync(process.argv[2],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(s,c);const E=c.WRITE_HISTORICAL_EXTRACTOR_V88;
const order=[['订单号','产品总数','SKU','产品名称','国家','运单号','备注'],['1001',2,'A*2','Savon','FRANCE','T1','']];
const fact=[['No','Description','Quantity','COGs','Shipping'],[null,'FRANCE',null,null,null],[1,'Savon *2',1,2,5]];
assert.equal(E.detectSheetRole('18206-18722 CN',order).role,'ORDER');
assert.equal(E.detectSheetRole('FACT CN',fact).role,'FACT');
console.log('V8.8 sheet role detection PASS');