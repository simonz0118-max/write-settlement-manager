const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={window:null};c.window=c;c.WRITE_HUMAN_WORKFLOW_V84={fulfillmentOrigin:o=>({origin:o.fulfillmentOrigin||'CN'}),family:x=>{const s=String(x.productName||'');if(/filet/i.test(s))return'YD_NET';if(/crayon/i.test(s))return'PENCIL_MAIN';return'NEW:'+s},accountingAlias:x=>String(x.productName||'Article'),learnedComponentRole:()=>({role:'PACKAGE',confidence:.9,evidence:[]})};vm.createContext(c);
for(const p of process.argv.slice(2))vm.runInContext(fs.readFileSync(p,'utf8'),c);
const P=c.WRITE_V10_PRODUCTION;
const base=(id,sku,name,q=1)=>({orderId:id,trackingNumber:'T'+id,destinationCountry:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',taxRegime:'T',lineItems:[{sku,productName:name,quantity:q}]});
let x=P.build([base('1','SKU-A','Le Filet de camouflage / 3x4',1),base('2','SKU-B','Le Filet de camouflage / 3x4',1),base('3','SKU-C','Le Filet de camouflage / 3x4',1)]);
assert.equal(x.rows.length,1);assert.equal(x.rows[0].quantity,3);assert(x.audit.finalAggregationPass);assert(x.audit.hardPass);
// Marketing fragment must not become a billable component.
x=P.build([base('4','','47% d’économie *1 + Gomme capuchon Shield / Lot de 2',1)]);assert(!x.rows[0].description.includes('47%'));
// SERVICE is separate from package and same service aggregates by actual multiplicity.
x=P.build([{orderId:'5',trackingNumber:'T5',destinationCountry:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',lineItems:[{productName:'Gravure Personnalisée *2 + Le Crayon Intemporel / Lot de 4'}]},{orderId:'6',trackingNumber:'T6',destinationCountry:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',lineItems:[{productName:'Gravure Personnalisée *1 + Le Crayon Intemporel / Lot de 4'}]}]);
const service=x.rows.find(r=>r.role==='SERVICE'),pkg=x.rows.find(r=>r.role==='PACKAGE');assert(service&&pkg);assert.equal(service.quantity,3);assert.equal(pkg.quantity,2);assert(!pkg.description.toLowerCase().includes('gravure'));assert(x.audit.hardPass);
// Same accounting description but different origin/currency must NOT merge.
x=P.build([base('7','A','Le Filet de camouflage / 2x4'),{...base('8','B','Le Filet de camouflage / 2x4'),currency:'USD'},{...base('9','C','Le Filet de camouflage / 2x4'),fulfillmentOrigin:'FR'}]);assert.equal(x.rows.length,3);
console.log('V10.0.3 accounting golden final aggregation PASS');