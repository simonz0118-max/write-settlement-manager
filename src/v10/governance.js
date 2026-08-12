/* WRITE V10 — Learning Governance */
(function(g){'use strict';const VERSION='10.0.0-rc1';
const STAGE=Object.freeze({SHADOW:'SHADOW',CANARY:'CANARY',PRODUCTION:'PRODUCTION',ROLLED_BACK:'ROLLED_BACK'});
function ruleEnvelope(rule={},meta={}){
 return{...rule,governance:{stage:meta.stage||STAGE.SHADOW,source:meta.source||'UNKNOWN',scope:meta.scope||rule.scope||'UNSPECIFIED',
 effectiveFrom:meta.effectiveFrom||null,effectiveTo:meta.effectiveTo||null,confidence:Number(meta.confidence??rule.confidence??0),
 version:Number(meta.version||1),rollbackVersion:meta.rollbackVersion||null,datasetFingerprints:meta.datasetFingerprints||[],createdAt:Date.now()}};
}
function eligibleForAutoLearning(evidence={}){
 if(evidence.partial===true)return{eligible:false,reason:'PARTIAL_FACT_FORBIDDEN'};
 if(!evidence.sourceClosed)return{eligible:false,reason:'SOURCE_CLOSURE_REQUIRED'};
 return{eligible:true,reason:'SOURCE_CLOSED'};
}
function eligibleForPriceLearning(evidence={}){
 const base=eligibleForAutoLearning(evidence);if(!base.eligible)return base;
 if(!evidence.humanConfirmed)return{eligible:false,reason:'HUMAN_CONFIRMATION_REQUIRED'};
 if(!evidence.currency)return{eligible:false,reason:'CURRENCY_REQUIRED'};
 if(!evidence.configurationFingerprint)return{eligible:false,reason:'CONFIG_FINGERPRINT_REQUIRED'};
 return{eligible:true,reason:'PRICE_EVIDENCE_CLOSED'};
}
function evaluateRegression(metrics={},baseline={}){
 const keys=['semanticAccuracy','paidLeakRate','freeMischargeRate','currencyLeakRate','traceability'];
 const drops=keys.filter(k=>Number.isFinite(metrics[k])&&Number.isFinite(baseline[k])&&metrics[k]<baseline[k]);
 const hardBad=(metrics.paidLeakRate??0)>0||(metrics.freeMischargeRate??0)>0||(metrics.currencyLeakRate??0)>0||(metrics.fivefoldPass===false);
 return{rollback:hardBad||drops.length>0,reasons:[...(hardBad?['HARD_ACCOUNTING_GATE']:[]),...drops.map(k=>`REGRESSION:${k}`)]};
}
g.WRITE_V10_GOVERNANCE={VERSION,STAGE,ruleEnvelope,eligibleForAutoLearning,eligibleForPriceLearning,evaluateRegression};
})(window);