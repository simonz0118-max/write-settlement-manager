
(function(){
'use strict';

const DB_NAME='write-settlement-kb';
const DB_VERSION=1;
const SYNC_ENDPOINT='/api/rules/sync';
const DEVICE_KEY='write-kb-device-id-v1';
const SYNC_META_KEY='write-kb-sync-meta-v1';

const PRIORITY={
  MANUAL_CONFIRMED:600,
  SKU_EXACT:500,
  BUNDLE_CONFIRMED:450,
  NAME_EXACT:400,
  AUTO_INFERRED:300,
  ESTIMATED:200
};

let db=null;
let ready=false;
let initPromise=null;
let syncing=false;
let syncPromise=null;
let batchSyncDepth=0;
let cache=new Map();
let pending=new Set();

function uuid(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  return 'r-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
function deviceId(){
  try{
    let id=localStorage.getItem(DEVICE_KEY);
    if(!id){id=uuid();localStorage.setItem(DEVICE_KEY,id)}
    return id;
  }catch(e){return 'local-device'}
}
function norm(v=''){
  return String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
}
function country(v=''){
  return String(v??'').trim().toUpperCase();
}
function cacheKey(type,lookupKey){return type+'\u0001'+lookupKey}
function priority(rule){return Number(rule?.priority)||PRIORITY[rule?.confidenceLevel]||0}
function shouldReplace(existing,incoming){
  if(!existing)return true;
  const a=priority(existing),b=priority(incoming);
  if(a!==b)return b>a;
  return String(incoming.updatedAt||'')>String(existing.updatedAt||'');
}
function normalizeRule(raw={}){
  const now=new Date().toISOString();
  return {
    ruleId:String(raw.ruleId||uuid()),
    type:String(raw.type||'GENERIC'),
    lookupKey:String(raw.lookupKey||''),
    payload:raw.payload&&typeof raw.payload==='object'?raw.payload:{},
    confidenceLevel:String(raw.confidenceLevel||'AUTO_INFERRED'),
    priority:Number(raw.priority)||PRIORITY[raw.confidenceLevel]||PRIORITY.AUTO_INFERRED,
    source:String(raw.source||'LOCAL'),
    confirmed:!!raw.confirmed,
    deviceId:String(raw.deviceId||deviceId()),
    createdAt:String(raw.createdAt||now),
    updatedAt:String(raw.updatedAt||now),
    version:Number(raw.version)||1,
    syncState:String(raw.syncState||'PENDING'),
    deleted:!!raw.deleted
  };
}
function openDb(){
  if(db)return Promise.resolve(db);
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(new Error('IndexedDB unavailable'));
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const d=req.result;
      if(!d.objectStoreNames.contains('rules')){
        const store=d.createObjectStore('rules',{keyPath:'ruleId'});
        store.createIndex('byType','type',{unique:false});
        store.createIndex('byUpdatedAt','updatedAt',{unique:false});
        store.createIndex('bySyncState','syncState',{unique:false});
      }
      if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});
    };
    req.onsuccess=()=>{db=req.result;resolve(db)};
    req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
  });
}
function allRules(){
  return new Promise((resolve,reject)=>{
    const req=db.transaction('rules','readonly').objectStore('rules').getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>reject(req.error);
  });
}
function putRule(rule){
  return new Promise((resolve,reject)=>{
    const req=db.transaction('rules','readwrite').objectStore('rules').put(rule);
    req.onsuccess=()=>resolve(rule);
    req.onerror=()=>reject(req.error);
  });
}
function rebuild(rules){
  cache=new Map();pending=new Set();
  for(const raw of rules||[]){
    const rule=normalizeRule(raw);
    if(rule.deleted)continue;
    const id=cacheKey(rule.type,rule.lookupKey);
    const existing=cache.get(id);
    if(shouldReplace(existing,rule))cache.set(id,rule);
    if(rule.syncState!=='SYNCED')pending.add(rule.ruleId);
  }
}
function find(type,lookupKey){return cache.get(cacheKey(type,lookupKey))||null}
async function upsert(raw,{queueSync=true}={}){
  const incoming=normalizeRule(raw);
  const id=cacheKey(incoming.type,incoming.lookupKey);
  const existing=cache.get(id);
  if(existing && !shouldReplace(existing,incoming))return existing;
  if(existing){
    incoming.ruleId=existing.ruleId;
    incoming.createdAt=existing.createdAt;
    incoming.version=(Number(existing.version)||1)+1;
  }
  incoming.updatedAt=new Date().toISOString();
  incoming.syncState=queueSync?'PENDING':'SYNCED';
  await putRule(incoming);
  cache.set(id,incoming);
  if(queueSync)pending.add(incoming.ruleId);
  renderStatus();
  if(queueSync&&navigator.onLine&&batchSyncDepth===0)queueMicrotask(()=>sync().catch(()=>{}));
  return incoming;
}
function productCategory(productName='',sku=''){
  const s=norm(sku),n=norm(productName);
  const bySku=s?find('PRODUCT_CATEGORY','sku:'+s):null;
  if(bySku?.payload?.category)return bySku.payload.category;
  const byName=n?find('PRODUCT_CATEGORY','name:'+n):null;
  return byName?.payload?.category||null;
}
function factPrice(countryName,targetType){
  const rule=find('FACT_PRICE',country(countryName)+'\u0001'+targetType);
  const price=Number(rule?.payload?.unitPrice);
  return Number.isFinite(price)?price:null;
}
async function learnProduct(productName,sku,categoryName,manual=true){
  const s=norm(sku),n=norm(productName);
  const lookupKey=s?'sku:'+s:'name:'+n;
  if(!lookupKey.replace(/^(sku:|name:)$/,''))return;
  return upsert({
    type:'PRODUCT_CATEGORY',lookupKey,
    payload:{category:categoryName,productName:String(productName||''),sku:String(sku||'')},
    confidenceLevel:manual?'MANUAL_CONFIRMED':(s?'SKU_EXACT':'NAME_EXACT'),
    confirmed:!!manual,
    source:manual?'MANUAL_REVIEW':'AUTO_RULE'
  });
}
async function learnPrice(countryName,targetType,unitPrice,source='AUTO_INFERRED'){
  const price=Number(unitPrice);
  if(!Number.isFinite(price))return;
  return upsert({
    type:'FACT_PRICE',
    lookupKey:country(countryName)+'\u0001'+targetType,
    payload:{country:country(countryName),targetType,unitPrice:price},
    confidenceLevel:source==='MANUAL'?'MANUAL_CONFIRMED':'AUTO_INFERRED',
    confirmed:source==='MANUAL',
    source
  });
}

function schemaRules(){
  return [...cache.values()].filter(r=>r.type==='ORDER_SCHEMA'&&!r.deleted)
    .sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function schemaFor(fingerprint=''){
  return find('ORDER_SCHEMA',String(fingerprint||''))||null;
}
async function learnSchema(schema={},manual=true){
  const fingerprint=String(schema.fingerprint||'').trim();
  if(!fingerprint)return null;
  return upsert({
    type:'ORDER_SCHEMA',
    lookupKey:fingerprint,
    payload:{
      headers:Array.isArray(schema.headers)?schema.headers:[],
      mapping:schema.mapping&&typeof schema.mapping==='object'?schema.mapping:{},
      mappingByHeader:schema.mappingByHeader&&typeof schema.mappingByHeader==='object'?schema.mappingByHeader:{},
      sheetName:String(schema.sheetName||''),
      sourceFile:String(schema.sourceFile||''),
      confidence:Number(schema.confidence)||0
    },
    confidenceLevel:manual?'MANUAL_CONFIRMED':'AUTO_INFERRED',
    confirmed:!!manual,
    source:manual?'MANUAL_SCHEMA':'AUTO_SCHEMA'
  });
}


function payloadSignature(v){try{const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;return JSON.stringify(stable(v))}catch{return String(v)}}

function parseBusinessDateFromText(v=''){
  const t=String(v||'');
  const m=t.match(/(?:^|[_\-\s])(\d{1,2})[-_.](\d{1,2})[-_.](\d{2,4})(?:[_\-\s.]|$)/);
  if(m){
    let y=Number(m[3]);if(y<100)y+=2000;
    const d=new Date(Date.UTC(y,Number(m[2])-1,Number(m[1])));
    if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);
  }
  const ymd=t.match(/(?:^|[_\-\s])(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?:[_\-\s.]|$)/);
  if(ymd){
    const d=new Date(Date.UTC(Number(ymd[1]),Number(ymd[2])-1,Number(ymd[3])));
    if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);
  }
  return '';
}
function maxOrderNumberFromText(v=''){
  const nums=String(v||'').match(/\d{4,}/g)||[];
  return nums.reduce((m,x)=>Math.max(m,Number(x)||0),0);
}
function ruleBusinessRank(payload={}){
  const source=String(payload.sourceFile||payload.sourceFactDescription||'');
  const date=String(payload.businessDate||parseBusinessDateFromText(source)||'');
  const order=Math.max(Number(payload.latestOrderNumber)||0,maxOrderNumberFromText(source));
  return {date,order};
}
function compareBusinessRank(a={},b={}){
  const A=ruleBusinessRank(a),B=ruleBusinessRank(b);
  if(A.date&&B.date&&A.date!==B.date)return A.date>B.date?1:-1;
  if(A.date&&!B.date)return 1;
  if(!A.date&&B.date)return -1;
  if(A.order!==B.order)return A.order>B.order?1:-1;
  return 0;
}
function semanticPayloadSignature(type,payload={}){
  const p={...payload};
  delete p.sourceFile;delete p.quantity;delete p.amount;delete p.confidence;delete p.sourceFactDescription;
  return payloadSignature(p);
}
function sameSemanticPayload(type,a,b){return semanticPayloadSignature(type,a)===semanticPayloadSignature(type,b)}
function learnedNoop(rule){return {rule,unchanged:true,alreadyLearned:true,syncState:String(rule?.syncState||''),ruleId:String(rule?.ruleId||'')}}
async function recordConflict(ruleType,lookupKey,existingPayload,incomingPayload,source='AUTO'){
  const conflictIdentity=ruleType+'\u0001'+lookupKey+'\u0001'+semanticPayloadSignature(ruleType,existingPayload)+'\u0001'+semanticPayloadSignature(ruleType,incomingPayload);
  const conflictKey='conflict:'+payloadSignature(conflictIdentity);
  const existing=find('RULE_CONFLICT',conflictKey);
  if(existing)return existing;
  return upsert({type:'RULE_CONFLICT',lookupKey:conflictKey,
    payload:{ruleType,lookupKey,existingPayload,incomingPayload,status:'OPEN'},confidenceLevel:'MANUAL_CONFIRMED',
    confirmed:false,source:'CONFLICT:'+source});
}
function costLookupKeys(spec={}){
  const sku=norm(spec.sku),name=norm(spec.productName),c=country(spec.country),cur=String(spec.currency||'').toUpperCase();
  const keys=[];if(sku)keys.push('sku:'+sku+'\\u0001'+c+'\\u0001'+cur,'sku:'+sku+'\\u0001'+c+'\\u0001','sku:'+sku);
  if(name)keys.push('name:'+name+'\\u0001'+c+'\\u0001'+cur,'name:'+name+'\\u0001'+c+'\\u0001','name:'+name);
  return keys;
}
function costModel(spec={}){for(const k of costLookupKeys(spec)){const r=find('COST_MODEL',k);if(r)return r}return null}
function calculateCost(spec={}){
  const rule=costModel(spec);if(!rule)return {resolved:false};
  const m=rule.payload||{},q=Math.max(0,Number(spec.quantity)||0),amount=Number(spec.orderAmount)||0;let total=null,unit=null;
  if(m.strategy==='UNIT_FIXED'){unit=Number(m.unitCost);if(Number.isFinite(unit))total=q*unit}
  else if(m.strategy==='ORDER_FIXED'){total=Number(m.orderCost);if(Number.isFinite(total))unit=q?total/q:total}
  else if(m.strategy==='PERCENT_ORDER'){const pct=Number(m.percent);if(Number.isFinite(pct)){total=amount*pct/100;unit=q?total/q:total}}
  else if(m.strategy==='TIER_UNIT'){const tiers=Array.isArray(m.tiers)?m.tiers:[];const t=tiers.find(x=>q>=Number(x.min||0)&&(x.max==null||q<=Number(x.max)));if(t){unit=Number(t.unitCost);if(Number.isFinite(unit))total=q*unit}}
  return Number.isFinite(total)?{resolved:true,totalCost:total,unitCost:unit,strategy:m.strategy,rule}:{resolved:false,rule};
}
async function learnCostModel(spec={},manual=true){
  const keys=costLookupKeys(spec);if(!keys.length)throw new Error('成本规则缺少商品身份');
  const lookupKey=keys[0],payload={productName:String(spec.productName||''),sku:String(spec.sku||''),country:country(spec.country),currency:String(spec.currency||'').toUpperCase(),
    strategy:String(spec.strategy||'UNIT_FIXED'),unitCost:spec.unitCost,orderCost:spec.orderCost,percent:spec.percent,tiers:Array.isArray(spec.tiers)?spec.tiers:[],
    cogs:spec.cogs,shipping:spec.shipping,sourceFactDescription:String(spec.sourceFactDescription||''),sourceFile:String(spec.sourceFile||''),confidence:Number(spec.confidence)||0};
  const existing=find('COST_MODEL',lookupKey);
  if(existing?.confirmed&&sameSemanticPayload('COST_MODEL',existing.payload,payload))return learnedNoop(existing);
  if(existing?.confirmed){
    const rank=compareBusinessRank(payload,existing.payload);
    if(rank>0){
      const rule=await upsert({type:'COST_MODEL',lookupKey,payload,confidenceLevel:'MANUAL_CONFIRMED',confirmed:true,source:'LATEST_BUSINESS_DATA'});
      return {rule,updatedByLatest:true,ruleId:rule?.ruleId||'',syncState:rule?.syncState||''};
    }
    if(rank<0)return {rule:existing,unchanged:true,alreadyLearned:true,olderIgnored:true,ruleId:existing.ruleId||'',syncState:existing.syncState||''};
  }
  if(existing?.confirmed){
    const conflict=await recordConflict('COST_MODEL',lookupKey,existing.payload,payload,manual?'MANUAL':'AUTO');return {conflict:true,rule:existing,conflictRule:conflict};
  }
  const rule=await upsert({type:'COST_MODEL',lookupKey,payload,confidenceLevel:manual?'MANUAL_CONFIRMED':'AUTO_INFERRED',confirmed:!!manual,source:manual?'MANUAL_COST':'FACT_LEARNING'});
  return {rule,created:true,ruleId:rule?.ruleId||'',syncState:rule?.syncState||''};
}
function currencyPolicy(key='DEFAULT'){return find('CURRENCY_POLICY',String(key||'DEFAULT'))}
async function learnCurrencyPolicy(key='DEFAULT',payload={},manual=true){
  const lookupKey=String(key||'DEFAULT'),existing=find('CURRENCY_POLICY',lookupKey);
  if(existing?.confirmed&&payloadSignature(existing.payload)!==payloadSignature(payload)){const c=await recordConflict('CURRENCY_POLICY',lookupKey,existing.payload,payload,manual?'MANUAL':'AUTO');return{conflict:true,rule:existing,conflictRule:c}}
  return upsert({type:'CURRENCY_POLICY',lookupKey,payload,confidenceLevel:manual?'MANUAL_CONFIRMED':'AUTO_INFERRED',confirmed:!!manual,source:manual?'MANUAL_CURRENCY':'AUTO_CURRENCY'});
}
function taxPolicy(key='DEFAULT'){return find('TAX_POLICY',String(key||'DEFAULT'))}
async function learnTaxPolicy(key='DEFAULT',payload={},manual=false){
  if(!manual)throw new Error('VAT/税务规则必须人工确认后才能学习');
  const lookupKey=String(key||'DEFAULT'),existing=find('TAX_POLICY',lookupKey);
  if(existing?.confirmed&&payloadSignature(existing.payload)!==payloadSignature(payload)){const c=await recordConflict('TAX_POLICY',lookupKey,existing.payload,payload,'MANUAL');return{conflict:true,rule:existing,conflictRule:c}}
  return upsert({type:'TAX_POLICY',lookupKey,payload,confidenceLevel:'MANUAL_CONFIRMED',confirmed:true,source:'MANUAL_TAX'});
}
async function learnFactModel(model={},manual=false){
  const lookupKey=String(model.sourceFile||'FACT')+'\\u0001'+String(model.sheetName||'FACT');
  return upsert({type:'FACT_MODEL',lookupKey,payload:model,confidenceLevel:manual?'MANUAL_CONFIRMED':'AUTO_INFERRED',confirmed:!!manual,source:manual?'MANUAL_FACT':'HISTORICAL_FACT'});
}
function reviewedProductLookupKeys(spec={}){
  const sku=norm(spec.sku),name=norm(spec.productName),c=country(spec.country),o=country(spec.origin),cur=String(spec.currency||'').toUpperCase(),keys=[];
  if(sku){if(c&&o&&cur)keys.push('sku:'+sku+'\\u0001'+c+'\\u0001'+o+'\\u0001'+cur);keys.push('sku:'+sku)}
  if(name){if(c&&o&&cur)keys.push('name:'+name+'\\u0001'+c+'\\u0001'+o+'\\u0001'+cur);keys.push('name:'+name)}
  return keys;
}
function reviewedProduct(spec={}){for(const k of reviewedProductLookupKeys(spec)){const r=find('REVIEWED_PRODUCT',k);if(r)return r}return null}
async function learnReviewedProduct(spec={},manual=true){
  const keys=reviewedProductLookupKeys(spec);if(!keys.length)throw new Error('审核商品规则缺少 SKU/产品名');
  const lookupKey=keys[0],payload={productName:String(spec.productName||''),sku:String(spec.sku||''),family:String(spec.family||''),role:String(spec.role||''),normalizedDescription:String(spec.normalizedDescription||''),approvedFactDescription:String(spec.approvedFactDescription||''),country:country(spec.country),origin:country(spec.origin),currency:String(spec.currency||'').toUpperCase(),configurationFingerprint:String(spec.configurationFingerprint||''),sourceFile:String(spec.sourceFile||'')};
  const existing=find('REVIEWED_PRODUCT',lookupKey);
  if(existing?.confirmed&&sameSemanticPayload('REVIEWED_PRODUCT',existing.payload,payload))return learnedNoop(existing);
  if(existing?.confirmed){
    const rank=compareBusinessRank(payload,existing.payload);
    if(rank>0){
      const rule=await upsert({type:'REVIEWED_PRODUCT',lookupKey,payload,confidenceLevel:'MANUAL_CONFIRMED',confirmed:true,source:'LATEST_BUSINESS_DATA'});
      return {rule,updatedByLatest:true,ruleId:rule?.ruleId||'',syncState:rule?.syncState||''};
    }
    if(rank<0)return {rule:existing,unchanged:true,alreadyLearned:true,olderIgnored:true,ruleId:existing.ruleId||'',syncState:existing.syncState||''};
  }
  if(existing?.confirmed){const c=await recordConflict('REVIEWED_PRODUCT',lookupKey,existing.payload,payload,'MANUAL');return{conflict:true,rule:existing,conflictRule:c}}
  const rule=await upsert({type:'REVIEWED_PRODUCT',lookupKey,payload,confidenceLevel:'MANUAL_CONFIRMED',confirmed:true,source:'REVIEWED_WORKBOOK'});
  return {rule,created:true,ruleId:rule?.ruleId||'',syncState:rule?.syncState||''};
}
function reviewedFactLookupKey(spec={}){return[String(spec.invoiceEntity||'DEFAULT'),country(spec.origin),country(spec.country),String(spec.currency||'').toUpperCase(),String(spec.taxRegime||'UNSPECIFIED'),String(spec.role||''),String(spec.configurationFingerprint||'')].join('\\u0001')}
function reviewedFact(spec={}){return find('REVIEWED_FACT',reviewedFactLookupKey(spec))||null}
async function learnReviewedFact(spec={},manual=true){
  const lookupKey=reviewedFactLookupKey(spec),payload={invoiceEntity:String(spec.invoiceEntity||'DEFAULT'),origin:country(spec.origin),country:country(spec.country),currency:String(spec.currency||'').toUpperCase(),taxRegime:String(spec.taxRegime||'UNSPECIFIED'),role:String(spec.role||''),configurationFingerprint:String(spec.configurationFingerprint||''),description:String(spec.description||''),cogs:spec.cogs,shipping:spec.shipping,unitTotal:spec.unitTotal,amount:spec.amount,quantity:spec.quantity,sourceFile:String(spec.sourceFile||'')};
  if(!payload.configurationFingerprint)throw new Error('审核 FACT 规则缺少 Configuration');
  const existing=find('REVIEWED_FACT',lookupKey);
  if(existing?.confirmed&&sameSemanticPayload('REVIEWED_FACT',existing.payload,payload))return learnedNoop(existing);
  if(existing?.confirmed){
    const rank=compareBusinessRank(payload,existing.payload);
    if(rank>0){
      const rule=await upsert({type:'REVIEWED_FACT',lookupKey,payload,confidenceLevel:'MANUAL_CONFIRMED',confirmed:true,source:'LATEST_BUSINESS_DATA'});
      return {rule,updatedByLatest:true,ruleId:rule?.ruleId||'',syncState:rule?.syncState||''};
    }
    if(rank<0)return {rule:existing,unchanged:true,alreadyLearned:true,olderIgnored:true,ruleId:existing.ruleId||'',syncState:existing.syncState||''};
  }
  if(existing?.confirmed){const c=await recordConflict('REVIEWED_FACT',lookupKey,existing.payload,payload,'MANUAL');return{conflict:true,rule:existing,conflictRule:c}}
  const rule=await upsert({type:'REVIEWED_FACT',lookupKey,payload,confidenceLevel:'MANUAL_CONFIRMED',confirmed:true,source:'REVIEWED_WORKBOOK'});
  return {rule,created:true,ruleId:rule?.ruleId||'',syncState:rule?.syncState||''};
}

function conflicts(){return [...cache.values()].filter(r=>r.type==='RULE_CONFLICT'&&!r.deleted&&r.payload?.status!=='RESOLVED')}

async function migrateLegacy(){
  if((await allRules()).length)return;
  const now=new Date().toISOString();
  try{
    const products=JSON.parse(localStorage.getItem('write-learned-line-rules-v1')||'{}');
    for(const [lookupKey,v] of Object.entries(products||{})){
      if(!v?.category)continue;
      await putRule(normalizeRule({
        type:'PRODUCT_CATEGORY',lookupKey,
        payload:{category:v.category,productName:v.productName||'',sku:v.sku||''},
        confidenceLevel:'MANUAL_CONFIRMED',confirmed:true,source:'LEGACY_LOCALSTORAGE',
        createdAt:v.updatedAt||now,updatedAt:v.updatedAt||now,syncState:'PENDING'
      }));
    }
  }catch(e){console.warn('Product rule migration skipped',e)}
  try{
    const prices=JSON.parse(localStorage.getItem('write-auto-fact-price-rules-v1')||'{}');
    for(const [lookupKey,v] of Object.entries(prices||{})){
      const price=Number(v?.unitPrice);if(!Number.isFinite(price))continue;
      await putRule(normalizeRule({
        type:'FACT_PRICE',lookupKey,
        payload:{country:v.country||'',targetType:v.targetType||'',unitPrice:price},
        confidenceLevel:'AUTO_INFERRED',source:v.source||'LEGACY_LOCALSTORAGE',
        createdAt:v.updatedAt||now,updatedAt:v.updatedAt||now,syncState:'PENDING'
      }));
    }
  }catch(e){console.warn('Price rule migration skipped',e)}
}
function getSyncMeta(){
  try{return JSON.parse(localStorage.getItem(SYNC_META_KEY)||'{}')}catch(e){return{}}
}
function setSyncMeta(patch){
  const next={...getSyncMeta(),...patch};
  try{localStorage.setItem(SYNC_META_KEY,JSON.stringify(next))}catch(e){}
  renderStatus();
}
function beginBatchLearning(){batchSyncDepth++;return batchSyncDepth}
function endBatchLearning(){batchSyncDepth=Math.max(0,batchSyncDepth-1);return batchSyncDepth}
function batchLearningActive(){return batchSyncDepth>0}
async function init(){
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    renderStatus();
    try{
      await openDb();
      await migrateLegacy();
      rebuild(await allRules());
      ready=true;
      renderStatus();
      window.dispatchEvent(new CustomEvent('write-kb-ready'));
      if(navigator.onLine)await sync().catch(()=>{});
    }catch(err){
      ready=false;
      setSyncMeta({cloudStatus:'local-only',lastError:String(err?.message||err)});
      renderStatus();
      window.dispatchEvent(new CustomEvent('write-kb-ready'));
    }
    return ready;
  })();
  return initPromise;
}
async function sync({force=false}={}){
  if(!ready)return {ok:false,skipped:true,reason:'KB_NOT_READY'};
  if(!navigator.onLine)return {ok:false,skipped:true,reason:'OFFLINE'};
  if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
    syncing=true;renderStatus();
    try{
      let pushed=0,pulled=0,acceptedAll=[],cloudIds=[],cursor=getSyncMeta().lastCloudCursor||null;
      for(let pass=0;pass<30;pass++){
        const all=await allRules(),unsynced=all.filter(r=>r.syncState!=='SYNCED');
        const chunk=unsynced.slice(0,250);
        const resp=await fetch(SYNC_ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({deviceId:deviceId(),since:(force||pass>0)?null:cursor,rules:chunk})});
        if(!resp.ok)throw new Error('Cloud sync '+resp.status);
        const data=await resp.json();if(data?.ok===false)throw new Error(data.error||'Cloud sync rejected');
        for(const raw of(data.rules||[])){
          const incoming=normalizeRule({...raw,syncState:'SYNCED'}),current=find(incoming.type,incoming.lookupKey);
          if(shouldReplace(current,incoming))await putRule(incoming);
        }
        const accepted=new Set(data.acceptedRuleIds||[]);
        for(const rule of chunk)if(accepted.has(rule.ruleId))await putRule({...rule,syncState:'SYNCED'});
        rebuild(await allRules());
        pushed+=accepted.size;pulled+=Array.isArray(data.rules)?data.rules.length:0;
        acceptedAll.push(...accepted);cloudIds.push(...(data.rules||[]).map(r=>String(r?.ruleId||'')).filter(Boolean));
        cursor=data.cursor||cursor||new Date().toISOString();
        if(stats().pending===0)break;
        if(chunk.length===0)break;
      }
      const remaining=stats().pending,lastSyncAt=new Date().toISOString();
      if(remaining!==0)throw new Error('Cloud sync incomplete: pending '+remaining);
      setSyncMeta({cloudStatus:'connected',lastSyncAt,lastCloudCursor:cursor||lastSyncAt,lastError:''});
      window.dispatchEvent(new CustomEvent('write-kb-updated'));
      return {ok:true,pushed,pulled,acceptedRuleIds:[...new Set(acceptedAll)],cloudRuleIds:[...new Set(cloudIds)],
        cursor:cursor||lastSyncAt,lastSyncAt,cloudStatus:'connected',pending:0};
    }catch(err){
      const message=String(err?.message||err);setSyncMeta({cloudStatus:'local-only',lastError:message});
      return {ok:false,error:message,cloudStatus:'local-only',pending:stats().pending};
    }finally{syncing=false;syncPromise=null;renderStatus()}
  })();
  return syncPromise;
}
function stats(){
  const rules=[...cache.values()];
  return {
    total:rules.length,
    pending:pending.size,
    productRules:rules.filter(r=>r.type==='PRODUCT_CATEGORY').length,
    priceRules:rules.filter(r=>r.type==='FACT_PRICE').length,
    schemaRules:rules.filter(r=>r.type==='ORDER_SCHEMA').length,
    costRules:rules.filter(r=>r.type==='COST_MODEL').length,
    currencyRules:rules.filter(r=>r.type==='CURRENCY_POLICY').length,
    taxRules:rules.filter(r=>r.type==='TAX_POLICY').length,
    factModels:rules.filter(r=>r.type==='FACT_MODEL').length,
    conflicts:rules.filter(r=>r.type==='RULE_CONFLICT'&&r.payload?.status!=='RESOLVED').length,
    syncing,ready,
    online:navigator.onLine,
    cloud:getSyncMeta().cloudStatus==='connected',
    lastSyncAt:getSyncMeta().lastSyncAt||null
  };
}
function list(){return [...cache.values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}
function cloudReceiptStatus(){const st=stats(),meta=getSyncMeta();return {cloud:!!st.cloud,pending:Number(st.pending)||0,lastSyncAt:st.lastSyncAt||null,cloudStatus:meta.cloudStatus||'unknown',lastError:meta.lastError||''};}
async function exportBackup(){
  const rules=ready?await allRules():[];
  const blob=new Blob([JSON.stringify({format:'WRITE_KNOWLEDGE_BACKUP',version:1,exportedAt:new Date().toISOString(),deviceId:deviceId(),rules},null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='WRITE_Rules_Backup_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function importBackup(file){
  const payload=JSON.parse(await file.text());
  if(payload?.format!=='WRITE_KNOWLEDGE_BACKUP'||!Array.isArray(payload.rules))throw new Error('不是有效的 WRITE 规则备份');
  let count=0;
  for(const raw of payload.rules){await upsert({...raw,syncState:'PENDING',source:'BACKUP:'+String(raw.source||'UNKNOWN')});count++}
  rebuild(await allRules());window.dispatchEvent(new CustomEvent('write-kb-updated'));return count;
}
function renderStatus(){
  const el=document.getElementById('knowledgeStatus');if(!el)return;
  const st=stats();
  const last=st.lastSyncAt?new Date(st.lastSyncAt).toLocaleString('zh-CN'):'尚未同步';
  const state=st.syncing?'同步中':!st.ready?'本地初始化':!st.online?'离线':st.cloud?'云端已连接':'仅本地';
  el.innerHTML=`<div><b>${st.total}</b><span>长期规则</span></div><div><b>${st.pending}</b><span>待同步</span></div><div><b>${state}</b><span>同步状态</span></div><div><b>${last}</b><span>最后同步</span></div>`;
  const dot=document.getElementById('knowledgeCloudDot');
  if(dot)dot.dataset.state=st.syncing?'syncing':!st.online?'offline':st.cloud?'online':'local';
}
window.addEventListener('online',()=>sync().catch(()=>{}));
window.addEventListener('offline',renderStatus);
setTimeout(()=>{if(navigator.onLine)sync().catch(()=>{})},1500);

window.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&navigator.onLine)sync().catch(()=>{});
});
setInterval(()=>{if(navigator.onLine)sync().catch(()=>{})},5*60*1000);


window.WRITE_KB={
  init,sync,stats,list,productCategory,factPrice,learnProduct,learnPrice,learnSchema,schemaRules,schemaFor,costModel,calculateCost,learnCostModel,currencyPolicy,learnCurrencyPolicy,taxPolicy,learnTaxPolicy,learnFactModel,reviewedProduct,learnReviewedProduct,reviewedFact,learnReviewedFact,conflicts,cloudReceiptStatus,beginBatchLearning,endBatchLearning,batchLearningActive,exportBackup,importBackup,renderStatus,
  priority:PRIORITY
};
})();
