/* WRITE V8.5 — Evidence Fingerprint / Dedup */
(function(g){'use strict';const VERSION='8.5.0';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
function normalizedEvidenceKey(e={}){
  if(clean(e.sha256))return`SHA256:${clean(e.sha256).toLowerCase()}`;
  const parts=[e.client,e.invoice,e.batch,e.sourceFile,e.sourceSheet,e.sourceRange].map(x=>clean(x).toLowerCase());
  return`META:${parts.join('|')}`;
}
function dedupe(examples=[]){
  const seen=new Map(),duplicates=[];
  for(const e of examples){
    const k=normalizedEvidenceKey(e);
    if(!seen.has(k))seen.set(k,e);
    else duplicates.push({key:k,kept:seen.get(k),duplicate:e});
  }
  return{version:VERSION,input:examples.length,unique:seen.size,duplicates:duplicates.length,uniqueExamples:[...seen.values()],duplicateDetails:duplicates};
}
function confidenceEvidenceCount(examples=[]){return dedupe(examples).unique}
g.WRITE_EVIDENCE_FINGERPRINT_V85={VERSION,normalizedEvidenceKey,dedupe,confidenceEvidenceCount};
})(window);