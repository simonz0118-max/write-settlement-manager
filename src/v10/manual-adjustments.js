/* WRITE V10 — MANUAL_ONLY controlled entry. Never auto-generated. */
(function(g){'use strict';const VERSION='10.0.0-rc1';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
function validate(x={}){
 const errors=[];if(!clean(x.description))errors.push('DESCRIPTION_REQUIRED');if(!clean(x.reason))errors.push('REASON_REQUIRED');if(!clean(x.approvedBy))errors.push('APPROVER_REQUIRED');if(!clean(x.currency))errors.push('CURRENCY_REQUIRED');if(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0)errors.push('POSITIVE_QUANTITY_REQUIRED');
 if(x.unitTotal!==null&&x.unitTotal!==undefined&&!Number.isFinite(Number(x.unitTotal)))errors.push('UNIT_TOTAL_INVALID');return{ok:errors.length===0,errors};
}
function toInvoiceLine(x={}){const v=validate(x);if(!v.ok)throw new Error(`INVALID_MANUAL_ONLY:${v.errors.join(',')}`);const q=Number(x.quantity),u=x.unitTotal===null||x.unitTotal===undefined?null:Number(x.unitTotal),id=`MANUAL:${Date.now()}:${Math.random().toString(36).slice(2)}`;return{lineKey:id,invoiceEntity:clean(x.invoiceEntity)||'DEFAULT',origin:clean(x.origin).toUpperCase()||'UNKNOWN',destinationCountry:clean(x.destinationCountry).toUpperCase()||'GLOBAL',currency:clean(x.currency).toUpperCase(),taxRegime:clean(x.taxRegime)||'UNSPECIFIED',role:'MANUAL_ONLY',configurationFingerprint:`MANUAL:${clean(x.description)}`,description:clean(x.description),quantity:q,unitTotal:u,amount:u===null?null:Math.round((u*q+Number.EPSILON)*100)/100,priceSource:'MANUAL_APPROVED',priceVersion:clean(x.ruleVersion)||'manual-1',priceTrace:[{approvedBy:clean(x.approvedBy),reason:clean(x.reason),sourceDocument:clean(x.sourceDocument),createdAt:new Date().toISOString()}],atomIds:[],sourceOrderKeys:[],sourceItemKeys:[],needsReview:false,manualOnly:true};}
g.WRITE_V10_MANUAL={VERSION,validate,toInvoiceLine};
})(window);
