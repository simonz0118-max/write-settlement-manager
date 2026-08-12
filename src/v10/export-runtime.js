/* WRITE V10.0.4 export hotfix.
 * Production default:
 *   1) professional accounting workbook
 *   2) Golden FACT XLSX (template-faithful)
 * PDF raster renderer and audit JSON are no longer downloaded by default.
 * They remain opt-in diagnostics only.
 */
(function(g){'use strict';const VERSION='10.0.4';

function blobDownload(blob,name){
  if(!(blob instanceof Blob)||!blob.size)throw new Error(`EMPTY_EXPORT:${name}`);
  const a=document.createElement('a');
  const url=URL.createObjectURL(blob);
  a.href=url;a.download=name;a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
}

async function goldenFactForRows(workbookName,rows){
  if(typeof g.buildGeneratedFactWorkbook!=='function')throw new Error('GOLDEN_FACT_BUILDER_UNAVAILABLE');
  const oldGeneric=g.generatedGenericFactRowsForWorkbook,oldGenerated=g.generatedFactRowsForWorkbook;
  try{
    g.generatedGenericFactRowsForWorkbook=()=>rows;
    g.generatedFactRowsForWorkbook=g.generatedGenericFactRowsForWorkbook;
    return await g.buildGeneratedFactWorkbook(workbookName);
  }finally{
    g.generatedGenericFactRowsForWorkbook=oldGeneric;
    g.generatedFactRowsForWorkbook=oldGenerated;
  }
}

function accountingReport(){
  if(typeof g.buildAccountingReport!=='function')throw new Error('ACCOUNTING_REPORT_BUILDER_UNAVAILABLE');
  const r=g.buildAccountingReport();
  if(!r?.blob?.size)throw new Error('ACCOUNTING_REPORT_EMPTY');
  return r;
}

async function artifactsForWorkbook(workbookName,options={}){
  const x=g.WRITE_V10_PRODUCTION_ADAPTER.v10ForWorkbook(workbookName);
  const rows=x.rows;
  const safe=String(workbookName||'ORDERS')
    .replace(/\.[^.]+$/,'')
    .replace(/[^\p{L}\p{N}_.-]+/gu,'_')
    .slice(0,80)||'ORDERS';

  const xlsx=await goldenFactForRows(workbookName,rows);
  let pdf=null;
  if(options.includePdf===true){
    if(!g.WRITE_V10_PDF?.buildPdfBlob)throw new Error('PDF_RENDERER_UNAVAILABLE');
    pdf=await g.WRITE_V10_PDF.buildPdfBlob(rows,{
      parcelCount:x.parcelCount,
      parcelNeedsReview:x.audit.conflictOrderIds.length>0
    });
  }

  const audit={
    ...x.audit,
    source:workbookName,
    generatedAt:new Date().toISOString(),
    invoiceCount:1,
    grouping:'invoiceEntity + origin + country + currency + taxRegime + role + complete accounting configuration',
    originsMerged:false,
    pricing:'blank-red-human-entry',
    rows:x.rows
  };

  return [{
    xlsx,pdf,audit,
    baseName:`WRITE_${safe}`,
    anomalies:{
      conflictOrderIds:x.audit.conflictOrderIds,
      splitOrderIds:x.audit.splitOrderIds,
      missingSourceItems:x.audit.missingSourceItems
    }
  }];
}

async function downloadWorkbookArtifacts(workbookName,options={}){
  const arr=await artifactsForWorkbook(workbookName,options);
  for(const a of arr){
    blobDownload(a.xlsx,`${a.baseName}_FACT.xlsx`);
    if(options.includePdf===true && a.pdf)blobDownload(a.pdf,`${a.baseName}_FACT.pdf`);
    if(options.includeAudit===true){
      blobDownload(
        new Blob([JSON.stringify(a.audit,null,2)],{type:'application/json'}),
        `${a.baseName}_audit.json`
      );
    }
  }
  return arr.length;
}

async function downloadProductionPackage(options={}){
  const bridge=g.WRITE_V8_SOURCE_BRIDGE?.();
  const books=bridge?.sourceWorkbooks||[];
  if(!books.length)throw new Error('没有可导出的订单工作簿');

  const report=accountingReport();
  blobDownload(report.blob,report.fileName||'WRITE_会计结算.xlsx');

  let count=0;
  for(const w of books){
    count+=await downloadWorkbookArtifacts(w.name,{
      includePdf:options.includePdf===true,
      includeAudit:options.includeAudit===true
    });
  }

  return {
    invoiceCount:count,
    accountingFile:report.fileName||'WRITE_会计结算.xlsx',
    pdfIncluded:options.includePdf===true,
    auditIncluded:options.includeAudit===true
  };
}

g.WRITE_V10_EXPORT={
  VERSION,
  goldenFactForRows,
  accountingReport,
  artifactsForWorkbook,
  downloadWorkbookArtifacts,
  downloadProductionPackage
};
})(window);
