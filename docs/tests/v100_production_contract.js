const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={window:null,globalThis:null,console,TextEncoder,TextDecoder};c.window=c;c.globalThis=c;vm.createContext(c);
for(const f of process.argv.slice(2))vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const A=c.WRITE_V10_ATOMS,P=c.WRITE_V10_PRODUCTION;
assert(A&&P,'V10 production modules must load');

// Regression: physical dimensions are not quantities; compact human Xn notation is.
assert.equal(A.multiplicity('Housse 220×240 cm + 2 taies',1),1);
assert.equal(A.multiplicity('Autocollant 140 × 40 mm 3000 pièces',1),1);
assert.equal(A.multiplicity('Stylo eternelX3',1),3);
assert.equal(A.multiplicity('Savon * 2',1),2);

// Unknown descriptions are shortened conservatively, never pasted blindly, and remain traceable/red.
const shortened=P.shortenDescription('🔥 OFFRE EXCLUSIVE Boutique WRITE - GPS Apple GPS Apple - Noir / XL (Livraison rapide)', 'GPS-XL*2');
assert(shortened.length<80);
assert(!/offre exclusive|boutique|livraison gratuite/i.test(shortened));
assert(/GPS/i.test(shortened));

const orders=[
 {orderId:'O1',trackingNumber:'T1',country:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',lineItems:[{sku:'SOAP*2',productName:'Savon *2',quantity:2},{sku:'GIFT',productName:'Coffret cadeau 100% OFF',quantity:1}]},
 // Exact duplicate: must be removed.
 {orderId:'O1',trackingNumber:'T1',country:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',lineItems:[{sku:'SOAP*2',productName:'Savon *2',quantity:2},{sku:'GIFT',productName:'Coffret cadeau 100% OFF',quantity:1}]},
 // Same order, different tracking: two parcels, red review.
 {orderId:'O1',trackingNumber:'T2',country:'FRANCE',fulfillmentOrigin:'FR',currency:'EUR',lineItems:[{sku:'SOAP*2',productName:'Savon *2',quantity:2}]},
 // Gift-only order: excluded from product rows and parcel total.
 {orderId:'O2',trackingNumber:'T3',country:'FRANCE',currency:'EUR',lineItems:[{sku:'FREE',productName:'Échantillon gratuit',quantity:1}]},
 // Unknown: kept, shortened, red, price blank.
 {orderId:'O3',trackingNumber:'T4',country:'BELGIUM',currency:'EUR',lineItems:[{sku:'GPS-XL*2',productName:'🔥 OFFRE EXCLUSIVE Boutique WRITE - GPS Apple GPS Apple - Noir / XL (Livraison rapide)',quantity:2}]}
];
const x=P.build(orders);
assert.equal(x.audit.inputRecords,5);
assert.equal(x.audit.deduplicatedRecords,1);
assert.equal(x.audit.parcelCount,3);
assert.equal(x.audit.giftOnlyExcludedParcels,1);
assert(x.audit.splitOrderIds.includes('O1'));
assert(x.rows.every(r=>r.cogs===null&&r.shipping===null&&r.unitTotal===null&&r.amount===null));
const soap=x.rows.find(r=>r.country==='FRANCE'&&/Savon/.test(r.description));
assert(soap&&soap.quantity===2,'same country/config across origins must merge to two parcels');
assert(soap.needsReview,'split shipment rows must be red');
const unknown=x.rows.find(r=>r.country==='BELGIUM');
assert(unknown&&unknown.needsReview&&unknown.rawEvidence.length===1);
assert(!/offre exclusive|boutique/i.test(unknown.description));
assert(!x.rows.some(r=>/gratuit|100% OFF/i.test(r.description)));

// Same order + same tracking but conflicting contents: retain both records, one parcel, red.
const conflict=P.build([
 {orderId:'C1',trackingNumber:'TC',country:'FRANCE',lineItems:[{sku:'A',productName:'Savon',quantity:1}]},
 {orderId:'C1',trackingNumber:'TC',country:'FRANCE',lineItems:[{sku:'B',productName:'Stylo eternelX3',quantity:1}]}
]);
assert.equal(conflict.audit.parcelCount,1);
assert(conflict.audit.conflictOrderIds.includes('C1'));
assert(conflict.rows.every(r=>r.needsReview));

// Zero amount is an explicit free signal; a positive amount contradicting “free” is kept/red.
const free=P.build([
 {orderId:'F1',trackingNumber:'TF1',country:'FRANCE',lineItems:[{sku:'SAMPLE',productName:'Sample',amount:0}]},
 {orderId:'F2',trackingNumber:'TF2',country:'FRANCE',lineItems:[{sku:'PAID',productName:'Cadeau gratuit',amount:12}]}
]);
assert.equal(free.audit.giftOnlyExcludedParcels,1);
assert.equal(free.audit.parcelCount,1);
assert(free.rows[0].needsReview);
console.log('V10 production contract PASS');
