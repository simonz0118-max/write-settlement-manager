/* WRITE V10.5.0 — Production Learning Hardening
 * Production price authority:
 *   exact SKU COST_MODEL x quantity + learned PACKAGE_FEE once.
 * REVIEWED_FACT/CONFIG are semantic/audit only. No family fallback price.
 */
(function(g){'use strict';
const MODULE_VERSION='10.5.0';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const upper=v=>clean(v).toUpperCase();
const norm=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const baseSku=v=>clean(v).replace(/\s*(?:\*|x|×)\s*\d+(?:[.,]\d+)?\s*$/i,'').trim();
const round4=n=>Math.round((Number(n)+Number.EPSILON)*10000)/10000;
function releaseVersion(){
 return String(g.WRITE_RELEASE_META?.current?.version||document?.body?.dataset?.release||'10.5.2').trim()||'10.5.2';
}
function canonicalOrigin(v=''){
 const s=upper(typeof v==='object'?(v.fulfillmentOrigin||v.origin||v.storeAccount||v.shopAccount||''):v).replace(/_/g,'-').replace(/\s+/g,'-');
 if(['CN','CHINA','CHINE','中国','WRITE-CN','WRITE-CHINA'].includes(s)||/(^|-)WRITE-CN($|-)|中国仓|SHIPSTER/.test(s))return'CN';
 if(['FR','FRANCE','法国','WRITE-FR','WRITE-FRANCE'].includes(s)||/(^|-)WRITE-FR($|-)|法国仓/.test(s))return'FR';
 return upper(typeof v==='object'?(v.fulfillmentOrigin||v.origin||''):v)||'UNKNOWN';
}
function exactUnitCost(e,row){
 const sku=baseSku(e.sku),name=clean(e.productName||e.rawProductName||e.shortDescription);
 if(!sku&&!name)return null;
 try{
  const c=g.WRITE_KB?.calculateCost?.({sku,productName:name,country:row.country,currency:row.currency,quantity:1,orderAmount:0});
  if(c?.resolved&&Number.isFinite(Number(c.unitCost))){
   const rs=upper(c.rule?.payload?.sku||sku);
   if(rs.startsWith('CONFIG:')||rs.startsWith('PACKAGE_FEE:'))return null;
   return {unitCost:Number(c.unitCost),rule:c.rule};
  }
 }catch{}
 return null;
}
function componentMap(evidence=[],row={}){
 const m=new Map();
 for(const e of evidence){
  if(String(e._role||e.role||row.role)==='FREE_GIFT')continue;
  const sku=baseSku(e.sku),name=clean(e.productName||e.rawProductName||e.shortDescription),q=Math.max(0,Number(e.multiplicity??e.quantity??1)||0);
  if(!q)continue;
  const k=sku?'sku:'+norm(sku):'name:'+norm(name);if(k==='sku:'||k==='name:')continue;
  const x=m.get(k)||{sku,productName:name,family:clean(e.family),quantity:0};
  x.quantity+=q;m.set(k,x);
 }
 return [...m.values()].sort((a,b)=>(a.sku||a.productName).localeCompare(b.sku||b.productName,'en',{numeric:true,sensitivity:'base'}));
}
function componentSignature(comps=[]){
 return comps.map(c=>`${baseSku(c.sku)||norm(c.productName)}\u0002${round4(c.quantity)}`).join('\u0003');
}
function components(row){
 const evidence=(row.rawEvidence||[]).filter(e=>String(e._role||e.role||row.role)!=='FREE_GIFT');
 if(!evidence.length)return [];
 const groups=new Map();
 for(const e of evidence){
  const oid=clean(e.orderId),tracking=clean(e.trackingNumber);
  // production-core aggregates PACKAGE rows only after each parcel composition is known.
  // orderId + trackingNumber therefore identifies the original parcel represented by this evidence.
  const parcelKey=`${oid||'(NO_ORDER)'}\u0001${tracking||'(NO_TRACKING)'}`;
  if(!groups.has(parcelKey))groups.set(parcelKey,[]);
  groups.get(parcelKey).push(e);
 }
 const parcelComps=[...groups.values()].map(xs=>componentMap(xs,row)).filter(xs=>xs.length);
 if(parcelComps.length){
  const sigs=new Set(parcelComps.map(componentSignature));
  if(sigs.size===1){
   row.packageCount=Math.max(1,Number(row.quantity)||parcelComps.length||1);
   row.perPackageComponentSignature=componentSignature(parcelComps[0]);
   row.componentAggregationMode='PER_PARCEL_EVIDENCE';
   return parcelComps[0];
  }
  // A grouped FACT row should never contain different parcel compositions.
  // Fail closed instead of silently issuing a wrong invoice.
  row.componentAggregationConflict=true;
  row.componentAggregationSignatures=[...sigs];
  return [];
 }
 // Defensive fallback for legacy evidence without parcel identity:
 // normalize aggregate quantities by FACT package count only when exact.
 const packageCount=Math.max(1,Number(row.quantity)||1),aggregate=componentMap(evidence,row);
 const normalized=[];
 for(const c of aggregate){
  const q=c.quantity/packageCount;
  if(!Number.isFinite(q)||q<=0||Math.abs(q*packageCount-c.quantity)>1e-9){
   row.componentAggregationConflict=true;return [];
  }
  normalized.push({...c,quantity:q});
 }
 row.packageCount=packageCount;
 row.componentAggregationMode='NORMALIZED_LEGACY_EVIDENCE';
 row.perPackageComponentSignature=componentSignature(normalized);
 return normalized;
}
function packageFee(row,comps){
 const T=g.WRITE_V1040_LAYERING?._test;if(!T?.packageFeeSku)return null;
 const origin=canonicalOrigin(row.origin);
 const sku=T.packageFeeSku({origin,country:row.country,currency:row.currency},comps);
 try{
  const c=g.WRITE_KB?.calculateCost?.({sku,productName:'PACKAGE_FEE',country:row.country,currency:row.currency,quantity:1,orderAmount:0});
  if(c?.resolved&&Number.isFinite(Number(c.totalCost)))return {fee:Number(c.totalCost),sku,rule:c.rule};
 }catch{}
 return null;
}
function hardenPackage(row){
 if(String(row.role)!=='PACKAGE')return row;
 row.origin=canonicalOrigin(row.origin);
 row.componentAggregationConflict=false;row.componentAggregationSignatures=[];
 const comps=components(row);let cogs=0,missing=[];
 if(row.componentAggregationConflict){
  row.cogs=null;row.shipping=null;row.unitTotal=null;row.amount=null;
  row.priceBlank=true;row.needsReview=true;row.priceMatch='V1054_PARCEL_COMPOSITION_CONFLICT';
  row.priceSource='V1054_REVIEW_REQUIRED';row.missingCostComponents=['PARCEL_COMPOSITION_CONFLICT'];
  return row;
 }
 for(const c of comps){const x=exactUnitCost(c,row);if(!x)missing.push(c);else cogs+=x.unitCost*c.quantity}
 const fee=packageFee(row,comps);
 if(missing.length||!fee){
  row.cogs=missing.length?null:round4(cogs);row.shipping=null;row.unitTotal=null;row.amount=null;
  row.priceBlank=true;row.needsReview=true;row.priceMatch='V1050_EXACT_SKU_OR_PACKAGE_FEE_MISSING';
  row.priceSource='V1050_REVIEW_REQUIRED';row.missingCostComponents=missing.map(x=>x.sku||x.productName);
  return row;
 }
 row.cogs=round4(cogs);row.shipping=round4(fee.fee);row.unitTotal=round4(cogs+fee.fee);
 row.packageCount=Math.max(1,Number(row.quantity)||1);row.amount=round4(row.unitTotal*row.packageCount);row.priceBlank=false;row.needsReview=false;
 row.priceMatch='V1050_EXACT_SKU_PLUS_PACKAGE_FEE';row.priceSource='V1050_EXACT_SKU_COGS_PLUS_LEARNED_PACKAGE_FEE_ONCE';
 row.packageFeeRuleSku=fee.sku;return row;
}
function install(){
 const X=g.WRITE_V10_PRODUCTION;if(!X?.build||X.__v1050)return false;
 const base=X.build.bind(X);X.build=input=>{const r=base(input);(r.rows||[]).forEach(hardenPackage);r.version=releaseVersion();r.costLearningArchitecture='EXACT_SKU_COGS + SEMANTIC_FACT + PACKAGE_FEE_ONCE';
 X.lastResult=r;
 try{g.WRITE_PRODUCTION_STATE={result:r,rows:r.rows||[],reviewRows:(r.rows||[]).filter(x=>x.needsReview),reviewCount:(r.rows||[]).filter(x=>x.needsReview).length};
 g.dispatchEvent?.(new CustomEvent('write-production-result-updated',{detail:g.WRITE_PRODUCTION_STATE}));}catch{}
 return r};
 X.__v1050=true;return true;
}
function lockVersion(){
 if(typeof document==='undefined')return;
 const v=releaseVersion();
 document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent=`v${v} Production`);
}
function bindExport(){
 if(typeof document==='undefined')return;
 ['heroExportButton','topExportButton','quickExportButton'].forEach(id=>{
  const el=document.getElementById(id);if(!el||el.dataset.v1050Export==='1')return;el.dataset.v1050Export='1';
  el.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();try{
   if(typeof g.WRITE_V10_EXPORT?.downloadProductionPackage==='function')await g.WRITE_V10_EXPORT.downloadProductionPackage();
   else if(typeof g.WRITE_V10_EXPORT?.download==='function')await g.WRITE_V10_EXPORT.download();
   else throw new Error('Production export controller unavailable');
  }catch(err){console.error('[WRITE V10.5 export]',err);alert('导出失败：'+(err?.message||err))}
  },true);
 });
}
function reviewTruth(){
 const rows=g.WRITE_PRODUCTION_STATE?.rows||g.WRITE_V10_PRODUCTION?.lastResult?.rows||g.WRITE_V10_RUNTIME?.lastProduction?.rows;if(!Array.isArray(rows))return;
 const n=rows.filter(x=>x.needsReview).length;
 for(const id of['metricReview','quickReviewCount','navReviewCount']){const e=document.getElementById(id);if(e){e.textContent=String(n);e.hidden=n===0}}
}
function boot(){install();lockVersion();bindExport();reviewTruth();g.addEventListener?.('write-production-result-updated',()=>reviewTruth());let n=0;const t=setInterval(()=>{install();lockVersion();bindExport();reviewTruth();if(++n>40)clearInterval(t)},125)}
if(typeof document!=='undefined'){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot()}else install();
g.WRITE_V1050_HARDENING={VERSION:MODULE_VERSION,releaseVersion,canonicalOrigin,hardenPackage,install,_test:{components,componentMap,componentSignature,exactUnitCost,packageFee}};
})(typeof window!=='undefined'?window:globalThis);
