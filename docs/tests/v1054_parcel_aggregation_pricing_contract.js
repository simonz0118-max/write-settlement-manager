const fs=require('fs'),assert=require('assert'),vm=require('vm');
const source=fs.readFileSync('src/v10/v1050-production-hardening.js','utf8');

const rules={
 'STYLO':3.20,
 'PACKAGE_FEE:CN:FR:EUR:STYLO_Q1':2.10,
 'PACKAGE_FEE:CN:FR:EUR:STYLO_Q2':2.55,
 'PACKAGE_FEE:CN:FR:EUR:STYLO_Q3':2.95,
};
function feeSku(_scope,comps){
 const stylo=comps.find(c=>String(c.sku||c.productName).toUpperCase().includes('STYLO'));
 const q=Number(stylo?.quantity||0);
 return `PACKAGE_FEE:CN:FR:EUR:STYLO_Q${Math.min(3,Math.max(1,q))}`;
}
const ctx={
 console,
 globalThis:null,
 WRITE_RELEASE_META:{current:{version:'10.5.4'}},
 WRITE_V1040_LAYERING:{_test:{packageFeeSku:feeSku}},
 WRITE_KB:{
  calculateCost({sku}){
   const key=String(sku||'').toUpperCase();
   if(key==='STYLO')return {resolved:true,unitCost:3.20,totalCost:3.20,rule:{payload:{sku:'STYLO'}}};
   if(Object.prototype.hasOwnProperty.call(rules,key))return {resolved:true,unitCost:rules[key],totalCost:rules[key],rule:{payload:{sku:key}}};
   return {resolved:false};
  }
 },
 WRITE_V10_PRODUCTION:{build:x=>x},
 addEventListener(){},
};
ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(source,ctx);

const H=ctx.WRITE_V1050_HARDENING;
assert(H&&H._test,'hardening test API missing');

function evidence(order,tracking,multiplicity){
 return {orderId:order,trackingNumber:tracking,sourceItemKey:`${order}-${tracking}`,rawProductName:'Stylo eternel',sku:'STYLO',shortDescription:'Stylo eternel',multiplicity,role:'PACKAGE',family:'STYLO'};
}

// Critical fifth-round replay: two identical parcels, each Stylo ×1.
const row={
 role:'PACKAGE',origin:'CN',country:'FR',currency:'EUR',quantity:2,
 rawEvidence:[evidence('O1','T1',1),evidence('O2','T2',1)]
};
H.hardenPackage(row);
assert.equal(row.packageCount,2);
assert.equal(row.cogs,3.20);
assert.equal(row.shipping,2.10);
assert.equal(row.unitTotal,5.30);
assert.equal(row.amount,10.60);
assert.equal(row.needsReview,false);
assert.equal(row.componentAggregationMode,'PER_PARCEL_EVIDENCE');

// Two identical parcels, each Stylo ×2: packageCount must not turn Q2 into Q3/Q4.
const row2={
 role:'PACKAGE',origin:'CN',country:'FR',currency:'EUR',quantity:2,
 rawEvidence:[evidence('O3','T3',2),evidence('O4','T4',2)]
};
H.hardenPackage(row2);
assert.equal(row2.cogs,6.40);
assert.equal(row2.shipping,2.55);
assert.equal(row2.unitTotal,8.95);
assert.equal(row2.amount,17.90);

// Different parcel compositions inside one aggregate row must fail closed.
const bad={
 role:'PACKAGE',origin:'CN',country:'FR',currency:'EUR',quantity:2,
 rawEvidence:[evidence('O5','T5',1),evidence('O6','T6',2)]
};
H.hardenPackage(bad);
assert.equal(bad.needsReview,true);
assert.equal(bad.amount,null);
assert.equal(bad.priceMatch,'V1054_PARCEL_COMPOSITION_CONFLICT');

console.log('V10.5.4 parcel aggregation pricing integrity PASS');
