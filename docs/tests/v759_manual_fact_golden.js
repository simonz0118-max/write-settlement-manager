const fs=require('fs'),vm=require('vm'),assert=require('assert');
const runtime=fs.readFileSync(process.argv[2],'utf8');
const golden=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const ctx={console,window:null,startImport:async()=>{},document:{body:{dataset:{}},querySelector:()=>null,getElementById:()=>null},
 LABEL:{GENERIC_GOODS:'x'},classifyLine:()=>({isFree:false}),isMeaningfulProductLine:(n,s)=>!!String(n||s||'').trim(),
 currencyForWorkbook:()=> 'EUR',orderCurrency:()=> 'EUR',learnedCostRateForDescription:()=>null,
 sourceWorkbooks:[{name:'golden.xlsx'}],classified:{orders:[],lineItems:[]}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(runtime,ctx);

function qsku(s){const m=String(s||'').match(/\*(\d+(?:\.\d+)?)\s*$/);return m?Number(m[1]):1}
const orders=golden.orders.map((o,i)=>{
 const names=String(o.productNames||'').split(/\n/),skus=String(o.skuLines||'').split(/\n/),n=Math.max(names.length,skus.length);
 while(names.length<n)names.push('');while(skus.length<n)skus.push('');
 const lineItems=[];
 for(let j=0;j<n;j++)if(String(names[j]||'').trim()){
   lineItems.push({productName:names[j],sku:skus[j]||'',quantity:qsku(skus[j]),isFree:false});
 }
 return {sourceFile:'golden.xlsx',sourceSheet:'1001-1162',sourceRow:i+2,country:o.country,
   sourceProductCountWasExplicit:o.sourceProductCount!==null&&o.sourceProductCount!==undefined&&String(o.sourceProductCount)!=='',
   sourceProductCountValue:Number(o.sourceProductCount),productCount:Number(o.sourceProductCount),
   lineItems,recordKey:o.orderKey,orderId:o.orderKey};
});
ctx.classified={orders,lineItems:orders.flatMap(o=>o.lineItems.map(x=>({...x,sourceFile:'golden.xlsx',country:o.country})))};
const actual=ctx.v759LearnedManualRowsForWorkbook('golden.xlsx').rows.map(r=>({country:r.country,description:r.description,quantity:Number(r.quantity)}));
const expected=golden.expected;
function norm(s){return String(s||'').replace(/\s+/g,' ').replace(/\s*\/\s*/g,' / ').trim()}
function key(x){return `${x.country}\u0001${norm(x.description)}\u0001${x.quantity}`}
assert.equal(actual.length,49,'manual FACT must have 49 semantic rows');
assert.equal(actual.reduce((a,x)=>a+x.quantity,0),252,'manual FACT accounting Quantity sum must be 252');
const A=[...actual].map(key).sort(),E=[...expected].map(key).sort();
assert.deepEqual(A,E,'generated manual FACT semantics must exactly match uploaded human FACT');
const audit=ctx.v759LearnedManualRowsForWorkbook('golden.xlsx').audit;
assert.equal(audit.sourceRows,162);
assert.equal(audit.billableOrders,161);
assert.equal(audit.baseGroups,45);
assert.equal(audit.upsellGroups,4);
console.log('V7.5.9 MANUAL FACT GOLDEN PASS: 49 rows / base45 / upsell4 / accountingQty252');