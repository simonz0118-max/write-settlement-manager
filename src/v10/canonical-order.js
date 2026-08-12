/* WRITE V10 Stage B — CanonicalOrder */
(function(g){'use strict';const VERSION='10.0.0-a1';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toUpperCase();
function sourceHashFallback(o={}){let s=[o.sourceFile,o.sourceSheet,o.sourceRow,JSON.stringify(o.rawFields||{})].map(clean).join('|'),h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
function identity(o={},i=0){return[
 clean(o.sourceHash)||sourceHashFallback(o),clean(o.sourceSheet),String(o.sourceRow??i+1),
 clean(o.orderId||o.recordKey),clean(o.parcelId||o.packageId||o.trackingNumber||o.tracking||o.waybill)
].join('::')}
function canonicalize(o={},i=0){
 const sourceItems=(o.lineItems||o.sourceItems||[]).map((x,ii)=>({
  sourceItemKey:clean(x.sourceItemKey)||`${identity(o,i)}::ITEM:${ii}`,
  sourceCell:clean(x.sourceCell),sku:clean(x.sku),productName:clean(x.productName||x.description),
  quantity:x.quantity??null,currency:clean(x.currency||o.currency),raw:x
 }));
 return{
  canonicalVersion:VERSION,fulfillmentRecordId:identity(o,i),
  sourceHash:clean(o.sourceHash)||sourceHashFallback(o),sourceFile:clean(o.sourceFile),sourceSheet:clean(o.sourceSheet),sourceRow:o.sourceRow??null,sourceCell:clean(o.sourceCell),
  orderId:clean(o.orderId||o.recordKey),parcelId:clean(o.parcelId||o.packageId),trackingNumber:clean(o.trackingNumber||o.tracking||o.waybill),
  destinationCountry:norm(o.destinationCountry||o.country)||'GLOBAL',
  fulfillmentOrigin:norm(o.fulfillmentOrigin||g.WRITE_HUMAN_WORKFLOW_V84?.fulfillmentOrigin?.(o)?.origin)||'UNKNOWN',
  currency:norm(o.currency||o.orderCurrency||o.paymentCurrency)||'UNKNOWN',
  taxRegime:clean(o.taxRegime)||'UNSPECIFIED',invoiceEntity:clean(o.invoiceEntity)||'DEFAULT',
  buyerName:clean(o.buyerName||o.customerName),buyerEmail:clean(o.buyerEmail||o.email),
  rawFields:o.rawFields||o,sourceItems
 };
}
function canonicalizeAll(orders=[]){return orders.map(canonicalize)}
g.WRITE_V10_CANONICAL={VERSION,identity,canonicalize,canonicalizeAll};
})(window);