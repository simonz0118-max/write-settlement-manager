/* WRITE V10 — Invoice Compiler: FACT XLSX data bridge + PDF + audit JSON */
(function(g){'use strict';const VERSION='10.0.0-rc1';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const money=n=>Number.isFinite(Number(n))?Number(n):null;
function groupByInvoice(lines=[]){
 const m=new Map();
 for(const l of lines){
   const k=[l.invoiceEntity,l.origin,l.destinationCountry,l.currency,l.taxRegime].map(clean).join('\u0001');
   if(!m.has(k))m.set(k,{invoiceKey:k,invoiceEntity:l.invoiceEntity,origin:l.origin,destinationCountry:l.destinationCountry,currency:l.currency,taxRegime:l.taxRegime,lines:[]});
   m.get(k).lines.push(l);
 }
 return [...m.values()];
}
function factRowsFromIR(ir={}){
 return (ir.invoiceLines||[]).map((l,i)=>({
   no:i+1,origin:l.origin,country:l.destinationCountry,currency:l.currency,role:l.role,
   description:l.description,quantity:l.quantity,cogs:l.cogs??null,shipping:l.shipping??null,handling:l.handling??(String(l.configurationFingerprint||'').includes('HANDLING_FEE')?(l.unitTotal??null):null),
   unitTotal:l.unitTotal??null,amount:l.amount??null,needsReview:!!l.needsReview,
   sourceOrderKeys:l.sourceOrderKeys||[],sourceItemKeys:l.sourceItemKeys||[],atomIds:l.atomIds||[],
   calculationTrace:l.priceTrace||null,priceVersion:l.priceVersion||null,engine:'V10_IR'
 }));
}
function auditJSON(ir={},meta={}){
 const payload={schema:'WRITE_AUDIT_V10',version:VERSION,generatedAt:new Date().toISOString(),
   source:meta.source||null,pricingMode:meta.pricingMode||'STRICT_FORMAL',
   audit:ir.audit||null,invoiceLines:(ir.invoiceLines||[]).map(l=>({
    lineKey:l.lineKey,invoiceEntity:l.invoiceEntity,origin:l.origin,destinationCountry:l.destinationCountry,currency:l.currency,taxRegime:l.taxRegime,
    role:l.role,configurationFingerprint:l.configurationFingerprint,description:l.description,quantity:l.quantity,unitTotal:l.unitTotal,amount:l.amount,
    priceSource:l.priceSource,priceVersion:l.priceVersion,priceTrace:l.priceTrace,
    atomIds:l.atomIds,sourceOrderKeys:l.sourceOrderKeys,sourceItemKeys:l.sourceItemKeys,needsReview:l.needsReview
   })),freeAtoms:ir.freeAtoms||[]};
 return payload;
}
function anomalyReport(ir={}){
 const issues=[];
 for(const f of ir.audit?.failures||[])issues.push({severity:'P0',code:f,message:`五重守恒失败：${f}`});
 for(const l of ir.invoiceLines||[]){
   if(l.unitTotal===null)issues.push({severity:'P1',code:'PRICE_PENDING',lineKey:l.lineKey,message:`缺少可信价格：${l.description} [${l.currency}]`});
   if(l.needsReview)issues.push({severity:'P2',code:'CLASSIFICATION_REVIEW',lineKey:l.lineKey,message:`分类/描述低置信度：${l.description}`});
 }
 return{version:VERSION,count:issues.length,issues};
}
function pdfEscape(s=''){return String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E\xA0-\xFF]/g,'?')}
function buildPdfBytes(invoice={},opts={}){
 // Minimal PDF 1.4, standard Helvetica/Helvetica-Bold, no external network/dependency.
 const lines=invoice.lines||[],cur=clean(invoice.currency)||'EUR';
 const total=lines.reduce((s,l)=>s+(money(l.amount)||0),0);
 const content=[];
 let y=800;
 const t=(x,size,text,bold=false)=>{content.push(`BT /F${bold?2:1} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`);y-=size+5};
 t(50,18,opts.title||'FACTURE COMMERCIALE / COMMERCIAL INVOICE',true);
 t(50,10,`Entity: ${clean(invoice.invoiceEntity)||'DEFAULT'}`);
 t(50,10,`Origin: ${clean(invoice.origin)}   Destination: ${clean(invoice.destinationCountry)}`);
 t(50,10,`Currency: ${cur}   Tax regime: ${clean(invoice.taxRegime)}`);
 y-=8;t(50,9,'Description                                      Qty       Unit       Amount',true);
 y-=4;
 for(const l of lines){
   if(y<80){break}
   const d=clean(l.description).slice(0,48),q=Number(l.quantity||0),u=l.unitTotal===null?'PENDING':Number(l.unitTotal).toFixed(2),a=l.amount===null?'PENDING':Number(l.amount).toFixed(2);
   t(50,9,`${d.padEnd(49)} ${String(q).padStart(5)} ${String(u).padStart(10)} ${String(a).padStart(12)}`);
 }
 y-=5;t(50,11,`TOTAL ${cur}: ${total.toFixed(2)}`,true);
 if(lines.some(l=>l.unitTotal===null)){t(50,8,'DRAFT - PRICE PENDING / PRIX A CONFIRMER',true)}
 const stream=content.join('\n');
 const objs=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
 ];
 let pdf='%PDF-1.4\n',offs=[0];
 objs.forEach((o,i)=>{offs[i+1]=new TextEncoder().encode(pdf).length;pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const xref=new TextEncoder().encode(pdf).length;
 pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
 for(let i=1;i<=objs.length;i++)pdf+=`${String(offs[i]).padStart(10,'0')} 00000 n \n`;
 pdf+=`trailer << /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new TextEncoder().encode(pdf);
}
function buildPdfSet(ir={},opts={}){
 return groupByInvoice(ir.invoiceLines||[]).map(inv=>({invoiceKey:inv.invoiceKey,fileName:`FACTURE_${clean(inv.origin)||'UNK'}_${clean(inv.destinationCountry)||'GLOBAL'}_${clean(inv.currency)||'UNK'}.pdf`.replace(/[^\w.-]+/g,'_'),bytes:buildPdfBytes(inv,opts),invoice:inv}));
}
function strictFormalStatus(ir={}){
 const pending=(ir.invoiceLines||[]).filter(l=>l.unitTotal===null);
 return{formal:!!ir.audit?.hardPass&&pending.length===0,pendingLines:pending.length,reason:!ir.audit?.hardPass?'CONSERVATION_FAILED':pending.length?'PRICE_PENDING':'READY'};
}
g.WRITE_V10_COMPILER={VERSION,groupByInvoice,factRowsFromIR,auditJSON,anomalyReport,buildPdfBytes,buildPdfSet,strictFormalStatus};
})(window);