/* WRITE V10 Stage A — Accounting IR + fivefold conservation */
(function(g){'use strict';
const VERSION='10.0.0-a1',R=g.WRITE_V10_ATOMS?.ROLES||{};
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toUpperCase()||'UNKNOWN';
function fingerprint(atoms=[]){
 return [...atoms].sort((a,b)=>String(a.normalizedDescription).localeCompare(String(b.normalizedDescription),'fr',{numeric:true}))
   .map(a=>`${a.family}:${a.normalizedDescription}*${a.multiplicity}`).join(' + ');
}
function currencyOf(order={}){return norm(order.currency||order.orderCurrency||order.paymentCurrency||'UNKNOWN')}
function atomsFromOrders(orders=[]){
 const out=[],sourceItems=[];
 orders.forEach((o,oi)=>{
  const orderKey=clean(o.recordKey||o.orderId)||`ROW:${oi+1}`,origin=norm(o.fulfillmentOrigin||g.WRITE_HUMAN_WORKFLOW_V84?.fulfillmentOrigin?.(o)?.origin||'UNKNOWN'),currency=currencyOf(o),country=norm(o.destinationCountry||o.country||'GLOBAL');
  (o.lineItems||[]).forEach((item,ii)=>{
    const sik=clean(item.sourceItemKey)||`${orderKey}::${ii}::${clean(item.sku)}::${clean(item.productName)}`;
    const atoms=g.WRITE_V10_ATOMS.parseSourceItem(item,{sourceItemKey:sik,orderKey,origin,currency,destinationCountry:country,invoiceEntity:o.invoiceEntity||'DEFAULT',taxRegime:o.taxRegime||'UNSPECIFIED',sourceFile:o.sourceFile,sourceSheet:o.sourceSheet,sourceRow:o.sourceRow});
    sourceItems.push({sourceItemKey:sik,orderKey,atomIds:atoms.map(x=>x.atomId),raw:item});
    out.push(...atoms);
  });
 });
 return{atoms:out,sourceItems};
}
function buildIR(orders=[],pricingResolver=null){
 const lines=new Map(),freeAtoms=[],atoms=[],sourceItems=[];
 let sourceAtomicQuantity=0,representedAtomicQuantity=0,paidAtomCount=0,representedPaidAtoms=0,sourceItemCount=0;
 const sourceOrderKeys=new Set(),representedOrderKeys=new Set();
 for(let oi=0;oi<orders.length;oi++){
  const o=orders[oi],orderKey=clean(o.recordKey||o.orderId)||`ROW:${oi+1}`,origin=norm(o.fulfillmentOrigin||g.WRITE_HUMAN_WORKFLOW_V84?.fulfillmentOrigin?.(o)?.origin||'UNKNOWN'),currency=currencyOf(o),country=norm(o.destinationCountry||o.country||'GLOBAL');
  sourceOrderKeys.add(orderKey);const orderAtoms=[];
  const lis=o.lineItems||[];
  for(let ii=0;ii<lis.length;ii++){
   const item=lis[ii],sik=clean(item.sourceItemKey)||`${orderKey}::${ii}::${clean(item.sku)}::${clean(item.productName)}`;
   const parsed=g.WRITE_V10_ATOMS.parseSourceItem(item,{sourceItemKey:sik,orderKey,origin,currency,destinationCountry:country,invoiceEntity:o.invoiceEntity||'DEFAULT',taxRegime:o.taxRegime||'UNSPECIFIED',sourceFile:o.sourceFile,sourceSheet:o.sourceSheet,sourceRow:o.sourceRow});
   sourceItems.push({sourceItemKey:sik,orderKey,atomIds:parsed.map(x=>x.atomId),raw:item});sourceItemCount++;
   for(const a of parsed){atoms.push(a);orderAtoms.push(a);sourceAtomicQuantity+=a.multiplicity}
  }
  if(!orderAtoms.length){representedOrderKeys.add(orderKey);continue}
  const pkg=[];
  for(const a of orderAtoms){
   if(a.role===R.FREE_GIFT){freeAtoms.push(a);representedAtomicQuantity+=a.multiplicity;representedOrderKeys.add(orderKey);continue}
   if(a.role===R.MANUAL_ONLY){representedAtomicQuantity+=a.multiplicity;representedOrderKeys.add(orderKey);continue}
   paidAtomCount++;
   if(a.role===R.PACKAGE){pkg.push(a);continue}
   const key=[a.invoiceEntity,a.origin,a.destinationCountry,a.currency,a.taxRegime,a.role,a.family,a.normalizedDescription].join('\u0001');
   let l=lines.get(key);if(!l){l={lineKey:key,invoiceEntity:a.invoiceEntity,origin:a.origin,destinationCountry:a.destinationCountry,currency:a.currency,taxRegime:a.taxRegime,role:a.role,configurationFingerprint:`${a.family}:${a.normalizedDescription}`,description:a.normalizedDescription,quantity:0,atomIds:[],sourceOrderKeys:[],sourceItemKeys:[],needsReview:false};lines.set(key,l)}
   l.quantity+=a.multiplicity;l.atomIds.push(a.atomId);l.sourceOrderKeys.push(orderKey);l.sourceItemKeys.push(a.sourceItemKey);l.needsReview||=a.needsReview;
   representedAtomicQuantity+=a.multiplicity;representedPaidAtoms++;representedOrderKeys.add(orderKey);
  }
  if(pkg.length){
   const fp=fingerprint(pkg),s=pkg[0],key=[s.invoiceEntity,s.origin,s.destinationCountry,s.currency,s.taxRegime,R.PACKAGE,fp].join('\u0001');
   let l=lines.get(key);if(!l){l={lineKey:key,invoiceEntity:s.invoiceEntity,origin:s.origin,destinationCountry:s.destinationCountry,currency:s.currency,taxRegime:s.taxRegime,role:R.PACKAGE,configurationFingerprint:fp,description:fp,quantity:0,atomIds:[],sourceOrderKeys:[],sourceItemKeys:[],needsReview:false};lines.set(key,l)}
   l.quantity+=1;l.atomIds.push(...pkg.map(a=>a.atomId));l.sourceOrderKeys.push(orderKey);l.sourceItemKeys.push(...pkg.map(a=>a.sourceItemKey));l.needsReview||=pkg.some(a=>a.needsReview);
   for(const a of pkg){representedAtomicQuantity+=a.multiplicity;representedPaidAtoms++}representedOrderKeys.add(orderKey);
  }
 }
 const rows=[...lines.values()];
 for(const row of rows){
  const p=typeof pricingResolver==='function'?pricingResolver(row):null;
  row.priceVersion=p?.version||null;row.unitTotal=Number.isFinite(Number(p?.unitTotal))?Number(p.unitTotal):null;
  row.amount=row.unitTotal===null?null:Math.round((row.unitTotal*row.quantity+Number.EPSILON)*100)/100;
  row.priceTrace=p?.calculationTrace||null;row.priceSource=p?.source||null;
 }
 const orderConservation=sourceOrderKeys.size===representedOrderKeys.size;
 const itemConservation=sourceItemCount===sourceItems.length&&sourceItems.every(x=>x.atomIds.length>=1);
 const quantityConservation=Math.abs(sourceAtomicQuantity-representedAtomicQuantity)<1e-9;
 const semanticConservation=representedPaidAtoms===paidAtomCount;
 const currencyIsolation=rows.every(r=>!!r.currency&&r.currency!=='UNKNOWN'&&r.atomIds.length>0);
 const amountRowsValid=rows.every(r=>r.amount===null||(Number.isFinite(r.amount)&&r.currency&&r.currency!=='UNKNOWN'));
 const moneyCurrencyConservation=currencyIsolation&&amountRowsValid;
 const audit={orderConservation,itemConservation,quantityConservation,semanticConservation,moneyCurrencyConservation,
  sourceOrders:sourceOrderKeys.size,representedOrders:representedOrderKeys.size,sourceItems:sourceItemCount,atoms:atoms.length,
  sourceAtomicQuantity,representedAtomicQuantity,paidAtoms:paidAtomCount,freeAtoms:freeAtoms.length,currencyIsolation,
  failures:[...(!orderConservation?['ORDER_CONSERVATION']:[]),...(!itemConservation?['ITEM_CONSERVATION']:[]),...(!quantityConservation?['QUANTITY_CONSERVATION']:[]),...(!semanticConservation?['SEMANTIC_CONSERVATION']:[]),...(!moneyCurrencyConservation?['MONEY_CURRENCY_CONSERVATION']:[])],
  hardPass:orderConservation&&itemConservation&&quantityConservation&&semanticConservation&&moneyCurrencyConservation};
 return{version:VERSION,packageRows:rows.filter(x=>x.role===R.PACKAGE),upsellRows:rows.filter(x=>x.role===R.UPSELL),serviceRows:rows.filter(x=>x.role===R.SERVICE),feeRows:rows.filter(x=>x.role===R.FEE),freeAtoms,invoiceLines:rows,audit,atoms,sourceItems};
}
function auditFivefold(orders,sourceItems,atoms,rows,freeAtoms){
 const sourceOrderKeys=new Set(orders.map((o,i)=>clean(o.recordKey||o.orderId)||`ROW:${i+1}`));
 const representedOrderKeys=new Set([...rows.flatMap(r=>r.sourceOrderKeys),...freeAtoms.map(a=>a.orderKey)]);
 const itemMap=new Map(sourceItems.map(x=>[x.sourceItemKey,new Set(x.atomIds)])),atomIds=new Set(atoms.map(a=>a.atomId));
 const representedAtomIds=new Map();
 for(const r of rows)for(const id of r.atomIds)representedAtomIds.set(id,(representedAtomIds.get(id)||0)+1);
 for(const a of freeAtoms)representedAtomIds.set(a.atomId,(representedAtomIds.get(a.atomId)||0)+1);
 const paid=atoms.filter(a=>a.role!==R.FREE_GIFT&&a.role!==R.MANUAL_ONLY),atomMap=new Map(atoms.map(a=>[a.atomId,a]));
 const orderConservation=[...sourceOrderKeys].every(x=>representedOrderKeys.has(x));
 const itemConservation=[...itemMap.values()].every(ids=>[...ids].every(id=>atomIds.has(id)&&representedAtomIds.has(id)));
 const quantitySource=atoms.reduce((s,a)=>s+a.multiplicity,0);
 const quantityRepresented=rows.reduce((s,r)=>s+(r.role===R.PACKAGE?r.atomIds.reduce((q,id)=>q+(atomMap.get(id)?.multiplicity||0),0):r.quantity),0)+freeAtoms.reduce((s,a)=>s+a.multiplicity,0);
 const quantityConservation=Math.abs(quantitySource-quantityRepresented)<1e-9;
 const paidExactlyOnce=paid.every(a=>representedAtomIds.get(a.atomId)===1);
 const freeNeverBilled=freeAtoms.every(a=>!rows.some(r=>r.atomIds.includes(a.atomId)));
 const semanticConservation=paidExactlyOnce&&freeNeverBilled;
 const currencyIsolation=rows.every(r=>r.atomIds.every(id=>(atomMap.get(id)?.currency||r.currency)===r.currency));
 const amountRowsValid=rows.every(r=>r.amount===null||(Number.isFinite(r.amount)&&r.currency&&r.currency!=='UNKNOWN'));
 const moneyCurrencyConservation=currencyIsolation&&amountRowsValid;
 return{
  orderConservation,itemConservation,quantityConservation,semanticConservation,moneyCurrencyConservation,
  sourceOrders:sourceOrderKeys.size,representedOrders:representedOrderKeys.size,sourceItems:sourceItems.length,atoms:atoms.length,
  sourceAtomicQuantity:quantitySource,representedAtomicQuantity:quantityRepresented,
  paidAtoms:paid.length,freeAtoms:freeAtoms.length,currencyIsolation,
  failures:[
   ...(!orderConservation?['ORDER_CONSERVATION']:[]),...(!itemConservation?['ITEM_CONSERVATION']:[]),
   ...(!quantityConservation?['QUANTITY_CONSERVATION']:[]),...(!semanticConservation?['SEMANTIC_CONSERVATION']:[]),
   ...(!moneyCurrencyConservation?['MONEY_CURRENCY_CONSERVATION']:[])
  ],
  hardPass:orderConservation&&itemConservation&&quantityConservation&&semanticConservation&&moneyCurrencyConservation
 };
}
g.WRITE_V10_ACCOUNTING_IR={VERSION,currencyOf,atomsFromOrders,buildIR,auditFivefold};
})(window);