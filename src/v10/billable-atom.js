/* WRITE V10 Stage A — BillableAtom parser
 * A single source item may expand to multiple accounting atoms.
 * "cadeau" is not free by itself. Free status requires explicit free evidence.
 */
(function(g){'use strict';
const VERSION='10.0.0-a1';
const ROLES=Object.freeze({PACKAGE:'PACKAGE',UPSELL:'UPSELL',SERVICE:'SERVICE',FEE:'FEE',FREE_GIFT:'FREE_GIFT',MANUAL_ONLY:'MANUAL_ONLY'});
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const lower=v=>clean(v).toLowerCase();
const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);

const FREE_RE=/(?:100\s*%\s*off|\bgratuit(?:e)?\b|\boffert(?:e)?\b|\bfree\s*gift\b|\bgift\s*free\b|\b0\s*(?:€|eur|usd|\$|gbp|£)\b)/i;
const PAID_GIFT_RE=/(?:coffret\s*cadeau|bo[iî]te\s*cadeau|gift\s*box|cadeau)/i;
const SAMPLE_RE=/(?:échantillon|echantillon|\bsample\b)/i;
const SERVICE_RE=/(?:gravure|engraving|personnalisation|personalization)/i;
const IMPORT_FEE_RE=/(?:frais\s+d.?importation|import\s*fee|customs?\s*fee)/i;
const HANDLING_FEE_RE=/(?:handling|processing\s*fee|frais\s+de\s+traitement|frais\s+trait\.?)/i;

function explicitFreeEvidence(text=''){
  const m=clean(text).match(FREE_RE);
  return {isFree:!!m,evidence:m?[m[0]]:[]};
}
function splitComposite(text=''){
  const raw=String(text??'').replace(/\r/g,'\n').trim();
  if(!raw)return[];
  // Split only on high-confidence separators. Keep slash and hyphen inside descriptions/sizes.
  return raw.split(/\s*(?:\n+|\+|;|\||•)\s*/).map(clean).filter(Boolean);
}
function multiplicity(segment='',fallback=1){
  const s=clean(segment);
  // "×" is a physical-dimension separator. Counts use *, compact terminal Xn,
  // or an explicit quantity word. This avoids 220×240 cm becoming 240 units.
  let m=s.match(/\*\s*(\d+(?:[.,]\d+)?)\b/i);
  if(!m)m=s.match(/[A-Za-zÀ-ÿ\)]\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*$/);
  if(!m)m=s.match(/\b(?:qty|quantity|quantité|quantite)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
  return m?Number(m[1].replace(',','.')):(finite(fallback)??1);
}
function stripMultiplicity(segment=''){
  return clean(segment)
    .replace(/\s*\*\s*\d+(?:[.,]\d+)?\b/g,'')
    .replace(/(?<=[A-Za-zÀ-ÿ\)])\s*[xX]\s*\d+(?:[.,]\d+)?\s*$/,'')
    .replace(/\s+\b(?:qty|quantity|quantité|quantite)\s*[:=]?\s*\d+(?:[.,]\d+)?/i,'')
    .trim();
}
function genericFamily(segment=''){
  const s=clean(segment),l=lower(s);
  if(SERVICE_RE.test(s))return'ENGRAVING_SERVICE';
  if(IMPORT_FEE_RE.test(s))return'IMPORT_FEE';
  if(HANDLING_FEE_RE.test(s))return'HANDLING_FEE';
  if(PAID_GIFT_RE.test(s))return'PAID_GIFT_BOX';
  if(SAMPLE_RE.test(s))return'PAID_SAMPLE';
  if(/\b(?:savon|soap)\b/i.test(s))return'SOAP';
  if(/serviette|towel/i.test(s))return'SOAP_TOWEL';
  if(/baume|balm/i.test(s))return'SOAP_BALM';
  if(/ongles?|nails?/i.test(s))return'SOAP_NAIL';
  if(/(?:crayon|pencil|stylo\s+eternel|stylo\s+éternel)/i.test(s))return'PENCIL_MAIN';
  if(/(?:mines?|refill|recharge)/i.test(s))return'PENCIL_REFILL';
  if(/(?:filet|camouflage|camo\s*net)/i.test(s))return'YD_NET';
  const H=g.WRITE_HUMAN_WORKFLOW_V84;
  if(H?.family){const f=H.family({productName:s,sku:''});if(f&&f!=='SOAP_GIFT_POUCH'&&!String(f).startsWith('NEW:'))return f}
  return`NEW:${s.slice(0,64)||'UNKNOWN'}`;
}
function descriptionFor(family,segment=''){
  const s=stripMultiplicity(segment);
  if(family==='PAID_GIFT_BOX')return /coffret/i.test(s)?s:'Coffret cadeau';
  if(family==='PAID_SAMPLE')return s||'Échantillon';
  if(family==='ENGRAVING_SERVICE')return s||'Gravure';
  if(family==='IMPORT_FEE')return s||"Frais d'importation";
  if(family==='HANDLING_FEE')return s||'Frais de traitement';
  const H=g.WRITE_HUMAN_WORKFLOW_V84;
  const alias=H?.accountingAlias?.({productName:s,sku:''});
  return alias&&alias!=='Article'?alias:(s||'Article');
}
function roleFor(family,segment='',context={}){
  const free=explicitFreeEvidence(segment);
  if(free.isFree)return{role:ROLES.FREE_GIFT,confidence:1,paidEvidence:[],freeEvidence:free.evidence};
  if(family==='ENGRAVING_SERVICE')return{role:ROLES.SERVICE,confidence:1,paidEvidence:['service-family'],freeEvidence:[]};
  if(['IMPORT_FEE','HANDLING_FEE'].includes(family))return{role:ROLES.FEE,confidence:1,paidEvidence:['fee-family'],freeEvidence:[]};
  if(['PAID_GIFT_BOX','PAID_SAMPLE'].includes(family))return{role:ROLES.PACKAGE,confidence:.99,paidEvidence:['paid-product-family'],freeEvidence:[]};
  if(/^SOAP(?:_|$)/.test(family)||family==='PENCIL_MAIN'||family==='YD_NET')return{role:ROLES.PACKAGE,confidence:.98,paidEvidence:['known-billable-family'],freeEvidence:[]};
  if(family==='PENCIL_REFILL'&&context.families?.includes('PENCIL_MAIN'))return{role:ROLES.UPSELL,confidence:.98,paidEvidence:['context:refill-upsell'],freeEvidence:[]};

  const H=g.WRITE_HUMAN_WORKFLOW_V84;
  if(H?.learnedComponentRole){
    const r=H.learnedComponentRole({productName:stripMultiplicity(segment),sku:''},{families:context.families||[],order:context.order});
    if(r?.role==='SEPARATE_UPSELL')return{role:ROLES.UPSELL,confidence:Number(r.confidence||.9),paidEvidence:r.evidence||[],freeEvidence:[]};
    if(r?.role==='SERVICE')return{role:ROLES.SERVICE,confidence:Number(r.confidence||.9),paidEvidence:r.evidence||[],freeEvidence:[]};
    if(r?.role==='FEE')return{role:ROLES.FEE,confidence:Number(r.confidence||.9),paidEvidence:r.evidence||[],freeEvidence:[]};
    // Never accept a V8 FREE_GIFT solely because the token "cadeau" occurred.
    if(r?.role==='FREE_GIFT'&&explicitFreeEvidence(segment).isFree)return{role:ROLES.FREE_GIFT,confidence:Number(r.confidence||.9),paidEvidence:[],freeEvidence:explicitFreeEvidence(segment).evidence};
  }
  return{role:ROLES.PACKAGE,confidence:String(family).startsWith('NEW:')?.55:.92,paidEvidence:['default-billable'],freeEvidence:[]};
}
function sourceKey(item={},ctx={},index=0){
  return clean(ctx.sourceItemKey||item.sourceItemKey)||[
    clean(ctx.sourceHash),clean(ctx.sourceSheet),String(ctx.sourceRow??''),clean(ctx.orderKey),String(index)
  ].join('::');
}
function parseSourceItem(item={},ctx={}){
  const raw=clean(item.productName)||clean(item.description)||clean(item.sku);
  const parts=splitComposite(raw);
  const segs=parts.length?parts:[raw||clean(item.sku)||'Article'];
  const families=segs.map(genericFamily);
  const atoms=[];
  segs.forEach((seg,i)=>{
    const family=families[i],mult=multiplicity(seg,segs.length===1?(finite(item.quantity)??1):1),rr=roleFor(family,seg,{...ctx,families});
    atoms.push({
      atomId:`${sourceKey(item,ctx,i)}#${i}`,
      sourceItemKey:sourceKey(item,ctx,i),
      sourceText:raw,sourceSegment:seg,
      family,normalizedDescription:descriptionFor(family,seg),
      multiplicity:Math.max(0,Number(mult)||0),role:rr.role,
      paidEvidence:rr.paidEvidence||[],freeEvidence:rr.freeEvidence||[],
      confidence:rr.confidence,parserVersion:VERSION,
      currency:clean(ctx.currency||item.currency).toUpperCase()||'UNKNOWN',
      origin:clean(ctx.origin).toUpperCase()||'UNKNOWN',
      destinationCountry:clean(ctx.destinationCountry||ctx.country).toUpperCase()||'GLOBAL',
      invoiceEntity:clean(ctx.invoiceEntity)||'DEFAULT',
      taxRegime:clean(ctx.taxRegime)||'UNSPECIFIED',
      orderKey:clean(ctx.orderKey),
      sourceFile:clean(ctx.sourceFile),sourceSheet:clean(ctx.sourceSheet),sourceRow:ctx.sourceRow??null,sourceCell:clean(ctx.sourceCell),
      needsReview:String(family).startsWith('NEW:')||rr.confidence<.75
    });
  });
  return atoms;
}
g.WRITE_V10_ATOMS={VERSION,ROLES,explicitFreeEvidence,splitComposite,multiplicity,genericFamily,roleFor,parseSourceItem};
})(window);
