/* WRITE V8.6 — Historical Batch Scoring
 * Scores each human batch independently and independently per learning domain.
 */
(function(g){'use strict';
const VERSION='8.6.0';
const STATUS=Object.freeze({
  TRAINABLE:'TRAINABLE',
  EXPLAINED:'EXPLAINED',
  REFERENCE_ONLY:'REFERENCE_ONLY',
  REJECTED:'REJECTED'
});
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const known=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
function metric(v){return known(v)?clamp(v):null}
function weighted(entries){
  let num=0,den=0;
  for(const [value,w] of entries){if(known(value)){num+=clamp(value)*w;den+=w}}
  return den?num/den:null;
}
function scoreBatch(e={}){
  const sourceCoverage=metric(e.sourceCoverage);
  const quantityClosure=metric(e.quantityClosure);
  const configurationClosure=metric(e.configurationClosure);
  const traceability=metric(e.traceability);
  const humanConsistency=metric(e.humanConsistency);
  const priceConsistency=metric(e.priceConsistency);
  const sourceBacked=!!e.sourceBacked;
  const unresolved=Number(e.unresolvedCount||0);
  const manualOnly=Number(e.manualOnlyCount||0);
  const corrupt=!!e.corrupt;
  const explained=!!e.verifiedExplanation;
  const observations=Math.max(0,Number(e.observations||0));

  const structural=weighted([[sourceCoverage,30],[quantityClosure,25],[configurationClosure,25],[traceability,20]]);
  const semantic=weighted([[configurationClosure,35],[humanConsistency,35],[traceability,30]]);
  const price=weighted([[priceConsistency,70],[sourceCoverage,15],[traceability,15]]);

  function reject(reason){return{status:STATUS.REJECTED,trainable:false,reason}}
  function ref(reason,score){return{status:STATUS.REFERENCE_ONLY,trainable:false,reason,score}}
  function ok(reason,score){return{status:explained?STATUS.EXPLAINED:STATUS.TRAINABLE,trainable:true,reason,score}}

  let classification;
  if(corrupt)classification=reject('SOURCE_CORRUPT');
  else if(!sourceBacked)classification=ref('NOT_SOURCE_BACKED',semantic);
  else if(unresolved||manualOnly)classification=ref('UNRESOLVED_OR_MANUAL_ONLY_EVIDENCE',semantic);
  else if(![sourceCoverage,configurationClosure,traceability,humanConsistency].every(known))
    classification=ref('INSUFFICIENT_CLASSIFICATION_EVIDENCE',semantic);
  else if(sourceCoverage===1&&configurationClosure===1&&traceability===1&&humanConsistency>=.9)
    classification=ok('CLASSIFICATION_CLOSED_AND_CONSISTENT',semantic);
  else classification=ref('CLASSIFICATION_NOT_CLOSED',semantic);

  let quantity;
  if(corrupt)quantity=reject('SOURCE_CORRUPT');
  else if(!sourceBacked)quantity=ref('NOT_SOURCE_BACKED',structural);
  else if(unresolved&&!explained)quantity=ref('UNEXPLAINED_QUANTITY_DIFFERENCE',structural);
  else if(![sourceCoverage,quantityClosure,traceability].every(known))
    quantity=ref('INSUFFICIENT_QUANTITY_EVIDENCE',structural);
  else if(sourceCoverage===1&&quantityClosure===1&&traceability===1)
    quantity=ok(explained?'VERIFIED_EXPLANATION_FULLY_CLOSES_QUANTITY':'QUANTITY_EXACTLY_CLOSED',structural);
  else quantity=ref('QUANTITY_NOT_CLOSED',structural);

  let priceDecision;
  if(corrupt)priceDecision=reject('SOURCE_CORRUPT');
  else if(!sourceBacked)priceDecision=ref('FACT_PRICE_HAS_NO_ORDER_SOURCE',price);
  else if(manualOnly)priceDecision=ref('MANUAL_ONLY_PRICE_LINE',price);
  else if(!known(priceConsistency)||observations<3)
    priceDecision=ref('INSUFFICIENT_PRICE_EVIDENCE',price);
  else if(priceConsistency>=.9&&sourceCoverage===1)
    priceDecision=ok('SOURCE_BACKED_STABLE_HISTORICAL_PRICE',price);
  else priceDecision=ref('PRICE_NOT_STABLE_OR_NOT_CLOSED',price);

  const overall=weighted([[structural,45],[semantic,35],[price,20]]);
  return {
    version:VERSION,batchId:e.batchId||null,
    metrics:{sourceCoverage,quantityClosure,configurationClosure,traceability,humanConsistency,priceConsistency,structural,semantic,price,overall},
    decisions:{classification,quantity,price:priceDecision},
    flags:{sourceBacked,unresolved,manualOnly,corrupt,verifiedExplanation:explained,observations}
  };
}
function canTrainDomain(score,domain){return score?.decisions?.[domain]?.trainable===true}
g.WRITE_BATCH_SCORER_V86={VERSION,STATUS,scoreBatch,canTrainDomain};
})(window);