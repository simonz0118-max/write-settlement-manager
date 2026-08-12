const fs=require('fs'),vm=require('vm'),assert=require('assert');const s=fs.readFileSync(process.argv[2],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(s,c);const E=c.WRITE_HISTORICAL_EXTRACTOR_V88;
const d={fileName:'soap.xlsx',sheets:[
{name:'18206-18722 CN',rows:[['订单号','产品总数','SKU','产品名称','国家','运单号','备注'],['A',2,'S*2','Savon','FRANCE','CN1',''],['A',2,'S*2','Savon','FRANCE','CN2','']]},
{name:'FACT CN',rows:[['No','Description','Quantity','COGs','Shipping'],[null,'FRANCE',null,null,null],[1,'Savon *2',2,2,5],[2,'Savon *9',null,9,18]]},
{name:'18206-18722 FR',rows:[['订单号','产品总数','SKU','产品名称','国家','运单号','备注'],['B',2,'S*2','Savon','FRANCE','FR1','法国仓库发']]},
{name:'FACT FR',rows:[['No','Description','Quantity','COGs','Frais trait.','Shipping'],[null,'FRANCE',null,null,null,null],[1,'Savon *2',1,2,2.5,4]]}
]};
const x=E.extractWorkbook(d);assert.equal(x.orderRecords.length,3);assert.equal(x.factRows.length,3);
assert.equal(x.orderRecords.filter(r=>r.orderId==='A').length,2,'same order id with distinct tracking must survive');
assert.equal(x.factRows.filter(r=>r.templateOnly).length,1);assert(x.factRows.some(r=>r.origin==='FR'));assert(x.factRows.some(r=>r.origin==='CN'));
console.log('V8.8 soap CN/FR extraction PASS');