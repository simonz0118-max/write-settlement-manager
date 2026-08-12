/* WRITE V10.1.0 — single XLSX delivery */
(function(g){'use strict';const VERSION='10.1.0';
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
async function goldenFactForRows(workbookName,rows){const a=g.generatedGenericFactRowsForWorkbook,b=g.generatedFactRowsForWorkbook;try{g.generatedGenericFactRowsForWorkbook=()=>rows;g.generatedFactRowsForWorkbook=g.generatedGenericFactRowsForWorkbook;return await g.buildGeneratedFactWorkbook(workbookName)}finally{g.generatedGenericFactRowsForWorkbook=a;g.generatedFactRowsForWorkbook=b}}
function accountingReport(){const r=g.buildAccountingReport?.();if(!r?.blob?.size)throw new Error('ACCOUNTING_REPORT_EMPTY');return r}
const safe=n=>String(n||'ORDERS').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_.-]+/gu,'_').slice(0,90);
async function buildUnified(workbookName){const x=g.WRITE_V10_PRODUCTION_ADAPTER.v10ForWorkbook(workbookName),fact=await goldenFactForRows(workbookName,x.rows),report=accountingReport(),blob=await g.WRITE_V101_WORKBOOK.mergeFactAndAccounting(fact,report.blob,x,workbookName);return{blob,fileName:`WRITE_结算_${safe(workbookName)}_${new Date().toISOString().slice(0,10)}.xlsx`,rows:x.rows.length}}
async function downloadProductionPackage(){const books=g.WRITE_V8_SOURCE_BRIDGE?.()?.sourceWorkbooks||[];if(!books.length)throw new Error('没有可导出的订单工作簿');const files=[];for(const w of books){const r=await buildUnified(w.name);download(r.blob,r.fileName);files.push(r.fileName)}return{workbooks:books.length,files}}
g.WRITE_V10_EXPORT={VERSION,goldenFactForRows,accountingReport,buildUnified,downloadProductionPackage};
})(window);