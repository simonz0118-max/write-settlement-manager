/* WRITE V10 Shadow Runtime — V9 remains formal production */
(function(g){'use strict';let last=null;
function run(){
 try{
  const b=g.WRITE_V8_SOURCE_BRIDGE?.();if(!b?.orders?.length)return null;
  const canonical=g.WRITE_V10_CANONICAL.canonicalizeAll(b.orders);
  const ir=g.WRITE_V10_ACCOUNTING_IR.buildIR(canonical.map(o=>({
    ...o,recordKey:o.fulfillmentRecordId,country:o.destinationCountry,
    lineItems:o.sourceItems.map(x=>({productName:x.productName,sku:x.sku,quantity:x.quantity,sourceItemKey:x.sourceItemKey,currency:o.currency}))
  })));
  last={version:'10.0.0-a1',orders:canonical.length,lines:ir.invoiceLines.length,audit:ir.audit,
    roles:{package:ir.packageRows.length,upsell:ir.upsellRows.length,service:ir.serviceRows.length,fee:ir.feeRows.length,free:ir.freeAtoms.length},
    formalProductionEngine:'V9.0'};
  g.WRITE_V10_SHADOW_AUDIT=last;return last;
 }catch(e){last={error:e?.message||String(e)};g.WRITE_V10_SHADOW_AUDIT=last;return last}
}
function start(){setTimeout(run,800);window.addEventListener('write-import-complete',()=>setTimeout(run,300))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V10_SHADOW={VERSION:'10.0.0-a1',run,getLast:()=>last,productionTakeover:false};
})(window);