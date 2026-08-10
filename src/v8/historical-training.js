/* WRITE V8.1 Historical Training Dataset
 * Complete-only candidate extraction. Partial documents can never create rules.
 */
(function(global){
'use strict';

const VERSION='8.1.0';
const TRAINABLE=new Set(['COMPLETE']);
const NON_TRAINABLE=new Set(['PARTIAL','REFERENCE_ONLY','REJECTED']);

function clean(v=''){return String(v??'').trim()}
function stableJson(v){
  if(Array.isArray(v))return '['+v.map(stableJson).join(',')+']';
  if(v&&typeof v==='object'){
    return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stableJson(v[k])).join(',')+'}';
  }
  return JSON.stringify(v);
}
function fnv1a(text=''){
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)}
  return (h>>>0).toString(16).padStart(8,'0');
}
function contentFingerprint(doc){
  return fnv1a(stableJson({
    sourceRows:doc?.sourceRows||[],
    factRows:doc?.factRows||[],
    sourceMeta:doc?.sourceMeta||{}
  }));
}
function normalizeStatus(status){
  const s=clean(status).toUpperCase();
  return TRAINABLE.has(s)||NON_TRAINABLE.has(s)?s:'REFERENCE_ONLY';
}
function canTrain(doc){
  const status=normalizeStatus(doc?.status);
  if(status!=='COMPLETE')return {ok:false,status,reason:`STATUS_${status}_NOT_TRAINABLE`};
  if(doc?.coverage!=null&&Number(doc.coverage)<0.999999)
    return {ok:false,status:'PARTIAL',reason:'COVERAGE_NOT_CLOSED'};
  if(doc?.factRows&&doc.factRows.length===0)
    return {ok:false,status:'REFERENCE_ONLY',reason:'NO_FACT_ROWS'};
  return {ok:true,status:'COMPLETE',reason:'COMPLETE_VERIFIED'};
}
function deduplicateDocuments(docs=[]){
  const seen=new Map(),unique=[],duplicates=[];
  for(const doc of docs){
    const fp=clean(doc.contentHash)||contentFingerprint(doc);
    if(seen.has(fp)){duplicates.push({duplicateId:doc.id,canonicalId:seen.get(fp),fingerprint:fp});continue}
    seen.set(fp,doc.id);unique.push({...doc,contentHash:fp});
  }
  return {unique,duplicates};
}
function candidateKey(c){
  return [c.ruleType,c.scope,stableJson(c.pattern||{}),stableJson(c.action||{})].join('\u0001');
}
function mergeCandidates(candidates=[]){
  const map=new Map();
  for(const c of candidates){
    const k=candidateKey(c);
    let g=map.get(k);
    if(!g){
      g={...c,evidenceCount:0,sourceRefs:[],confidence:0,conflicts:[]};
      map.set(k,g);
    }
    g.evidenceCount++;
    if(c.sourceRef&&!g.sourceRefs.includes(c.sourceRef))g.sourceRefs.push(c.sourceRef);
    g.confidence=Math.max(g.confidence,Number(c.confidence)||0);
  }
  return [...map.values()].map(x=>({
    ...x,
    confidence:Math.min(0.995,x.confidence+Math.min(.08,Math.max(0,x.evidenceCount-1)*.02))
  }));
}
function detectContradictions(candidates=[]){
  const byPattern=new Map(),conflicts=[];
  for(const c of candidates){
    const k=[c.ruleType,c.scope,stableJson(c.pattern||{})].join('\u0001');
    let arr=byPattern.get(k);if(!arr){arr=[];byPattern.set(k,arr)}arr.push(c);
  }
  for(const [key,arr] of byPattern){
    const actions=new Map();
    for(const c of arr){
      const a=stableJson(c.action||{});
      if(!actions.has(a))actions.set(a,[]);
      actions.get(a).push(c);
    }
    if(actions.size>1){
      conflicts.push({key,actions:[...actions.entries()].map(([action,rows])=>({action,candidates:rows.map(x=>x.id||candidateKey(x))}))});
    }
  }
  return conflicts;
}
function trainingPlan(documents=[]){
  const de=deduplicateDocuments(documents),accepted=[],excluded=[];
  for(const d of de.unique){
    const gate=canTrain(d);
    if(gate.ok)accepted.push({...d,trainingGate:gate});
    else excluded.push({...d,trainingGate:gate});
  }
  return {version:VERSION,accepted,excluded,duplicates:de.duplicates};
}
function confidenceBand(v){
  const n=Number(v)||0;
  return n>=.95?'VERIFIED':n>=.80?'HIGH':n>=.60?'MEDIUM':'LOW';
}
function auditCandidates(candidates=[]){
  const merged=mergeCandidates(candidates),conflicts=detectContradictions(merged);
  return {
    candidates:merged,
    conflicts,
    summary:{
      total:merged.length,
      verified:merged.filter(x=>confidenceBand(x.confidence)==='VERIFIED').length,
      high:merged.filter(x=>confidenceBand(x.confidence)==='HIGH').length,
      medium:merged.filter(x=>confidenceBand(x.confidence)==='MEDIUM').length,
      low:merged.filter(x=>confidenceBand(x.confidence)==='LOW').length,
      conflicts:conflicts.length
    }
  };
}
function promoteable(candidate,conflicts=[]){
  const conflictKeys=new Set(conflicts.map(x=>x.key));
  const patternKey=[candidate.ruleType,candidate.scope,stableJson(candidate.pattern||{})].join('\u0001');
  if(conflictKeys.has(patternKey))return {ok:false,reason:'CONFLICT'};
  if((candidate.evidenceCount||0)<1)return {ok:false,reason:'NO_EVIDENCE'};
  if(Number(candidate.confidence||0)<.80)return {ok:false,reason:'LOW_CONFIDENCE'};
  return {ok:true,reason:'PROMOTABLE'};
}
global.WRITE_HISTORICAL_TRAINING_V81={
  VERSION,TRAINABLE,NON_TRAINABLE,
  contentFingerprint,normalizeStatus,canTrain,deduplicateDocuments,
  mergeCandidates,detectContradictions,trainingPlan,confidenceBand,
  auditCandidates,promoteable
};
})(window);
