/* WRITE V10 production adapter. V9 remains available only as an explicit rollback snapshot. */
(function(g){'use strict';const VERSION='10.2.5';
const v9Generic=g.generatedGenericFactRowsForWorkbook,v9Generated=g.generatedFactRowsForWorkbook,v9All=g.allGeneratedFactRows;
function canonicalOrigin(o={}){
 const candidates=[
  o.fulfillmentOrigin,o.origin,o.storeAccount,o.shopAccount,o.salesChannel,
  o.sourceRawFields?.['店铺账号'],o.rawFields?.['店铺账号']
 ];
 for(const value of candidates){
  const raw=String(value??'').trim().toUpperCase().replace(/_/g,'-').replace(/\s+/g,'-');
  if(!raw||raw==='UNKNOWN'||raw==='UNSPECIFIED'||raw==='N/A')continue;
  if(['CN','CHINA','CHINE','中国','WRITE-CN','WRITE-CHINA'].includes(raw)||
     /(?:^|-)WRITE-CN(?:$|-)|中国仓|CHINA-WAREHOUSE|SHIPSTER/.test(raw))return'CN';
  if(['FR','FRANCE','法国','WRITE-FR','WRITE-FRANCE'].includes(raw)||
     /(?:^|-)WRITE-FR(?:$|-)|法国仓|FRANCE-WAREHOUSE|WAREHOUSE-FR|ENTREP[OÔ]T-FR/.test(raw))return'FR';
 }
 const inferred=g.WRITE_HUMAN_WORKFLOW_V84?.fulfillmentOrigin?.({...o,fulfillmentOrigin:'',origin:''})?.origin;
 return inferred==='CN'||inferred==='FR'?inferred:'UNKNOWN';
}
function sourceOrders(workbookName){
 const b=g.WRITE_V8_SOURCE_BRIDGE?.(),all=b?.orders||[];
 return all.filter(o=>!workbookName||String(o.sourceFile||'')===String(workbookName)).map((o,i)=>({
  ...o,orderId:o.orderId||o.recordKey||o.fulfillmentRecordId||`ROW:${i+1}`,
  trackingNumber:o.trackingNumber||o.trackingNo||o.tracking||o.waybill||o.sourceRawFields?.['包裹号']||'',
  destinationCountry:o.destinationCountry||o.country||'GLOBAL',
  fulfillmentOrigin:canonicalOrigin(o),
  lineItems:(o.lineItems||o.sourceItems||[]).map((x,ii,arr)=>({...x,productName:x.productName||x.description||x.title||x.sku||'Article',amount:x.amount??x.lineTotal??(arr.length===1?o.orderAmount:undefined),sourceItemKey:x.sourceItemKey||`${o.orderId||o.recordKey||i}::${ii}`}))
 }))
}
function v10ForWorkbook(workbookName){
 const result=g.WRITE_V10_PRODUCTION.build(sourceOrders(workbookName));
 result.rows.parcelCount=result.parcelCount;result.rows.parcelNeedsReview=result.audit.conflictOrderIds.length>0;
 return{...result,decision:{useV10:true,reason:'PRODUCTION_100_PERCENT'},formalBeforeAcceptance:'V9.0'};
}
function install(){
 if(typeof v9Generic!=='function'||!g.WRITE_V10_PRODUCTION)return false;
 g.WRITE_V10_V9_ROLLBACK={generatedGenericFactRowsForWorkbook:v9Generic,generatedFactRowsForWorkbook:v9Generated,allGeneratedFactRows:v9All};
 g.generatedGenericFactRowsForWorkbook=function(workbookName){const x=v10ForWorkbook(workbookName);g.WRITE_V10_LAST_BY_WORKBOOK=g.WRITE_V10_LAST_BY_WORKBOOK||{};g.WRITE_V10_LAST_BY_WORKBOOK[workbookName]=x;return x.rows};
 g.generatedFactRowsForWorkbook=g.generatedGenericFactRowsForWorkbook;
 g.allGeneratedFactRows=function(){const b=g.WRITE_V8_SOURCE_BRIDGE?.();return(b?.sourceWorkbooks||[]).flatMap(w=>g.generatedGenericFactRowsForWorkbook(w.name))};
 return true;
}
function rollback(){if(g.WRITE_V10_V9_ROLLBACK){g.generatedGenericFactRowsForWorkbook=g.WRITE_V10_V9_ROLLBACK.generatedGenericFactRowsForWorkbook;g.generatedFactRowsForWorkbook=g.WRITE_V10_V9_ROLLBACK.generatedFactRowsForWorkbook;g.allGeneratedFactRows=g.WRITE_V10_V9_ROLLBACK.allGeneratedFactRows}return true}
g.WRITE_V10_PRODUCTION_ADAPTER={VERSION,install,rollback,v10ForWorkbook,sourceOrders,mode:'PRODUCTION'};install();
})(window);
