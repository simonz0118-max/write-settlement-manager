/* WRITE V8.7 — Verified explanation resolver
 * Explanations are data-driven, never inferred from a mismatch alone.
 */
(function(g){'use strict';const VERSION='8.7.0';
function resolverFromRegistry(registry=[]){
  return ctx=>{
    for(const r of registry||[]){
      if(r.enabled===false)continue;
      if(r.key&&r.key!==ctx.key)continue;
      if(r.batchId&&r.batchId!==ctx.batchId)continue;
      if(Number(r.sourceQuantity)!==Number(ctx.sourceQuantity))continue;
      if(Number(r.factQuantity)!==Number(ctx.factQuantity))continue;
      if(r.verified!==true||r.explainsFullDifference!==true)continue;
      return{verified:true,explainsFullDifference:true,code:r.code||'VERIFIED_HISTORICAL_EXPLANATION',evidenceRef:r.evidenceRef||null};
    }
    return null;
  };
}
g.WRITE_EXPLANATION_RESOLVER_V87={VERSION,resolverFromRegistry};
})(window);