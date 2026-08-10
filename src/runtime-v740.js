/* WRITE Settlement Manager v7.4.0 — Universal FACT Engine: data-first, non-blocking export */
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
  for(const x of (classified?.lineItems||[]).filter(x=>String(x.sourceFile||'')===String(workbookName||''))){
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

/* ---------- 5. FACT unified renderer: styles copied from the user's historical FACT ---------- */
function unifiedFactCountryRow(r,rowNo){
  const country=String(r?.country||'').trim()||'GLOBAL';
  return `<row r="${rowNo}" s="7" customFormat="1" ht="15" customHeight="1" spans="1:11"><c r="A${rowNo}" s="43"/>${xmlTextCell(`B${rowNo}`,44,country)}<c r="C${rowNo}" s="44"/><c r="D${rowNo}" s="45"/><c r="E${rowNo}" s="44"/><c r="F${rowNo}" s="44"/><c r="G${rowNo}" s="44"/><c r="H${rowNo}" s="44"/></row>`;
}
function unifiedFactDataRow(r,rowNo,index){
  const rawProduct=cleanFormalText(r?.description)||cleanFormalText(r?.sku)||'Article';
  const product=window.standardizeFactDescription?.(rawProduct,r?.sku)||rawProduct;
  // Formal FACT follows the user's manual standard: concise accounting description only.
  // SKU remains an internal grouping/audit key and is not printed into Description by default.
  const desc=product;
  const q=(r?.quantity===null||r?.quantity===undefined||r?.quantity==='')?null:(Number.isFinite(Number(r.quantity))?Number(r.quantity):null);
  const priceNum=v=>(v===null||v===undefined||v==='')?null:(Number.isFinite(Number(v))?Number(v):null);
  const c=priceNum(r?.cogs);
  const s=priceNum(r?.shipping);
  const u=priceNum(r?.unitTotal);
  const cells=[
    `<c r="A${rowNo}" s="43"/>`,
    xmlNumberCell(`B${rowNo}`,46,index),
    xmlTextCell(`C${rowNo}`,47,desc),
    q===null?`<c r="D${rowNo}" s="48"/>`:xmlNumberCell(`D${rowNo}`,48,q),
    c===null?`<c r="E${rowNo}" s="47"/>`:xmlNumberCell(`E${rowNo}`,47,c),
    s===null?`<c r="F${rowNo}" s="49"/>`:xmlNumberCell(`F${rowNo}`,49,s)
  ];
  if(u!==null){
    cells.push(xmlNumberCell(`G${rowNo}`,47,u));
    cells.push(xmlFormulaCell(`H${rowNo}`,47,`G${rowNo}*D${rowNo}`));
  }else if(c!==null&&s!==null){
    cells.push(xmlFormulaCell(`G${rowNo}`,47,`E${rowNo}+F${rowNo}`));
    cells.push(xmlFormulaCell(`H${rowNo}`,47,`G${rowNo}*D${rowNo}`));
  }else if(c!==null){
    cells.push(`<c r="G${rowNo}" s="47"/>`);
    cells.push(xmlFormulaCell(`H${rowNo}`,47,`E${rowNo}*D${rowNo}`));
  }else if(s!==null){
    cells.push(`<c r="G${rowNo}" s="47"/>`);
    cells.push(xmlFormulaCell(`H${rowNo}`,47,`F${rowNo}*D${rowNo}`));
  }else{
    // Price is legitimately unknown: leave all price/amount cells visually blank.
    cells.push(`<c r="G${rowNo}" s="47"/>`);
    cells.push(`<c r="H${rowNo}" s="47"/>`);
  }
  return `<row r="${rowNo}" s="7" customFormat="1" ht="27.75" customHeight="1" spans="1:11">${cells.join('')}</row>`;
}
function patchUnifiedFactTemplateSheetXml(xml,data,workbookName){
  const raw=(Array.isArray(data)&&data.length)?[...data]:[{country:'GLOBAL',description:'Article',sku:'',quantity:0,cogs:null,shipping:null,unitTotal:null}];

  const preferred=['FRANCE','BELGIUM','CANADA','SWITZERLAND','LUXEMBOURG','GERMANY','SPAIN','ITALY','NETHERLANDS','AUSTRIA','PORTUGAL','REUNION ISLAND'];
  const rank=c=>{const i=preferred.indexOf(String(c||'').toUpperCase());return i<0?999:i};
  raw.sort((a,b)=>rank(a.country)-rank(b.country)||String(a.country||'').localeCompare(String(b.country||''),'en')||String(a.description||'').localeCompare(String(b.description||''),'fr'));

  const expanded=[];let lastCountry=null,no=0;
  for(const r of raw){
    const country=String(r.country||'').trim()||'GLOBAL';
    if(country!==lastCountry){
      expanded.push({isCountryHeader:true,country});
      lastCountry=country;no=0;
    }
    expanded.push({...r,no:++no});
  }

  // The bundled unified template is the user's historical FACT #10312:
  // header row 10, dynamic area rows 11-19, blank row 20, footer starts row 21.
  const firstDynamic=11,oldTotal=19,oldFooterStart=21;
  const totalRow=firstDynamic+expanded.length;
  const footerStart=totalRow+2;
  const delta=footerStart-oldFooterStart;

  const rowRe=/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
  const rows=[];let m;
  while((m=rowRe.exec(xml)))rows.push({n:Number(m[1]),xml:m[0]});

  const before=rows.filter(x=>x.n<firstDynamic).map(x=>x.xml).join('');
  const after=rows.filter(x=>x.n>=oldFooterStart)
    .map(x=>shiftTemplateRowXml(x.xml,x.n,x.n+delta,oldTotal,totalRow)).join('');

  const countryHeaderRows=[];
  const bodyXml=expanded.map((r,i)=>{
    const rowNo=firstDynamic+i;
    if(r.isCountryHeader){
      countryHeaderRows.push(rowNo);
      return unifiedFactCountryRow(r,rowNo);
    }
    return unifiedFactDataRow(r,rowNo,r.no);
  }).join('');

  const totalXml=`<row r="${totalRow}" ht="32.25" customHeight="1" spans="1:8"><c r="A${totalRow}" s="20"/><c r="B${totalRow}" s="50"/><c r="C${totalRow}" s="50"/><c r="D${totalRow}" s="51"/><c r="E${totalRow}" s="50"/><c r="F${totalRow}" s="52"/><c r="G${totalRow}" s="52"/><c r="H${totalRow}" s="52"><f>SUM(H${firstDynamic}:H${totalRow-1})</f></c></row>`;
  const blankXml=`<row r="${totalRow+1}" ht="15" customHeight="1" spans="1:8"><c r="A${totalRow+1}" s="20"/></row>`;

  const sheetData=xml.match(/<sheetData>[\s\S]*?<\/sheetData>/)?.[0];
  if(!sheetData)throw new Error('统一 FACT 模板缺少 sheetData');
  let out=xml.replace(sheetData,`<sheetData>${before}${bodyXml}${totalXml}${blankXml}${after}</sheetData>`);

  // Keep original top-area merges; rebuild dynamic country merges; shift the unchanged footer merges.
  out=out.replace(/<mergeCells count="(\d+)">([\s\S]*?)<\/mergeCells>/,(whole,countText,body)=>{
    const refs=[...body.matchAll(/ref="([^"]+)"/g)].map(x=>x[1]);
    const kept=[];
    for(const ref of refs){
      const nums=[...ref.matchAll(/([A-Z]{1,3})(\d+)/g)].map(x=>Number(x[2]));
      if(!nums.length)continue;
      if(Math.max(...nums)<firstDynamic)kept.push(ref);
      else if(Math.min(...nums)>=oldFooterStart)kept.push(shiftTemplateMergeRef(ref,oldFooterStart,delta));
    }
    for(const rn of countryHeaderRows)kept.push(`B${rn}:H${rn}`);
    return `<mergeCells count="${kept.length}">${kept.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
  });

  const finalMaxRow=Math.max(...rows.map(x=>x.n))+delta;
  out=out.replace(/<dimension ref="A1:K\d+"\/>/,`<dimension ref="A1:K${finalMaxRow}"/>`);

  const currency=currencyForWorkbook(workbookName);
  const labels=['No','Description','Quantity',`COGs (${currency})`,`Shipping (${currency})`,`COGs + Shipping (${currency})`,`Amount (${currency})`];
  ['B','C','D','E','F','G','H'].forEach((col,i)=>{
    const style=col==='D'?42:41;
    const re=new RegExp(`<c[^>]*\\br="${col}10"[^>]*>[\\s\\S]*?<\\/c>`);
    out=out.replace(re,xmlTextCell(`${col}10`,style,labels[i]));
  });

  const date=new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date());
  out=out.replace(/<c[^>]*\br="E3"[^>]*>[\s\S]*?<\/c>/,xmlTextCell('E3',62,`FACT - AUTO\n\n${date}`));

  const paymentRow=22+delta;
  out=out.replace(new RegExp(`<c[^>]*\\br="B${paymentRow}"[^>]*>[\\s\\S]*?<\\/c>`),xmlTextCell(`B${paymentRow}`,62,`Pour le règlement, merci de faire un virement en ${currency}`));

  return out;
}

/* V7.3.1 runtime state */
window.WRITE_FACT_V731={patchSheet:patchUnifiedFactTemplateSheetXml};
window.WRITE_V731_RUNTIME={
  ok:true,
  version:'7.3.1',
  unifiedFactTemplate:true,
  unifiedFactStyle:'USER_HISTORICAL_FACT_10312',
  priceMayBeBlank:true,
  pencilLegacyAuditAuthoritative:true
};
console.info('WRITE V7.3.1 unified FACT runtime ready',window.WRITE_V731_RUNTIME);

/* ---------- V7.4 Universal FACT non-blocking export contract ---------- */
try{
  const _legacyGeneratedFactRows=generatedFactRowsForWorkbook;
  generatedFactRowsForWorkbook=function(workbookName){
    let rows=[];
    try{ rows=_legacyGeneratedFactRows(workbookName)||[]; }catch(e){ console.warn('V7.4 legacy FACT rows fallback:',e); }
    if(Array.isArray(rows)&&rows.length)return rows;
    return generatedGenericFactRowsForWorkbook(workbookName);
  };

  buildGeneratedFactWorkbook=async function(workbookName){
    // Universal rule: classification/learning is never a prerequisite for export.
    // Every workbook uses the canonical FACT template; unknown price stays blank.
    const data=generatedFactRowsForWorkbook(workbookName);
    const resp=await fetch('./assets/FACT_TEMPLATE_UNIFIED_V2.xlsx?v=7.5.7-001',{cache:'no-store'});
    if(!resp.ok)throw new Error(`无法读取统一 FACT 标准模板（HTTP ${resp.status}）`);
    const templateBlob=await resp.blob();
    if(!templateBlob?.size)throw new Error('统一 FACT 标准模板为空');
    const archive=await PreserveZipArchive.open(templateBlob);
    const sheetPath='xl/worksheets/sheet1.xml';
    if(!archive.get(sheetPath))throw new Error('统一 FACT 标准模板缺少 sheet1.xml');
    const xml=await archive.text(sheetPath,16*1024*1024);
    const patcher=window.WRITE_FACT_V731?.patchSheet;
    if(typeof patcher!=='function')throw new Error('统一 FACT 格式引擎未加载');
    const patched=patcher(xml,data,workbookName);
    const rebuilt=await rebuildArchiveReplacingEntry(archive,sheetPath,enc.encode(patched));
    if(!rebuilt?.size)throw new Error('统一 FACT Excel 生成结果为空');
    return rebuilt;
  };

  window.WRITE_V740={
    contract:'SOURCE_DATA_FIRST',
    unknownProduct:'EXPORT_WITH_KNOWN_FIELDS',
    unknownPrice:'BLANK',
    learning:'POST_EXPORT_ENHANCEMENT_ONLY'
  };
}catch(e){console.error('WRITE V7.4 universal export override failed:',e)}

})();
