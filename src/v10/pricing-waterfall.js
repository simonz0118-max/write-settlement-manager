/* WRITE V10 Stage D foundation — Pricing Waterfall */
(function(g){'use strict';const VERSION='10.0.0-a1',MODE=Object.freeze({STRICT_FORMAL:'STRICT_FORMAL',ALWAYS_ISSUE:'ALWAYS_ISSUE'});
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim(),norm=v=>clean(v).toUpperCase();
function nowTs(){return Date.now()}
function valid(rule,ctx,ts=nowTs()){
 if(!rule)return false;
 if(rule.effectiveFrom&&ts<new Date(rule.effectiveFrom).getTime())return false;
 if(rule.effectiveTo&&ts>new Date(rule.effectiveTo).getTime())return false;
 if(rule.currency&&norm(rule.currency)!==norm(ctx.currency))return false;
 if(rule.origin&&norm(rule.origin)!==norm(ctx.origin))return false;
 if(rule.destinationCountry&&norm(rule.destinationCountry)!==norm(ctx.destinationCountry))return false;
 if(rule.invoiceEntity&&clean(rule.invoiceEntity)!==clean(ctx.invoiceEntity))return false;
 return true;
}
function exactMatch(rule,line){
 if(!valid(rule,line))return false;
 if(rule.configurationFingerprint&&clean(rule.configurationFingerprint)!==clean(line.configurationFingerprint))return false;
 if(rule.role&&norm(rule.role)!==norm(line.role))return false;
 return true;
}
function evaluateFormula(rule,line){
 if(typeof rule.calculate==='function')return Number(rule.calculate(line));
 if(Number.isFinite(Number(rule.unitTotal)))return Number(rule.unitTotal);
 return null;
}
function resolve(line={},catalog={},mode=MODE.STRICT_FORMAL){
 const trace=[];
 const layers=[
  ['CURRENT_CONTRACT',catalog.currentContracts||[]],
  ['HISTORICAL_CONFIRMED',catalog.historicalConfirmed||[]],
  ['APPROVED_FAMILY_FORMULA',catalog.familyFormulas||[]],
  ['APPROVED_SHIPPING_FORMULA',catalog.shippingFormulas||[]],
  ['APPROVED_TAX_HANDLING',catalog.taxHandlingRules||[]]
 ];
 for(const [layer,rules] of layers){
   for(const rule of rules){
     if(!exactMatch(rule,line))continue;
     const unitTotal=evaluateFormula(rule,line);
     trace.push({layer,ruleId:rule.ruleId||null,matched:true});
     if(Number.isFinite(unitTotal))return{status:'PRICED',unitTotal,source:layer,ruleId:rule.ruleId||null,version:rule.version||1,currency:line.currency,calculationTrace:trace,effectiveFrom:rule.effectiveFrom||null,effectiveTo:rule.effectiveTo||null};
   }
 }
 if(mode===MODE.ALWAYS_ISSUE){
   const fallbacks=(catalog.unknownFallbacks||[]).filter(r=>valid(r,line)&&r.approved===true);
   for(const rule of fallbacks){
     const unitTotal=evaluateFormula(rule,line);
     trace.push({layer:'APPROVED_UNKNOWN_FALLBACK',ruleId:rule.ruleId||null,matched:true});
     if(Number.isFinite(unitTotal)){
       const max=Number.isFinite(Number(rule.maxUnitTotal))?Number(rule.maxUnitTotal):Infinity;
       if(unitTotal<0||unitTotal>max)continue;
       return{status:'PRICED_FALLBACK',unitTotal,source:'APPROVED_UNKNOWN_FALLBACK',ruleId:rule.ruleId||null,version:rule.version||1,currency:line.currency,calculationTrace:trace};
     }
   }
   return{status:'BLOCKED_NO_APPROVED_FALLBACK',unitTotal:null,currency:line.currency,calculationTrace:trace};
 }
 return{status:'PRICE_PENDING',unitTotal:null,currency:line.currency,calculationTrace:trace};
}
g.WRITE_V10_PRICING={VERSION,MODE,valid,exactMatch,resolve};
})(window);