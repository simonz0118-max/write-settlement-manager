/* WRITE V8.0 Rule Store — local-first, conflict-safe */
(function(g){'use strict';
const DB='write-semantic-rules-v8',STORE='rules';
function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'id'});s.createIndex('updatedAt','updatedAt');s.createIndex('scope','scope');s.createIndex('sourceType','sourceType')}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function getAll(){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
async function put(rule){const db=await open(),r=g.WRITE_SEMANTIC_V8.normalizeRule({...rule,updatedAt:Date.now()});await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(r);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});return r}
async function putMany(rules){const db=await open(),out=(rules||[]).map(x=>g.WRITE_SEMANTIC_V8.normalizeRule({...x,updatedAt:Date.now()}));await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite'),s=t.objectStore(STORE);out.forEach(x=>s.put(x));t.oncomplete=resolve;t.onerror=()=>reject(t.error)});return out}
async function remove(id){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}
async function exportJson(){return JSON.stringify({version:'8.0.0',exportedAt:Date.now(),rules:await getAll()},null,2)}
async function importJson(text){const j=typeof text==='string'?JSON.parse(text):text;if(!Array.isArray(j?.rules))throw new Error('INVALID_RULE_BACKUP');return putMany(j.rules)}
async function sync(){try{const rules=await getAll(),r=await fetch('/api/rules/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({semanticV8:true,rules})});if(!r.ok)return{ok:false,status:r.status,reason:'HTTP'};const data=await r.json().catch(()=>({}));return{ok:!!data.ok,data}}catch(e){return{ok:false,reason:'OFFLINE_OR_UNAVAILABLE',message:e?.message||String(e)}}}
g.WRITE_RULE_STORE_V8={VERSION:'8.0.0',getAll,put,putMany,remove,exportJson,importJson,sync};
})(window);
