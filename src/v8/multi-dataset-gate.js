/* WRITE V8.5 — Multi-Dataset Golden Gate */
(function(g){'use strict';const VERSION='8.5.0';
const REQUIRED=['THOMAS_CAMOUFLAGE_1001_1162','YD_ARCHIVE_MULTI_FAMILY','PENCIL_WRITE_STORE','SOAP_THIBAULT_HISTORY'];
function evaluate(results={}){
 const datasets={};let all=true;
 for(const id of REQUIRED){
   const r=results[id]||{};
   const pass=r.pass===true;
   datasets[id]={pass,checks:r.checks||{},failures:r.failures||[]};
   if(!pass)all=false;
 }
 const zeroLoss=results.zeroLoss?.pass===true;
 const classification=results.classification?.pass===true;
 const trace=results.trace?.pass===true;
 const evidenceDedup=results.evidenceDedup?.pass===true;
 const regression=all&&zeroLoss&&classification&&trace&&evidenceDedup;
 return{version:VERSION,datasets,zeroLoss,classification,trace,evidenceDedup,crossDatasetRegression:regression,
   takeoverCandidate:regression,
   formalFactTakeover:false};
}
function assertPass(report){
 if(!report?.crossDatasetRegression){
   const e=new Error('V8.5_MULTI_DATASET_GATE_FAILED');e.code='V8.5_MULTI_DATASET_GATE_FAILED';e.report=report;throw e;
 }
 return true;
}
g.WRITE_MULTI_DATASET_GATE_V85={VERSION,REQUIRED,evaluate,assertPass};
})(window);