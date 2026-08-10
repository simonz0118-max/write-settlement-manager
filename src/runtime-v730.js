/* WRITE Settlement Manager v7.3.0 — legacy-safe runtime compatibility overlay */
(function(){
'use strict';

function cleanFormalText(v=''){
  return String(v??'')
    .replace(/\b(待确认|UNKNOWN|未设置|自动识别|需复核|PRICE_BLANK)\b/gi,'')
    .replace(/^\s*[·:\-]+\s*/,'')
    .trim();
}
function assignGlobalFunction(name,fn){
  try{
    // Existing WRITE functions are classic-script global function bindings.
    if(name==='classifyLine')classifyLine=fn;
    else if(name==='classifyOrder')classifyOrder=fn;
    else if(name==='generatedGenericFactRowsForWorkbook')generatedGenericFactRowsForWorkbook=fn;
    else if(name==='generatedTemplateDataRow')generatedTemplateDataRow=fn;
    else if(name==='patchLearnedTemplateSheetXml')patchLearnedTemplateSheetXml=fn;
    else throw new Error('unsupported override '+name);
    return true;
  }catch(e){
    console.error('WRITE V7.3.0 override failed:',name,e);
    return false;
  }
}

/* ---------- 1. Extend categories without deleting legacy categories ---------- */
try{
  const extras=[
    ['APPAREL','服装 / 穿戴商品','Chemise / Gilet / Ceinture / Débardeur / Chaussettes'],
    ['WELLNESS','健康 / 食品商品','Gelée au collagène 等'],
    ['JEWELRY','饰品 / 珠宝商品','Bracelet / Bague / Collier'],
    ['GENERIC_GOODS','一般商品','未见过但结构完整的普通商品']
  ];
  for(const [code,label,description] of extras){
    if(!LABEL[code]){
      LINE_CATEGORIES.splice(Math.max(0,LINE_CATEGORIES.length-1),0,{code,label,description});
      LABEL[code]=label;
    }
  }
}catch(e){console.warn('WRITE V7.3 category extension:',e)}

/* ---------- 2. Classification: legacy deterministic > historical family > confirmed learned > generic ---------- */
const legacyClassify=classifyLine;
assignGlobalFunction('classifyLine',function(productName='',sku=''){
  const name=norm(productName),n=low(name),s=low(sku);
  const alias=normalizeRuleToken(`${name} ${sku}`).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
  const isFree=/^🎁/.test(name)||/100%\s*off|gratuit|cadeau offert/.test(n);
  let category='OTHER';

  // Mature legacy rules are authoritative. D1/IndexedDB learning can never override them.
  if(/commande professionnelle|professional order|cmd pro/.test(n))category='B2B';
  else if(/carte[- ]cadeau|gift\s*card/.test(n))category='GIFT_CARD';
  else if(/gravure|雕刻/.test(n)||/(^|\D)50505594077448/.test(s)||/雕刻/.test(s))category='ENGRAVING';
  else if(/gomme[- ]?capuchon|gommes?[- ]capuchons?\s+shield|gomme.*shield/.test(n)||/(^|\s)2\s*gomme(?:\s|\*|$)/.test(s)||/58329286902024/.test(s))category='ERASER';
  else if(/\ble carnet parfait\b|\bcarnet\b/.test(n)||/(^|\s)carnet(?:\s|\*|$)/.test(s))category='NOTEBOOK';
  else if(/coffret cadeau|礼盒|盒子/.test(n)||/(^|\D)52838739738888/.test(s)||/盒子/.test(s))category='GIFT_BOX';
  else if(/mines? color[ée]es?|彩色.*笔芯|pack.*mines/.test(n)||/qb-csbt|qb[_ -]?6/.test(s)||/(^|\D)(49624586256648|52725633384712)(\D|$)/.test(s)||/(?:^|\s)qb\s*(?:6|csbt)(?:\s|$)/.test(alias))category='COLOR_REFILL';
  else if(/mines? rechargeables?|\b4\s*mines\b|笔芯/.test(n)||/qb[_ -]?4/.test(s)||/(^|\D)(45407586615560|45157341331720)(\D|$)/.test(s)||/(?:^|\s)qb\s*4(?:\s|$)/.test(alias))category='REFILL';
  else if(/le crayon intemporel|铅笔|crayon/.test(n)||/qb[_ -]?(obsidienne|aluminium|carmin|nuit|jade|saturne)/.test(s)||/(^|\D)(45242109231368|45242109329672)(\D|$)/.test(s)||/铅笔/.test(s)||/(?:^|\s)qb\s*(?:obsidienne|aluminium|carmin|nuit|jade|saturne)(?:\s|$)/.test(alias))category='PENCIL';
  else{
    const inferred=window.WRITE_HISTORY_V730?.inferCategory?.(productName,sku);
    if(inferred&&LABEL[inferred])category=inferred;
    else{
      const learned=persistentCategoryFor(productName,sku);
      if(learned&&LABEL[learned])category=learned;
      else if(isMeaningfulProductLine(productName,sku))category='GENERIC_GOODS';
      else return legacyClassify(productName,sku);
    }
  }
  return {category,categoryLabel:LABEL[category]||category,isFree,quantity:quantityFromSku(sku)};
});

/* ---------- 3. Order accounting categories for new families ---------- */
const legacyClassifyOrder=classifyOrder;
assignGlobalFunction('classifyOrder',function(order){
  const o=legacyClassifyOrder(order);
  const items=o.lineItems||[];
  const paid=new Set(items.filter(x=>!x.isFree).map(x=>x.category));

  if(!items.some(x=>x.category==='OTHER')){
    o.unknownItemCount=0;
    o.classificationStatus='已分类';
  }

  // Never replace mature accounting categories.
  if(['PENCIL_ORDER','REFILL_ORDER','ACCESSORY_ORDER','SERVICE_ORDER','B2B','GIFT_CARD','ZERO_FREE'].includes(o.accountingCode))return o;
  if(paid.has('APPAREL')){o.accountingCode='APPAREL_ORDER';o.accountingCategory='服装 / 穿戴商品';}
  else if(paid.has('WELLNESS')){o.accountingCode='WELLNESS_ORDER';o.accountingCategory='健康 / 食品商品';}
  else if(paid.has('JEWELRY')){o.accountingCode='JEWELRY_ORDER';o.accountingCategory='饰品 / 珠宝商品';}
  else if(paid.has('GENERIC_GOODS')){o.accountingCode='GOODS_ORDER';o.accountingCategory='一般商品';}
  return o;
});

/* ---------- 4. Generic FACT: historical order-bundle rules ---------- */
assignGlobalFunction('generatedGenericFactRowsForWorkbook',function(workbookName){
  const currency=currencyForWorkbook(workbookName);
  const rows=window.WRITE_HISTORY_V730?.buildRowsForWorkbook?.({
    workbookName,
    orders:classified?.orders||[],
    currency
  });
  if(Array.isArray(rows)&&rows.length)return rows;

  // Last fallback: preserve country/product/SKU/quantity, blank price.
  const map=new Map();
  for(const x of (classified?.lineItems||[]).filter(x=>String(x.sourceFile||'')===String(workbookName||'')&&!x.isFree)){
    const product=cleanFormalText(x.productName||x.sku)||'Article';
    const sku=cleanFormalText(x.sku),country=String(x.country||'').trim();
    const key=[country,product,sku].join('\u0001');
    const cur=map.get(key)||{country,product,sku,quantity:0,orders:new Set()};
    cur.quantity+=Number(x.quantity)||1;cur.orders.add(String(x.recordKey||x.orderId||''));map.set(key,cur);
  }
  return [...map.values()]
    .sort((a,b)=>a.country.localeCompare(b.country,'en')||a.product.localeCompare(b.product,'fr'))
    .map((x,i)=>({
      no:i+1,country:x.country,description:x.product,sku:x.sku,quantity:x.quantity,
      cogs:null,shipping:null,unitTotal:null,amount:null,currency,
      costStatus:'PRICE_BLANK',sourceFile:workbookName,sourceSheet:'AUTO_FACT_V730',
      generated:true,orderCount:x.orders.size
    }));
});

/* ---------- 5. FACT row renderer: no internal text ---------- */
const legacyGeneratedTemplateDataRow=generatedTemplateDataRow;
assignGlobalFunction('generatedTemplateDataRow',function(r,rowNo,index){
  if(r?.isCountryHeader){
    return `<row r="${rowNo}" s="1" customFormat="1" ht="18" customHeight="1" spans="1:8"><c r="A${rowNo}" s="27"/>${xmlTextCell(`B${rowNo}`,30,r.country||'')}${xmlTextCell(`C${rowNo}`,31,'')}<c r="D${rowNo}" s="32"/><c r="E${rowNo}" s="31"/><c r="F${rowNo}" s="69"/><c r="G${rowNo}" s="31"/><c r="H${rowNo}" s="31"/></row>`;
  }
  const clean={...r,description:cleanFormalText(r?.description)||cleanFormalText(r?.sku)||'Article',sku:cleanFormalText(r?.sku)};
  let xml=legacyGeneratedTemplateDataRow(clean,rowNo,index);
  // Old generic renderer appended Country to Description. V7.3 uses country section headers instead.
  xml=xml.replace(/Country:\s*[^<\n\r]+/gi,'');
  return xml;
});

/* ---------- 6. FACT workbook structure: one file, countries in sections, historical template preserved ---------- */
assignGlobalFunction('patchLearnedTemplateSheetXml',function(xml,data,workbookName){
  const raw=(data&&data.length)?[...data]:[{description:'Article',sku:'',country:'',quantity:0,cogs:null,shipping:null,unitTotal:null}];
  raw.sort((a,b)=>String(a.country||'').localeCompare(String(b.country||''),'en')||String(a.description||'').localeCompare(String(b.description||''),'fr'));

  const expanded=[];let lastCountry=null,no=0;
  for(const r of raw){
    const c=String(r.country||'').trim()||'GLOBAL';
    if(c!==lastCountry){expanded.push({isCountryHeader:true,country:c});lastCountry=c;no=0;}
    expanded.push({...r,description:cleanFormalText(r.description)||'Article',sku:cleanFormalText(r.sku),no:++no});
  }

  // Historical learned template: header row 10; data region starts at 11; footer starts at 17.
  const count=Math.max(1,expanded.length),totalRow=11+count,oldTotal=16,delta=totalRow-oldTotal;
  const rowRe=/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
  const rows=[];let m;while((m=rowRe.exec(xml)))rows.push({n:Number(m[1]),xml:m[0]});
  const before=rows.filter(x=>x.n<11).map(x=>x.xml).join('');
  const after=rows.filter(x=>x.n>=17).map(x=>shiftTemplateRowXml(x.xml,x.n,x.n+delta,oldTotal,totalRow)).join('');
  const dataRows=expanded.map((r,i)=>generatedTemplateDataRow(r,11+i,r.isCountryHeader?'':r.no)).join('');
  const totalXml=`<row r="${totalRow}" ht="32.25" customHeight="1" spans="1:8"><c r="A${totalRow}" s="12"/><c r="B${totalRow}" s="33"/><c r="C${totalRow}" s="33"/><c r="D${totalRow}" s="34"/><c r="E${totalRow}" s="33"/><c r="F${totalRow}" s="70"/><c r="G${totalRow}" s="70"/><c r="H${totalRow}" s="70"><f>SUM(H11:H${totalRow-1})</f></c></row>`;

  const sheetData=xml.match(/<sheetData>[\s\S]*?<\/sheetData>/)?.[0];
  if(!sheetData)throw new Error('FACT 模板缺少 sheetData');
  let out=xml.replace(sheetData,`<sheetData>${before}${dataRows}${totalXml}${after}</sheetData>`);
  out=out.replace(/<dimension ref="A1:K\d+"\/>/,`<dimension ref="A1:K${Math.max(35,35+delta)}"/>`);
  out=out.replace(/<mergeCells count="(\d+)">([\s\S]*?)<\/mergeCells>/,(whole,countText,body)=>{
    const shifted=body.replace(/ref="([A-Z]+\d+:[A-Z]+\d+)"/g,(mm,ref)=>`ref="${shiftTemplateMergeRef(ref,17,delta)}"`);
    return `<mergeCells count="${countText}">${shifted}</mergeCells>`;
  });

  const currency=currencyForWorkbook(workbookName);
  const labels=['No','Description','Quantity',`COGs (${currency})`,` Shipping (${currency})`,`COGs + Shipping (${currency})`,`Amount (${currency})`];
  ['B','C','D','E','F','G','H'].forEach((col,i)=>{
    const re=new RegExp(`<c[^>]*\\br="${col}10"[^>]*>[\\s\\S]*?<\\/c>`);
    out=out.replace(re,xmlTextCell(`${col}10`,col==='D'?26:25,labels[i]));
  });

  const date=new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date());
  out=out.replace(/<c[^>]*\br="E3"[^>]*>[\s\S]*?<\/c>/,xmlTextCell('E3',62,`FACT - AUTO\n\n${date}`));
  const paymentRow=19+delta;
  out=out.replace(new RegExp(`<c[^>]*\\br="B${paymentRow}"[^>]*>[\\s\\S]*?<\\/c>`),xmlTextCell(`B${paymentRow}`,42,`Pour le règlement, merci de faire un virement en ${currency}`));
  return out;
});

window.WRITE_V730_RUNTIME={
  ok:true,version:'7.3.0',historyMeta:window.WRITE_HISTORY_V730?.meta||null,
  fullyAutomatic:true,
  formalInvoice:{singleFile:true,countrySections:true,priceMayBeBlank:true,noInternalStatus:true},
  priority:['LEGACY_WRITE_CN_FACT','HISTORICAL_RULE','CONFIRMED_LEARNING','GENERIC_BLANK_PRICE']
};
console.info('WRITE V7.3.0 runtime ready',window.WRITE_V730_RUNTIME);
})();