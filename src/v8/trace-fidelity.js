/* WRITE V8.3.1 Trace Fidelity Hardening */
(function(g){'use strict';
const VERSION='8.3.1';
const BILLABLE=new Set(['MAIN','UPSELL','SERVICE','FEE']);

function clean(v=''){return String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim()}
function audit(semanticOrders=[],factRows=[]){
  const factById=new Map();
  const orderToFact=new Map();
  const itemToFact=new Map();
  const errors=[];

  factRows.forEach((row,index)=>{
    const id=clean(row?.traceId)||`FACT:${index+1}`;
    const orders=[...(row?.sourceOrderKeys||[])].map(clean).filter(Boolean);
    const items=[...(row?.sourceItemKeys||[])].map(clean).filter(Boolean);
    if(!orders.length)errors.push({code:'FACT_WITHOUT_SOURCE_ORDER',traceId:id});
    if(!items.length)errors.push({code:'FACT_WITHOUT_SOURCE_ITEM',traceId:id});
    factById.set(id,{id,row,orders,items});

    for(const key of orders){
      let list=orderToFact.get(key); if(!list){list=[];orderToFact.set(key,list)}
      list.push(id);
    }
    for(const key of items){
      let list=itemToFact.get(key); if(!list){list=[];itemToFact.set(key,list)}
      list.push(id);
    }
  });

  let sourceOrders=0,billableOrders=0,placeholderOnlyOrders=0;
  let sourceItems=0,billableItems=0,nonBillableItems=0;
  const orderDisposition=[];
  const itemDisposition=[];

  for(const order of semanticOrders||[]){
    const ok=clean(order?.orderKey);
    sourceOrders++;
    const billable=(order?.items||[]).filter(x=>BILLABLE.has(String(x?.role||'').toUpperCase()));
    const main=billable.filter(x=>String(x?.role).toUpperCase()==='MAIN');
    const routed=orderToFact.get(ok)||[];
    if(main.length)billableOrders++;
    else if((order?.items||[]).length && (order?.items||[]).every(x=>x?.family==='PLACEHOLDER_NON_PRODUCT'))placeholderOnlyOrders++;

    const mainRows=routed.filter(fid=>String(factById.get(fid)?.row?.role||'').toUpperCase()==='MAIN');
    if(main.length && mainRows.length!==1)errors.push({code:'MAIN_ORDER_ROUTE_COUNT',orderKey:ok,count:mainRows.length});
    if(!main.length && mainRows.length)errors.push({code:'NON_MAIN_ORDER_ROUTED_TO_MAIN',orderKey:ok,count:mainRows.length});

    orderDisposition.push({
      orderKey:ok,
      billable:billable.length>0,
      mainItemCount:main.length,
      factTraceIds:routed,
      disposition:routed.length?'ROUTED':'AUDIT_ONLY'
    });

    for(const item of order?.items||[]){
      sourceItems++;
      const ik=clean(item?.sourceItemKey);
      const role=String(item?.role||'UNKNOWN').toUpperCase();
      const routedItems=itemToFact.get(ik)||[];
      if(BILLABLE.has(role)){
        billableItems++;
        if(routedItems.length!==1)errors.push({code:'BILLABLE_ITEM_ROUTE_COUNT',itemKey:ik,role,count:routedItems.length});
      }else{
        nonBillableItems++;
        if(routedItems.length)errors.push({code:'NON_BILLABLE_ITEM_EMITTED',itemKey:ik,role,count:routedItems.length});
      }
      itemDisposition.push({
        itemKey:ik,orderKey:ok,role,family:item?.family||'UNKNOWN',
        sourceQuantity:Number(item?.sourceQuantity??item?.quantity??0)||0,
        factTraceIds:routedItems,
        disposition:routedItems.length?'ROUTED':(BILLABLE.has(role)?'MISSING':'AUDIT_ONLY')
      });
    }
  }

  const duplicateFactOrders=[];
  for(const [key,ids] of orderToFact){
    const mainIds=ids.filter(fid=>String(factById.get(fid)?.row?.role||'').toUpperCase()==='MAIN');
    if(mainIds.length>1)duplicateFactOrders.push({orderKey:key,mainTraceIds:mainIds});
  }
  const duplicateItems=[...itemToFact.entries()].filter(([,ids])=>ids.length>1).map(([itemKey,ids])=>({itemKey,traceIds:ids}));

  return {
    version:VERSION,
    sourceOrders,billableOrders,placeholderOnlyOrders,
    sourceItems,billableItems,nonBillableItems,
    factRows:factRows.length,
    factRowsWithSource:[...factById.values()].filter(x=>x.orders.length&&x.items.length).length,
    orderDisposition,itemDisposition,
    duplicateFactOrders,duplicateItems,errors,
    exactTracePass:errors.length===0&&duplicateFactOrders.length===0&&duplicateItems.length===0
  };
}

function combinedGate(zeroLossAudit,fidelityAudit,traceAudit){
  return {
    version:VERSION,
    zeroLoss:!!zeroLossAudit?.hardPass,
    classificationExact:!!fidelityAudit?.exact,
    traceExact:!!traceAudit?.exactTracePass,
    formalTakeoverEligible:!!zeroLossAudit?.hardPass&&!!fidelityAudit?.exact&&!!traceAudit?.exactTracePass
  };
}

g.WRITE_TRACE_FIDELITY_V831={VERSION,audit,combinedGate};
})(window);
