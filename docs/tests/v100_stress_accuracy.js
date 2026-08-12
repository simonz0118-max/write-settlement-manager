const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const c={window:null,globalThis:null,console,TextEncoder,TextDecoder};c.window=c;c.globalThis=c;vm.createContext(c);
for(const f of process.argv.slice(2))vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const P=c.WRITE_V10_PRODUCTION;assert(P);
let seed=0x10c0ffee;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32};
const pick=a=>a[Math.floor(rnd()*a.length)],countries=['FRANCE','BELGIUM','CANADA','SWITZERLAND','GERMANY','SPAIN'],origins=['CN','FR'],products=[
 ['SOAP','Savon *2'],['BALM','Baume 55g *1'],['PEN','Stylo eternelX3'],['REFILL','Lot de 6 Mines colorées *1'],['NET','Filet camouflage *2'],['TOWEL','Serviette de Douche *1'],['NAIL','Kit Ongles *1']
];
const base=[],expectedParcels=new Set(),giftOnly=new Set();
for(let i=0;i<50000;i++){
 const id=`S${i}`,tracking=`T${i}`,country=pick(countries),origin=pick(origins),gift=rnd()<.08,unknown=rnd()<.12;
 const lineItems=gift?[{sku:'FREE',productName:'Échantillon gratuit',amount:0}]:unknown?[{sku:`UNK-${i%97}`,productName:`🔥 OFFRE EXCLUSIVE Produit expérimental série ${i%97} / taille ${1+i%5}`,unitPrice:10+rnd()*100}]:Array.from({length:1+Math.floor(rnd()*3)},()=>{const p=pick(products);return{sku:p[0],productName:p[1],unitPrice:5+rnd()*95}});
 base.push({orderId:id,trackingNumber:tracking,country,fulfillmentOrigin:origin,currency:'EUR',lineItems});
 if(gift)giftOnly.add(`${id}|${tracking}`);else expectedParcels.add(`${id}|${tracking}`);
 if(i%997===0)base.push(JSON.parse(JSON.stringify(base[base.length-1]))); // exact duplicate
 if(i%1499===0){base.push({...base[base.length-1],trackingNumber:`${tracking}-B`,fulfillmentOrigin:origin==='CN'?'FR':'CN'});if(gift)giftOnly.add(`${id}|${tracking}-B`);else expectedParcels.add(`${id}|${tracking}-B`)}
}
const started=Date.now(),x=P.build(base),elapsedMs=Date.now()-started;
assert.equal(x.audit.parcelCount,expectedParcels.size);
assert.equal(x.audit.giftOnlyExcludedParcels,giftOnly.size);
assert.equal(x.audit.missingSourceItems.length,0);
assert(x.audit.deduplicatedRecords>0&&x.audit.splitOrderIds.length>0);
assert(x.rows.length>0&&x.rows.every(r=>r.priceBlank&&r.cogs===null&&r.shipping===null&&r.unitTotal===null&&r.amount===null));
assert.equal(x.rows.reduce((n,r)=>n+r.quantity,0),x.audit.parcelCount);
assert(x.rows.filter(r=>r.needsReview).length>0);
const snapshot=JSON.stringify(x.rows.map(({country,description,quantity,needsReview})=>({country,description,quantity,needsReview})));
const rerun=P.build(base),snapshot2=JSON.stringify(rerun.rows.map(({country,description,quantity,needsReview})=>({country,description,quantity,needsReview})));
assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'),crypto.createHash('sha256').update(snapshot2).digest('hex'),'same input must be deterministic');
console.log(JSON.stringify({status:'PASS',seed:'0x10c0ffee',inputRecords:base.length,parcels:x.audit.parcelCount,giftOnlyExcluded:x.audit.giftOnlyExcludedParcels,deduplicated:x.audit.deduplicatedRecords,splitOrders:x.audit.splitOrderIds.length,rows:x.rows.length,elapsedMs,deterministic:true,missingSourceItems:0},null,2));
