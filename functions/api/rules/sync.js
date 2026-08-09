
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}})}
function safe(raw){
  if(!raw||typeof raw!=='object')return null;
  const ruleId=String(raw.ruleId||'').slice(0,180),lookupKey=String(raw.lookupKey||'').slice(0,500);
  if(!ruleId||!lookupKey)return null;
  return {
    ruleId,type:String(raw.type||'GENERIC').slice(0,60),lookupKey,
    payload:raw.payload&&typeof raw.payload==='object'?raw.payload:{},
    confidenceLevel:String(raw.confidenceLevel||'AUTO_INFERRED').slice(0,40),
    priority:Number(raw.priority)||0,source:String(raw.source||'LOCAL').slice(0,80),
    confirmed:raw.confirmed?1:0,deviceId:String(raw.deviceId||'').slice(0,180),
    createdAt:String(raw.createdAt||new Date().toISOString()),updatedAt:String(raw.updatedAt||new Date().toISOString()),
    version:Number(raw.version)||1,deleted:raw.deleted?1:0
  };
}
async function upsert(db,r){
  return db.prepare(`
    INSERT INTO write_rules(rule_id,type,lookup_key,payload_json,confidence_level,priority,source,confirmed,device_id,created_at,updated_at,version,deleted)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
    ON CONFLICT(type,lookup_key) DO UPDATE SET
      payload_json=CASE WHEN excluded.priority>write_rules.priority OR (excluded.priority=write_rules.priority AND excluded.updated_at>=write_rules.updated_at) THEN excluded.payload_json ELSE write_rules.payload_json END,
      confidence_level=CASE WHEN excluded.priority>write_rules.priority OR (excluded.priority=write_rules.priority AND excluded.updated_at>=write_rules.updated_at) THEN excluded.confidence_level ELSE write_rules.confidence_level END,
      priority=MAX(write_rules.priority,excluded.priority),
      source=CASE WHEN excluded.priority>write_rules.priority OR (excluded.priority=write_rules.priority AND excluded.updated_at>=write_rules.updated_at) THEN excluded.source ELSE write_rules.source END,
      confirmed=MAX(write_rules.confirmed,excluded.confirmed),
      updated_at=MAX(write_rules.updated_at,excluded.updated_at),
      version=MAX(write_rules.version,excluded.version),
      deleted=CASE WHEN excluded.priority>write_rules.priority OR (excluded.priority=write_rules.priority AND excluded.updated_at>=write_rules.updated_at) THEN excluded.deleted ELSE write_rules.deleted END
  `).bind(r.ruleId,r.type,r.lookupKey,JSON.stringify(r.payload),r.confidenceLevel,r.priority,r.source,r.confirmed,r.deviceId,r.createdAt,r.updatedAt,r.version,r.deleted).run();
}
function rowToRule(row){return {ruleId:row.rule_id,type:row.type,lookupKey:row.lookup_key,payload:JSON.parse(row.payload_json||'{}'),confidenceLevel:row.confidence_level,priority:row.priority,source:row.source,confirmed:!!row.confirmed,deviceId:row.device_id,createdAt:row.created_at,updatedAt:row.updated_at,version:row.version,deleted:!!row.deleted,syncState:'SYNCED'}}
export async function onRequestPost({request,env}){
  const db=env.WRITE_RULES_DB;if(!db)return json({error:'WRITE_RULES_DB binding is not configured'},503);
  let body;try{body=await request.json()}catch(e){return json({error:'Invalid JSON'},400)}
  const accepted=[];
  for(const raw of (Array.isArray(body.rules)?body.rules.slice(0,2000):[])){const r=safe(raw);if(!r)continue;await upsert(db,r);accepted.push(r.ruleId)}
  const since=body.since?String(body.since):'1970-01-01T00:00:00.000Z';
  const result=await db.prepare(`SELECT * FROM write_rules WHERE updated_at>?1 ORDER BY updated_at ASC LIMIT 5000`).bind(since).all();
  return json({ok:true,acceptedRuleIds:accepted,rules:(result.results||[]).map(rowToRule),cursor:new Date().toISOString()});
}
export async function onRequestGet({request,env}){
  const db=env.WRITE_RULES_DB;if(!db)return json({error:'WRITE_RULES_DB binding is not configured'},503);
  const since=new URL(request.url).searchParams.get('since')||'1970-01-01T00:00:00.000Z';
  const result=await db.prepare(`SELECT * FROM write_rules WHERE updated_at>?1 ORDER BY updated_at ASC LIMIT 5000`).bind(since).all();
  return json({ok:true,rules:(result.results||[]).map(rowToRule),cursor:new Date().toISOString()});
}
