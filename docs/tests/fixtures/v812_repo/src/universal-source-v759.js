/* WRITE Settlement Manager v7.5.6 — Order Count Immutable + Standardized Description */
(function(){
'use strict';

const V759_VERSION='7.5.9';

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
function standardizeFactDescription(product='',sku=''){
  let text=clean(product).replace(/\r/g,' ').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  text=text.replace(/\bSKU\s*:\s*\S+/ig,'').replace(/\s+/g,' ').trim();
  if(!text)text=clean(sku)||'Article';

  // Canonical family learned from the user's manually standardized FACT.
  // All camouflage-net variants collapse to one accounting family; size remains.
  if(/filet\s+de\s+camouflage/i.test(text)){
    const dim=text.match(/\b(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\b/i);
    return dim?`Le Filet de camouflage / ${dim[1].replace(',','.')}x${dim[2].replace(',','.')}`:'Le Filet de camouflage';
  }

  const colorOnly=/^(?:blanc(?:he)?|noir(?:e)?|beige|kaki|khaki|gris(?:e)?(?:\s+fonc[ée]e?)?|vert(?:e)?|bleu(?:e)?|rouge|rose|jaune|orange|marron|brun(?:e)?|violet(?:te)?|argent(?:é)?|dor[ée]?)$/i;
  const pieces=text.split(/\s+(?:-|–|—)\s+|\s*\/\s*/).map(x=>x.trim()).filter(Boolean);
  let base=pieces.shift()||text;
  const extras=pieces.filter(x=>!colorOnly.test(x));

  const dimension=text.match(/\b(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\b/i);
  const length=text.match(/\b(\d+(?:[.,]\d+)?)\s*(m|cm|mm)\b/i);
  const lot=text.match(/\b(?:lot\s+de|pack\s+de)\s*(\d+)\b/i);
  let spec='';
  if(dimension)spec=`${dimension[1].replace(',','.')}x${dimension[2].replace(',','.')}`;
  else if(length)spec=`${length[1].replace(',','.')}${length[2].toLowerCase()}`;
  else if(lot)spec=`Lot de ${lot[1]}`;
  else if(extras.length)spec=extras[0];

  base=base.replace(/\s+/g,' ').trim();
  if(base.length>68)base=base.slice(0,68).replace(/\s+\S*$/,'').trim();
  return spec&&base.toLowerCase()!==spec.toLowerCase()?`${base} / ${spec}`:base;
}
window.standardizeFactDescription=standardizeFactDescription;

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


// V7.5.6 ORDER COUNT IMMUTABLE
// One valid source order == one parcel == exactly one unit in formal FACT Quantity.
// Product/SKU quantities remain source audit data, but they must never multiply or
// compress the order count shown in the formal invoice.
function immutableOrderForFact(order){
  const raw=finite(order?.sourceProductCountValue);
  if(order?.sourceProductCountWasExplicit)return raw!==null&&raw>0;
  const items=(order?.lineItems||[]).filter(x=>!x?.isFree);
  return items.some(item=>{
    const q=finite(item?.quantity);
    return q!==null&&q>0&&isMeaningfulProductLine(item?.productName||'',item?.sku||'');
  });
}
function accessoryLike(item){
  const t=[clean(item?.productName),clean(item?.sku)].join(' ').toLowerCase();
  return /kit de fixation|corde|cliquet|collier de serrage|accessoir|support|crochet|sangle|attache|fixation|vis|screw|bolt|strap|rope|clip/.test(t);
}
function primaryLineForOrder(order){
  const items=(order?.lineItems||[]).filter(x=>!x?.isFree&&isMeaningfulProductLine(x?.productName||'',x?.sku||''));
  if(!items.length)return null;
  return items.find(x=>!accessoryLike(x))||items[0];
}
function historicalDescriptionForPrimary(item,country){
  const history=window.WRITE_HISTORY_V730;
  if(!history||!item)return '';
  try{
    const fam=history.familyFor?.(item.productName||'',item.sku||'');
    if(!fam)return '';
    const n=legacyQtyForHistory(item);
    return history.descFor?.(fam,n,item.productName||'')||'';
  }catch(e){return ''}
}
function conciseItemDescription(item){
  if(!item)return '';
  const raw=standardizeFactDescription(item.productName||'',item.sku||'');
  return clean(raw);
}
function packageDescription(order){
  const items=(order?.lineItems||[]).filter(x=>!x?.isFree&&isMeaningfulProductLine(x?.productName||'',x?.sku||''));
  const names=[];
  for(const item of items){
    const d=conciseItemDescription(item);
    if(d&&!names.some(x=>x.toLowerCase()===d.toLowerCase()))names.push(d);
  }
  if(names.length)return names.join(' + ');
  const fallback=meaningfulRawFallback(order);
  return standardizeFactDescription(fallback,'')||'Article';
}
function trueProductQuantityForOrder(order){
  const raw=finite(order?.sourceProductCountValue);
  if(order?.sourceProductCountWasExplicit){
    return raw!==null&&raw>0?raw:null;
  }
  const items=(order?.lineItems||[]).filter(x=>!x?.isFree&&isMeaningfulProductLine(x?.productName||'',x?.sku||''));
  if(!items.length)return null;
  let total=0;
  for(const item of items){
    const q=finite(item?.quantity);
    if(q===null||q<=0)return null;
    total+=q;
  }
  return total>0?total:null;
}
function expectedProductQuantityForWorkbook(workbookName){
  return (classified?.orders||[])
    .filter(o=>String(o?.sourceFile||'')===String(workbookName||''))
    .reduce((a,o)=>a+(trueProductQuantityForOrder(o)||0),0);
}
function costTotalsFromRows(rows=[]){
  let cogs=0,shipping=0,total=0,known=true,seen=false;
  for(const r of rows){
    const q=finite(r?.quantity)??1,c=finite(r?.cogs),s=finite(r?.shipping),u=finite(r?.unitTotal);
    if(c===null&&s===null&&u===null){known=false;continue}
    seen=true;
    const ct=c??0,st=s??0,ut=u??(ct+st);
    cogs+=q*ct;shipping+=q*st;total+=q*ut;
  }
  return known&&seen?{cogs,shipping,unitTotal:total}:null;
}
function packageCostForOrder(order,workbookName,currency){
  const history=window.WRITE_HISTORY_V730;
  const items=(order?.lineItems||[]).filter(x=>!x?.isFree);
  let allKnown=true,cogs=0,shipping=0,unitTotal=0,seen=false;
  const historicalItems=items.filter(item=>historicalMatch(item,order.country)).map(item=>({...item,quantity:legacyQtyForHistory(item)}));
  if(historicalItems.length){
    try{
      const hrs=history?.buildRowsForWorkbook?.({workbookName,orders:[{...order,lineItems:historicalItems}],currency})||[];
      const ht=costTotalsFromRows(hrs);
      if(!ht)allKnown=false;
      else{seen=true;cogs+=ht.cogs;shipping+=ht.shipping;unitTotal+=ht.unitTotal}
    }catch(e){allKnown=false}
  }
  for(const item of items.filter(item=>!historicalMatch(item,order.country))){
    const q=finite(item?.quantity);
    if(q===null){allKnown=false;continue}
    const cost=reliableSupplementCost({...item,country:order.country,currency,orderAmount:order.orderAmount});
    if(!cost){allKnown=false;continue}
    const c=finite(cost.cogs),s=finite(cost.shipping),u=finite(cost.unitTotal)??((c??0)+(s??0));
    if(c===null&&s===null&&u===null){allKnown=false;continue}
    seen=true;cogs+=q*(c??0);shipping+=q*(s??0);unitTotal+=q*(u??0);
  }
  return allKnown&&seen?{cogs,shipping,unitTotal,source:'PACKAGE_EXACT'}:null;
}
function priceSignature(cost){
  if(!cost)return 'BLANK';
  const f=n=>Number(n||0).toFixed(6);
  return [f(cost.cogs),f(cost.shipping),f(cost.unitTotal)].join('|');
}
window.immutableOrderCountForWorkbook=function(workbookName){
  return (classified?.orders||[]).filter(o=>String(o?.sourceFile||'')===String(workbookName||'')&&immutableOrderForFact(o)).length;
};
window.orderCountByCountryForWorkbook=function(workbookName){
  const out={};
  for(const o of (classified?.orders||[])){
    if(String(o?.sourceFile||'')!==String(workbookName||'')||!immutableOrderForFact(o))continue;
    const c=clean(o?.country)||'GLOBAL';out[c]=(out[c]||0)+1;
  }
  return out;
};

// Formal FACT package rows: every counted source order contributes EXACTLY 1.
// Orders are only merged after a concise standardized Description is chosen.

// V7.5.9 MANUAL FACT LEARNING
// Learned exactly from the user's manually prepared FACT for batch 1001-1162.
// Source records stay intact in the application; these rules only control the
// formal accounting FACT aggregation layer.
function v759NormSpaces(v=''){return String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim()}
function v759QtyFromSku(v=''){
  const m=v759NormSpaces(v).match(/\*(\d+(?:[.,]\d+)?)\s*$/);
  if(!m)return 1;
  const n=Number(String(m[1]).replace(',','.'));
  return Number.isFinite(n)&&n>0?n:1;
}
function v759Placeholder(v=''){
  return /^(?:48|97|n\/?a|na|none|null|unknown|inconnu|待确认|未知|[-—–]+)$/i.test(v759NormSpaces(v));
}
function v759CanonicalProduct(name=''){
  const t=v759NormSpaces(name);
  if(/filet\s+de\s+camouflage.*triang/i.test(t)){
    const d=t.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i);
    if(d)return `Le Filet de camouflage Triangulaire / ${d[1].replace(',','.')}x${d[2].replace(',','.')}x${d[3].replace(',','.')}`;
    return 'Le Filet de camouflage Triangulaire';
  }
  if(/filet\s+de\s+camouflage/i.test(t)){
    const d=t.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i);
    if(d)return `Le Filet de camouflage / ${d[1].replace(',','.')}x${d[2].replace(',','.')}`;
    return 'Le Filet de camouflage';
  }
  if(/cordes?\s+à\s+cliquets/i.test(t))return 'Cordes à cliquets réglables - Lot de 4';
  if(/colliers?\s+de\s+serrage/i.test(t))return 'Colliers de serrage x100 - pergola';
  if(/kit\s+de\s+fixation\s+complet/i.test(t)){
    return /suspendu/i.test(t)?'Kit de fixation complet - Suspendu':'Kit de fixation complet';
  }
  if(/corde\s+de\s+fixation\s+polyester/i.test(t)){
    const m=t.match(/corde\s+de\s+fixation\s+polyester\s+tressée\s*-\s*([^/]*?)\s*\/\s*(\d+(?:[.,]\d+)?\s*(?:m|cm|mm))/i);
    if(m){
      const color=v759NormSpaces(m[1]);
      const len=v759NormSpaces(m[2]).replace(/\s+/g,'');
      return color?`Corde de fixation polyester tressée - ${color} / ${len}`:`Corde de fixation polyester tressée - / ${len}`;
    }
  }
  return t||'Article';
}
function v759IsNetProduct(p=''){return /^Le Filet de camouflage/i.test(p)}
function v759IsUpsellWhenNet(p=''){
  return p==='Colliers de serrage x100 - pergola'||
         p==='Cordes à cliquets réglables - Lot de 4'||
         p==='Kit de fixation complet - Suspendu';
}
function v759OrderItems(order){
  const items=(order?.lineItems||[]).map((x,i)=>({
    product:v759CanonicalProduct(x?.productName||''),
    qty:finite(x?.quantity)??v759QtyFromSku(x?.sku||''),
    sku:clean(x?.sku||''),
    pos:i,
    raw:x
  })).filter(x=>x.product&&!v759Placeholder(x.product));
  return items;
}
function v759ManualDecomposeOrder(order){
  const items=v759OrderItems(order);
  if(!items.length)return {billable:false,baseItems:[],upsells:[],ignored:[],description:''};
  const hasNet=items.some(x=>v759IsNetProduct(x.product));
  const upsells=[],base=[],ignored=[];
  for(const item of items){
    if(hasNet&&v759IsUpsellWhenNet(item.product)){upsells.push(item);continue}
    if(item.product==='Kit de fixation complet'){ignored.push({...item,reason:'SUPPORTING_KIT_WITHOUT_MANUAL_FACT_LINE'});continue}
    if(item.product==='Kit de fixation complet - Suspendu'&&!hasNet){
      // Learned from the manual FACT: when a suspended kit is bundled with
      // another non-net main product (e.g. ratchet cords), the kit is not a
      // separate formal FACT line. If it is the only product, keep it to avoid
      // losing a standalone order.
      const other=items.some(x=>x!==item&&x.product!=='Kit de fixation complet'&&x.product!=='Kit de fixation complet - Suspendu');
      if(other){ignored.push({...item,reason:'SUPPORTING_KIT_NON_NET_BUNDLE'});continue}
    }
    base.push(item);
  }
  if(!base.length&&upsells.length){
    // UPSell-only order: preserve one formal base line instead of deleting the
    // order from accounting; this is a universal safety fallback, not present
    // in the learned 1001-1162 sample.
    const first=upsells.shift();base.push(first);
  }
  // Nets first, then other main products; preserve source order inside each class.
  base.sort((a,b)=>(v759IsNetProduct(a.product)?0:1)-(v759IsNetProduct(b.product)?0:1)||a.pos-b.pos);
  const separatedUpsells=upsells.length>0;
  const descLines=base.map(item=>{
    // Exact learned rule:
    // - single main item x2 with no separated UPSell => no *2 suffix
    // - x3+ => suffix kept
    // - multi-main or separated-UPSell order => any x2+ suffix kept
    const showMultiplier=item.qty>1&&(base.length>1||separatedUpsells||item.qty>2);
    return item.product+(showMultiplier?` *${item.qty}`:'');
  });
  return {billable:base.length>0,baseItems:base,upsells,ignored,description:descLines.join('\n')};
}
function v759NaturalKey(desc=''){
  const s=String(desc||'');
  const simple=s.match(/^Le Filet de camouflage \/ (\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if(simple)return [0,Number(simple[1]),Number(simple[2]),s];
  const tri=s.match(/^Le Filet de camouflage Triangulaire \/ (\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if(tri)return [1,Number(tri[1]),Number(tri[2]),Number(tri[3]),s];
  if(s==='Cordes à cliquets réglables - Lot de 4')return [2,0,0,s];
  if(!s.includes('\n')&&!/\s\*\d+$/.test(s))return [3,0,0,s];
  return [4,0,0,s];
}
function v759CompareKeys(a,b){
  const aa=v759NaturalKey(a),bb=v759NaturalKey(b),n=Math.max(aa.length,bb.length);
  for(let i=0;i<n;i++){
    const av=aa[i]??'',bv=bb[i]??'';
    if(typeof av==='number'&&typeof bv==='number'){if(av!==bv)return av-bv}
    else {const c=String(av).localeCompare(String(bv),'fr',{numeric:true,sensitivity:'base'});if(c)return c}
  }
  return 0;
}
function v759LearnedManualRowsForWorkbook(workbookName){
  const source=(classified?.orders||[]).filter(o=>String(o?.sourceFile||'')===String(workbookName||''));
  const baseGroups=new Map(),upsellGroups=new Map(),audit={
    sourceRows:source.length,billableOrders:0,manualExcluded:[],ignoredSupportingLines:[],baseGroups:0,upsellGroups:0
  };
  for(const order of source){
    const country=clean(order?.country)||'GLOBAL';
    const d=v759ManualDecomposeOrder(order);
    if(!d.billable){
      audit.manualExcluded.push({orderKey:String(order?.recordKey||order?.orderId||''),sourceRow:Number(order?.sourceRow||0)||0,reason:'NO_MANUAL_BILLABLE_PRODUCT'});
      continue;
    }
    audit.billableOrders++;
    audit.ignoredSupportingLines.push(...d.ignored.map(x=>({orderKey:String(order?.recordKey||order?.orderId||''),product:x.product,qty:x.qty,reason:x.reason})));
    const key=`${country}\u0001${d.description}`;
    let g=baseGroups.get(key);
    if(!g){
      g={country,description:d.description,quantity:0,orders:[],priceRows:[],kind:'BASE_CONFIG'};
      baseGroups.set(key,g);
    }
    g.quantity+=1;
    g.orders.push(order);
    const pc=packageCostForOrder(order,workbookName,workbookCurrency(workbookName));
    if(pc)g.priceRows.push(pc);

    for(const up of d.upsells){
      const ukey=`${country}\u0001${up.product}`;
      let ug=upsellGroups.get(ukey);
      if(!ug){
        ug={country,description:`${up.product} UPSEll`,quantity:0,items:[],kind:'UPSELL'};
        upsellGroups.set(ukey,ug);
      }
      ug.quantity+=Number(up.qty)||1;
      ug.items.push({...up,order});
    }
  }
  audit.baseGroups=baseGroups.size;audit.upsellGroups=upsellGroups.size;

  function basePrice(g){
    if(!g.priceRows.length)return {cogs:null,shipping:null,unitTotal:null,amount:null,costStatus:'PRICE_BLANK'};
    // Only fill a grouped price when EVERY contributing order has a reliable
    // package price. Aggregate then divide by accounting Quantity (order count).
    if(g.priceRows.length!==g.quantity)return {cogs:null,shipping:null,unitTotal:null,amount:null,costStatus:'PRICE_BLANK'};
    let c=0,s=0,t=0;
    for(const p of g.priceRows){
      const pc=finite(p?.cogs),ps=finite(p?.shipping),pt=finite(p?.unitTotal);
      if(pc===null&&ps===null&&pt===null)return {cogs:null,shipping:null,unitTotal:null,amount:null,costStatus:'PRICE_BLANK'};
      c+=pc??0;s+=ps??0;t+=pt??((pc??0)+(ps??0));
    }
    return {cogs:c/g.quantity,shipping:s/g.quantity,unitTotal:t/g.quantity,amount:Math.round((t+Number.EPSILON)*100)/100,costStatus:'KNOWN'};
  }
  function upsellPrice(g){
    // Exact product learning only; never infer from fuzzy historical package prices.
    let unit=null;
    for(const x of g.items){
      const hit=reliableSupplementCost({productName:x.product,sku:x.sku,country:g.country,currency:workbookCurrency(workbookName),quantity:x.qty});
      const u=finite(hit?.unitTotal)??finite(hit?.cogs);
      if(u===null)return {cogs:null,shipping:null,unitTotal:null,amount:null,costStatus:'PRICE_BLANK'};
      if(unit===null)unit=u;
      else if(Math.abs(unit-u)>1e-9)return {cogs:null,shipping:null,unitTotal:null,amount:null,costStatus:'PRICE_BLANK'};
    }
    if(unit===null)return {cogs:null,shipping:null,unitTotal:null,amount:null,costStatus:'PRICE_BLANK'};
    return {cogs:unit,shipping:0,unitTotal:unit,amount:Math.round((unit*g.quantity+Number.EPSILON)*100)/100,costStatus:'KNOWN'};
  }

  const countries=[...new Set([...baseGroups.values(),...upsellGroups.values()].map(x=>x.country))];
  const preferred=['FRANCE','BELGIUM','CANADA','SWITZERLAND','LUXEMBOURG','GERMANY','SPAIN','ITALY','NETHERLANDS','AUSTRIA','PORTUGAL','REUNION ISLAND','GREECE','GLOBAL'];
  countries.sort((a,b)=>{
    const ai=preferred.indexOf(a.toUpperCase()),bi=preferred.indexOf(b.toUpperCase());
    return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'en');
  });
  const rows=[];
  for(const country of countries){
    const bases=[...baseGroups.values()].filter(x=>x.country===country).sort((a,b)=>v759CompareKeys(a.description,b.description));
    const ups=[...upsellGroups.values()].filter(x=>x.country===country).sort((a,b)=>a.description.localeCompare(b.description,'fr',{numeric:true,sensitivity:'base'}));
    for(const g of bases){
      const p=basePrice(g);
      rows.push({...g,...p,currency:workbookCurrency(workbookName),generated:true,manualRule:'V759_BASE_ORDER_CONFIG'});
    }
    for(const g of ups){
      const p=upsellPrice(g);
      rows.push({...g,...p,currency:workbookCurrency(workbookName),generated:true,manualRule:'V759_UPSELL_ACTUAL_QTY'});
    }
  }
  rows.forEach((r,i)=>r.no=i+1);
  return {rows,audit};
}
window.WRITE_MANUAL_FACT_RULES_V759={
  version:'7.5.9',
  source:'USER_MANUAL_FACT_1001_1162',
  baseQuantity:'MATCHING_ORDER_COUNT',
  upsellQuantity:'ACTUAL_UPSELL_UNITS',
  crossOrderAggregation:true,
  sourceAuditImmutable:true,
  normalize:v759CanonicalProduct
};
window.v759LearnedManualRowsForWorkbook=v759LearnedManualRowsForWorkbook;
window.generatedGenericFactRowsForWorkbook = function(workbookName){
  const result=v759LearnedManualRowsForWorkbook(workbookName);
  window.WRITE_LAST_MANUAL_FACT_AUDIT=window.WRITE_LAST_MANUAL_FACT_AUDIT||{};
  window.WRITE_LAST_MANUAL_FACT_AUDIT[workbookName]=result.audit;
  return result.rows;
};
// Completely remove profile routing from all active V7.5 reporting paths.
window.generatedFactRowsForWorkbook = function(workbookName){return generatedGenericFactRowsForWorkbook(workbookName)};
window.allGeneratedFactRows = function(){return (sourceWorkbooks||[]).flatMap(w=>generatedGenericFactRowsForWorkbook(w.name))};

// Accounting FACT views must use the same universal rows as the deliverable
// workbooks; imported historical FACT is a learning source, not an authority.
window.buildFactExportData = function(){
  const factRows=allGeneratedFactRows();
  const active=factRows.filter(r=>finite(r.quantity)!==null&&finite(r.quantity)>0);
  const audits=sourceWorkbooks.map(w=>window.WRITE_LAST_MANUAL_FACT_AUDIT?.[w.name]||v759LearnedManualRowsForWorkbook(w.name).audit);
  const orderCount=audits.reduce((a,x)=>a+Number(x.billableOrders||0),0);
  const merchandiseQty=(classified?.lineItems||[]).reduce((a,x)=>a+(finite(x?.quantity)??0),0);
  const factAccountingQty=active.reduce((a,r)=>a+(finite(r.quantity)??0),0);
  const totalAmount=active.reduce((a,r)=>a+(Number(r.amount)||0),0);
  const cogsTotal=active.reduce((a,r)=>a+(Number(r.quantity)||0)*(Number(r.cogs)||0),0);
  const shippingTotal=active.reduce((a,r)=>a+(Number(r.quantity)||0)*(Number(r.shipping)||0),0);
  const byDesc=new Map();
  for(const r of factRows){
    const display=clean(r.description)||'Article',key=[display.toLowerCase(),clean(r.country).toLowerCase(),priceSignature(r.cogs===null&&r.shipping===null&&r.unitTotal===null?null:{cogs:r.cogs,shipping:r.shipping,unitTotal:r.unitTotal})].join('\u0001');
    const cur=byDesc.get(key)||{description:display,sku:clean(r.sku),quantity:0,unknownQuantity:false,cogs:r.cogs,shipping:r.shipping,unitTotal:r.unitTotal,amount:0,countries:new Set(),files:new Set(),rows:0};
    const q=finite(r.quantity);if(q===null)cur.unknownQuantity=true;else cur.quantity+=q;cur.amount+=Number(r.amount)||0;cur.rows++;
    if(r.country)cur.countries.add(r.country);if(r.sourceFile)cur.files.add(r.sourceFile);byDesc.set(key,cur);
  }
  const summary=[...byDesc.values()].map(x=>({...x,quantity:x.unknownQuantity&&x.quantity===0?null:x.quantity,avgCogs:x.cogs,avgShipping:x.shipping,avgUnit:x.unitTotal}))
    .sort((a,b)=>a.description.localeCompare(b.description,'fr'));
  const countries=new Map();for(const r of factRows){const c=clean(r.country)||'GLOBAL';if(!countries.has(c))countries.set(c,[]);countries.get(c).push(r)}
  const preferred=['FRANCE','BELGIUM','CANADA','SWITZERLAND','LUXEMBOURG','GERMANY','SPAIN','ITALY','NETHERLANDS','AUSTRIA','PORTUGAL','GREECE','GLOBAL'];
  const countryOrder=[...countries.keys()].sort((a,b)=>{const ai=preferred.indexOf(a.toUpperCase()),bi=preferred.indexOf(b.toUpperCase());return(ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'en')});
  return {factRows,active,totalAmount,totalQty:factAccountingQty,orderCount,parcelCount:orderCount,merchandiseQty,factAccountingQty,cogsTotal,shippingTotal,unallocated:0,summary,countries,countryOrder,parcelRows:[]};
};

// Import flow: schema learning remains available, but review/unknown states can
// never block source ingestion or subsequent FACT export.
startImport = async function(fileList){
  clearExportDownloadLink();
  const files=[...fileList].filter(f=>/\.(xlsx|zip)$/i.test(f.name));if(!files.length||busy)return;
  await window.WRITE_KB?.init?.().catch(()=>{});
  const schemaRules=window.WRITE_SCHEMA?.getRules?.()||[];
  worker?.terminate();worker=new Worker('./src/workers/import.worker.v758.js?v=7.5.9-001');importStartedAt=performance.now();importedFileNames=files.map(f=>f.name);
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
      window.dispatchEvent(new CustomEvent('write-import-complete',{detail:{sourceRecordCount,records:orders.length,sameOrderIdGroups:sameWorkbookOrderIdGroups.length,sourceFidelityVersion:V759_VERSION}}));
      worker?.terminate();worker=null;
    }
    if(data.type==='error'){setBusy(false);showError(data.message||'未知导入错误');worker?.terminate();worker=null}
  };
  worker.onerror=e=>{setBusy(false);showError(e.message||'导入线程异常');worker?.terminate();worker=null};
  worker.postMessage({files,schemaRules});
};



// V8 SHADOW READ-ONLY SOURCE BRIDGE.
window.WRITE_V8_SOURCE_BRIDGE = function(){
  const cloneItem=(x)=>({...x,sourceRawFields:x?.sourceRawFields?{...x.sourceRawFields}:x?.sourceRawFields});
  const snapshotOrders=(classified?.orders||[]).map(o=>({
    ...o,
    sourceRawFields:o?.sourceRawFields?{...o.sourceRawFields}:o?.sourceRawFields,
    lineItems:(o?.lineItems||[]).map(cloneItem)
  }));
  const snapshotLineItems=(classified?.lineItems||[]).map(cloneItem);
  const snapshotWorkbooks=(sourceWorkbooks||[]).map(w=>({...w}));
  return Object.freeze({
    version:V759_VERSION,
    orders:snapshotOrders,
    lineItems:snapshotLineItems,
    sourceWorkbooks:snapshotWorkbooks,
    sourceRecordCount:Number(sourceRecordCount||snapshotOrders.length),
    bridgeMode:'READ_ONLY_SNAPSHOT'
  });
};

// Runtime version marker keeps the currently deployed shell honest even before
// the next full HTML cache-bust package is applied.
try{
  document.body.dataset.release=V759_VERSION;
  const brandVersion=document.querySelector('.brand-copy small');if(brandVersion)brandVersion.textContent=`v${V759_VERSION}`;
  const historyCurrent=document.getElementById('historyCurrentVersion');if(historyCurrent)historyCurrent.textContent=`v${V759_VERSION}`;
  const historyHost=document.getElementById('releaseHistory');
  if(historyHost&&!historyHost.querySelector('[data-v758-entry]')){
    const article=document.createElement('article');article.className='history-item current';article.dataset.v757Entry='1';
    article.innerHTML='<div class="history-meta"><span class="history-version">v7.5.8</span><time class="history-time">2026-08-10 20:45</time></div><div class="history-body"><h3>One Order One Row + True Product Quantity</h3><ul><li>160 个有效源订单必须生成 160 条独立 FACT 订单行。</li><li>Quantity 必须读取每个订单真实商品总数；不得强制为 1。</li><li>订单行数与商品数量双重守恒；历史整单成本转换为单位价后保持总金额不变。</li></ul></div>';
    historyHost.prepend(article);
    const count=document.getElementById('historyCount');if(count){const n=Number((count.textContent.match(/\d+/)||[])[0]||0);count.textContent=`${n+1} 个版本`;}
  }
}catch(e){console.warn('WRITE v7.5.8 version marker:',e)}

window.WRITE_MANUAL_STANDARD_ACTIVE_V759={
  version:V759_VERSION,
  manualAccountingAggregation:true,
  baseQuantity:'MATCHING_ORDER_COUNT',upsellQuantity:'ACTUAL_UPSELL_UNITS',
  crossOrderAggregation:true,
  dualInvariant:true,
  unknownNeverBlocks:true,
  descriptionStandard:'MANUAL_FACT_STYLE_V1'
};
})();
