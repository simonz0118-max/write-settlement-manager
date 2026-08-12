const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');
const ctx={console,window:null,startImport:async()=>{},document:{body:{dataset:{}},querySelector:()=>null,getElementById:()=>null},
 LABEL:{GENERIC_GOODS:'x'},classifyLine:()=>({isFree:false}),isMeaningfulProductLine:()=>true,currencyForWorkbook:()=> 'EUR',orderCurrency:()=> 'EUR',
 learnedCostRateForDescription:()=>null,sourceWorkbooks:[{name:'m.xlsx'}],classified:{orders:[],lineItems:[]}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const lines=[
 {productName:'Le Filet de camouflage renforcé premium - Blanc / 3x5',sku:'NET*1',quantity:1,isFree:false},
 {productName:'Kit de fixation complet - Suspendu',sku:'KIT*1',quantity:1,isFree:false}
];
const o={sourceFile:'m.xlsx',sourceRow:2,country:'FRANCE',sourceProductCountWasExplicit:true,sourceProductCountValue:2,productCount:2,lineItems:lines,recordKey:'M1',orderId:'M1'};
ctx.classified={orders:[o],lineItems:lines.map(x=>({...x,sourceFile:'m.xlsx',country:'FRANCE'}))};
const r=ctx.generatedGenericFactRowsForWorkbook('m.xlsx')[0];
assert.equal(r.quantity,2);
assert(/Le Filet de camouflage \/ 3x5/.test(r.description));
assert(/Kit de fixation complet/.test(r.description));
assert(!/SKU|NET\*1|KIT\*1/.test(r.description));
console.log('V7.5.8 multi-product order description PASS');