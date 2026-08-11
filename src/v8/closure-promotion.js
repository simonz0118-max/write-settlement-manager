/* WRITE V8.7 — Closure-to-training promotion controller */
(function(g){'use strict';const VERSION='8.7.0';
function evaluate(report,meta={}){
  const evidence=g.WRITE_CLOSURE_ANALYZER_V87.toBatchEvidence(report,meta);
  const score=g.WRITE_BATCH_SCORER_V86.scoreBatch(evidence);
  return{version:VERSION,evidence,score,promotions:{
    classification:score.decisions.classification.trainable===true,
    quantity:score.decisions.quantity.trainable===true,
    price:score.decisions.price.trainable===true
  }};
}
function route(report,meta,payload){
  const x=evaluate(report,meta);
  return{...x,training:g.WRITE_TRAINING_ROUTER_V86.route(x.score,payload||{})};
}
g.WRITE_CLOSURE_PROMOTION_V87={VERSION,evaluate,route};
})(window);