/* WRITE V10.4.0 — Three-layer reviewed learning
 * Layer 1: SKU/product COGS via COST_MODEL + COMPONENT_COST_EQUATION
 * Layer 2: Configuration/FACT semantics via REVIEWED_FACT / REVIEWED_PRODUCT
 * Layer 3: per-package fee via PACKAGE_FEE namespace (stored through COST_MODEL transport)
 *
 * Compatibility:
 * - existing CONFIG:<fingerprint> rules remain readable, but new reviewed learning no longer writes them.
 * - if no learned package fee exists, V10.2.9 shipping table remains the fallback.
 */
(function(g){'use strict';
const VERSION='10.4.0';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const upper=v=>clean(v).toUpperCase();
const norm=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const baseSku=v=>clean(v).replace(/\s*(?:\*|x|×)\s*\d+(?:[.,]\d+)?\s*$/i,'').trim();
const round4=n=>Math.round((Number(n)+Number.EPSILON)*10000)/10000;
const reviewedByFingerprint=new Map();

function isCN(v=''){return ['CN','CHINA','CHINE','中国'].includes(upper(v))}
function isMainProduct(x={}){
  const fam=upper(x.family);
  if(fam==='PENCIL_MAIN')return true;
  const hay=norm([x.productName,x.rawProductName,x.shortDescription,x.sku].filter(Boolean).join(' '));
  return /stylo\s*(?:eternel|eternel)|eternal\s*pen|pencil[_\s-]*main/.test(hay);
}
function accessoryNoShipping(x={}){
  const fam=upper(x.family);
  if(['PAID_GIFT_BOX','REFILL_LOT4','REFILL_LOT6','REFILL_COLOR','FREE_GIFT'].includes(fam))return true;
  const hay=norm([x.productName,x.rawProductName,x.shortDescription,x.sku].filter(Boolean).join(' '));
  return /coffret\s*cadeau|mine(?:s)?\s*(?:rechargeable|coloree|color)|lot\s*de\s*[46]\s*mine/.test(hay);
}
function driverIdentity(x={}){
  const sku=baseSku(x.sku);
  if(sku)return 'SKU:'+norm(sku);
  const name=clean(x.productName||x.rawProductName||x.shortDescription||'Stylo eternel');
  return 'NAME:'+norm(name);
}
function packageDriver(components=[]){
  const mains=(components||[]).filter(isMainProduct);
  if(mains.length){
    const quantity=mains.reduce((s,x)=>s+Math.max(0,Number(x.quantity??x.multiplicity??1)||0),0);
    const first=mains[0];
    return {identity:driverIdentity(first),quantity:quantity||1,kind:'MAIN_PRODUCT'};
  }
  const weighted=(components||[]).filter(x=>!accessoryNoShipping(x));
  if(weighted.length){
    const quantity=weighted.reduce((s,x)=>s+Math.max(0,Number(x.quantity??x.multiplicity??1)||0),0);
    return {identity:driverIdentity(weighted[0]),quantity:quantity||1,kind:'WEIGHT_DRIVER'};
  }
  return {identity:'ACCESSORY_ONLY',quantity:1,kind:'ACCESSORY_ONLY'};
}
function packageFeeSku(scope={},components=[]){
  const d=packageDriver(components);
  const origin=upper(scope.origin||'CN')||'CN',country=upper(scope.country)||'GLOBAL',currency=upper(scope.currency)||'EUR';
  return `PACKAGE_FEE:${origin}:${country}:${currency}:${d.identity}:Q${d.quantity}`;
}
function componentsFromEvidence(evidence=[]){
  const m=new Map();
  for(const e of evidence||[]){
    const sku=baseSku(e.sku),productName=clean(e.productName||e.rawProductName||e.shortDescription),family=clean(e.family);
    const key=sku?'sku:'+norm(sku):'name:'+norm(productName);
    if(!key.replace(/^(sku:|name:)$/,''))continue;
    const q=Math.max(0,Number(e.multiplicity??e.quantity??1)||0); if(!q)continue;
    const x=m.get(key)||{sku,productName,family,quantity:0};x.quantity+=q;m.set(key,x);
  }
  return [...m.values()];
}
function samePackageFee(a,b){return Math.abs(Number(a)-Number(b))<1e-9}

function installKbLayer(){
  const kb=g.WRITE_KB;
  if(!kb||kb.__v1040Layered)return false;
  const originalLearnCostModel=kb.learnCostModel?.bind(kb);
  const originalReviewedFact=kb.learnReviewedFact?.bind(kb);
  const originalEquation=kb.learnComponentCostEquation?.bind(kb);
  if(!originalLearnCostModel||!originalReviewedFact||!originalEquation)return false;

  kb.learnCostModel=async function(spec={},manual=true){
    const sku=upper(spec.sku);
    if(sku.startsWith('CONFIG:')){
      return {unchanged:true,alreadyLearned:true,legacyConfigSuppressed:true,layer:'CONFIG_FACT'};
    }
    return originalLearnCostModel(spec,manual);
  };

  kb.learnReviewedFact=async function(spec={},manual=true){
    const fp=String(spec.configurationFingerprint||'');
    if(fp)reviewedByFingerprint.set(fp,{...spec});
    return originalReviewedFact(spec,manual);
  };

  kb.learnComponentCostEquation=async function(spec={},manual=true){
    const result=await originalEquation(spec,manual);
    if(!isCN(spec.origin||'CN'))return result;
    const reviewed=reviewedByFingerprint.get(String(spec.configurationFingerprint||''))||{};
    const fee=Number(reviewed.shipping);
    if(!Number.isFinite(fee)||fee<0)return {...result,packageFeeSkipped:true};
    const sku=packageFeeSku({origin:'CN',country:spec.country||reviewed.country,currency:spec.currency||reviewed.currency},spec.components||[]);
    const packageResult=await originalLearnCostModel({
      sku,productName:'PACKAGE_FEE',country:spec.country||reviewed.country,currency:spec.currency||reviewed.currency,
      strategy:'ORDER_FIXED',orderCost:round4(fee),cogs:null,shipping:round4(fee),
      sourceFactDescription:'AUDITED_PACKAGE_FEE',sourceFile:String(spec.sourceFile||reviewed.sourceFile||''),confidence:1
    },true);
    return {...result,packageFeeRule:packageResult,packageFeeSku:sku,packageFee:round4(fee)};
  };

  kb.__v1040Layered=true;
  return true;
}

function learnedPackageFee(row={}){
  const kb=g.WRITE_KB;if(!kb?.calculateCost)return null;
  const components=componentsFromEvidence(row.rawEvidence||[]);
  const sku=packageFeeSku({origin:row.origin,country:row.country,currency:row.currency},components);
  try{
    const r=kb.calculateCost({sku,productName:'PACKAGE_FEE',country:row.country,currency:row.currency,quantity:1,orderAmount:0});
    if(r?.resolved&&Number.isFinite(Number(r.totalCost)))return {fee:Number(r.totalCost),sku,rule:r.rule};
  }catch{}
  return null;
}
function applyPackageFee(row={}){
  if(String(row.role)!=='PACKAGE')return row;
  const learned=learnedPackageFee(row);if(!learned)return row;
  const cogs=Number(row.cogs);if(!Number.isFinite(cogs))return row;
  row.shipping=round4(learned.fee);
  row.unitTotal=round4(cogs+learned.fee);
  row.amount=round4(row.unitTotal*(Number(row.quantity)||0));
  row.priceBlank=false;row.needsReview=false;row.learnedFromReviewedWorkbook=true;
  row.priceSource='V1040_SKU_COGS_PLUS_LEARNED_PACKAGE_FEE_ONCE';
  row.packageFeeRuleSku=learned.sku;
  return row;
}
function installRuntimeLayer(){
  const X=g.WRITE_V10_PRODUCTION;
  if(!X?.build||X.__v1040Layered)return false;
  const base=X.build.bind(X);
  X.build=input=>{
    const result=base(input);
    (result.rows||[]).forEach(applyPackageFee);
    result.version=VERSION;
    result.costLearningArchitecture='SKU_COGS + FACT_CONFIGURATION + PACKAGE_FEE';
    return result;
  };
  X.__v1040Layered=true;
  return true;
}
function updateVersionUi(){
  if(typeof document==='undefined')return;
  document.body.dataset.release=VERSION;
  document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent=`v${VERSION} Production`);
  const cv=document.getElementById('historyCurrentVersion');if(cv)cv.textContent=`v${VERSION}`;
}
function install(){
  const a=installKbLayer(),b=installRuntimeLayer();updateVersionUi();
  return a||b;
}
function boot(){
  install();
  let tries=0;const t=setInterval(()=>{install();if(++tries>=20||(g.WRITE_KB?.__v1040Layered&&g.WRITE_V10_PRODUCTION?.__v1040Layered))clearInterval(t)},100);
}
if(typeof document!=='undefined'){
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
}else install();

g.WRITE_V1040_LAYERING={VERSION,install,applyPackageFee,learnedPackageFee,_test:{
  isMainProduct,accessoryNoShipping,driverIdentity,packageDriver,packageFeeSku,componentsFromEvidence,samePackageFee,applyPackageFee
}};
})(typeof window!=='undefined'?window:globalThis);
