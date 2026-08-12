/* WRITE V10.0.5 production export.
 * One click -> one ZIP:
 * - professional accounting settlement XLSX
 * - one Golden FACT XLSX per imported workbook
 * Internal audit JSON is not a user-facing download.
 */
(function(g){'use strict';const VERSION='10.0.6';
function blobDownload(blob,name){if(!(blob instanceof Blob)||!blob.size)throw new Error(`EMPTY_EXPORT:${name}`);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500)}
async function goldenFactForRows(workbookName,rows){if(typeof g.buildGeneratedFactWorkbook!=='function')throw new Error('GOLDEN_FACT_BUILDER_UNAVAILABLE');const oldGeneric=g.generatedGenericFactRowsForWorkbook,oldGenerated=g.generatedFactRowsForWorkbook;try{g.generatedGenericFactRowsForWorkbook=()=>rows;g.generatedFactRowsForWorkbook=g.generatedGenericFactRowsForWorkbook;return await g.buildGeneratedFactWorkbook(workbookName)}finally{g.generatedGenericFactRowsForWorkbook=oldGeneric;g.generatedFactRowsForWorkbook=oldGenerated}}
function accountingReport(){if(typeof g.buildAccountingReport!=='function')throw new Error('ACCOUNTING_REPORT_BUILDER_UNAVAILABLE');const r=g.buildAccountingReport();if(!r?.blob?.size)throw new Error('ACCOUNTING_REPORT_EMPTY');return r}
function safeName(name=''){return String(name||'ORDERS').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_.-]+/gu,'_').slice(0,90)||'ORDERS'}
async function buildProductionZip(){const bridge=g.WRITE_V8_SOURCE_BRIDGE?.(),books=bridge?.sourceWorkbooks||[];if(!books.length)throw new Error('没有可导出的订单工作簿');if(typeof g.zipStoreBlobs!=='function')throw new Error('ZIP_BUILDER_UNAVAILABLE');const report=accountingReport();const entries=[{name:report.fileName||'WRITE_会计结算.xlsx',data:report.blob}];const facts=[];for(const w of books){const x=g.WRITE_V10_PRODUCTION_ADAPTER.v10ForWorkbook(w.name);const fact=await goldenFactForRows(w.name,x.rows);if(!fact?.size)throw new Error(`${w.name}: FACT_EMPTY`);const filename=`FACT_${safeName(w.name)}.xlsx`;entries.push({name:filename,data:fact});facts.push({workbook:w.name,fileName:filename,rows:x.rows.length,parcelCount:x.parcelCount})}const zip=await g.zipStoreBlobs(entries);if(!zip?.size)throw new Error('SETTLEMENT_ZIP_EMPTY');const range=typeof g.currentOrderRangeLabel==='function'?g.currentOrderRangeLabel():'订单';const stamp=typeof g.localDateStamp==='function'?g.localDateStamp():new Date().toISOString().slice(0,10);const fileName=`WRITE_结算交付包_${range}_${stamp}.zip`;return{zip,fileName,accountingFile:entries[0].name,facts}}
async function downloadProductionPackage(){const result=await buildProductionZip();blobDownload(result.zip,result.fileName);return result}
g.WRITE_V10_EXPORT={VERSION,goldenFactForRows,accountingReport,buildProductionZip,downloadProductionPackage};
})(window);
