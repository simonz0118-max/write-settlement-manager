import {json,requireAdmin,validateBodySize} from '../../_shared/rules-auth.js';

const TABLE='write_rules_v1017';
const AUDIT='write_rules_audit_v1110';
const CHUNK=50;
const REVIEWED_TYPES=new Set(['REVIEWED_PRODUCT','REVIEWED_FACT','COST_MODEL','COMPONENT_COST_EQUATION','PACKAGE_FEE','PRODUCT_CATEGORY']);

async function ensure(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLE} (
    rule_id TEXT PRIMARY KEY,type TEXT NOT NULL,lookup_key TEXT NOT NULL,payload_json TEXT NOT NULL,
    confidence_level TEXT,priority INTEGER,source TEXT,confirmed INTEGER,device_id TEXT,created_at TEXT,
    updated_at TEXT NOT NULL,version INTEGER,sync_state TEXT,deleted INTEGER DEFAULT 0
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_updated ON ${TABLE}(updated_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_lookup ON ${TABLE}(type,lookup_key)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${AUDIT} (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,rule_id TEXT,action TEXT NOT NULL,type TEXT,
    lookup_key TEXT,request_id TEXT,created_at TEXT NOT NULL
  )`).run();
}
function clean(r={},now=new Date().toISOString()){
  const type=String(r.type||'GENERIC'),reviewed=REVIEWED_TYPES.has(type),deleted=!!r.deleted;
  return {
    ruleId:String(r.ruleId||''),type,lookupKey:String(r.lookupKey||''),
    payload:r.payload&&typeof r.payload==='object'?r.payload:{},
    confidenceLevel:reviewed?'MANUAL_CONFIRMED':'AUTO_INFERRED',
    priority:reviewed?600:300,
    source:deleted?'AUTHENTICATED_DELETE':(reviewed?'AUTHENTICATED_REVIEW':'AUTHENTICATED_SYNC'),
    confirmed:reviewed,
    deviceId:String(r.deviceId||'').slice(0,160),
    createdAt:now,updatedAt:now,deleted
  };
}
function stmt(db,r,now){
  const x=clean(r,now);if(!x.ruleId||!x.lookupKey)return null;
  return {
    x,
    statement:db.prepare(`INSERT INTO ${TABLE}
      (rule_id,type,lookup_key,payload_json,confidence_level,priority,source,confirmed,device_id,created_at,updated_at,version,sync_state,deleted)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(rule_id) DO UPDATE SET
       type=excluded.type,lookup_key=excluded.lookup_key,payload_json=excluded.payload_json,
       confidence_level=excluded.confidence_level,priority=excluded.priority,source=excluded.source,
       confirmed=excluded.confirmed,device_id=excluded.device_id,
       updated_at=excluded.updated_at,version=${TABLE}.version+1,sync_state='SYNCED',deleted=excluded.deleted`)
      .bind(x.ruleId,x.type,x.lookupKey,JSON.stringify(x.payload),x.confidenceLevel,x.priority,x.source,x.confirmed?1:0,
            x.deviceId,x.createdAt,x.updatedAt,1,'SYNCED',x.deleted?1:0)
  };
}
function fromRow(r){
  let payload={};try{payload=JSON.parse(r.payload_json||'{}')}catch{}
  return {ruleId:r.rule_id,type:r.type,lookupKey:r.lookup_key,payload,confidenceLevel:r.confidence_level,
    priority:r.priority,source:r.source,confirmed:!!r.confirmed,deviceId:r.device_id,createdAt:r.created_at,
    updatedAt:r.updated_at,version:r.version,syncState:'SYNCED',deleted:!!r.deleted};
}
async function audit(db,x,requestId){
  await db.prepare(`INSERT INTO ${AUDIT}(rule_id,action,type,lookup_key,request_id,created_at) VALUES(?,?,?,?,?,?)`)
    .bind(x.ruleId,x.deleted?'DELETE':'UPSERT',x.type,x.lookupKey,requestId,new Date().toISOString()).run();
}
async function writeBulk(db,rules,requestId){
  const accepted=[];
  for(let i=0;i<rules.length;i+=CHUNK){
    const part=rules.slice(i,i+CHUNK),statements=[],xs=[];
    for(let j=0;j<part.length;j++){
      const now=new Date(Date.now()+j).toISOString(),built=stmt(db,part[j],now);
      if(built){statements.push(built.statement);xs.push(built.x)}
    }
    if(statements.length){
      await db.batch(statements);
      for(const x of xs){accepted.push(x.ruleId);await audit(db,x,requestId)}
    }
  }
  return accepted;
}
async function fetchRules(db,since){
  const q=since
    ? db.prepare(`SELECT * FROM ${TABLE} WHERE updated_at>? ORDER BY updated_at ASC LIMIT 10000`).bind(String(since))
    : db.prepare(`SELECT * FROM ${TABLE} ORDER BY updated_at ASC LIMIT 10000`);
  const out=await q.all();return Array.isArray(out.results)?out.results:[];
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{allow:'POST, GET, OPTIONS'}})}
export async function onRequestGet({env}){
  return json({ok:true,service:'WRITE_RULES_SYNC',version:'11.1.0',method:'GET',auth:'required-for-sync'});
}
export async function onRequestPost({request,env}){
  try{
    const denied=requireAdmin(request,env);if(denied)return denied;
    if(!validateBodySize(request))return json({ok:false,error:'REQUEST_TOO_LARGE'},413);
    if(!env.WRITE_RULES_DB)return json({ok:false,error:'WRITE_RULES_DB binding missing'},503);
    const db=env.WRITE_RULES_DB;await ensure(db);
    const body=await request.json().catch(()=>({})),rules=Array.isArray(body.rules)?body.rules:[];
    if(rules.length>500)return json({ok:false,error:'Too many rules in one request',count:rules.length},413);
    const requestId=crypto.randomUUID?.()||String(Date.now());
    const accepted=await writeBulk(db,rules,requestId);
    const rows=await fetchRules(db,body.since?String(body.since):null);
    const cursor=rows.length?String(rows[rows.length-1].updated_at):new Date().toISOString();
    return json({ok:true,acceptedRuleIds:accepted,rules:rows.map(fromRow),cursor,serverVersion:'11.1.0',
      received:rules.length,accepted:accepted.length,authority:'SERVER_CONTROLLED'});
  }catch(e){return json({ok:false,error:String(e?.message||e),stage:'POST_SYNC'},500)}
}
