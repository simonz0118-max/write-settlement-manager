/* WRITE V10 production statistics contract: orders -> country + full package composition -> one FACT. */
(function(g){'use strict';const VERSION='10.0.0';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toUpperCase();
function tracking(o={}){return clean(o.trackingNumber||o.tracking||o.waybill||o.parcelId||o.packageId)}
function orderId(o={},i=0){return clean(o.orderId||o.recordKey)||`ROW:${i+1}`}
function stableString(x){if(Array.isArray(x))return`[${x.map(stableString).join(',')}]`;if(x&&typeof x==='object')return`{${Object.keys(x).sort().map(k=>`${k}:${stableString(x[k])}`).join(',')}}`;return JSON.stringify(x)}
function duplicateKey(o={},i=0){return[orderId(o,i),tracking(o),norm(o.destinationCountry||o.country),stableString((o.lineItems||[]).map(x=>({sku:clean(x.sku),productName:clean(x.productName||x.description),quantity:x.quantity,amount:x.amount??x.lineTotal??x.unitPrice,discount:x.discount??x.discountPercent})))].join('\u0001')}
function shortenDescription(raw='',sku=''){
 let s=clean(raw).replace(/[🔥⭐✨✅🎁🧪™®©]/gu,' ')
  .replace(/\b(?:offre\s+exclusive|boutique\s+write|livraison\s+gratuite|best\s*seller|nouveau|premium|promotion|promo|hot\s*sale|free\s*shipping)\b/gi,' ')
  .replace(/\b([\p{L}\p{N}-]+)(?:\s+\1\b)+/giu,'$1').replace(/\s*[-–—|]\s*[-–—|]+/g,' - ').replace(/\s+/g,' ').trim();
 s=s.replace(/^\s*[-–—|:]+\s*/,'').trim();
 if(!s||s.length<3)s=clean(sku)||'Article';
 if(s.length>72)s=s.slice(0,72).replace(/\s+\S*$/,'').trim();
 return s||clean(sku)||'Article';
}
function canonicalOrders(input=[]){
 const seen=new Map(),orders=[],duplicates=[];
 input.forEach((o,i)=>{const key=duplicateKey(o,i);if(seen.has(key)){duplicates.push({duplicateIndex:i,keptIndex:seen.get(key),orderId:orderId(o,i),trackingNumber:tracking(o)});return}seen.set(key,i);orders.push({...o,__sourceIndex:i,__orderId:orderId(o,i),__tracking:tracking(o)})});
 return{orders,duplicates};
}
function orderConflicts(orders=[]){
 const records=new Map();for(const o of orders){if(!records.has(o.__orderId))records.set(o.__orderId,[]);records.get(o.__orderId).push(o)}
 const splitOrderIds=[],conflictOrderIds=[];
 for(const[id,rows]of records){const tracks=new Set(rows.map(x=>x.__tracking||'(NO_TRACKING)'));if(tracks.size>1)splitOrderIds.push(id);if(rows.length>1)conflictOrderIds.push(id)}
 return{splitOrderIds,conflictOrderIds};
}
function numericEvidence(item,keys){for(const k of keys){if(item[k]!==undefined&&item[k]!==null&&item[k]!==''&&Number.isFinite(Number(item[k])))return Number(item[k])}return null}
function freeDecision(item={}){
 const text=clean(item.productName||item.description),textFree=/(?:100\s*%\s*off|\bfree\b|gratuit(?:e)?|offert(?:e)?|免费|贈品|赠品)/i.test(text)||item.isFree===true;
 const amount=numericEvidence(item,['amount','lineTotal','total','unitPrice','price']),discount=numericEvidence(item,['discountPercent','discount']);
 const financialFree=amount===0||discount===100,positive=amount!==null&&amount>0,conflict=textFree&&positive;
 return{free:(textFree||financialFree)&&!conflict,conflict,textFree,financialFree,amount,discount};
}
function packageKey(o){return`${o.__orderId}\u0001${o.__tracking||'(NO_TRACKING)'}`}
function build(input=[]){
 const {orders,duplicates}=canonicalOrders(input),{splitOrderIds,conflictOrderIds}=orderConflicts(orders),reviewOrders=new Set(conflictOrderIds),groups=new Map(),freeAtoms=[],sourceItems=[],sourceByKey=new Map(),representedItems=[];
 const packages=new Map();for(const o of orders){const key=packageKey(o);if(!packages.has(key))packages.set(key,[]);packages.get(key).push(o)}
 let parcelCount=0,giftOnlyExcludedParcels=0;
 for(const records of packages.values()){
  const primary=records[0],country=norm(primary.destinationCountry||primary.country)||'GLOBAL',oid=primary.__orderId,atoms=[];let packageConflict=reviewOrders.has(oid);
  if(new Set(records.map(o=>norm(o.destinationCountry||o.country)||'GLOBAL')).size>1)packageConflict=true;
  for(const o of records)(o.lineItems||[]).forEach((item,ii)=>{
    const sourceItemKey=clean(item.sourceItemKey)||`${oid}::${o.__tracking}::${o.__sourceIndex}::${ii}`,free=freeDecision(item),parsed=g.WRITE_V10_ATOMS.parseSourceItem(item,{sourceItemKey,orderKey:oid,origin:norm(o.fulfillmentOrigin)||'UNKNOWN',currency:norm(o.currency)||'UNKNOWN',destinationCountry:country,invoiceEntity:o.invoiceEntity||'DEFAULT',taxRegime:o.taxRegime||'UNSPECIFIED',sourceFile:o.sourceFile,sourceSheet:o.sourceSheet,sourceRow:o.sourceRow});
    if(free.free)parsed.forEach(a=>{a.role=g.WRITE_V10_ATOMS.ROLES.FREE_GIFT;a.needsReview=false});
    if(free.conflict){packageConflict=true;parsed.forEach(a=>{if(a.role===g.WRITE_V10_ATOMS.ROLES.FREE_GIFT)a.role=g.WRITE_V10_ATOMS.ROLES.PACKAGE;a.needsReview=true})}
    const sourceRecord={sourceItemKey,orderId:oid,trackingNumber:o.__tracking,rawProductName:clean(item.productName||item.description),sku:clean(item.sku),freeDecision:free,atomIds:parsed.map(a=>a.atomId)};sourceItems.push(sourceRecord);sourceByKey.set(sourceItemKey,sourceRecord);atoms.push(...parsed)
  });
  const billed=atoms.filter(a=>a.role!==g.WRITE_V10_ATOMS.ROLES.FREE_GIFT&&a.role!==g.WRITE_V10_ATOMS.ROLES.MANUAL_ONLY);freeAtoms.push(...atoms.filter(a=>a.role===g.WRITE_V10_ATOMS.ROLES.FREE_GIFT));
  if(!billed.length){giftOnlyExcludedParcels++;continue}parcelCount++;
  const parts=billed.map(a=>{const source=sourceByKey.get(a.sourceItemKey),unknown=String(a.family).startsWith('NEW:'),desc=(unknown?shortenDescription(a.sourceSegment,source?.sku):clean(a.normalizedDescription)).replace(/\s*\*\s*\d+(?:[.,]\d+)?\s*$/,'').trim()||'Article';return{...a,description:desc,sku:source?.sku||'',needsReview:a.needsReview||unknown||packageConflict}}).sort((a,b)=>a.description.localeCompare(b.description,'fr',{numeric:true,sensitivity:'base'})||a.sku.localeCompare(b.sku));
  const display=parts.map(a=>`${a.description} *${a.multiplicity}`).join(' + '),identity=parts.map(a=>`${a.description}\u0002${a.sku}\u0002${a.multiplicity}`).join('\u0003'),key=[country,identity].join('\u0001');let row=groups.get(key);
  if(!row){row={country,description:display,quantity:0,cogs:null,shipping:null,handling:null,unitTotal:null,amount:null,priceBlank:true,needsReview:false,sourceOrderKeys:[],sourceItemKeys:[],trackingNumbers:[],rawEvidence:[],splitShipmentReview:false};groups.set(key,row)}
  row.quantity+=1;row.sourceOrderKeys.push(oid);row.trackingNumbers.push(primary.__tracking);row.sourceItemKeys.push(...parts.map(a=>a.sourceItemKey));row.needsReview||=parts.some(a=>a.needsReview);row.splitShipmentReview||=splitOrderIds.includes(oid);row.rawEvidence.push(...parts.map(a=>({orderId:oid,trackingNumber:primary.__tracking,sourceItemKey:a.sourceItemKey,rawProductName:a.sourceText,sku:a.sku,shortDescription:a.description,multiplicity:a.multiplicity,role:a.role,family:a.family,needsReview:a.needsReview})));
  representedItems.push(...parts.map(a=>a.sourceItemKey));
 }
 const rows=[...groups.values()].sort((a,b)=>a.country.localeCompare(b.country,'en')||a.description.localeCompare(b.description,'fr',{numeric:true,sensitivity:'base'}));rows.forEach((r,i)=>{r.no=i+1;r.parcelCount=parcelCount;r.parcelNeedsReview=conflictOrderIds.length>0});rows.parcelCount=parcelCount;rows.parcelNeedsReview=conflictOrderIds.length>0;
 const billedSourceItems=new Set(rows.flatMap(r=>r.sourceItemKeys)),freeSourceItems=new Set(freeAtoms.map(a=>a.sourceItemKey)),allSourceItems=new Set(sourceItems.map(x=>x.sourceItemKey),representedItems);const missing=[...allSourceItems].filter(k=>!billedSourceItems.has(k)&&!freeSourceItems.has(k));
 const audit={version:VERSION,inputRecords:input.length,uniqueRecords:orders.length,deduplicatedRecords:duplicates.length,duplicates,packageRecords:packages.size,parcelCount,giftOnlyExcludedParcels,splitOrderIds,conflictOrderIds,sourceItems:sourceItems.length,representedItems:billedSourceItems.size,freeItems:freeSourceItems.size,missingSourceItems:missing,hardPass:missing.length===0};
 return{version:VERSION,rows,parcelCount,audit,freeAtoms,sourceItems};
}
g.WRITE_V10_PRODUCTION={VERSION,shortenDescription,duplicateKey,canonicalOrders,orderConflicts,freeDecision,build};
})(window);
