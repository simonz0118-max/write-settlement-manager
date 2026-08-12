const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');
const ctx={console,window:null,startImport:async()=>{},document:{body:{dataset:{}},querySelector:()=>null,getElementById:()=>null},
 LABEL:{GENERIC_GOODS:'一般商品'},classifyLine:()=>({isFree:false}),
 isMeaningfulProductLine:(n,s)=>!!String(n||s||'').trim(),currencyForWorkbook:()=> 'EUR',orderCurrency:()=> 'EUR',
 learnedCostRateForDescription:()=>null,sourceWorkbooks:[{name:'batch.xlsx'}],classified:{orders:[],lineItems:[]}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);

const orders=[];
function add(country,i,q,items){
 const lines=items||[{productName:'Le Filet de camouflage renforcé premium - Beige / 3x4',sku:`SKU-${i}*${q}`,quantity:q,isFree:false}];
 orders.push({sourceFile:'batch.xlsx',sourceRow:i+2,country,sourceProductCountWasExplicit:true,sourceProductCountValue:q,productCount:q,lineItems:lines,recordKey:'R'+i,orderId:'R'+i});
}
// 160 valid orders, total quantity 288:
// FR: 158 orders = 284 units (126*2 + 32*1), BE 2, GR 2.
for(let i=0;i<158;i++)add('FRANCE',i,i<126?2:1);
add('BELGIUM',158,2);
add('GREECE',159,2);
// 2 retained source records with unknown/zero quantity.
orders.push({sourceFile:'batch.xlsx',sourceRow:162,country:'FRANCE',sourceProductCountWasExplicit:true,sourceProductCountValue:0,productCount:0,lineItems:[],recordKey:'Z1',orderId:'Z1',sourceRawFields:{备注:'定制订单'}});
orders.push({sourceFile:'batch.xlsx',sourceRow:163,country:'FRANCE',sourceProductCountWasExplicit:true,sourceProductCountValue:0,productCount:0,lineItems:[],recordKey:'Z2',orderId:'Z2',sourceRawFields:{备注:'尺寸调整'}});
ctx.classified={orders,lineItems:orders.flatMap(o=>o.lineItems||[])};
const rows=ctx.generatedGenericFactRowsForWorkbook('batch.xlsx');
const active=rows.filter(r=>r.quantity!==null);
assert.equal(active.length,160,'160 valid orders => 160 FACT rows');
assert.equal(new Set(active.map(r=>r.sourceOrderKey)).size,160,'no cross-order merge');
assert.equal(active.reduce((a,r)=>a+r.quantity,0),288,'true product Quantity sum must be 288');
assert.equal(active.filter(r=>r.country==='FRANCE').length,158);
assert.equal(active.filter(r=>r.country==='BELGIUM').length,1);
assert.equal(active.filter(r=>r.country==='GREECE').length,1);
assert.equal(rows.filter(r=>r.quantity===null).length,2);
const exp=ctx.buildFactExportData();
assert.equal(exp.orderCount,160);
assert.equal(exp.parcelCount,160);
assert.equal(exp.totalQty,288);
assert.equal(exp.merchandiseQty,288);
console.log('V7.5.8 DUAL INVARIANT PASS: 160 rows + 288 quantity');