const fs=require('fs'),vm=require('vm'),assert=require('assert');
const files=process.argv.slice(2).map(p=>fs.readFileSync(p,'utf8')),c={window:null};c.window=c;vm.createContext(c);for(const s of files)vm.runInContext(s,c);
const IR=c.WRITE_V10_ACCOUNTING_IR;
const cases=[
 ['paid-gift',[{productName:'Coffret Cadeau Deluxe *1'}],x=>x.packageRows.length===1&&x.freeAtoms.length===0],
 ['paid-sample',[{productName:'Échantillon premium *1'}],x=>x.packageRows.length===1&&x.freeAtoms.length===0],
 ['free-gift',[{productName:'Coffret cadeau offert *1'}],x=>x.freeAtoms.length===1&&x.invoiceLines.length===0],
 ['soap-3',[{productName:'Savon *2 + Serviette *1 + Baume *1'}],x=>x.packageRows.length===1&&x.audit.sourceAtomicQuantity===4],
 ['soap-4',[{productName:'Savon *2 + Serviette *1 + Baume *1 + Ongles *1'}],x=>x.packageRows.length===1&&x.audit.sourceAtomicQuantity===5],
 ['engraving',[{productName:'Gravure personnalisée *2'}],x=>x.serviceRows.length===1&&x.serviceRows[0].quantity===2],
 ['import-fee',[{productName:"Frais d'importation *1"}],x=>x.feeRows.length===1],
 ['handling-fr',[{productName:'Frais de traitement *2'}],x=>x.feeRows.length===1&&x.feeRows[0].quantity===2],
 ['currency-eur',[{productName:'Savon *2'}],x=>x.packageRows[0].currency==='EUR'],
 ['currency-usd',[{productName:'Savon *2'}],x=>x.packageRows[0].currency==='USD'],
 ['unknown',[{productName:'未知新品 Ω XXL *3'}],x=>x.packageRows.length===1&&x.packageRows[0].needsReview],
 ['same-order-multi-tracking',[{productName:'Savon *1'}],x=>x.audit.hardPass],
 ['zero-qty',[{productName:'Savon',quantity:0}],x=>x.audit.hardPass&&x.audit.sourceAtomicQuantity===0],
 ['empty-sku',[{productName:'Savon *2',sku:''}],x=>x.audit.hardPass],
 ['unicode-long',[{productName:'Édition spéciale 超长 Unicode Produit Ω • Savon *2'}],x=>x.audit.hardPass]
];
let pass=0;
for(let i=0;i<cases.length;i++){const [name,items,check]=cases[i],currency=name==='currency-usd'?'USD':'EUR',orders=[{recordKey:`O${i}`,country:'FRANCE',currency,fulfillmentOrigin:name==='handling-fr'?'FR':'CN',lineItems:items}];const x=IR.buildIR(orders);if(!check(x)){console.error('FAIL',name,JSON.stringify(x));process.exit(1)}if(!x.audit.hardPass){console.error('HARD FAIL',name,x.audit);process.exit(1)}pass++}
assert.equal(pass,15);console.log(`V10 15 deterministic semantic scenarios PASS: ${pass}/15 = 100%`);