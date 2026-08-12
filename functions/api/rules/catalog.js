const TABLE='write_rules_v1017';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const PRODUCT_TYPES=new Set(['REVIEWED_PRODUCT','COST_MODEL','PRODUCT_CATEGORY']);
const MANAGE_TYPES=new Set(['REVIEWED_PRODUCT','COST_MODEL','PRODUCT_CATEGORY','REVIEWED_FACT','RULE_CONFLICT']);

async function ensure(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLE} (
    rule_id TEXT PRIMARY KEY,type TEXT NOT NULL,lookup_key TEXT NOT NULL,payload_json TEXT NOT NULL,
    confidence_level TEXT,priority INTEGER,source TEXT,confirmed INTEGER,device_id TEXT,created_at TEXT,
    updated_at TEXT NOT NULL,version INTEGER,sync_state TEXT,deleted INTEGER DEFAULT 0
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_updated ON ${TABLE}(updated_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_lookup ON ${TABLE}(type,lookup_key)`).run();
}
const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
const upper=v=>String(v??'').trim().toUpperCase();
const cleanControl=v=>String(v??'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim();
function configIdentityFromRule(rule){
  const p=rule?.payload||{},sku=String(p.sku||'');
  if(rule?.type==='COST_MODEL'&&/^CONFIG:/i.test(sku))return cleanControl(sku.replace(/^CONFIG:/i,''));
  return cleanControl(p.configurationFingerprint||'');
}
function configDisplayName(config,facts=[]){
  const key=norm(cleanControl(config)),fact=facts.find(f=>norm(cleanControl(f.payload?.configurationFingerprint))===key);
  const fromFact=cleanControl(fact?.payload?.description||'');
  if(fromFact)return fromFact;
  return cleanControl(config).replace(/\s+([0-9]+)$/,' ×$1');
}
function conflictSignature(r){
  const p=r?.payload||{};
  return JSON.stringify([String(p.ruleType||''),String(p.lookupKey||''),p.existingPayload||{},p.incomingPayload||{}]);
}

function parsePayload(s){try{return JSON.parse(s||'{}')}catch{return {}}}
function rowToRule(r){
  return {ruleId:r.rule_id,type:r.type,lookupKey:r.lookup_key,payload:parsePayload(r.payload_json),confidenceLevel:r.confidence_level,
    priority:Number(r.priority)||0,source:r.source,confirmed:!!r.confirmed,deviceId:r.device_id,createdAt:r.created_at,
    updatedAt:r.updated_at,version:Number(r.version)||1,syncState:'SYNCED',deleted:!!r.deleted};
}
function productIdentity(rule){
  const p=rule.payload||{},sku=norm(p.sku),name=norm(p.productName);
  if(rule.type==='COST_MODEL'&&/^config:/i.test(String(p.sku||''))){
    const cfg=configIdentityFromRule(rule);return 'config:'+norm(cfg);
  }
  return sku?'sku:'+sku:(name?'name:'+name:'rule:'+rule.ruleId);
}
function lookupFor(type,p={}){
  if(type==='REVIEWED_PRODUCT'){
    const sku=norm(p.sku),name=norm(p.productName),c=upper(p.country),o=upper(p.origin),cur=upper(p.currency);
    if(sku)return c&&o&&cur?`sku:${sku}\u0001${c}\u0001${o}\u0001${cur}`:`sku:${sku}`;
    if(name)return c&&o&&cur?`name:${name}\u0001${c}\u0001${o}\u0001${cur}`:`name:${name}`;
  }
  if(type==='COST_MODEL'){
    const sku=norm(p.sku),name=norm(p.productName),c=upper(p.country),cur=upper(p.currency);
    if(sku)return `sku:${sku}\u0001${c}\u0001${cur}`;
    if(name)return `name:${name}\u0001${c}\u0001${cur}`;
  }
  if(type==='PRODUCT_CATEGORY'){
    const sku=norm(p.sku),name=norm(p.productName); if(sku)return 'sku:'+sku;if(name)return 'name:'+name;
  }
  if(type==='REVIEWED_FACT'){
    return [String(p.invoiceEntity||'DEFAULT'),upper(p.origin),upper(p.country),upper(p.currency),String(p.taxRegime||'UNSPECIFIED'),String(p.role||''),String(p.configurationFingerprint||'')].join('\u0001');
  }
  return null;
}
function productGroup(rules){
  const groups=new Map(),facts=rules.filter(r=>r.type==='REVIEWED_FACT');
  for(const r of rules.filter(r=>PRODUCT_TYPES.has(r.type))){
    const id=productIdentity(r);let g=groups.get(id);
    if(!g){g={id,sku:'',productName:'',displayKind:'PRODUCT',family:'',role:'',countries:new Set(),origins:new Set(),currencies:new Set(),descriptions:new Set(),rules:[],costRules:[],factRules:[],updatedAt:''};groups.set(id,g)}
    const p=r.payload||{},cfg=configIdentityFromRule(r);
    if(id.startsWith('config:')){
      g.displayKind='PACKAGE';
      g.sku='';
      g.productName=g.productName||configDisplayName(cfg,facts);
      g.family=g.family||'PACKAGE_CONFIGURATION';
      g.role=g.role||'PACKAGE';
      const fact=facts.find(f=>norm(cleanControl(f.payload?.configurationFingerprint))===norm(cleanControl(cfg)));
      if(fact){
        const fp=fact.payload||{};
        if(fp.country)g.countries.add(upper(fp.country));if(fp.origin)g.origins.add(upper(fp.origin));if(fp.currency)g.currencies.add(upper(fp.currency));
        if(fp.description)g.descriptions.add(cleanControl(fp.description));
      }
    }else{
      g.sku=g.sku||cleanControl(p.sku||'');g.productName=g.productName||cleanControl(p.productName||'');
      g.family=g.family||cleanControl(p.family||p.category||'');g.role=g.role||cleanControl(p.role||'');
    }
    if(p.country)g.countries.add(upper(p.country));if(p.origin)g.origins.add(upper(p.origin));if(p.currency)g.currencies.add(upper(p.currency));
    if(p.approvedFactDescription)g.descriptions.add(cleanControl(p.approvedFactDescription));if(p.normalizedDescription)g.descriptions.add(cleanControl(p.normalizedDescription));
    if(p.sourceFactDescription)g.descriptions.add(cleanControl(p.sourceFactDescription));
    g.rules.push(r);if(r.type==='COST_MODEL')g.costRules.push(r);if(String(r.updatedAt)>g.updatedAt)g.updatedAt=String(r.updatedAt);
  }
  for(const g of groups.values()){
    const fps=new Set();
    for(const r of g.rules){
      const cfg=configIdentityFromRule(r);if(cfg)fps.add(norm(cfg));
      const fp=cleanControl(r.payload?.configurationFingerprint||'');if(fp)fps.add(norm(cleanControl(fp)));
    }
    g.factRules=facts.filter(f=>fps.has(norm(cleanControl(f.payload?.configurationFingerprint||''))));
    if(g.displayKind==='PACKAGE'&&!g.productName){
      const cfg=[...fps][0]||'';g.productName=configDisplayName(cfg,facts)||'套装配置';
    }
  }
  return [...groups.values()].map(g=>({...g,countries:[...g.countries],origins:[...g.origins],currencies:[...g.currencies],descriptions:[...g.descriptions],
    ruleCount:g.rules.length+g.factRules.length,costCount:g.costRules.length,factCount:g.factRules.length}));
}
function matchesGroup(g,terms){
  if(!terms.length)return true;
  const hay=norm([g.sku,g.productName,g.family,g.role,...g.countries,...g.origins,...g.currencies,...g.descriptions,
    ...g.rules.map(r=>JSON.stringify(r.payload||{})),...g.factRules.map(r=>JSON.stringify(r.payload||{}))].join(' '));
  return terms.some(t=>hay.includes(norm(t)));
}
async function loadAll(db){
  const out=await db.prepare(`SELECT * FROM ${TABLE} WHERE deleted=0 AND type!='SMOKE' ORDER BY updated_at DESC LIMIT 10000`).all();
  return (out.results||[]).map(rowToRule);
}
async function getRule(db,id){const r=await db.prepare(`SELECT * FROM ${TABLE} WHERE rule_id=?`).bind(id).first();return r?rowToRule(r):null}
async function mutateRule(db,op){
  const old=await getRule(db,op.ruleId);if(!old)return {ok:false,status:404,error:'RULE_NOT_FOUND'};
  if(!MANAGE_TYPES.has(old.type))return {ok:false,status:400,error:'RULE_TYPE_NOT_MANAGEABLE'};
  if(op.expectedUpdatedAt&&String(old.updatedAt)!==String(op.expectedUpdatedAt))return {ok:false,status:409,error:'RULE_CHANGED_ON_CLOUD',current:old};
  const now=new Date().toISOString();
  if(op.action==='delete'){
    await db.prepare(`UPDATE ${TABLE} SET deleted=1,updated_at=?,version=version+1,sync_state='SYNCED' WHERE rule_id=?`).bind(now,old.ruleId).run();
    return {ok:true,action:'delete',ruleId:old.ruleId,updatedAt:now};
  }
  if(op.action==='update'){
    const payload=op.payload&&typeof op.payload==='object'?op.payload:null;if(!payload)return {ok:false,status:400,error:'INVALID_PAYLOAD'};
    const lookup=lookupFor(old.type,payload)||old.lookupKey;
    await db.prepare(`UPDATE ${TABLE} SET payload_json=?,lookup_key=?,updated_at=?,version=version+1,sync_state='SYNCED',source='CLOUD_MANUAL_EDIT',confirmed=1 WHERE rule_id=?`)
      .bind(JSON.stringify(payload),lookup,now,old.ruleId).run();
    return {ok:true,action:'update',ruleId:old.ruleId,lookupKey:lookup,updatedAt:now};
  }
  return {ok:false,status:400,error:'UNKNOWN_ACTION'};
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{allow:'GET, POST, OPTIONS'}})}
export async function onRequestGet({request,env}){
  try{
    if(!env.WRITE_RULES_DB)return json({ok:false,error:'WRITE_RULES_DB binding missing'},503);
    await ensure(env.WRITE_RULES_DB);
    const u=new URL(request.url),q=String(u.searchParams.get('q')||''),terms=q.split(/[\n,;，；]+/).map(x=>x.trim()).filter(Boolean);
    const rules=await loadAll(env.WRITE_RULES_DB),allProducts=productGroup(rules),products=allProducts.filter(g=>matchesGroup(g,terms));
    const attachedFactIds=new Set(allProducts.flatMap(g=>(g.factRules||[]).map(r=>r.ruleId)));
    const nonProduct=rules.filter(r=>!PRODUCT_TYPES.has(r.type)&&!attachedFactIds.has(r.ruleId));
    const conflictRows=rules.filter(r=>r.type==='RULE_CONFLICT'),uniqueConflictMap=new Map();
    for(const r of conflictRows){const sig=conflictSignature(r);if(!uniqueConflictMap.has(sig))uniqueConflictMap.set(sig,r)}
    const counts={totalRules:rules.length,products:products.length,reviewedProduct:rules.filter(r=>r.type==='REVIEWED_PRODUCT').length,
      costModel:rules.filter(r=>r.type==='COST_MODEL').length,reviewedFact:rules.filter(r=>r.type==='REVIEWED_FACT').length,
      conflicts:uniqueConflictMap.size,rawConflictRows:conflictRows.length,historicalConflictDuplicates:Math.max(0,conflictRows.length-uniqueConflictMap.size),other:nonProduct.length};
    return json({ok:true,version:'10.2.2',counts,products,otherRules:nonProduct.slice(0,1000),
      conflicts:[...uniqueConflictMap.values()].slice(0,1000)});
  }catch(e){return json({ok:false,error:String(e?.message||e)},500)}
}
export async function onRequestPost({request,env}){
  try{
    if(!env.WRITE_RULES_DB)return json({ok:false,error:'WRITE_RULES_DB binding missing'},503);
    const db=env.WRITE_RULES_DB;await ensure(db);const body=await request.json().catch(()=>({}));
    const ops=Array.isArray(body.operations)?body.operations:[body],results=[];
    if(ops.length>200)return json({ok:false,error:'TOO_MANY_OPERATIONS'},413);
    for(const op of ops){
      const r=await mutateRule(db,op||{});results.push(r);
      if(!r.ok&&r.status===409)return json({ok:false,error:r.error,current:r.current,results},409);
    }
    return json({ok:results.every(x=>x.ok),results,changed:results.filter(x=>x.ok).length});
  }catch(e){return json({ok:false,error:String(e?.message||e)},500)}
}