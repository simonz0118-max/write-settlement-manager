/* WRITE V8.7 — Automatic Historical Closure Analyzer
 * Converts historical Order↔FACT pairs into evidence states without guessing.
 */
(function(g){'use strict';
const VERSION='8.7.0';
const STATE=Object.freeze({
  EXACT_CLOSED:'EXACT_CLOSED',
  EXPLAINED_CLOSED:'EXPLAINED_CLOSED',
  TEMPLATE_ONLY:'TEMPLATE_ONLY',
  FACT_ONLY_MANUAL:'FACT_ONLY_MANUAL',
  PARTIAL_UNEXPLAINED:'PARTIAL_UNEXPLAINED',
  SOURCE_ONLY:'SOURCE_ONLY'
});
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
function canon(v=''){return clean(v).toLowerCase().replace(/\s*\+\s*/g,' + ').replace(/\s*\/\s*/g,' / ')}

function sourceKey(row={}){
  return [
    clean(row.origin||'UNKNOWN').toUpperCase(),
    clean(row.country||'GLOBAL').toUpperCase(),
    canon(row.configuration||row.description||'')
  ].join('\u0001');
}
function factKey(row={}){
  return [
    clean(row.origin||'UNKNOWN').toUpperCase(),
    clean(row.country||'GLOBAL').toUpperCase(),
    canon(row.configuration||row.description||'')
  ].join('\u0001');
}

function indexRows(rows=[],keyFn){
  const map=new Map();
  rows.forEach((r,i)=>{
    const k=keyFn(r);let a=map.get(k);if(!a){a=[];map.set(k,a)}
    a.push({...r,__index:i});
  });
  return map;
}

function analyzerOptions(options={}){
  return {
    allowVerifiedExplanation:options.allowVerifiedExplanation!==false,
    explanationResolver:typeof options.explanationResolver==='function'?options.explanationResolver:null
  };
}

function analyze(sourceRows=[],factRows=[],options={}){
  const o=analyzerOptions(options),S=indexRows(sourceRows,sourceKey),F=indexRows(factRows,factKey);
  const keys=new Set([...S.keys(),...F.keys()]);
  const findings=[];
  for(const k of keys){
    const src=S.get(k)||[], fact=F.get(k)||[];
    const sourceQuantity=src.reduce((a,r)=>a+(num(r.quantity)||0),0);
    const factObserved=fact.filter(r=>num(r.quantity)!==null);
    const factQuantity=factObserved.reduce((a,r)=>a+(num(r.quantity)||0),0);
    const templateRows=fact.filter(r=>num(r.quantity)===null);
    const sourceOrderKeys=[...new Set(src.flatMap(r=>r.sourceOrderKeys||[]).map(clean).filter(Boolean))];

    let state,reason,explanation=null;
    if(!src.length && factObserved.length){
      state=STATE.FACT_ONLY_MANUAL;reason='FACT_HAS_NO_MATCHING_ORDER_CONFIGURATION';
    }else if(!src.length && templateRows.length && !factObserved.length){
      state=STATE.TEMPLATE_ONLY;reason='FACT_TEMPLATE_WITHOUT_SOURCE_OCCURRENCE';
    }else if(src.length && !fact.length){
      state=STATE.SOURCE_ONLY;reason='SOURCE_CONFIGURATION_NOT_PRESENT_IN_FACT';
    }else if(src.length && factObserved.length && sourceQuantity===factQuantity){
      state=STATE.EXACT_CLOSED;reason='SOURCE_AND_FACT_QUANTITY_EXACT';
    }else if(src.length && factObserved.length){
      if(o.allowVerifiedExplanation&&o.explanationResolver){
        explanation=o.explanationResolver({
          key:k,sourceRows:src,factRows:fact,
          sourceQuantity,factQuantity,difference:factQuantity-sourceQuantity
        })||null;
      }
      if(explanation?.verified===true&&explanation?.explainsFullDifference===true){
        state=STATE.EXPLAINED_CLOSED;reason=explanation.code||'VERIFIED_EXPLANATION';
      }else{
        state=STATE.PARTIAL_UNEXPLAINED;reason='QUANTITY_OR_CONFIGURATION_NOT_CLOSED';
      }
    }else{
      state=STATE.PARTIAL_UNEXPLAINED;reason='UNRESOLVED_CONFIGURATION_STATE';
    }
    findings.push({
      key:k,state,reason,sourceQuantity,
      factQuantity:factObserved.length?factQuantity:null,
      sourceRows:src.length,factRows:fact.length,templateRows:templateRows.length,
      sourceOrderKeys,explanation
    });
  }
  const counts={};
  for(const x of findings)counts[x.state]=(counts[x.state]||0)+1;
  const trainable=findings.filter(x=>x.state===STATE.EXACT_CLOSED||x.state===STATE.EXPLAINED_CLOSED);
  const unresolved=findings.filter(x=>x.state===STATE.PARTIAL_UNEXPLAINED);
  return {
    version:VERSION,
    findings,counts,
    sourceConfigurations:S.size,
    factConfigurations:F.size,
    trainableConfigurations:trainable.length,
    unresolvedConfigurations:unresolved.length,
    exactClosureRate:S.size?findings.filter(x=>x.state===STATE.EXACT_CLOSED).length/S.size:1,
    safeForAutomaticPromotion:unresolved.length===0
  };
}

function toBatchEvidence(report={},meta={}){
  const f=report.findings||[];
  const exact=f.filter(x=>x.state===STATE.EXACT_CLOSED).length;
  const explained=f.filter(x=>x.state===STATE.EXPLAINED_CLOSED).length;
  const unresolved=f.filter(x=>x.state===STATE.PARTIAL_UNEXPLAINED).length;
  const manual=f.filter(x=>x.state===STATE.FACT_ONLY_MANUAL).length;
  const sourceCount=report.sourceConfigurations||0;
  const closed=exact+explained;
  const sourceBacked=sourceCount>0;
  const ratio=sourceCount?closed/sourceCount:0;
  return {
    batchId:meta.batchId||null,
    sourceBacked,
    sourceCoverage:sourceCount?Math.min(1,(sourceCount-f.filter(x=>x.state===STATE.SOURCE_ONLY).length)/sourceCount):0,
    quantityClosure:ratio,
    configurationClosure:ratio,
    traceability:meta.traceability??(sourceBacked?1:null),
    humanConsistency:meta.humanConsistency??(sourceBacked?ratio:null),
    priceConsistency:meta.priceConsistency??null,
    unresolvedCount:unresolved,
    manualOnlyCount:manual,
    verifiedExplanation:explained>0&&unresolved===0,
    observations:meta.observations??closed
  };
}

g.WRITE_CLOSURE_ANALYZER_V87={VERSION,STATE,sourceKey,factKey,analyze,toBatchEvidence};
})(window);