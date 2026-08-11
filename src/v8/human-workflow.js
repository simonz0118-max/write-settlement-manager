/* WRITE V8.4 — Unified Human Accounting Workflow
 * Generalizes human behavior learned from YD/camouflage, archived FACT,
 * write-store pencil history, and soap history.
 * Shadow only: it never replaces the V7.5.9 production FACT generator.
 */
(function(g){'use strict';

const VERSION='8.5.0';

const COMPONENT_ROLE=Object.freeze({
  PACKAGE_COMPONENT:'PACKAGE_COMPONENT',
  SEPARATE_UPSELL:'SEPARATE_UPSELL',
  FREE_GIFT:'FREE_GIFT',
  SERVICE:'SERVICE',
  FEE:'FEE',
  UNKNOWN:'UNKNOWN'
});

const DISPOSITION=Object.freeze({
  BILLED:'BILLED',
  NOT_YET_FULFILLED:'NOT_YET_FULFILLED',
  AUDIT_ONLY:'AUDIT_ONLY',
  MANUAL_ONLY:'MANUAL_ONLY',
  UNKNOWN_REVIEW:'UNKNOWN_REVIEW'
});

function clean(v=''){return String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim()}
function lower(v){return clean(v).toLowerCase()}
function finite(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function normCountry(v){return clean(v).toUpperCase()||'GLOBAL'}

function fulfillmentRecordKey(order={},index=0){
  const orderId=clean(order.orderId||order.recordKey)||`ROW:${Number(order.sourceRow||index+1)}`;
  const parcel=clean(order.packageId||order.parcelId||order.fulfillmentId);
  const tracking=clean(order.trackingNumber||order.tracking||order.waybill);
  const sheet=clean(order.sourceSheet);
  const row=Number(order.sourceRow||0);
  // Never deduplicate solely on orderId. Same orderId can represent another parcel/re-shipment.
  return [orderId,parcel||tracking||`${sheet}:${row||index+1}`].join('::');
}

function family(item={}){
  const text=`${clean(item.productName)} ${clean(item.sku)}`;
  if(/filet\s+de\s+camouflage.*triang|三角形?网|triangulaire/i.test(text))return 'CAMOUFLAGE_NET_TRIANGLE';
  if(/filet\s+de\s+camouflage/i.test(text))return 'CAMOUFLAGE_NET';
  if(/kit\s+de\s+fixation/i.test(text))return 'FIXATION_KIT';
  if(/colliers?\s+de\s+serrage/i.test(text))return 'CABLE_TIE';
  if(/cordes?\s+à\s+cliquets/i.test(text))return 'RATCHET_CORD';
  if(/gel[ée]e?\s+au\s+collag[èe]ne|collagen.*jelly|jelly/i.test(text))return 'COLLAGEN_JELLY';
  if(/\bchemise\b/i.test(text))return 'CHEMISE';
  if(/\bgilet\b|kryonify/i.test(text))return 'GILET';
  if(/mine(?:s)?\s+(?:rechargeable|color[ée]e)|refill/i.test(text))return 'PENCIL_REFILL';
  if(/stylo\s+[ée]ternel|crayon\s+[ée]ternel|pencil/i.test(text))return 'PENCIL';
  if(/baume/i.test(text))return 'SOAP_BALM';
  if(/ongles?|nail/i.test(text))return 'SOAP_NAIL';
  if(/serviette|towel/i.test(text))return 'SOAP_TOWEL';
  if(/savon|soap/i.test(text))return 'SOAP';
  if(/sachet\s+moussant|exfoliant|soap\s+pouch/i.test(text))return 'SOAP_GIFT_POUCH';
  if(/gravure|engraving/i.test(text))return 'ENGRAVING_SERVICE';
  if(/frais\s+d.?importation|import\s+fee/i.test(text))return 'IMPORT_FEE';
  return `NEW:${(clean(item.productName)||clean(item.sku)||'UNKNOWN').slice(0,64)}`;
}

function contextFamilies(items=[]){return items.map(x=>family(x))}

function learnedComponentRole(item,context={}){
  const fam=family(item),families=context.families||[];
  // Explicit non-billable evidence learned from soap history.
  if(fam==='SOAP_GIFT_POUCH'||/100\s*%\s*off|gratuit|cadeau|offert|free\s*gift/i.test(`${item.productName||''} ${item.sku||''}`))
    return {role:COMPONENT_ROLE.FREE_GIFT,confidence:.99,evidence:['historical:non-billable-gift']};

  if(fam==='ENGRAVING_SERVICE')return {role:COMPONENT_ROLE.SERVICE,confidence:.99,evidence:['family:service']};
  if(fam==='IMPORT_FEE')return {role:COMPONENT_ROLE.FEE,confidence:.99,evidence:['family:fee']};

  // YD/camouflage: accessories can be separate accounting upsells in net context.
  const withNet=families.some(x=>x==='CAMOUFLAGE_NET'||x==='CAMOUFLAGE_NET_TRIANGLE');
  if(withNet&&['FIXATION_KIT','CABLE_TIE','RATCHET_CORD'].includes(fam))
    return {role:COMPONENT_ROLE.SEPARATE_UPSELL,confidence:.97,evidence:['YD:net-accessory-separate-upsell']};

  // Pencil: refill/mines are separately counted upsells when accompanied by pencil.
  if(fam==='PENCIL_REFILL'&&families.includes('PENCIL'))
    return {role:COMPONENT_ROLE.SEPARATE_UPSELL,confidence:.97,evidence:['PENCIL:refill-separate-upsell']};

  // Soap: these are package components, not separate upsell lines.
  if(['SOAP','SOAP_BALM','SOAP_NAIL','SOAP_TOWEL'].includes(fam))
    return {role:COMPONENT_ROLE.PACKAGE_COMPONENT,confidence:.98,evidence:['SOAP:package-component']};

  // Archived families are package/main components unless verified context says otherwise.
  if(['COLLAGEN_JELLY','CHEMISE','GILET','CAMOUFLAGE_NET','CAMOUFLAGE_NET_TRIANGLE','PENCIL'].includes(fam))
    return {role:COMPONENT_ROLE.PACKAGE_COMPONENT,confidence:.95,evidence:['historical:main-package-family']};

  return {role:COMPONENT_ROLE.UNKNOWN,confidence:.45,evidence:['new-or-unresolved']};
}

function accountingAlias(item){
  const fam=family(item);
  const text=clean(item.productName);
  if(fam==='SOAP')return 'Savon';
  if(fam==='SOAP_BALM')return 'Baume';
  if(fam==='SOAP_NAIL')return 'Ongles';
  if(fam==='SOAP_TOWEL')return 'Serviette';
  if(fam==='SOAP_GIFT_POUCH')return 'Sachet moussant exfoliant';
  if(fam==='COLLAGEN_JELLY')return 'Gelée au collagène';
  if(fam==='CHEMISE')return 'Chemise';
  if(fam==='GILET')return 'Gilet';
  if(fam==='PENCIL')return 'Stylo eternel';
  if(fam==='PENCIL_REFILL')return /6/i.test(text)?'Lot de 6 Mines colorées':/4/i.test(text)?'Lot de 4 mines rechargeables':'Mines colorées';
  if(fam==='FIXATION_KIT')return 'Kit de fixation complet - Suspendu';
  if(fam==='CABLE_TIE')return 'Colliers de serrage x100 - pergola';
  if(fam==='RATCHET_CORD')return 'Cordes à cliquets réglables - Lot de 4';
  if(fam==='CAMOUFLAGE_NET'||fam==='CAMOUFLAGE_NET_TRIANGLE'){
    const m=text.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×*]\s*(\d+(?:[.,]\d+)?))?/i);
    const d=m?[m[1],m[2],m[3]].filter(Boolean).map(x=>x.replace(',','.')).join('x'):'';
    return fam==='CAMOUFLAGE_NET_TRIANGLE'
      ?`Le Filet de camouflage Triangulaire${d?` / ${d}`:''}`
      :`Le Filet de camouflage${d?` / ${d}`:''}`;
  }
  return text||clean(item.sku)||'Article';
}

function quantity(item){
  const direct=finite(item.quantity);
  if(direct!==null)return Math.max(0,direct);
  const m=clean(item.sku).match(/(?:\*|x|×)\s*(\d+(?:[.,]\d+)?)\s*$/i);
  if(m)return Number(m[1].replace(',','.'));
  return 1;
}

function fulfillmentOrigin(order={}){
  const explicit=clean(order.fulfillmentOrigin||order.warehouse||order.origin).toUpperCase();
  if(explicit==='FR'||explicit==='FRANCE')return {origin:'FR',confidence:1,evidence:['source:explicit-origin']};
  if(explicit==='CN'||explicit==='CHINA'||explicit==='CHINE')return {origin:'CN',confidence:1,evidence:['source:explicit-origin']};
  const source=`${clean(order.sourceSheet)} ${clean(order.notes)} ${clean(order.remark)} ${clean(order.pickNote)}`;
  if(/法国仓(?:库)?发|france\s*warehouse|entrep[oô]t\s*fr/i.test(source))
    return {origin:'FR',confidence:.98,evidence:['historical:fr-warehouse-note']};
  if(/\bCN\b|中国仓|china\s*warehouse/i.test(source))
    return {origin:'CN',confidence:.95,evidence:['historical:cn-warehouse-note']};
  return {origin:'UNKNOWN',confidence:.35,evidence:['origin:unresolved']};
}

function sourceFulfillmentState(order={}){
  // Important: field emptiness alone is not enough to invent a universal rule.
  // Historical evidence may supply an exact learned rule later.
  const shippedAt=clean(order.shippedAt||order.shipTime||order.shippingTime);
  const tracking=clean(order.trackingNumber||order.tracking||order.waybill);
  return {shippedSignal:!!shippedAt,trackingSignal:!!tracking};
}

function reviewDispositionForItems(items=[]){
  return items.some(x=>x.componentRole===COMPONENT_ROLE.UNKNOWN)
    ?{disposition:DISPOSITION.UNKNOWN_REVIEW,confidence:.4,evidence:['unknown-component-review']}
    :null;
}
function disposition(order={},options={}){
  if(options.manualOnly===true)return {disposition:DISPOSITION.MANUAL_ONLY,confidence:1,evidence:['fact-only-manual-line']};
  if(options.explainedNotFulfilled===true)return {disposition:DISPOSITION.NOT_YET_FULFILLED,confidence:.99,evidence:['verified-historical-exclusion']};
  if(options.placeholder===true)return {disposition:DISPOSITION.AUDIT_ONLY,confidence:1,evidence:['placeholder']};
  return {disposition:DISPOSITION.BILLED,confidence:.80,evidence:['default:source-record-billable']};
}

function buildRecord(order={},options={}){
  const items=(order.lineItems||[]).filter(x=>clean(x.productName)||clean(x.sku));
  const families=contextFamilies(items);
  const mapped=items.map(item=>{
    const role=learnedComponentRole(item,{families,order});
    return {
      sourceItem:item,
      family:family(item),
      alias:accountingAlias(item),
      quantity:quantity(item),
      componentRole:role.role,
      confidence:role.confidence,
      evidence:role.evidence
    };
  });
  return {
    recordKey:fulfillmentRecordKey(order,options.index||0),
    orderId:clean(order.orderId||order.recordKey),
    country:normCountry(order.country),
    origin:fulfillmentOrigin(order),
    sourceFulfillmentState:sourceFulfillmentState(order),
    disposition:disposition(order,options),
    items:mapped
  };
}

function configuration(record){
  const pkg=new Map(),upsell=[];
  for(const x of record.items){
    if(x.componentRole===COMPONENT_ROLE.PACKAGE_COMPONENT){
      const key=x.alias;
      pkg.set(key,(pkg.get(key)||0)+x.quantity);
    }else if(x.componentRole===COMPONENT_ROLE.SEPARATE_UPSELL){
      upsell.push(x);
    }
  }
  const components=[...pkg.entries()].sort((a,b)=>a[0].localeCompare(b[0],'fr',{numeric:true}))
    .map(([alias,qty])=>({alias,quantity:qty}));
  const description=components.map(x=>`${x.alias}${x.quantity!==1?` *${x.quantity}`:''}`).join(' + ');
  return {components,description:description||'NO_PACKAGE_COMPONENT',separateUpsells:upsell};
}

function aggregate(records=[]){
  const packageGroups=new Map(),upsellGroups=new Map(),auditOnly=[];
  for(const r of records){
    if(r.disposition.disposition!==DISPOSITION.BILLED){auditOnly.push(r);continue}
    const cfg=configuration(r);
    if(cfg.components.length){
      const key=[r.origin.origin,r.country,cfg.description].join('\u0001');
      let g=packageGroups.get(key);
      if(!g){g={origin:r.origin.origin,country:r.country,role:'PACKAGE',description:cfg.description,quantity:0,sourceRecordKeys:[]};packageGroups.set(key,g)}
      g.quantity+=1;g.sourceRecordKeys.push(r.recordKey);
    }
    for(const u of cfg.separateUpsells){
      const key=[r.origin.origin,r.country,u.alias].join('\u0001');
      let g=upsellGroups.get(key);
      if(!g){g={origin:r.origin.origin,country:r.country,role:'SEPARATE_UPSELL',description:`${u.alias} UPSELL`,quantity:0,sourceRecordKeys:[]};upsellGroups.set(key,g)}
      g.quantity+=u.quantity;g.sourceRecordKeys.push(r.recordKey);
    }
  }
  return {packageRows:[...packageGroups.values()],upsellRows:[...upsellGroups.values()],auditOnly};
}

g.WRITE_HUMAN_WORKFLOW_V84=Object.freeze({
  VERSION,COMPONENT_ROLE,DISPOSITION,
  fulfillmentRecordKey,family,learnedComponentRole,accountingAlias,quantity,
  fulfillmentOrigin,sourceFulfillmentState,reviewDispositionForItems,disposition,buildRecord,configuration,aggregate
});
})(window);
