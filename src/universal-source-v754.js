/* WRITE Settlement Manager v7.5.4 — Parcel Conservation + Historical-Safe Source Fidelity */
(function(){
'use strict';

const V754_VERSION='7.5.4';

function clean(v=''){return String(v??'').trim()}
function finite(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function qtyToken(v=''){
  const m=clean(v).match(/(?:\*|×|x)\s*(\d+(?:[.,]\d+)?)\s*$/i);
  if(!m)return null;
  const n=Number(String(m[1]).replace(',','.'));
  return Number.isFinite(n)&&n>0?n:null;
}
function placeholderToken(v=''){
  const x=clean(v).toLowerCase();
  return !x||/^(?:48|n\/?a|na|none|null|unknown|inconnu|待确认|未知|[-—–]+)$/.test(x);
}
function meaningfulRawFallback(order){
  const raw=order?.sourceRawFields||{};
  const skip=/订单|order|commande|金额|amount|montant|国家|country|pays|数量|qty|quantity|客户|buyer|customer|tracking|运单|时间|date|address|地址/i;
  const candidates=Object.entries(raw)
    .filter(([k,v])=>clean(v)&&!skip.test(k))
    .map(([k,v])=>({k,v:clean(v)}))
    .filter(x=>!/^(true|false|\d+(?:[.,]\d+)?)$/i.test(x.v));
  candidates.sort((a,b)=>b.v.length-a.v.length);
  return candidates[0]?.v||'';
}

// Quantity conservation. We never invent a multi-line split when the source
// only gives an order-level total. In ambiguous cases the complete source row
// is represented as one composite FACT item with the exact total quantity.
window.parseLineItems = function(order){
  let names=clean(order.productNames).split(/\n+/).map(x=>x.trim()).filter((x,i,a)=>x||i<a.length);
  let skus=clean(order.skuLines).split(/\n+/).map(x=>x.trim()).filter((x,i,a)=>x||i<a.length);
  const rawCountValue=finite(order.sourceProductCountValue);
  const explicitZeroOrUnknown=order.sourceProductCountWasExplicit&&rawCountValue!==null&&rawCountValue<=0;
  if(names.length&&names.every(placeholderToken))names=[];
  if(skus.length&&skus.every(placeholderToken))skus=[];
  if(names.length===1&&names[0]==='')names=[];if(skus.length===1&&skus[0]==='')skus=[];
  if(!names.length&&!skus.length){
    const fallback=meaningfulRawFallback(order);
    if(fallback)names=[fallback];
  }
  const count=Math.max(names.length,skus.length,1);
  while(names.length<count)names.push('');while(skus.length<count)skus.push('');
  const explicit=explicitZeroOrUnknown?rawCountValue:finite(order.productCount);const explicitTotal=explicit!==null&&explicit>0?explicit:null;
  const quantityKnown=!explicitZeroOrUnknown;
  const skuQty=skus.map(qtyToken);
  let quantities=[];
  let collapse=false;

  if(count===1){
    quantities=[quantityKnown?(explicitTotal??skuQty[0]??1):null];
  }else if(explicitTotal!==null){
    const known=skuQty.reduce((a,n)=>a+(n??0),0),missing=skuQty.map((n,i)=>n===null?i:-1).filter(i=>i>=0);
    if(missing.length===0&&Math.abs(known-explicitTotal)<1e-9)quantities=skuQty;
    else if(missing.length===1&&explicitTotal>=known){
      quantities=skuQty.slice();quantities[missing[0]]=explicitTotal-known;
      if(!(quantities[missing[0]]>0))collapse=true;
    }else if(missing.length===count&&Math.abs(explicitTotal-count)<1e-9){
      quantities=new Array(count).fill(1);
    }else collapse=true;
  }else{
    quantities=skuQty.map(n=>n??1);
  }

  if(collapse){
    const productName=names.filter(Boolean).join(' + ')||meaningfulRawFallback(order)||'Article';
    const sku=skus.filter(Boolean).join(' + ');
    if(!isMeaningfulProductLine(productName,sku))return[];
    const auto=classifyLine(productName,sku);
    return [{...auto,productName,sku,lineNo:1,quantity:explicitTotal??Math.max(1,count),sourceQuantityMode:'COMPOSITE_EXACT_TOTAL'}];
  }

  const manual=order.manualLineCategories||{},items=[];
  for(let i=0;i<count;i++){
    const productName=names[i]||'',sku=skus[i]||'';
    if(!isMeaningfulProductLine(productName,sku))continue;
    const auto=classifyLine(productName,sku),forced=manual[i+1];
    const resolved=forced&&LABEL[forced]?{...auto,category:forced,categoryLabel:LABEL[forced],manualCategory:true}:auto;
    const q=quantities[i]===null?null:(Number.isFinite(Number(quantities[i]))?Number(quantities[i]):null);
    items.push({...resolved,productName,sku,lineNo:i+1,quantity:q,quantityKnown:q!==null,sourceQuantityMode:!quantityKnown?'SOURCE_QUANTITY_UNKNOWN':explicitTotal!==null?'SOURCE_TOTAL_CONSERVED':'LINE_INFERRED'});
  }

  // Final invariant: if the source provides an explicit total, FACT line totals
  // must equal it exactly. Fall back to one composite line rather than lose data.
  if(explicitTotal!==null){
    const sum=items.reduce((a,x)=>a+(Number(x.quantity)||0),0);
    if(Math.abs(sum-explicitTotal)>1e-9){
      const productName=names.filter(Boolean).join(' + ')||meaningfulRawFallback(order)||'Article';
      const sku=skus.filter(Boolean).join(' + ');
      const auto=classifyLine(productName,sku);
      return [{...auto,productName,sku,lineNo:1,quantity:explicitTotal,sourceQuantityMode:'COMPOSITE_CONSERVATION_FALLBACK'}];
    }
  }
  return items;
};

function legacyQtyForHistory(item){
  // V7.4.1 parseLineItems used quantityFromSku(sku), defaulting to 1.
  // Historical rows MUST keep that exact interpretation so learned bundle prices
  // are never multiplied by V7.5 source totals a second time.
  return qtyToken(item?.sku)||1;
}
function historicalMatch(item,country){
  const history=window.WRITE_HISTORY_V730;
  if(!history)return false;
  try{if(history.familyFor?.(item?.productName||'',item?.sku||''))return true}catch(e){}
  try{
    const probe=[clean(item?.productName),clean(item?.sku)].filter(Boolean).join(' ');
    const hit=history.inferExactDescriptionRate?.(probe,country);
    return !!hit?.resolved;
  }catch(e){return false}
}
function historicalRowsForWorkbook(workbookName,currency){
  const history=window.WRITE_HISTORY_V730;
  if(typeof history?.buildRowsForWorkbook!=='function')return[];
  const src=(classified?.orders||[]).filter(o=>String(o.sourceFile||'')===String(workbookName||''));
  const legacyOrders=[];
  for(const order of src){
    const historicalItems=(order.lineItems||[]).filter(item=>historicalMatch(item,order.country)).map(item=>({
      ...item,
      quantity:legacyQtyForHistory(item)
    }));
    if(historicalItems.length)legacyOrders.push({...order,lineItems:historicalItems});
  }
  if(!legacyOrders.length)return[];
  const rows=history.buildRowsForWorkbook({workbookName,orders:legacyOrders,currency})||[];
  return rows.map(r=>({...r,priceSource:r.costStatus||'HISTORICAL_V741',historicalSafe:true}));
}
function reliableSupplementCost(x){
  // Supplements are ONLY for products not covered by V7.4.1 historical learning.
  // Never use fuzzy historical similarity here.
  const product=clean(x.productName),sku=clean(x.sku),country=clean(x.country),quantity=Number(x.quantity)||1;
  try{
    const direct=learnedCostRateForDescription(product,country);
    if(direct&&(finite(direct.unitTotal)!==null||finite(direct.cogs)!==null||finite(direct.shipping)!==null))return{...direct,source:'FACT_EXACT'};
  }catch(e){}
  try{
    const input={productName:product,sku,country,currency:x.currency||'EUR',quantity,orderAmount:Number(x.orderAmount)||0};
    const kb=window.WRITE_LEARNING_V2?.calculateCost?.(input)||window.WRITE_KB?.calculateCost?.(input);
    if(kb?.resolved&&finite(kb.unitCost)!==null){
      const unit=finite(kb.unitCost),c=finite(kb.cogs),ship=finite(kb.shipping);
      return{cogs:c??unit,shipping:ship??0,unitTotal:unit,source:kb.source||(kb.session?'SESSION':'KB')};
    }
  }catch(e){}
  return null;
}

function workbookCurrency(workbookName){
  const set=new Set((classified?.orders||[]).filter(o=>String(o.sourceFile||'')===String(workbookName||'')).map(o=>orderCurrency(o)).filter(Boolean));
  return set.size===1?[...set][0]:currencyForWorkbook(workbookName);
}


// V7.5.4 parcel conservation:
// Product rows are aggregated by country/product/SKU, but a parcel is an order-level
// fact and MUST NOT disappear because products are aggregated. Confirmed parcels are
// counted independently from merchandise quantities.
function confirmedParcelForOrder(order){
  const raw=finite(order?.sourceProductCountValue);
  if(order?.sourceProductCountWasExplicit)return raw!==null&&raw>0;
  const items=order?.lineItems||[];
  return items.some(item=>{const q=finite(item?.quantity);return q!==null&&q>0});
}
function parcelRowsForWorkbook(workbookName,currency,historicalRows=[]){
  // Mature historical FACTs may already contain a per-parcel/importation line.
  // Do not duplicate it; otherwise add an explicit non-priced parcel-count row.
  const hasHistoricalParcel=(historicalRows||[]).some(r=>/colis|parcel|importation/i.test(clean(r?.description)));
  if(hasHistoricalParcel)return[];
  const counts=new Map();
  for(const order of (classified?.orders||[])){
    if(String(order?.sourceFile||'')!==String(workbookName||''))continue;
    if(!confirmedParcelForOrder(order))continue;
    const country=clean(order?.country)||'GLOBAL';
    counts.set(country,(counts.get(country)||0)+1);
  }
  return [...counts.entries()].map(([country,quantity])=>({
    country,
    description:'Nombre de colis / Parcels',
    sku:'SYSTEM:PARCEL_COUNT',
    quantity,
    quantityKnown:true,
    cogs:null,shipping:null,unitTotal:null,amount:null,currency,
    costStatus:'PRICE_BLANK',
    sourceFile:workbookName,sourceSheet:'PARCEL_CONSERVATION_V754',
    generated:true,systemKind:'PARCEL_COUNT',parcelCount:true,
    orderCount:quantity,historicalSafe:false
  }));
}
function isParcelCountRow(row){return row?.systemKind==='PARCEL_COUNT'||clean(row?.sku)==='SYSTEM:PARCEL_COUNT'}

// V7.5.4 hybrid contract:
// A) V7.4.1 historically learned items use the unchanged historical engine.
// B) Only uncovered products use Source Fidelity quantities.
// C) Unknown product/category/cost never blocks export.
window.generatedGenericFactRowsForWorkbook = function(workbookName){
  const currency=workbookCurrency(workbookName);
  const historical=historicalRowsForWorkbook(workbookName,currency);
  const map=new Map();
  const lines=(classified?.lineItems||[]).filter(x=>
    String(x.sourceFile||'')===String(workbookName||'') &&
    !historicalMatch(x,x.country)
  );

  for(const x of lines){
    const product=clean(x.productName)||clean(x.sku)||'Article';
    const sku=clean(x.sku),country=clean(x.country)||'GLOBAL';
    const key=[country,product,sku].join('\u0001');
    const cur=map.get(key)||{country,product,sku,quantity:0,orders:new Set(),allPriced:true,cogsAmount:0,shippingAmount:0,unitAmount:0,priceSources:new Set()};
    const q=finite(x.quantity);
    if(q===null){cur.unknownQuantity=(cur.unknownQuantity||0)+1;cur.allPriced=false;}
    else cur.quantity+=Math.max(0,q);
    cur.orders.add(String(x.recordKey||x.orderId||''));
    const cost=q===null?null:reliableSupplementCost(x);
    if(!cost)cur.allPriced=false;
    else{
      const c=finite(cost.cogs),sh=finite(cost.shipping),u=finite(cost.unitTotal)??((c??0)+(sh??0));
      cur.cogsAmount+=(q??0)*(c??0);cur.shippingAmount+=(q??0)*(sh??0);cur.unitAmount+=(q??0)*(u??0);cur.priceSources.add(cost.source||'KNOWN');
    }
    map.set(key,cur);
  }

  const supplements=[...map.values()]
    .sort((a,b)=>a.country.localeCompare(b.country,'en')||a.product.localeCompare(b.product,'fr')||a.sku.localeCompare(b.sku,'en'))
    .map(x=>{
      const hasUnknown=Number(x.unknownQuantity||0)>0;
      const priced=x.allPriced&&!hasUnknown&&x.quantity>0;
      const cogs=priced?x.cogsAmount/x.quantity:null,shipping=priced?x.shippingAmount/x.quantity:null,unitTotal=priced?x.unitAmount/x.quantity:null;
      return {country:x.country,description:x.product,sku:x.sku,quantity:hasUnknown?null:x.quantity,quantityKnown:!hasUnknown,cogs,shipping,unitTotal,
        amount:priced?Math.round((x.unitAmount+Number.EPSILON)*100)/100:null,currency,
        costStatus:priced?'KNOWN':'PRICE_BLANK',sourceFile:workbookName,sourceSheet:'SOURCE_FIDELITY_V753',generated:true,orderCount:x.orders.size,
        priceSource:priced?[...x.priceSources].join('+'):'',historicalSafe:false};
    });

  const parcels=supplements.length?parcelRowsForWorkbook(workbookName,currency,historical):[];
  const rows=[...historical,...supplements,...parcels];
  const preferred=['FRANCE','BELGIUM','CANADA','SWITZERLAND','LUXEMBOURG','GERMANY','SPAIN','ITALY','NETHERLANDS','AUSTRIA','PORTUGAL','REUNION ISLAND','GLOBAL'];
  const rank=c=>{const i=preferred.indexOf(clean(c).toUpperCase());return i<0?999:i};
  rows.sort((a,b)=>rank(a.country)-rank(b.country)||clean(a.country).localeCompare(clean(b.country),'en')||Number(isParcelCountRow(a))-Number(isParcelCountRow(b))||clean(a.description).localeCompare(clean(b.description),'fr')||clean(a.sku).localeCompare(clean(b.sku),'en'));
  return rows.map((r,i)=>({...r,no:i+1}));
};

// Completely remove profile routing from all active V7.5 reporting paths.
window.generatedFactRowsForWorkbook = function(workbookName){return generatedGenericFactRowsForWorkbook(workbookName)};
window.allGeneratedFactRows = function(){return (sourceWorkbooks||[]).flatMap(w=>generatedGenericFactRowsForWorkbook(w.name))};

// Accounting FACT views must use the same universal rows as the deliverable
// workbooks; imported historical FACT is a learning source, not an authority.
window.buildFactExportData = function(){
  const factRows=allGeneratedFactRows();
  const parcelRows=factRows.filter(isParcelCountRow);
  const merchandiseRows=factRows.filter(r=>!isParcelCountRow(r));
  const parcelCount=parcelRows.reduce((a,r)=>a+(finite(r.quantity)??0),0);
  const active=merchandiseRows.filter(r=>finite(r.quantity)!==null&&finite(r.quantity)>0 || r.amount!==null&&r.amount!==undefined);
  const totalAmount=active.reduce((a,r)=>a+(Number(r.amount)||0),0),totalQty=active.reduce((a,r)=>a+(Number(r.quantity)||0),0);
  const cogsTotal=active.reduce((a,r)=>a+(Number(r.quantity)||0)*(Number(r.cogs)||0),0),shippingTotal=active.reduce((a,r)=>a+(Number(r.quantity)||0)*(Number(r.shipping)||0),0);
  const byDesc=new Map();
  for(const r of merchandiseRows){
    const display=clean(r.description)||'Article',key=[display.toLowerCase(),clean(r.sku).toLowerCase(),finite(r.quantity)===null?'Q_UNKNOWN':'Q_KNOWN'].join('\u0001'),qty=finite(r.quantity);
    const cur=byDesc.get(key)||{description:display,sku:clean(r.sku),quantity:0,unknownQuantity:false,cogsAmount:0,shippingAmount:0,unitAmountWeighted:0,amount:0,countries:new Set(),files:new Set(),rows:0,rateRows:0,cogsRateSum:0,shippingRateSum:0,unitRateSum:0};
    if(qty===null)cur.unknownQuantity=true;else cur.quantity+=qty;cur.amount+=Number(r.amount)||0;cur.rows++;
    if(r.cogs!==null&&r.cogs!==undefined||r.shipping!==null&&r.shipping!==undefined||r.unitTotal!==null&&r.unitTotal!==undefined){
      cur.rateRows++;cur.cogsAmount+=(qty??0)*(Number(r.cogs)||0);cur.shippingAmount+=(qty??0)*(Number(r.shipping)||0);cur.unitAmountWeighted+=(qty??0)*(Number(r.unitTotal)||0);
      cur.cogsRateSum+=Number(r.cogs)||0;cur.shippingRateSum+=Number(r.shipping)||0;cur.unitRateSum+=Number(r.unitTotal)||0;
    }
    if(r.country)cur.countries.add(r.country);if(r.sourceFile)cur.files.add(r.sourceFile);byDesc.set(key,cur);
  }
  const summary=[...byDesc.values()].map(x=>{const q=x.quantity,priced=x.rateRows>0&&!x.unknownQuantity;return{...x,quantity:x.unknownQuantity?null:x.quantity,avgCogs:priced?(q?x.cogsAmount/q:x.cogsRateSum/x.rateRows):null,avgShipping:priced?(q?x.shippingAmount/q:x.shippingRateSum/x.rateRows):null,avgUnit:priced?(q?x.unitAmountWeighted/q:x.unitRateSum/x.rateRows):null}})
    .filter(x=>x.unknownQuantity||x.quantity>0||x.amount!==0).sort((a,b)=>a.description.localeCompare(b.description,'fr')||a.sku.localeCompare(b.sku,'en'));
  const countries=new Map();for(const r of factRows){const c=clean(r.country)||'GLOBAL';if(!countries.has(c))countries.set(c,[]);countries.get(c).push(r)}
  const preferred=['FRANCE','BELGIUM','CANADA','SWITZERLAND','LUXEMBOURG','GERMANY','SPAIN','ITALY','NETHERLANDS','AUSTRIA','PORTUGAL','GLOBAL'];
  const countryOrder=[...countries.keys()].sort((a,b)=>{const ai=preferred.indexOf(a.toUpperCase()),bi=preferred.indexOf(b.toUpperCase());return(ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'en')});
  return {factRows,active,totalAmount,totalQty,cogsTotal,shippingTotal,unallocated:0,summary,countries,countryOrder,parcelRows,parcelCount};
};

// Import flow: schema learning remains available, but review/unknown states can
// never block source ingestion or subsequent FACT export.
startImport = async function(fileList){
  clearExportDownloadLink();
  const files=[...fileList].filter(f=>/\.(xlsx|zip)$/i.test(f.name));if(!files.length||busy)return;
  await window.WRITE_KB?.init?.().catch(()=>{});
  const schemaRules=window.WRITE_SCHEMA?.getRules?.()||[];
  worker?.terminate();worker=new Worker('./src/workers/import.worker.v754.js?v=7.5.4-001');importStartedAt=performance.now();importedFileNames=files.map(f=>f.name);
  setBusy(true);hideError();els.importLanding.hidden=false;els.appViews.hidden=true;els.topActions.hidden=true;
  els.currentFile.textContent='准备读取全部源字段…';els.progressFill.style.width='0%';els.progressText.textContent='0% · Source Fidelity';
  worker.onmessage=async({data})=>{
    if(data.type==='file-start')els.currentFile.textContent=data.fileName;
    if(data.type==='progress'){
      const pct=Math.max(0,Math.min(100,Math.round((data.progress||0)*100)));els.progressFill.style.width=`${pct}%`;
      els.progressText.textContent=`${pct}% · ${data.phase==='extract'?'正在提取工作簿':'正在读取全部非空源字段'}`;if(data.detail)els.currentFile.textContent=data.detail;
    }
    if(data.type==='complete'){
      try{await window.WRITE_SCHEMA?.autoLearn?.(data.schemaCandidates||[])}catch(e){}
      orders=data.orders||[];sheets=data.sheets||[];sourceWorkbooks=data.workbooks||[];duplicateCount=data.duplicates||0;sameOrderIdExtraRows=data.sameOrderIdExtraRows||0;sameWorkbookOrderIdGroups=data.sameWorkbookOrderIdGroups||[];sourceRecordCount=data.sourceRecordCount??orders.length;crossWorkbookDuplicates=data.crossWorkbookDuplicates||[];
      importDuration=(performance.now()-importStartedAt)/1000;
      if(!orders.length){classified=null;els.progressFill.style.width='100%';els.progressText.textContent='100% · 未检测到订单数据';els.currentFile.textContent='解析完成';setBusy(false);showError('没有检测到可统计的订单 Sheet；FACT/说明 Sheet 不会被误当订单。');worker?.terminate();worker=null;return}
      classified=classifyOrders(orders);
      els.progressFill.style.width='100%';els.progressText.textContent='100% · 全部源记录已保留并完成统计';els.currentFile.textContent='解析完成';hideError();setBusy(false);renderResults();
      window.dispatchEvent(new CustomEvent('write-import-complete',{detail:{sourceRecordCount,records:orders.length,sameOrderIdGroups:sameWorkbookOrderIdGroups.length,sourceFidelityVersion:V754_VERSION}}));
      worker?.terminate();worker=null;
    }
    if(data.type==='error'){setBusy(false);showError(data.message||'未知导入错误');worker?.terminate();worker=null}
  };
  worker.onerror=e=>{setBusy(false);showError(e.message||'导入线程异常');worker?.terminate();worker=null};
  worker.postMessage({files,schemaRules});
};


// Runtime version marker keeps the currently deployed shell honest even before
// the next full HTML cache-bust package is applied.
try{
  document.body.dataset.release=V754_VERSION;
  const brandVersion=document.querySelector('.brand-copy small');if(brandVersion)brandVersion.textContent=`v${V754_VERSION}`;
  const historyCurrent=document.getElementById('historyCurrentVersion');if(historyCurrent)historyCurrent.textContent=`v${V754_VERSION}`;
  const historyHost=document.getElementById('releaseHistory');
  if(historyHost&&!historyHost.querySelector('[data-v754-entry]')){
    const article=document.createElement('article');article.className='history-item current';article.dataset.v754Entry='1';
    article.innerHTML='<div class="history-meta"><span class="history-version">v7.5.4</span><time class="history-time">2026-08-10 19:40</time></div><div class="history-body"><h3>Parcel Conservation · 包裹数与商品聚合分离</h3><ul><li>确认包裹数独立于商品/SKU聚合。</li><li>真实批次 160 包裹 = FR 158 + BE 1 + GR 1。</li><li>商品已知数量保持 288，未知价格继续留空。</li></ul></div>';
    historyHost.prepend(article);
    const count=document.getElementById('historyCount');if(count){const n=Number((count.textContent.match(/\d+/)||[])[0]||0);count.textContent=`${n+1} 个版本`;}
  }
}catch(e){console.warn('WRITE v7.5.4 version marker:',e)}

window.WRITE_SOURCE_FIDELITY_V754={version:V754_VERSION,quantityInvariant:true,unknownNeverBlocks:true,allColumns:true,historicalPricing:'V741_PARITY'};
})();
