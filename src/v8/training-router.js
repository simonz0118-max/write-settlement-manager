/* WRITE V8.6 — Domain-specific training router */
(function(g){'use strict';const VERSION='8.6.0';
function route(batchScore={},payload={}){
 const out={version:VERSION,batchId:batchScore.batchId||payload.batchId||null,classification:[],quantity:[],price:[],reference:[]};
 for(const example of payload.examples||[]){
   const domain=example.domain;
   if(!['classification','quantity','price'].includes(domain)){out.reference.push({...example,reason:'UNKNOWN_DOMAIN'});continue}
   if(g.WRITE_BATCH_SCORER_V86.canTrainDomain(batchScore,domain))out[domain].push(example);
   else out.reference.push({...example,reason:batchScore?.decisions?.[domain]?.reason||'DOMAIN_NOT_TRAINABLE'});
 }
 return out;
}
g.WRITE_TRAINING_ROUTER_V86={VERSION,route};
})(window);