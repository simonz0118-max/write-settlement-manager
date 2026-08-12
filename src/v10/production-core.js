/* WRITE V10 production statistics contract: orders -> country + full package composition -> one FACT. */
(function(g){'use strict';const VERSION='10.0.3';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toUpperCase();
function tracking(o={}){return clean(o.trackingNumber||o.tracking||o.waybill||o.parcelId||o.packageId)}
function orderId(o={},i=0){return clean(o.orderId||o.recordKey)||`ROW:${i+1}`}
function stableString(x){if(Array.isArray(x))return`[${x.map(stableString).join(',')}]`;if(x&&typeof x==='object')return`{${Object.keys(x).sort().map(k=>`${k}:${stableString(x[k])}`).join(',')}}`;return JSON.stringify(x)}
function duplicateKey(o={},i=0){return[orderId(o,i),tracking(o),norm(o.destinationCountry||o.country),stableString((o.lineItems||[]).map(x=>({sku:clean(x.sku),productName:clean(x.productName||x.description),quantity:x.quantity,amount:x.amount??x.lineTotal??x.unitPrice,discount:x.discount??x.discountPercent})))].join('\u0001')}
function shortenDescription(raw='',sku=''){
 let s=clean(raw).replace(/[🔥⭐✨✅🎁🧪™®©]/gu,' ')
  .replace(/(?:^|\s*(?:\+|\||•|;|,)\s*)(?:\d{1,3}\s*%\s*(?:d['’]économie|de\s+réduction|off|discount)|économisez\s+\d{1,3}\s*%|save\s+\d{1,3}\s*%)(?=\s*(?:\+|\||•|;|,|$))/giu,' ')
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
function isMarketingOnly(text=''){const s=clean(text);return /^(?:\d{1,3}\s*%\s*(?:d['’]économie|de\s+réduction|off|discount)|économisez\s+\d{1,3}\s*%|save\s+\d{1,3}\s*%)\s*(?:\*\s*\d+(?:[.,]\d+)?)?$/iu.test(s)}
function build(input=[]){
 const {orders,duplicates}=canonicalOrders(input),{splitOrderIds,conflictOrderIds}=orderConflicts(orders),reviewOrders=new Set(conflictOrderIds);
 const packageGroups=new Map(),separateGroups=new Map(),freeAtoms=[],sourceItems=[],represented=new Set(),packages=new Map();
 for(const o of orders){const key=packageKey(o);if(!packages.has(key))packages.set(key,[]);packages.get(key).push(o)}
 let parcelCount=0,giftOnlyExcludedParcels=0;
 const R=g.WRITE_V10_ATOMS.ROLES;
 function dims(o,country){return{
   invoiceEntity:clean(o.invoiceEntity)||'DEFAULT',
   origin:norm(o.fulfillmentOrigin||g.WRITE_HUMAN_WORKFLOW_V84?.fulfillmentOrigin?.(o)?.origin)||'UNKNOWN',
   country,
   currency:norm(o.currency||o.orderCurrency||o.paymentCurrency)||'UNKNOWN',
   taxRegime:clean(o.taxRegime)||'UNSPECIFIED'
 }}
 function addSeparate(a,source,d,oid,trackingNumber,packageConflict){
   const unknown=String(a.family).startsWith('NEW:'),rawDesc=unknown?a.sourceSegment:a.normalizedDescription;
   const desc=shortenDescription(rawDesc,source?.sku).replace(/\s*\*\s*\d+(?:[.,]\d+)?\s*$/,'').trim()||'Article';
   const key=[d.invoiceEntity,d.origin,d.country,d.currency,d.taxRegime,a.role,desc].join('\u0001');
   let row=separateGroups.get(key);
   if(!row){row={...d,role:a.role,configurationFingerprint:`${a.role}:${desc}`,description:desc,quantity:0,cogs:null,shipping:null,handling:null,unitTotal:null,amount:null,priceBlank:true,needsReview:false,sourceOrderKeys:[],sourceItemKeys:[],trackingNumbers:[],rawEvidence:[],splitShipmentReview:false};separateGroups.set(key,row)}
   row.quantity+=Number(a.multiplicity)||0;row.sourceOrderKeys.push(oid);row.sourceItemKeys.push(a.sourceItemKey);row.trackingNumbers.push(trackingNumber);
   row.needsReview||=a.needsReview||unknown||packageConflict;row.splitShipmentReview||=splitOrderIds.includes(oid);
   row.rawEvidence.push({orderId:oid,trackingNumber,sourceItemKey:a.sourceItemKey,rawProductName:a.sourceText,sku:source?.sku||'',shortDescription:desc,multiplicity:a.multiplicity,role:a.role,family:a.family,needsReview:row.needsReview});
   represented.add(a.sourceItemKey);
 }
 for(const records of packages.values()){
  const primary=records[0],country=norm(primary.destinationCountry||primary.country)||'GLOBAL',oid=primary.__orderId,d=dims(primary,country),pkg=[],sources=new Map();let packageConflict=reviewOrders.has(oid);
  if(new Set(records.map(o=>norm(o.destinationCountry||o.country)||'GLOBAL')).size>1)packageConflict=true;
  if(new Set(records.map(o=>dims(o,country).origin)).size>1||new Set(records.map(o=>dims(o,country).currency)).size>1)packageConflict=true;
  for(const o of records)(o.lineItems||[]).forEach((item,ii)=>{
    const sourceItemKey=clean(item.sourceItemKey)||`${oid}::${o.__tracking}::${o.__sourceIndex}::${ii}`,free=freeDecision(item);
    const parsed=g.WRITE_V10_ATOMS.parseSourceItem(item,{sourceItemKey,orderKey:oid,origin:d.origin,currency:d.currency,destinationCountry:country,invoiceEntity:d.invoiceEntity,taxRegime:d.taxRegime,sourceFile:o.sourceFile,sourceSheet:o.sourceSheet,sourceRow:o.sourceRow});
    if(free.free)parsed.forEach(a=>{a.role=R.FREE_GIFT;a.needsReview=false});
    if(free.conflict){packageConflict=true;parsed.forEach(a=>{if(a.role===R.FREE_GIFT)a.role=R.PACKAGE;a.needsReview=true})}
    const sourceRecord={sourceItemKey,orderId:oid,trackingNumber:o.__tracking,rawProductName:clean(item.productName||item.description),sku:clean(item.sku),freeDecision:free,atomIds:parsed.map(a=>a.atomId)};
    sourceItems.push(sourceRecord);sources.set(sourceItemKey,sourceRecord);
    for(const a of parsed){
      if(isMarketingOnly(a.sourceSegment)){represented.add(a.sourceItemKey);continue}
      if(a.role===R.FREE_GIFT){freeAtoms.push(a);represented.add(a.sourceItemKey);continue}
      if(a.role===R.MANUAL_ONLY){represented.add(a.sourceItemKey);continue}
      if(a.role===R.SERVICE||a.role===R.FEE||a.role===R.UPSELL){addSeparate(a,sourceRecord,d,oid,primary.__tracking,packageConflict);continue}
      pkg.push(a)
    }
  });
  if(!pkg.length){
    const hasSeparate=[...separateGroups.values()].some(r=>r.sourceOrderKeys.includes(oid));
    if(!hasSeparate)giftOnlyExcludedParcels++; else parcelCount++;
    continue
  }
  parcelCount++;
  const parts=pkg.map(a=>{
    const source=sources.get(a.sourceItemKey),unknown=String(a.family).startsWith('NEW:'),rawDesc=unknown?a.sourceSegment:a.normalizedDescription;
    const desc=shortenDescription(rawDesc,source?.sku).replace(/\s*\*\s*\d+(?:[.,]\d+)?\s*$/,'').trim()||'Article';
    return{...a,description:desc,sku:source?.sku||'',needsReview:a.needsReview||unknown||packageConflict}
  }).sort((a,b)=>a.description.localeCompare(b.description,'fr',{numeric:true,sensitivity:'base'})||Number(a.multiplicity)-Number(b.multiplicity));
  // Human FACT identity is accounting description + multiplicity, NOT raw SKU.
  const components=new Map();
  for(const a of parts){const k=a.description;let c=components.get(k);if(!c){c={description:k,multiplicity:0,atoms:[]};components.set(k,c)}c.multiplicity+=Number(a.multiplicity)||0;c.atoms.push(a)}
  const comps=[...components.values()].sort((a,b)=>a.description.localeCompare(b.description,'fr',{numeric:true,sensitivity:'base'}));
  const display=comps.map(c=>`${c.description}${c.multiplicity!==1?` *${c.multiplicity}`:''}`).join(' + ');
  const identity=comps.map(c=>`${c.description}\u0002${c.multiplicity}`).join('\u0003');
  const key=[d.invoiceEntity,d.origin,d.country,d.currency,d.taxRegime,'PACKAGE',identity].join('\u0001');
  let row=packageGroups.get(key);
  if(!row){row={...d,role:'PACKAGE',configurationFingerprint:identity,description:display,quantity:0,cogs:null,shipping:null,handling:null,unitTotal:null,amount:null,priceBlank:true,needsReview:false,sourceOrderKeys:[],sourceItemKeys:[],trackingNumbers:[],rawEvidence:[],splitShipmentReview:false};packageGroups.set(key,row)}
  row.quantity+=1;row.sourceOrderKeys.push(oid);row.trackingNumbers.push(primary.__tracking);row.sourceItemKeys.push(...new Set(parts.map(a=>a.sourceItemKey)));
  row.needsReview||=parts.some(a=>a.needsReview);row.splitShipmentReview||=splitOrderIds.includes(oid);
  for(const a of parts){represented.add(a.sourceItemKey);row.rawEvidence.push({orderId:oid,trackingNumber:primary.__tracking,sourceItemKey:a.sourceItemKey,rawProductName:a.sourceText,sku:a.sku,shortDescription:a.description,multiplicity:a.multiplicity,role:a.role,family:a.family,needsReview:a.needsReview})}
 }
 const rows=[...packageGroups.values(),...separateGroups.values()].sort((a,b)=>a.country.localeCompare(b.country,'en')||a.origin.localeCompare(b.origin,'en')||a.currency.localeCompare(b.currency,'en')||a.role.localeCompare(b.role,'en')||a.description.localeCompare(b.description,'fr',{numeric:true,sensitivity:'base'}));
 rows.forEach((r,i)=>{r.no=i+1;r.parcelCount=parcelCount;r.parcelNeedsReview=conflictOrderIds.length>0});rows.parcelCount=parcelCount;rows.parcelNeedsReview=conflictOrderIds.length>0;
 const allSourceItems=new Set(sourceItems.map(x=>x.sourceItemKey)),missing=[...allSourceItems].filter(k=>!represented.has(k));
 const finalKeys=new Set(),duplicateFinalRows=[];
 for(const r of rows){const k=[r.invoiceEntity,r.origin,r.country,r.currency,r.taxRegime,r.role,r.configurationFingerprint].join('\u0001');if(finalKeys.has(k))duplicateFinalRows.push(k);finalKeys.add(k)}
 const audit={version:'10.0.3',inputRecords:input.length,uniqueRecords:orders.length,deduplicatedRecords:duplicates.length,duplicates,packageRecords:packages.size,parcelCount,giftOnlyExcludedParcels,splitOrderIds,conflictOrderIds,sourceItems:sourceItems.length,representedItems:represented.size,freeItems:new Set(freeAtoms.map(a=>a.sourceItemKey)).size,missingSourceItems:missing,duplicateFinalRows,finalAggregationPass:duplicateFinalRows.length===0,hardPass:missing.length===0&&duplicateFinalRows.length===0};
 return{version:'10.0.3',rows,parcelCount,audit,freeAtoms,sourceItems};
}
g.WRITE_V10_PRODUCTION={VERSION,shortenDescription,duplicateKey,canonicalOrders,orderConflicts,freeDecision,build};
})(window);
