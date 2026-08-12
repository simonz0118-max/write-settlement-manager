/* WRITE V10 production exports: one fixed-layout FACT XLSX + matching PDF + audit JSON. */
(function(g){'use strict';const VERSION='10.0.3';
function blobDownload(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
async function goldenFactForRows(workbookName,rows){if(typeof g.buildGeneratedFactWorkbook!=='function')throw new Error('GOLDEN_FACT_BUILDER_UNAVAILABLE');const oldGeneric=g.generatedGenericFactRowsForWorkbook,oldGenerated=g.generatedFactRowsForWorkbook;try{g.generatedGenericFactRowsForWorkbook=()=>rows;g.generatedFactRowsForWorkbook=g.generatedGenericFactRowsForWorkbook;return await g.buildGeneratedFactWorkbook(workbookName)}finally{g.generatedGenericFactRowsForWorkbook=oldGeneric;g.generatedFactRowsForWorkbook=oldGenerated}}
async function artifactsForWorkbook(workbookName){
 const x=g.WRITE_V10_PRODUCTION_ADAPTER.v10ForWorkbook(workbookName),rows=x.rows,safe=String(workbookName||'ORDERS').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_.-]+/gu,'_').slice(0,80)||'ORDERS';
 const xlsx=await goldenFactForRows(workbookName,rows),pdf=await g.WRITE_V10_PDF.buildPdfBlob(rows,{parcelCount:x.parcelCount,parcelNeedsReview:x.audit.conflictOrderIds.length>0});
 const audit={...x.audit,source:workbookName,generatedAt:new Date().toISOString(),invoiceCount:1,grouping:'invoiceEntity + origin + country + currency + taxRegime + role + complete accounting configuration',originsMerged:false,pricing:'blank-red-human-entry',rows:x.rows};
 return[{xlsx,pdf,audit,baseName:`WRITE_${safe}`,anomalies:{conflictOrderIds:x.audit.conflictOrderIds,splitOrderIds:x.audit.splitOrderIds,missingSourceItems:x.audit.missingSourceItems}}]
}
async function downloadWorkbookArtifacts(workbookName){const arr=await artifactsForWorkbook(workbookName);for(const a of arr){blobDownload(a.xlsx,`${a.baseName}_FACT.xlsx`);blobDownload(a.pdf,`${a.baseName}_FACT.pdf`);blobDownload(new Blob([JSON.stringify(a.audit,null,2)],{type:'application/json'}),`${a.baseName}_audit.json`)}return arr.length}
g.WRITE_V10_EXPORT={VERSION,goldenFactForRows,artifactsForWorkbook,downloadWorkbookArtifacts};
})(window);
