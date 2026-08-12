const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');
const history={
 familyFor:(p)=>/chemise/i.test(p)?'CHEMISE':null,
 descFor:()=> 'Chemise*3',
 buildRowsForWorkbook:()=>[{country:'FRANCE',description:'Chemise*3',quantity:1,cogs:20,shipping:11.10,unitTotal:31.10,amount:31.10}]
};
const ctx={console,window:null,startImport:async()=>{},document:{body:{dataset:{}},querySelector:()=>null,getElementById:()=>null},
 LABEL:{GENERIC_GOODS:'x'},classifyLine:()=>({isFree:false}),isMeaningfulProductLine:()=>true,currencyForWorkbook:()=> 'EUR',orderCurrency:()=> 'EUR',
 learnedCostRateForDescription:()=>null,sourceWorkbooks:[{name:'h.xlsx'}],classified:{orders:[],lineItems:[]},WRITE_HISTORY_V730:history};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const line={productName:'Chemise',sku:'CHEM*3',quantity:3,isFree:false};
const o={sourceFile:'h.xlsx',sourceRow:2,country:'FRANCE',sourceProductCountWasExplicit:true,sourceProductCountValue:3,productCount:3,lineItems:[line],recordKey:'H1',orderId:'H1'};
ctx.classified={orders:[o],lineItems:[{...line,sourceFile:'h.xlsx',country:'FRANCE'}]};
const r=ctx.generatedGenericFactRowsForWorkbook('h.xlsx')[0];
assert.equal(r.quantity,3);
assert(Math.abs(r.cogs-(20/3))<1e-10);
assert(Math.abs(r.shipping-(11.10/3))<1e-10);
assert(Math.abs(r.unitTotal-(31.10/3))<1e-10);
assert.equal(r.amount,31.10);
assert(Math.abs(r.quantity*r.unitTotal-31.10)<1e-9);
console.log('V7.5.8 historical package total preserved PASS');