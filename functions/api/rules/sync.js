const TABLE='write_rules_v1017';
const CHUNK=50;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function ensure(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLE} (
    rule_id TEXT PRIMARY KEY,type TEXT NOT NULL,lookup_key TEXT NOT NULL,payload_json TEXT NOT NULL,
    confidence_level TEXT,priority INTEGER,source TEXT,confirmed INTEGER,device_id TEXT,created_at TEXT,
    updated_at TEXT NOT NULL,version INTEGER,sync_state TEXT,deleted INTEGER DEFAULT 0
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_updated ON ${TABLE}(updated_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_lookup ON ${TABLE}(type,lookup_key)`).run();
}
function clean(r={}){
  return {ruleId:String(r.ruleId||''),type:String(r.type||'GENERIC'),lookupKey:String(r.lookupKey||''),
    payload:r.payload&&typeof r.payload==='object'?r.payload:{},confidenceLevel:String(r.confidenceLevel||'AUTO_INFERRED'),
    priority:Number(r.priority)||0,source:String(r.source||''),confirmed:!!r.confirmed,deviceId:String(r.deviceId||''),
    createdAt:String(r.createdAt||new Date().toISOString()),updatedAt:String(r.updatedAt||new Date().toISOString()),
    version:Number(r.version)||1,deleted:!!r.deleted};
}
function stmt(db,r){
  const x=clean(r); if(!x.ruleId||!x.lookupKey)return null;
  return db.prepare(`INSERT INTO ${TABLE}
   (rule_id,type,lookup_key,payload_json,confidence_level,priority,source,confirmed,device_id,created_at,updated_at,version,sync_state,deleted)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(rule_id) DO UPDATE SET
    type=excluded.type,lookup_key=excluded.lookup_key,payload_json=excluded.payload_json,
    confidence_level=excluded.confidence_level,priority=excluded.priority,source=excluded.source,
    confirmed=excluded.confirmed,device_id=excluded.device_id,created_at=excluded.created_at,
    updated_at=excluded.updated_at,version=excluded.version,sync_state='SYNCED',deleted=excluded.deleted
   WHERE excluded.updated_at >= ${TABLE}.updated_at`)
   .bind(x.ruleId,x.type,x.lookupKey,JSON.stringify(x.payload),x.confidenceLevel,x.priority,x.source,x.confirmed?1:0,
         x.deviceId,x.createdAt,x.updatedAt,x.version,'SYNCED',x.deleted?1:0);
}
function fromRow(r){
  let payload={};try{payload=JSON.parse(r.payload_json||'{}')}catch{}
  return {ruleId:r.rule_id,type:r.type,lookupKey:r.lookup_key,payload,confidenceLevel:r.confidence_level,
    priority:r.priority,source:r.source,confirmed:!!r.confirmed,deviceId:r.device_id,createdAt:r.created_at,
    updatedAt:r.updated_at,version:r.version,syncState:'SYNCED',deleted:!!r.deleted};
}
async function writeBulk(db,rules){
  const accepted=[];
  for(let i=0;i<rules.length;i+=CHUNK){
    const part=rules.slice(i,i+CHUNK),ids=[],statements=[];
    for(const r of part){const s=stmt(db,r);if(s){statements.push(s);ids.push(String(r.ruleId||''))}}
    if(statements.length){await db.batch(statements);accepted.push(...ids)}
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
  try{
    if(!env.WRITE_RULES_DB)return json({ok:false,error:'WRITE_RULES_DB binding missing'},503);
    await ensure(env.WRITE_RULES_DB);
    return json({ok:true,service:'WRITE_RULES_SYNC',version:'10.1.8',method:'GET'});
  }catch(e){return json({ok:false,error:String(e?.message||e),stage:'GET_INIT'},500)}
}
export async function onRequestPost({request,env}){
  try{
    if(!env.WRITE_RULES_DB)return json({ok:false,error:'WRITE_RULES_DB binding missing'},503);
    const db=env.WRITE_RULES_DB;await ensure(db);
    const body=await request.json().catch(()=>({})),rules=Array.isArray(body.rules)?body.rules:[];
    if(rules.length>5000)return json({ok:false,error:'Too many rules in one request',count:rules.length},413);
    const accepted=await writeBulk(db,rules);
    const rows=await fetchRules(db,body.since?String(body.since):null);
    const cursor=rows.length?String(rows[rows.length-1].updated_at):new Date().toISOString();
    return json({ok:true,acceptedRuleIds:accepted,rules:rows.map(fromRow),cursor,serverVersion:'10.1.8',
      received:rules.length,accepted:accepted.length});
  }catch(e){return json({ok:false,error:String(e?.message||e),stage:'POST_SYNC'},500)}
}
