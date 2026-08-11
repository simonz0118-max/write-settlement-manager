/* WRITE V8.4 — Evidence-First Training Gate
 * Learn only human behavior that can be reproduced from corresponding order source.
 */
(function(g){'use strict';
const VERSION='8.4.0';
const STATUS=Object.freeze({
  EXACT_CLOSED:'EXACT_CLOSED',
  EXPLAINED_CLOSED:'EXPLAINED_CLOSED',
  FACT_ONLY_MANUAL:'FACT_ONLY_MANUAL',
  TEMPLATE_ONLY:'TEMPLATE_ONLY',
  PARTIAL_UNEXPLAINED:'PARTIAL_UNEXPLAINED',
  SOURCE_ONLY:'SOURCE_ONLY'
});

function finite(v){return v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null)}

function classify(example={}){
  const source=finite(example.sourceQuantity);
  const fact=finite(example.factQuantity);
  const matched=!!example.sourceMatched;
  const configClosed=!!example.configurationClosed;
  const explanation=example.explanation||null;

  if(!matched && fact!==null)return {status:STATUS.FACT_ONLY_MANUAL,trainable:false,reason:'FACT_HAS_NO_ORDER_SOURCE'};
  if(example.templateOnly===true)return {status:STATUS.TEMPLATE_ONLY,trainable:false,reason:'NO_SOURCE_OCCURRENCE'};
  if(matched && fact===null)return {status:STATUS.SOURCE_ONLY,trainable:false,reason:'NO_FACT_OBSERVATION'};

  if(matched && source!==null && fact!==null && source===fact && configClosed)
    return {status:STATUS.EXACT_CLOSED,trainable:true,reason:'SOURCE_FACT_EXACT_CLOSED'};

  // A mismatch may be learned only when historical material itself supplies a
  // reproducible rule that fully explains the difference (e.g. verified
  // not-yet-fulfilled rows excluded from that FACT).
  if(matched && explanation?.verified===true && explanation?.explainsFullDifference===true && configClosed)
    return {status:STATUS.EXPLAINED_CLOSED,trainable:true,reason:explanation.code||'VERIFIED_EXPLANATION'};

  return {status:STATUS.PARTIAL_UNEXPLAINED,trainable:false,reason:'DO_NOT_PARTIALLY_LEARN'};
}

function canPromote(rule={}){
  const examples=rule.examples||[];
  if(!examples.length)return {ok:false,reason:'NO_EVIDENCE'};
  const gates=examples.map(classify);
  if(gates.some(x=>!x.trainable))return {ok:false,reason:'CONTAINS_UNRESOLVED_OR_MANUAL_EVIDENCE',gates};
  return {ok:true,reason:'ALL_EVIDENCE_SOURCE_BACKED_AND_CLOSED',gates};
}

g.WRITE_EVIDENCE_GATE_V84={VERSION,STATUS,classify,canPromote};
})(window);
