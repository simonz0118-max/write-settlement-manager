const fs=require('fs'),vm=require('vm');
const c={console,window:null,CustomEvent:class{},document:undefined};c.window=c;
c.WRITE_KB={
 reviewedFact:spec=>spec.configurationFingerprint==='Stylo eternel\u00021'?{payload:{description:'Stylo eternel',cogs:3.20,shipping:2.10,unitTotal:5.30,amount:10.60}}:null,
 list:()=>[],costModel:()=>null,reviewedProduct:()=>null
};
vm.createContext(c);
vm.runInContext(fs.readFileSync('src/v10/billable-atom.js','utf8'),c,{filename:'billable-atom.js'});
vm.runInContext(fs.readFileSync('src/v10/production-core.js','utf8'),c,{filename:'production-core.js'});
const orders=[
 {orderId:'A1',trackingNumber:'T1',destinationCountry:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',lineItems:[{sku:'STYLO',productName:'Stylo eternel *1',quantity:1}]},
 {orderId:'A2',trackingNumber:'T2',destinationCountry:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',lineItems:[{sku:'STYLO',productName:'Stylo eternel *1',quantity:1}]},
 {orderId:'A3',trackingNumber:'T3',destinationCountry:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',lineItems:[{sku:'MYSTERY',productName:'Mystery cap *1',quantity:1}]}
];
const r=c.WRITE_V10_PRODUCTION.build(orders);
const pencil=r.rows.find(x=>x.configurationFingerprint==='Stylo eternel\u00021');
const unknown=r.rows.find(x=>String(x.description).toLowerCase().includes('mystery'));
if(!pencil)throw Error('pencil row missing '+JSON.stringify(r.rows));
const checks=[pencil.quantity===2,pencil.cogs===3.2,pencil.shipping===2.1,pencil.unitTotal===5.3,pencil.amount===10.6,pencil.needsReview===false,pencil.priceBlank===false];
if(checks.some(x=>!x))throw Error('pencil values '+JSON.stringify(pencil));
if(!unknown||unknown.priceBlank!==true||unknown.needsReview!==true||unknown.amount!==null)throw Error('unknown fail-closed '+JSON.stringify(unknown));
if(r.parcelCount!==3)throw Error('parcelCount '+r.parcelCount);
console.log('V11.0.10 PRODUCTION REPLAY SMOKE PASS',JSON.stringify({pencil:{quantity:pencil.quantity,cogs:pencil.cogs,shipping:pencil.shipping,unitTotal:pencil.unitTotal,amount:pencil.amount},unknown:{priceBlank:unknown.priceBlank,needsReview:unknown.needsReview},parcelCount:r.parcelCount}));
