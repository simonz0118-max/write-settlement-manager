
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
let syncing=false;
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
  if(queueSync&&navigator.onLine)queueMicrotask(()=>sync().catch(()=>{}));
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
async function init(){
  try{
    await openDb();
    await migrateLegacy();
    rebuild(await allRules());
    ready=true;
    renderStatus();
    if(navigator.onLine)sync().catch(()=>{});
  }catch(err){
    ready=false;
    console.warn('Knowledge base running in legacy localStorage fallback',err);
    renderStatus();
  }
  window.dispatchEvent(new CustomEvent('write-kb-ready'));
}
async function sync({force=false}={}){
  if(syncing||!ready||!navigator.onLine)return;
  syncing=true;renderStatus();
  try{
    const all=await allRules();
    const unsynced=all.filter(r=>r.syncState!=='SYNCED');
    const meta=getSyncMeta();
    const resp=await fetch(SYNC_ENDPOINT,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({deviceId:deviceId(),since:force?null:(meta.lastCloudCursor||null),rules:unsynced})
    });
    if(!resp.ok)throw new Error('Cloud sync '+resp.status);
    const data=await resp.json();
    for(const raw of (data.rules||[])){
      const incoming=normalizeRule({...raw,syncState:'SYNCED'});
      const current=find(incoming.type,incoming.lookupKey);
      if(shouldReplace(current,incoming))await putRule(incoming);
    }
    const accepted=new Set(data.acceptedRuleIds||unsynced.map(r=>r.ruleId));
    for(const rule of unsynced){
      if(accepted.has(rule.ruleId))await putRule({...rule,syncState:'SYNCED'});
    }
    rebuild(await allRules());
    setSyncMeta({cloudStatus:'connected',lastSyncAt:new Date().toISOString(),lastCloudCursor:data.cursor||new Date().toISOString(),lastError:''});
    window.dispatchEvent(new CustomEvent('write-kb-updated'));
  }catch(err){
    setSyncMeta({cloudStatus:'local-only',lastError:String(err?.message||err)});
  }finally{
    syncing=false;renderStatus();
  }
}
function stats(){
  const rules=[...cache.values()];
  return {
    total:rules.length,
    pending:pending.size,
    productRules:rules.filter(r=>r.type==='PRODUCT_CATEGORY').length,
    priceRules:rules.filter(r=>r.type==='FACT_PRICE').length,
    syncing,ready,
    online:navigator.onLine,
    cloud:getSyncMeta().cloudStatus==='connected',
    lastSyncAt:getSyncMeta().lastSyncAt||null
  };
}
function list(){return [...cache.values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}
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
  const state=st.syncing?'同步中':!st.online?'离线':st.cloud?'云端已连接':'仅本地';
  el.innerHTML=`<div><b>${st.total}</b><span>长期规则</span></div><div><b>${st.pending}</b><span>待同步</span></div><div><b>${state}</b><span>同步状态</span></div><div><b>${last}</b><span>最后同步</span></div>`;
  const dot=document.getElementById('knowledgeCloudDot');
  if(dot)dot.dataset.state=st.syncing?'syncing':!st.online?'offline':st.cloud?'online':'local';
}
window.addEventListener('online',()=>sync().catch(()=>{}));
window.addEventListener('offline',renderStatus);

window.WRITE_KB={
  init,sync,stats,list,productCategory,factPrice,learnProduct,learnPrice,exportBackup,importBackup,renderStatus,
  priority:PRIORITY
};
})();
