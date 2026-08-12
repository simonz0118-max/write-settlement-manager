/* WRITE Settlement Manager v5.3.3 - single-file browser bundle */
const norm = (v='') => String(v ?? '').trim();
const low = (v='') => norm(v).toLowerCase();

const LINE_CATEGORIES = [
  ['PENCIL','铅笔','Le Crayon Intemporel / 铅笔本体'],
  ['ENGRAVING','雕刻服务','Gravure Personnalisée / 雕刻'],
  ['REFILL','普通笔芯','可替换普通笔芯'],
  ['COLOR_REFILL','彩色笔芯','彩色笔芯 / Mines colorées'],
  ['GIFT_BOX','礼盒','Coffret Cadeau / 礼盒'],
  ['ERASER','橡皮 / 笔帽橡皮','Gomme-capuchon Shield / 橡皮配件'],
  ['NOTEBOOK','笔记本 / Carnet','Le Carnet Parfait / 笔记本配件'],
  ['GIFT_CARD','礼品卡','Carte-cadeau'],
  ['B2B','B2B / 专业订单','Commande Professionnelle'],
  ['OTHER','待确认','未命中已知规则'],
].map(([code,label,description])=>({code,label,description}));

const LABEL = Object.fromEntries(LINE_CATEGORIES.map(x=>[x.code,x.label]));

function quantityFromSku(sku='') {
  const m = norm(sku).match(/\*(\d+(?:\.\d+)?)\s*$/);
  return m ? Number(m[1]) : 1;
}


const LEARNED_RULES_STORAGE_KEY='write-learned-line-rules-v1';
function normalizeRuleToken(v=''){
  return low(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}
function learnedRuleKey(productName='',sku=''){
  const s=normalizeRuleToken(sku),n=normalizeRuleToken(productName);
  return s?`sku:${s}`:n?`name:${n}`:'';
}
function loadPersistentLineRules(){
  try{
    const raw=JSON.parse(localStorage.getItem(LEARNED_RULES_STORAGE_KEY)||'{}');
    return raw&&typeof raw==='object'?raw:{};
  }catch(e){return{}}
}
function savePersistentLineRule(productName='',sku='',category=''){
  if(!LABEL[category]||category==='OTHER')return;
  const key=learnedRuleKey(productName,sku);if(!key)return;
  const rules=loadPersistentLineRules();
  rules[key]={category,productName:norm(productName),sku:norm(sku),updatedAt:new Date().toISOString()};
  try{localStorage.setItem(LEARNED_RULES_STORAGE_KEY,JSON.stringify(rules))}catch(e){}
  window.WRITE_KB?.learnProduct?.(productName,sku,category,true)?.catch?.(()=>{});
}
function persistentCategoryFor(productName='',sku=''){
  const kbCategory=window.WRITE_KB?.productCategory?.(productName,sku);
  if(kbCategory)return kbCategory;
  const rules=loadPersistentLineRules();
  const skuKey=normalizeRuleToken(sku)?`sku:${normalizeRuleToken(sku)}`:'';
  const nameKey=normalizeRuleToken(productName)?`name:${normalizeRuleToken(productName)}`:'';
  return (skuKey&&rules[skuKey]?.category)||(nameKey&&rules[nameKey]?.category)||null;
}

function classifyLine(productName='', sku='') {
  const name = norm(productName), n = low(name), s = low(sku);
  const isFree = /^🎁/.test(name) || /100%\s*off|gratuit|cadeau offert/.test(n);
  let category = persistentCategoryFor(productName,sku) || 'OTHER';
  if (category!=='OTHER') {}
  else if (/commande professionnelle|professional order|cmd pro/.test(n)) category = 'B2B';
  else if (/carte[- ]cadeau|gift\s*card/.test(n)) category = 'GIFT_CARD';
  else if (/gravure|雕刻/.test(n) || /(^|\D)50505594077448/.test(s) || /雕刻/.test(s)) category = 'ENGRAVING';
  else if (/gomme[- ]?capuchon|gommes?[- ]capuchons?\s+shield|gomme.*shield/.test(n) || /(^|\s)2\s*gomme(?:\s|\*|$)/.test(s) || /58329286902024/.test(s)) category = 'ERASER';
  else if (/\ble carnet parfait\b|\bcarnet\b/.test(n) || /(^|\s)carnet(?:\s|\*|$)/.test(s)) category = 'NOTEBOOK';
  else if (/coffret cadeau|礼盒|盒子/.test(n) || /(^|\D)52838739738888/.test(s) || /盒子/.test(s)) category = 'GIFT_BOX';
  else if (/mines? color[ée]es?|彩色.*笔芯|pack.*mines/.test(n) || /qb-csbt/.test(s) || /(^|\D)(49624586256648|52725633384712)(\D|$)/.test(s) || /qb-6/.test(s)) category = 'COLOR_REFILL';
  else if (/mines? rechargeables?|\b4\s*mines\b|笔芯/.test(n) || /qb-4/.test(s) || /(^|\D)(45407586615560|45157341331720)(\D|$)/.test(s)) category = 'REFILL';
  else if (/le crayon intemporel|铅笔|crayon/.test(n) || /qb-(obsidienne|aluminium|carmin|nuit|jade|saturne)/.test(s) || /(^|\D)(45242109231368|45242109329672)(\D|$)/.test(s) || /铅笔/.test(s)) category = 'PENCIL';
  return { category, categoryLabel: LABEL[category], isFree, quantity: quantityFromSku(sku) };
}


const STRUCTURAL_FIELD_LABELS=new Set([
  '订单号','订单金额','产品总数','多品名','产品名称','商品名称','收货人国家','国家',
  'order id','order amount','product count','sku','product name','country',
  'commande','montant','produit','pays'
].map(v=>low(v)));
function isStructuralProductToken(value=''){
  const t=low(norm(value)).replace(/[：:]+$/,'').trim();
  if(!t)return false;
  if(STRUCTURAL_FIELD_LABELS.has(t))return true;
  if(/^(产品名称|商品名称|收货人国家|订单号|订单金额|产品总数|多品名)$/.test(t))return true;
  return false;
}
function isMeaningfulProductLine(productName='',sku=''){
  const name=norm(productName).trim();
  const code=norm(sku).trim();
  if(!name && !code)return false;
  if(isStructuralProductToken(name)||isStructuralProductToken(code))return false;
  return true;
}

function parseLineItems(order) {
  const names = norm(order.productNames).split(/\n+/).map(x=>x.trim());
  const skus = norm(order.skuLines).split(/\n+/).map(x=>x.trim());
  const manual = order.manualLineCategories || {};
  const count = Math.max(names.filter(Boolean).length ? names.length : 0, skus.filter(Boolean).length ? skus.length : 0, 1);
  const items=[];
  for(let i=0;i<count;i++) {
    const productName=names[i]||''; const sku=skus[i]||'';
    if(!isMeaningfulProductLine(productName,sku)) continue;
    const auto=classifyLine(productName,sku);
    const forced=manual[i+1];
    const resolved=forced && LABEL[forced] ? {...auto,category:forced,categoryLabel:LABEL[forced],manualCategory:true} : auto;
    items.push({ ...resolved, productName, sku, lineNo:i+1 });
  }
  return items;
}

function classifyOrder(order) {
  const items=parseLineItems(order);
  const paidItems=items.filter(x=>!x.isFree);
  const categories=new Set(items.map(x=>x.category));
  const paidCategories=new Set(paidItems.map(x=>x.category));
  const amount=Number(order.orderAmount)||0;
  let code='OTHER'; let label='待确认';
  if ([...categories].includes('B2B')) [code,label]=['B2B','B2B / 专业订单'];
  else if ([...categories].includes('GIFT_CARD')) [code,label]=['GIFT_CARD','礼品卡订单'];
  else if (amount===0 && (paidItems.length===0 || items.every(x=>x.isFree || x.category==='OTHER'))) [code,label]=['ZERO_FREE','赠品 / 0€订单'];
  else if (paidCategories.has('PENCIL')) [code,label]=['PENCIL_ORDER','铅笔订单'];
  else if (paidCategories.has('REFILL') || paidCategories.has('COLOR_REFILL')) [code,label]=['REFILL_ORDER','笔芯订单'];
  else if (paidCategories.has('GIFT_BOX') || paidCategories.has('ERASER') || paidCategories.has('NOTEBOOK')) [code,label]=['ACCESSORY_ORDER','礼盒 / 配件订单'];
  else if (paidCategories.has('ENGRAVING')) [code,label]=['SERVICE_ORDER','雕刻服务订单'];
  else if (amount===0) [code,label]=['ZERO_OTHER','0€待确认订单'];
  const unknownItems=items.filter(x=>x.category==='OTHER');
  return {...order, accountingCode:code, accountingCategory:label, lineItems:items, unknownItemCount:unknownItems.length,
    hasGift:items.some(x=>x.isFree), classificationStatus:unknownItems.length?'需复核':'已分类'};
}

function classifyOrders(orders=[]) {
  const classified=orders.map(classifyOrder);
  const lineItems=[];
  for(const o of classified) for(const item of o.lineItems) lineItems.push({...item, recordKey:o.recordKey, sourceRow:o.sourceRow, orderId:o.orderId, orderAmount:o.orderAmount, country:o.country, currency:o.currency, sourceFile:o.sourceFile, sourceSheet:o.sourceSheet});
  const orderMap=new Map();
  for(const o of classified){
    const k=o.accountingCategory; const r=orderMap.get(k)||{category:k,orders:0,amount:0,review:0}; r.orders++; r.amount+=Number(o.orderAmount)||0; if(o.classificationStatus==='需复核')r.review++; orderMap.set(k,r);
  }
  const lineMap=new Map();
  for(const item of lineItems){
    const k=item.categoryLabel; const r=lineMap.get(k)||{category:k,lines:0,quantity:0,freeQuantity:0,orders:new Set(),touchedAmountOrders:new Map()};
    r.lines++; r.quantity+=Number(item.quantity)||1; if(item.isFree)r.freeQuantity+=Number(item.quantity)||1; const rid=item.recordKey||item.orderId; r.orders.add(rid); r.touchedAmountOrders.set(rid,Number(item.orderAmount)||0); lineMap.set(k,r);
  }
  const orderSummary=[...orderMap.values()].sort((a,b)=>b.amount-a.amount);
  const lineSummary=[...lineMap.values()].map(r=>({category:r.category,lines:r.lines,quantity:r.quantity,freeQuantity:r.freeQuantity,orders:r.orders.size,touchedAmount:[...r.touchedAmountOrders.values()].reduce((a,b)=>a+b,0)})).sort((a,b)=>b.quantity-a.quantity);
  const unknown=lineItems.filter(x=>x.category==='OTHER');
  return {orders:classified,lineItems,orderSummary,lineSummary,unknown};
}


const enc=new TextEncoder();
function esc(v=''){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function colName(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function u16(n){return[n&255,(n>>>8)&255]}function u32(n){return[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
function zipStore(entries){const parts=[],central=[];let offset=0;for(const e of entries){const name=enc.encode(e.name),data=typeof e.data==='string'?enc.encode(e.data):e.data,crc=crc32(data);const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name]);parts.push(local,data);central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]));offset+=local.length+data.length}const centralSize=central.reduce((a,b)=>a+b.length,0),centralOffset=offset;return new Blob([...parts,...central,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralSize),...u32(centralOffset),...u16(0)])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
function cellXml(v,r,c,style=0){const ref=`${colName(c)}${r}`;if(v==null||v==='')return`<c r="${ref}" s="${style}"/>`;if(typeof v==='number'&&Number.isFinite(v))return`<c r="${ref}" s="${style}"><v>${v}</v></c>`;return`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`}

const K={text:0,header:1,int:2,currency:3,altText:4,altInt:5,altCurrency:6,percent:7,altPercent:8,title:9,subtitle:10,section:11,totalText:12,totalInt:13,totalCurrency:14,totalPercent:15,reviewHeader:16,center:17,wrap:18,muted:19};
function formatKind(sheet,r,c){for(const rule of sheet.formatRules||[]){if(r>=rule.r1&&r<=rule.r2&&c>=rule.c1&&c<=rule.c2)return rule.kind}if(sheet.currencyColumns?.includes(c))return'currency';if(sheet.percentColumns?.includes(c))return'percent';if(sheet.integerColumns?.includes(c))return'int';if(sheet.centerColumns?.includes(c))return'center';if(sheet.wrapColumns?.includes(c))return'wrap';return'text'}
function styleFor(sheet,ri,ci,value){const r=ri+1,c=ci+1;if(r===sheet.titleRow)return K.title;if(r===sheet.subtitleRow)return K.subtitle;if(sheet.sectionRows?.includes(r))return K.section;if(sheet.headerRows?.includes(r))return sheet.reviewMode?K.reviewHeader:K.header;const kind=formatKind(sheet,r,c);const total=sheet.totalRows?.includes(r),alt=sheet.bandedRows&&r>(sheet.headerRows?.[0]||1)&&r%2===0;if(total){if(kind==='currency')return K.totalCurrency;if(kind==='percent')return K.totalPercent;if(kind==='int')return K.totalInt;return K.totalText}if(kind==='currency')return alt?K.altCurrency:K.currency;if(kind==='percent')return alt?K.altPercent:K.percent;if(kind==='int')return alt?K.altInt:K.int;if(kind==='center')return K.center;if(kind==='wrap')return K.wrap;return alt?K.altText:K.text}
function sheetXml(sheet){const rows=sheet.rows||[],widths=sheet.widths||[],freezeRow=sheet.freezeRow??1,freezeCol=sheet.freezeCol??0,filterRow=sheet.autoFilterRow??0;const maxCols=Math.max(1,rows.reduce((m,r)=>Math.max(m,r?.length||0),0)),lastCol=colName(maxCols),lastRow=Math.max(1,rows.length);let xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';xml+='<sheetViews><sheetView workbookViewId="0" showGridLines="0">';if(freezeRow>0||freezeCol>0){const topLeft=`${colName(freezeCol+1)}${freezeRow+1}`,pane=freezeRow>0&&freezeCol>0?'bottomRight':freezeRow>0?'bottomLeft':'topRight';xml+=`<pane${freezeCol?` xSplit="${freezeCol}"`:''}${freezeRow?` ySplit="${freezeRow}"`:''} topLeftCell="${topLeft}" activePane="${pane}" state="frozen"/>`}xml+='</sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/>';if(widths.length)xml+='<cols>'+widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols>';xml+='<sheetData>';rows.forEach((row,ri)=>{const r=ri+1;let ht=24;if(r===sheet.titleRow)ht=38;else if(r===sheet.subtitleRow)ht=30;else if(sheet.headerRows?.includes(r)||sheet.sectionRows?.includes(r))ht=30;else if(sheet.tallRows?.includes(r))ht=38;xml+=`<row r="${r}" ht="${ht}" customHeight="1">`;for(let ci=0;ci<(row||[]).length;ci++)xml+=cellXml(row[ci],r,ci+1,styleFor(sheet,ri,ci,row[ci]));xml+='</row>'});xml+='</sheetData>';if(sheet.merges?.length)xml+=`<mergeCells count="${sheet.merges.length}">${sheet.merges.map(x=>`<mergeCell ref="${x}"/>`).join('')}</mergeCells>`;if(filterRow>0&&rows.length>=filterRow)xml+=`<autoFilter ref="A${filterRow}:${lastCol}${lastRow}"/>`;xml+='<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';return xml}

const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="[$-40C]#,##0.00 [$€-40C]"/><numFmt numFmtId="165" formatCode="[$-40C]0.00%"/></numFmts><fonts count="7"><font><sz val="11"/><name val="Aptos"/><color rgb="FF1D1D1F"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="20"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font><font><sz val="11"/><name val="Aptos"/><color rgb="FF6E6E73"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FF1D1D1F"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FF9A3412"/></font><font><sz val="11"/><name val="Aptos"/><color rgb="FF6E6E73"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1C1C1E"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F7"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E5EA"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFAFAFC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7F7F8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E5EA"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FFC7C7CC"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="20">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="3" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="5" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="4" borderId="2" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="3" fontId="4" fillId="4" borderId="2" xfId="0" applyFill="1" applyFont="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="4" fillId="4" borderId="2" xfId="0" applyFill="1" applyFont="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="4" fillId="4" borderId="2" xfId="0" applyFill="1" applyFont="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="7" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function buildXlsx(sheets){const entries=[],workbookSheets=sheets.map((s,i)=>`<sheet name="${esc(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('');entries.push({name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`});entries.push({name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});entries.push({name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="22000" windowHeight="14000"/></bookViews><sheets>${workbookSheets}</sheets></workbook>`});entries.push({name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});entries.push({name:'xl/styles.xml',data:styles});sheets.forEach((s,i)=>entries.push({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s)}));return zipStore(entries)}
let currentExportObjectUrl='';
function clearExportDownloadLink(){
  document.getElementById('exportReadyBar')?.remove();
  if(currentExportObjectUrl){
    try{URL.revokeObjectURL(currentExportObjectUrl)}catch(e){}
    currentExportObjectUrl='';
  }
}
function showExportDownloadLink(blob,filename){
  clearExportDownloadLink();
  currentExportObjectUrl=URL.createObjectURL(blob);
  const bar=document.createElement('div');
  bar.id='exportReadyBar';
  bar.className='export-ready-bar';
  const sizeMb=(blob.size/1024/1024).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  bar.innerHTML=`
    <div class="export-ready-copy">
      <strong>✓ 结算包已生成</strong>
      <span>${escapeHtml(filename)} · ${sizeMb} MB</span>
    </div>
    <a class="export-ready-download" href="${currentExportObjectUrl}" download="${escapeHtml(filename)}">下载结算包</a>
    <button class="export-ready-close" type="button" aria-label="关闭">×</button>`;
  document.body.appendChild(bar);
  bar.querySelector('.export-ready-close')?.addEventListener('click',clearExportDownloadLink);
  return currentExportObjectUrl;
}
function downloadBlob(blob,filename){
  if(!(blob instanceof Blob)||!blob.size)throw new Error('下载文件为空。');
  const url=showExportDownloadLink(blob,filename);
  try{
    const a=document.createElement('a');
    a.href=url;a.download=filename;a.style.display='none';
    document.body.appendChild(a);a.click();a.remove();
  }catch(err){
    console.warn('自动下载被浏览器阻止，请使用页面上的“下载结算包”按钮。',err);
  }
  return url;
}


// v6.5.12 FACT template preservation + backfill engine.
// The original XLSX is treated as a template. Only FACT data cell VALUES are replaced;
// styles, borders, merged cells, row heights, column widths, formulas/layout and all other package parts are preserved.

const ZIP_EOCD=0x06054b50, ZIP_CEN=0x02014b50, ZIP_LOC=0x04034b50;
const utf8dec=new TextDecoder('utf-8');

function basename(path=''){return String(path).replace(/\\/g,'/').split('/').pop()||'workbook.xlsx'}
function xmlDecodeLocal(value=''){
  return String(value).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'").replace(/&amp;/g,'&')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}
function zipFileName(bytes,flags){try{return new TextDecoder((flags&0x800)?'utf-8':'utf-8').decode(bytes)}catch{return utf8dec.decode(bytes)}}

class PreserveZipArchive{
  constructor(blob,entries){this.blob=blob;this.entries=entries;this.byName=new Map(entries.map(e=>[e.name,e]));}
  static async open(blob){
    const tailSize=Math.min(blob.size,65557), tail=new Uint8Array(await blob.slice(blob.size-tailSize).arrayBuffer());
    const v=new DataView(tail.buffer,tail.byteOffset,tail.byteLength); let pos=-1;
    for(let i=tail.length-22;i>=0;i--){if(v.getUint32(i,true)===ZIP_EOCD){pos=i;break}}
    if(pos<0)throw new Error('无法读取 XLSX ZIP 尾部目录');
    const total=v.getUint16(pos+10,true), centralSize=v.getUint32(pos+12,true), centralOffset=v.getUint32(pos+16,true);
    if(total===0xffff||centralOffset===0xffffffff||centralSize===0xffffffff)throw new Error('暂不支持 ZIP64 XLSX');
    const central=new Uint8Array(await blob.slice(centralOffset,centralOffset+centralSize).arrayBuffer());
    const cv=new DataView(central.buffer,central.byteOffset,central.byteLength), entries=[]; let p=0;
    while(p+46<=central.length&&entries.length<total){
      if(cv.getUint32(p,true)!==ZIP_CEN)break;
      const flags=cv.getUint16(p+8,true), method=cv.getUint16(p+10,true), modTime=cv.getUint16(p+12,true), modDate=cv.getUint16(p+14,true);
      const crc=cv.getUint32(p+16,true), compressedSize=cv.getUint32(p+20,true), uncompressedSize=cv.getUint32(p+24,true);
      const nameLen=cv.getUint16(p+28,true), extraLen=cv.getUint16(p+30,true), commentLen=cv.getUint16(p+32,true), externalAttrs=cv.getUint32(p+38,true), localOffset=cv.getUint32(p+42,true);
      const name=zipFileName(central.slice(p+46,p+46+nameLen),flags).replace(/^\//,'');
      entries.push({name,flags,method,modTime,modDate,crc,compressedSize,uncompressedSize,externalAttrs,localOffset});
      p+=46+nameLen+extraLen+commentLen;
    }
    return new PreserveZipArchive(blob,entries);
  }
  get(name){return this.byName.get(String(name).replace(/^\//,''))}
  async dataRange(entry){
    const h=new DataView(await this.blob.slice(entry.localOffset,entry.localOffset+30).arrayBuffer());
    if(h.getUint32(0,true)!==ZIP_LOC)throw new Error(`XLSX 条目损坏：${entry.name}`);
    const nameLen=h.getUint16(26,true), extraLen=h.getUint16(28,true), start=entry.localOffset+30+nameLen+extraLen;
    return {start,end:start+entry.compressedSize};
  }
  async compressedBlob(entry){const {start,end}=await this.dataRange(entry);return this.blob.slice(start,end)}
  async stream(entryOrName){
    const entry=typeof entryOrName==='string'?this.get(entryOrName):entryOrName;if(!entry)throw new Error(`找不到 XLSX 条目：${entryOrName}`);
    const source=(await this.compressedBlob(entry)).stream();
    if(entry.method===0)return source;
    if(entry.method===8)return source.pipeThrough(new DecompressionStream('deflate-raw'));
    throw new Error(`不支持 XLSX 压缩方式：${entry.method}`);
  }
  async bytes(entryOrName,max=32*1024*1024){
    const entry=typeof entryOrName==='string'?this.get(entryOrName):entryOrName;if(!entry)return new Uint8Array();
    if(entry.uncompressedSize>max)throw new Error(`XLSX 条目过大，不能整块读取：${entry.name}`);
    const reader=(await this.stream(entry)).getReader(),chunks=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new Error(`XLSX 条目过大：${entry.name}`);chunks.push(value)}
    const out=new Uint8Array(size);let off=0;for(const c of chunks){out.set(c,off);off+=c.length}return out;
  }
  async text(name,max=32*1024*1024){return utf8dec.decode(await this.bytes(name,max))}
}
function normalizeTargetLocal(target){
  const clean=xmlDecodeLocal(target).replace(/^\//,'').replace(/^\.\//,'');
  return clean.startsWith('xl/')?clean:`xl/${clean}`;
}
function findFactSheetPath(workbookXml,relsXml){
  const relationships=new Map();
  let match;
  // Supports <Relationship> and namespace-prefixed forms such as <ns0:Relationship>.
  const relRe=/<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*)\/?\s*>/g;
  while((match=relRe.exec(relsXml))){
    const attrs=match[1];
    const id=/\bId=["']([^"']+)["']/.exec(attrs)?.[1];
    const target=/\bTarget=["']([^"']+)["']/.exec(attrs)?.[1];
    if(id&&target)relationships.set(id,normalizeTargetLocal(target));
  }

  const sheets=[];
  const sheetRe=/<(?:[A-Za-z_][\w.-]*:)?sheet\b([^>]*)\/?\s*>/g;
  while((match=sheetRe.exec(workbookXml))){
    const attrs=match[1];
    const name=xmlDecodeLocal(/\bname=["']([^"']+)["']/.exec(attrs)?.[1]||'');
    const rid=/\b(?:r:)?id=["']([^"']+)["']/.exec(attrs)?.[1];
    const path=relationships.get(rid)||'';
    if(path)sheets.push({name,path});
  }

  const named=sheets.filter(item=>/FACT/i.test(item.name));
  if(named.length){
    const cn=named.find(item=>/CN/i.test(item.name));
    return (cn||named[0]).path;
  }
  if(sheets.length===1)return sheets[0].path;
  return '';
}
function normalizeCountry(v=''){
  const s=norm(v).toUpperCase().replace(/\s+/g,' ');
  const aliases={'FR':'FRANCE','BE':'BELGIUM','CA':'CANADA','CH':'SWITZERLAND','LU':'LUXEMBOURG','DE':'GERMANY','US':'UNITED STATES','USA':'UNITED STATES','ES':'SPAIN','UA':'UKRAINE'};
  return aliases[s]||s;
}
function isColorPack6(item){
  const x=`${item.productName||''} ${item.sku||''}`.toLowerCase();
  return /pack[^0-9]*6|52725633384712|49624586256648|qb-6/.test(x);
}
function factDescriptionType(desc=''){
  const d=norm(desc).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const pencil=/stylo\s*eternel\s*x\s*(\d+)/i.exec(d);
  if(pencil)return {type:'pencil',bucket:Number(pencil[1])};

  const upsell=/upsell/.test(d);
  if(/lot de 2 gommes/.test(d))return {type:upsell?'eraserUpsell':'eraserBase'};
  if(/carnet/.test(d))return {type:upsell?'notebookUpsell':'notebookBase'};

  if(/lot de 4 mines rechargeables/.test(d))return {type:upsell?'refill4Upsell':'refill4Base'};
  if(/lot de 6 mines rechargeables/.test(d))return {type:upsell?'refill6Upsell':'refill6Base'};
  if(/lot de 6 mines colorees/.test(d))return {type:upsell?'color6Upsell':'color6Base'};
  if(/lot de 12 mines colorees/.test(d))return {type:upsell?'color12Upsell':'color12Base'};
  if(/mines colorees/.test(d))return {type:'colorSingleUpsell'};

  if(/gravure personnalis/.test(d))return {type:'engraving'};
  if(/coffret cadeau/.test(d))return {type:'giftBox'};
  if(/frais d.importation/.test(d))return {type:'derivedCharge'};
  if(/cout du moule/.test(d))return {type:'fixedCharge'};
  return {type:'unknown'};
}
function accessoryPackSize(item){
  const x=`${item.productName||''} ${item.sku||''}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/(?:^|\D)12\s*mines/.test(x)||/\b12\s*mines\b/.test(x))return 12;
  if(/(?:^|\D)6\s*mines/.test(x)||/\b6\s*mines\b/.test(x)||/qb-6/.test(x))return 6;
  if(/(?:^|\D)4\s*mines/.test(x)||/\b4\s*mines\b/.test(x)||/qb-4/.test(x))return 4;
  return 1;
}
function sourceDataForWorkbook(workbookName){
  const wbOrders=(classified?.orders||[]).filter(o=>o.sourceFile===workbookName);
  const wbLines=(classified?.lineItems||[]).filter(x=>x.sourceFile===workbookName);
  const paidLines=wbLines.filter(x=>!x.isFree);

  const pencilQtyByOrder=new Map();
  for(const line of paidLines){
    if(line.category==='PENCIL'){
      const orderId=String(line.recordKey||line.orderId);
      pencilQtyByOrder.set(orderId,(pencilQtyByOrder.get(orderId)||0)+(Number(line.quantity)||1));
    }
  }

  const pencilBucket=new Map();
  for(const order of wbOrders){
    const country=normalizeCountry(order.country);
    const qty=Math.round(pencilQtyByOrder.get(String(order.recordKey||order.orderId))||0);
    if(qty>0){
      const bucketId=`${country}\u0001${qty}`;
      pencilBucket.set(bucketId,(pencilBucket.get(bucketId)||0)+1);
    }
  }

  const buckets=new Map();
  const inputLedger=new Map();
  const addBucket=(bucketType,country,quantity)=>{
    const bucketId=`${bucketType}\u0001${country}`;
    buckets.set(bucketId,(buckets.get(bucketId)||0)+quantity);
  };
  const addLedger=(category,quantity)=>{
    inputLedger.set(category,(inputLedger.get(category)||0)+quantity);
  };

  let engraving=0,boxWithPencil=0,boxWithoutPencil=0;

  for(const line of paidLines){
    const quantity=Math.max(0,Number(line.quantity)||1);
    const country=normalizeCountry(line.country);
    const hasPencil=(pencilQtyByOrder.get(String(line.recordKey||line.orderId))||0)>0;
    const mode=hasPencil?'Upsell':'Base';

    addLedger(line.category,quantity);

    if(line.category==='ERASER')addBucket(`eraser${mode}`,country,quantity);
    else if(line.category==='NOTEBOOK')addBucket(`notebook${mode}`,country,quantity);
    else if(line.category==='REFILL'){
      const packSize=accessoryPackSize(line);
      addBucket(`refill${packSize}${mode}`,country,quantity);
    }
    else if(line.category==='COLOR_REFILL'){
      const packSize=accessoryPackSize(line);
      if(packSize===12)addBucket(`color12${mode}`,country,quantity);
      else if(packSize===6)addBucket(`color6${mode}`,country,quantity);
      else addBucket('colorSingleUpsell',country,quantity);
    }
    else if(line.category==='ENGRAVING')engraving+=quantity;
    else if(line.category==='GIFT_BOX'){
      if(hasPencil)boxWithPencil+=quantity;
      else boxWithoutPencil+=quantity;
    }
  }

  return {
    wbOrders,wbLines,paidLines,pencilQtyByOrder,pencilBucket,buckets,
    inputLedger,engraving,boxWithPencil,boxWithoutPencil
  };
}

function targetQuantity(src,kind,country,row,context){
  if(kind.type==='pencil')return src.pencilBucket.get(`${country}\u0001${kind.bucket}`)||0;
  if(/^(eraser|notebook|refill4|refill6|color6|color12)(Base|Upsell)$/.test(kind.type)){
    return src.buckets.get(`${kind.type}\u0001${country}`)||0;
  }
  if(kind.type==='colorSingleUpsell')return src.buckets.get(`colorSingleUpsell\u0001${country}`)||0;
  if(kind.type==='engraving')return src.engraving;
  if(kind.type==='giftBox'){
    if(row===context.firstBoxRow)return src.boxWithPencil;
    if(row===context.secondBoxRow)return src.boxWithoutPencil;
    return 0;
  }
  return 0;
}

function buildFactBackfillPlan(workbookName,factRows){
  const src=sourceDataForWorkbook(workbookName),
        plan=new Map(),
        boxRows=factRows.filter(r=>factDescriptionType(r.description).type==='giftBox').sort((a,b)=>a.sourceRow-b.sourceRow),
        context={firstBoxRow:boxRows[0]?.sourceRow,secondBoxRow:boxRows[1]?.sourceRow},
        allocated=new Map(),
        mappedTargets=new Set();

  let total=0;
  for(const r of factRows){
    const kind=factDescriptionType(r.description),
          country=normalizeCountry(r.country),
          unit=Number.isFinite(Number(r.unitTotal))
            ?Number(r.unitTotal)
            :((Number(r.cogs)||0)+(Number(r.shipping)||0));

    let quantity=0;
    if(!['derivedCharge','fixedCharge','unknown'].includes(kind.type)){
      quantity=targetQuantity(src,kind,country,Number(r.sourceRow),context);
      mappedTargets.add(`${kind.type}\u0001${country}`);
    }

    quantity=Math.max(0,Math.round(quantity));
    const amount=Math.round((quantity*unit+Number.EPSILON)*100)/100;
    plan.set(Number(r.sourceRow),{quantity,amount,kind:kind.type,country});
    allocated.set(kind.type,(allocated.get(kind.type)||0)+quantity);
    total+=amount;
  }

  return {
    plan,total:Math.round((total+Number.EPSILON)*100)/100,
    src,allocated,mappedTargets
  };
}

/*
 * Export invariant:
 * Every PAID order line must be one of:
 *   A. represented in a FACT target row, or
 *   B. explicitly designated as a derived/fixed/system charge.
 * A classified paid product is never allowed to disappear silently.
 */

const AUTO_FACT_PRICE_STORAGE_KEY='write-auto-fact-price-rules-v1';

function loadAutoFactPriceRules(){
  try{
    const data=JSON.parse(localStorage.getItem(AUTO_FACT_PRICE_STORAGE_KEY)||'{}');
    return data&&typeof data==='object'?data:{};
  }catch(e){return{}}
}
function saveAutoFactPriceRule(country,targetType,unitPrice,source='CURRENT_ORDER'){
  const price=Number(unitPrice);
  if(!Number.isFinite(price)||price<0)return;
  const ruleId=`${normalizeCountry(country)}\u0001${targetType}`;
  const rules=loadAutoFactPriceRules();
  rules[ruleId]={
    country:normalizeCountry(country),
    targetType,
    unitPrice:Math.round((price+Number.EPSILON)*10000)/10000,
    source,
    updatedAt:new Date().toISOString()
  };
  try{localStorage.setItem(AUTO_FACT_PRICE_STORAGE_KEY,JSON.stringify(rules))}catch(e){}
  window.WRITE_KB?.learnPrice?.(country,targetType,price,source)?.catch?.(()=>{});
}
function savedAutoFactUnitPrice(country,targetType){
  const kbPrice=window.WRITE_KB?.factPrice?.(country,targetType);
  if(Number.isFinite(kbPrice))return kbPrice;
  const rules=loadAutoFactPriceRules();
  const ruleId=`${normalizeCountry(country)}\u0001${targetType}`;
  const price=Number(rules[ruleId]?.unitPrice);
  return Number.isFinite(price)?price:null;
}
function lineTargetType(line,pencilQtyByOrder){
  const hasPencil=(pencilQtyByOrder.get(String(line.recordKey||line.orderId))||0)>0;
  const mode=hasPencil?'Upsell':'Base';
  const packSize=accessoryPackSize(line);
  if(line.category==='ERASER')return `eraser${mode}`;
  if(line.category==='NOTEBOOK')return `notebook${mode}`;
  if(line.category==='REFILL')return `refill${packSize}${mode}`;
  if(line.category==='COLOR_REFILL'){
    return packSize===12?`color12${mode}`:packSize===6?`color6${mode}`:'colorSingleUpsell';
  }
  if(line.category==='ENGRAVING')return 'engraving';
  if(line.category==='GIFT_BOX')return 'giftBox';
  return '';
}
function targetDescription(targetType,bucket=0){
  const labels={
    eraserBase:'Lot de 2 gommes',
    eraserUpsell:'Lot de 2 gommes UPSELL',
    notebookBase:'Carnet X1',
    notebookUpsell:'Carnet X1 UPSELL',
    refill4Base:'4 mines rechargeables',
    refill4Upsell:'4 mines rechargeables UPSELL',
    refill6Base:'Lot de 6 mines rechargeables',
    refill6Upsell:'Lot de 6 mines rechargeables UPSELL',
    color6Base:"Mines colorées - Pack de 6 mines |36% d'économie",
    color6Upsell:"Mines colorées - Pack de 6 mines |36% d'économie UPSELL",
    color12Base:"Mines colorées - Pack de 12 mines |47% d'économie",
    color12Upsell:"Mines colorées - Pack de 12 mines |47% d'économie UPSELL",
    colorSingleUpsell:'Mines colorées UPSELL'
  };
  if(targetType==='pencil')return `Stylo eternel X${bucket}`;
  return labels[targetType]||targetType;
}
function inferUnitPriceFromCurrentOrders(workbookName,targetType,country,bucket=0){
  const source=sourceDataForWorkbook(workbookName);
  const targetCountry=normalizeCountry(country);
  const orderById=new Map(source.wbOrders.map(o=>[String(o.recordKey||o.orderId),o]));
  const paidQtyByOrder=new Map();

  for(const line of source.paidLines){
    const orderId=String(line.recordKey||line.orderId);
    paidQtyByOrder.set(orderId,(paidQtyByOrder.get(orderId)||0)+(Number(line.quantity)||1));
  }

  let weightedValue=0,weightedQty=0;

  if(targetType==='pencil'){
    for(const order of source.wbOrders){
      const orderId=String(order.recordKey||order.orderId);
      const pencilQty=Math.round(source.pencilQtyByOrder.get(orderId)||0);
      if(pencilQty!==Number(bucket) || normalizeCountry(order.country)!==targetCountry)continue;
      const orderAmount=Number(order.orderAmount)||0;
      if(orderAmount<=0)continue;
      const perUnit=orderAmount/Math.max(1,pencilQty);
      weightedValue+=perUnit*pencilQty;
      weightedQty+=pencilQty;
    }
  }else{
    for(const line of source.paidLines){
      if(normalizeCountry(line.country)!==targetCountry)continue;
      if(lineTargetType(line,source.pencilQtyByOrder)!==targetType)continue;
      const order=orderById.get(String(line.recordKey||line.orderId));
      const orderAmount=Number(order?.orderAmount)||0;
      const totalPaidQty=paidQtyByOrder.get(String(line.recordKey||line.orderId))||1;
      if(orderAmount<=0)continue;
      const inferred=orderAmount/Math.max(1,totalPaidQty);
      const qty=Number(line.quantity)||1;
      weightedValue+=inferred*qty;
      weightedQty+=qty;
    }
  }

  let learned=weightedQty>0?weightedValue/weightedQty:null;
  if(!Number.isFinite(learned))learned=savedAutoFactUnitPrice(targetCountry,targetType);

  // Last fallback: average the same learned CN product type from other countries.
  if(!Number.isFinite(learned)){
    const candidates=LEARNED_PENCIL_FACT_ROWS
      .filter(row=>factDescriptionType(row.description).type===targetType)
      .map(row=>{
        const unit=Number(row.unitTotal);
        return Number.isFinite(unit)?unit:((Number(row.cogs)||0)+(Number(row.shipping)||0));
      })
      .filter(Number.isFinite);
    learned=candidates.length?candidates.reduce((a,b)=>a+b,0)/candidates.length:0;
  }

  learned=Math.max(0,Number(learned)||0);
  saveAutoFactPriceRule(targetCountry,targetType,learned,'CURRENT_ORDER_OR_TEMPLATE');
  return learned;
}
function buildDynamicFactSupplementRows(workbookName,factRows){
  const source=sourceDataForWorkbook(workbookName);
  const supplements=[];
  const existingTargets=new Set();

  for(const row of factRows){
    const parsed=factDescriptionType(row.description);
    const country=normalizeCountry(row.country);
    existingTargets.add(`${country}\u0001${parsed.type}${parsed.type==='pencil'?`\u0001${parsed.bucket}`:''}`);
  }

  let nextRow=Math.max(172,...factRows.map(r=>Number(r.sourceRow)||0))+2;
  const needed=new Map();

  for(const line of source.paidLines){
    if(['PENCIL','ENGRAVING','GIFT_BOX','B2B','GIFT_CARD'].includes(line.category))continue;
    const targetType=lineTargetType(line,source.pencilQtyByOrder);
    if(!targetType)continue;
    const country=normalizeCountry(line.country);
    const targetId=`${country}\u0001${targetType}`;
    if(!needed.has(targetId))needed.set(targetId,{country,targetType,quantity:0});
    needed.get(targetId).quantity+=(Number(line.quantity)||1);
  }

  for(const item of needed.values()){
    const targetId=`${item.country}\u0001${item.targetType}`;
    if(existingTargets.has(targetId))continue;
    const unitPrice=inferUnitPriceFromCurrentOrders(workbookName,item.targetType,item.country);
    supplements.push({
      sourceRow:nextRow++,
      country:item.country,
      description:targetDescription(item.targetType),
      quantity:item.quantity,
      cogs:unitPrice,
      shipping:0,
      unitTotal:unitPrice,
      amount:Math.round((item.quantity*unitPrice+Number.EPSILON)*100)/100,
      dynamic:true,
      learnedPrice:true
    });
  }

  for(const [bucketId,orderCount] of source.pencilBucket.entries()){
    const parts=String(bucketId).split('\u0001');
    const country=parts[0]||'';
    const bucket=Number(parts[1]||0);
    const targetId=`${country}\u0001pencil\u0001${bucket}`;
    if(existingTargets.has(targetId))continue;
    const unitPrice=inferUnitPriceFromCurrentOrders(workbookName,'pencil',country,bucket);
    supplements.push({
      sourceRow:nextRow++,
      country,
      description:targetDescription('pencil',bucket),
      quantity:orderCount,
      cogs:unitPrice,
      shipping:0,
      unitTotal:unitPrice,
      amount:Math.round((orderCount*unitPrice+Number.EPSILON)*100)/100,
      dynamic:true,
      learnedPrice:true
    });
  }

  return supplements;
}
function factRowsWithAutoLearning(workbookName,factRows){
  return [...factRows,...buildDynamicFactSupplementRows(workbookName,factRows)];
}
function dynamicFactRowXml(row){
  const rn=Number(row.sourceRow);
  const unit=Number(row.unitTotal)||0;
  const qty=Number(row.quantity)||0;
  const amount=Math.round((qty*unit+Number.EPSILON)*100)/100;
  return `<row r="${rn}" s="80" customFormat="1" ht="18" customHeight="1" spans="1:8">`+
    `<c r="A${rn}" s="94"/>`+
    `<c r="B${rn}" s="124" t="inlineStr"><is><t>${esc(row.country||'')}</t></is></c>`+
    `<c r="C${rn}" s="125" t="inlineStr"><is><t>${esc(row.description||'AUTO LEARNED')}</t></is></c>`+
    `<c r="D${rn}" s="125"><v>${qty}</v></c>`+
    `<c r="E${rn}" s="126"><v>${unit}</v></c>`+
    `<c r="F${rn}" s="124"><v>0</v></c>`+
    `<c r="G${rn}" s="126"><f>E${rn}+F${rn}</f><v>${unit}</v></c>`+
    `<c r="H${rn}" s="127"><f>G${rn}*D${rn}</f><v>${amount}</v></c>`+
    `</row>`;
}
function appendDynamicFactRows(xml,rows){
  if(!rows?.length)return xml;
  const maxRow=Math.max(...rows.map(r=>Number(r.sourceRow)||0));
  let out=xml.replace(/<dimension ref="A1:J\d+"\/>/,`<dimension ref="A1:J${maxRow}"/>`);
  const extra=rows.map(dynamicFactRowXml).join('');
  out=out.replace('</sheetData>',extra+'</sheetData>');
  return out;
}

function factCompletenessAudit(workbookName,factRows){
  const built=buildFactBackfillPlan(workbookName,factRows);
  const source=built.src;
  const issues=[];
  const lineTargets=[];

  const targetExists=(targetType,country)=>{
    return factRows.some(row=>{
      const parsed=factDescriptionType(row.description);
      return parsed.type===targetType && normalizeCountry(row.country)===country;
    });
  };

  for(const line of source.paidLines){
    if(line.category==='PENCIL')continue;

    const country=normalizeCountry(line.country);
    const hasPencil=(source.pencilQtyByOrder.get(String(line.recordKey||line.orderId))||0)>0;
    const mode=hasPencil?'Upsell':'Base';
    const packSize=accessoryPackSize(line);

    let targetType='';
    if(line.category==='ERASER')targetType=`eraser${mode}`;
    else if(line.category==='NOTEBOOK')targetType=`notebook${mode}`;
    else if(line.category==='REFILL')targetType=`refill${packSize}${mode}`;
    else if(line.category==='COLOR_REFILL'){
      targetType=packSize===12?`color12${mode}`:packSize===6?`color6${mode}`:'colorSingleUpsell';
    }
    else if(line.category==='ENGRAVING')targetType='engraving';
    else if(line.category==='GIFT_BOX')targetType='giftBox';
    else if(['B2B','GIFT_CARD'].includes(line.category))targetType='SYSTEM_EXCLUDED';
    else targetType='UNMAPPED';

    lineTargets.push({...line,targetType,country});

    if(targetType==='UNMAPPED'){
      const identity=norm(line.productName).trim()||norm(line.sku).trim()||`订单 ${line.orderId} 第 ${line.lineNo||'?'} 个商品`;
      issues.push({
        type:'UNMAPPED_PRODUCT',
        orderId:line.orderId,
        product:identity,
        sku:line.sku,
        country,
        quantity:line.quantity,
        sourceFile:line.sourceFile,
        sourceSheet:line.sourceSheet,
        sourceRow:line.sourceRow
      });
    }else if(targetType!=='SYSTEM_EXCLUDED' && targetType!=='giftBox' && targetType!=='engraving' && !targetExists(targetType,country)){
      issues.push({type:'NO_FACT_TARGET',orderId:line.orderId,product:line.productName,sku:line.sku,country,quantity:line.quantity,target:targetType});
    }
  }

  for(const [bucketId,orderCount] of source.pencilBucket.entries()){
    const parts=String(bucketId).split('\u0001');
    const country=parts[0]||'';
    const bucket=Number(parts[1]||0);
    const exists=factRows.some(row=>{
      const parsed=factDescriptionType(row.description);
      return parsed.type==='pencil' && Number(parsed.bucket)===bucket && normalizeCountry(row.country)===country;
    });
    if(!exists)issues.push({type:'NO_PENCIL_BUCKET',country,bucket,orders:orderCount});
  }

  const expectedByTarget=new Map();
  const actualByTarget=new Map();

  for(const item of lineTargets){
    if(!item.targetType || ['SYSTEM_EXCLUDED','UNMAPPED','giftBox','engraving'].includes(item.targetType))continue;
    const targetId=`${item.targetType}\u0001${item.country}`;
    expectedByTarget.set(targetId,(expectedByTarget.get(targetId)||0)+(Number(item.quantity)||1));
  }

  for(const [,planned] of built.plan.entries()){
    const targetType=planned.kind;
    if(!targetType || ['pencil','giftBox','engraving','derivedCharge','fixedCharge','unknown'].includes(targetType))continue;
    const targetId=`${targetType}\u0001${planned.country}`;
    actualByTarget.set(targetId,(actualByTarget.get(targetId)||0)+(Number(planned.quantity)||0));
  }

  for(const [targetId,expectedQty] of expectedByTarget.entries()){
    const actualQty=actualByTarget.get(targetId)||0;
    if(Math.round(expectedQty)!==Math.round(actualQty)){
      issues.push({type:'QUANTITY_MISMATCH',targetId,expected:expectedQty,actual:actualQty});
    }
  }

  return {ok:issues.length===0,issues,built};
}

function escapeRegExp(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function numericCellXml(attrs,ref,value){
  const cleanAttrs=String(attrs).replace(/\s+t="[^"]*"/g,'');
  if(value===''||value==null)return `<c${cleanAttrs}/>`;
  return `<c${cleanAttrs}><v>${Number(value)}</v></c>`;
}
function replaceNumericCell(xml,ref,value){
  const re=new RegExp(`<c([^>]*\\br="${escapeRegExp(ref)}"[^>]*)\\/>|<c([^>]*\\br="${escapeRegExp(ref)}"[^>]*)>[\\s\\S]*?<\\/c>`);
  const m=re.exec(xml);if(!m)return xml;
  return xml.slice(0,m.index)+numericCellXml(m[1]||m[2],ref,value)+xml.slice(m.index+m[0].length);
}
function readNumericCell(xml,ref){
  const re=new RegExp(`<c[^>]*\\br="${escapeRegExp(ref)}"[^>]*>[\\s\\S]*?<v[^>]*>([^<]*)<\\/v>[\\s\\S]*?<\\/c>`);
  const m=re.exec(xml);const n=m?Number(m[1]):NaN;return Number.isFinite(n)?n:null;
}
function cellHasFormula(xml,ref){
  const re=new RegExp(`<c[^>]*\br="${escapeRegExp(ref)}"[^>]*>[\s\S]*?<f(?:\s[^>]*)?>[\s\S]*?<\/f>[\s\S]*?<\/c>`);
  return re.test(xml);
}
function patchFactXml(xml,factRows,workbookName){
  const {plan,total}=buildFactBackfillPlan(workbookName,factRows);
  const oldTotal=factRows.reduce((a,r)=>a+(Number(r.amount)||0),0);
  let out=xml;
  for(const r of factRows){
    const row=Number(r.sourceRow),v=plan.get(row)||{quantity:0,amount:0};
    out=replaceNumericCell(out,`D${row}`,v.quantity>0?v.quantity:'');
    // V6.5.12: FACT templates sometimes store decimal-looking COGs/Shipping cells as shared strings.
    // Excel then treats them as text and formulas such as E+F fail. Re-write numeric inputs as real
    // XLSX numeric cells while keeping the original cell style/position unchanged.
    if(Number.isFinite(Number(r.cogs)))out=replaceNumericCell(out,`E${row}`,Number(r.cogs));
    if(Number.isFinite(Number(r.shipping)))out=replaceNumericCell(out,`F${row}`,Number(r.shipping));
    if(Number.isFinite(Number(r.unitTotal))&&!cellHasFormula(out,`G${row}`))out=replaceNumericCell(out,`G${row}`,Number(r.unitTotal));
    out=replaceNumericCell(out,`H${row}`,v.amount);
  }
  // Preserve total-cell formatting by replacing only values of cells that held the previous FACT total.
  const maxRow=Math.max(0,...factRows.map(r=>Number(r.sourceRow)||0)),scanEnd=maxRow+16;
  const candidates=[];
  for(let row=maxRow+1;row<=scanEnd;row++){
    for(const col of ['A','B','C','D','E','F','G','H']){
      const ref=`${col}${row}`,num=readNumericCell(out,ref);
      if(num!==null&&Math.abs(num-oldTotal)<0.02)candidates.push(ref);
    }
  }
  for(const ref of candidates)out=replaceNumericCell(out,ref,total);
  return {xml:out,total,rows:plan.size};
}
function zipLocalHeader(e,nameBytes){
  const flags=(e.flags||0)&0x800;
  return new Uint8Array([...u32(ZIP_LOC),...u16(20),...u16(flags),...u16(e.method),...u16(e.modTime||0),...u16(e.modDate||0),...u32(e.crc),...u32(e.compressedSize),...u32(e.uncompressedSize),...u16(nameBytes.length),...u16(0),...nameBytes]);
}
function zipCentralHeader(e,nameBytes,offset){
  const flags=(e.flags||0)&0x800;
  return new Uint8Array([...u32(ZIP_CEN),...u16(20),...u16(20),...u16(flags),...u16(e.method),...u16(e.modTime||0),...u16(e.modDate||0),...u32(e.crc),...u32(e.compressedSize),...u32(e.uncompressedSize),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(e.externalAttrs||0),...u32(offset),...nameBytes]);
}
async function rebuildFactWorkbook(blob,workbookName){
  const archive=await PreserveZipArchive.open(blob),wbXml=await archive.text('xl/workbook.xml',4*1024*1024),relsXml=await archive.text('xl/_rels/workbook.xml.rels',4*1024*1024),factPath=findFactSheetPath(wbXml,relsXml);
  if(!factPath)throw new Error(`${basename(workbookName)} 没有 FACT 工作表`);
  const factRows=sheets.flatMap(s=>s.sourceFile===workbookName&&s.status==='ignored_fact'?(s.factRows||[]):[]);
  if(!factRows.length)throw new Error(`${basename(workbookName)} 的 FACT 模板没有可识别的分类行`);
  const factXml=await archive.text(factPath,16*1024*1024),patched=patchFactXml(factXml,factRows,workbookName),newBytes=enc.encode(patched.xml);
  const parts=[],central=[],entries=[];let offset=0;
  for(const orig of archive.entries){
    const nameBytes=enc.encode(orig.name);let e,data;
    if(orig.name===factPath){
      e={...orig,flags:(orig.flags||0)&0x800,method:0,crc:crc32(newBytes),compressedSize:newBytes.length,uncompressedSize:newBytes.length};data=newBytes;
    }else{e={...orig,flags:(orig.flags||0)&0x800};data=await archive.compressedBlob(orig)}
    const local=zipLocalHeader(e,nameBytes);parts.push(local,data);central.push(zipCentralHeader(e,nameBytes,offset));offset+=local.length+e.compressedSize;entries.push(e);
  }
  const centralSize=central.reduce((a,b)=>a+b.length,0),centralOffset=offset;
  parts.push(...central,new Uint8Array([...u32(ZIP_EOCD),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralSize),...u32(centralOffset),...u16(0)]));
  return new Blob(parts,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function crc32Blob(blob){
  let c=0xffffffff;const reader=blob.stream().getReader();
  while(true){const {value,done}=await reader.read();if(done)break;for(const b of value){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}}
  return (c^0xffffffff)>>>0;
}
async function zipStoreBlobs(entries){
  const meta=[];for(const e of entries){const data=e.data instanceof Blob?e.data:new Blob([e.data]),crc=await crc32Blob(data);meta.push({name:e.name,data,size:data.size,crc})}
  const parts=[],central=[];let offset=0;
  for(const e of meta){const name=enc.encode(e.name),h=new Uint8Array([...u32(ZIP_LOC),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),...u32(e.crc),...u32(e.size),...u32(e.size),...u16(name.length),...u16(0),...name]);parts.push(h,e.data);central.push(new Uint8Array([...u32(ZIP_CEN),...u16(20),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),...u32(e.crc),...u32(e.size),...u32(e.size),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]));offset+=h.length+e.size}
  const centralSize=central.reduce((a,b)=>a+b.length,0),centralOffset=offset;
  return new Blob([...parts,...central,new Uint8Array([...u32(ZIP_EOCD),...u16(0),...u16(0),...u16(meta.length),...u16(meta.length),...u32(centralSize),...u32(centralOffset),...u16(0)])],{type:'application/zip'});
}



const $ = (id) => document.getElementById(id);
const els = {
  dropzone:$('dropzone'), fileInput:$('fileInput'), chooseButton:$('chooseButton'), idleState:$('idleState'), busyState:$('busyState'),
  currentFile:$('currentFile'), progressFill:$('progressFill'), progressText:$('progressText'), errorCard:$('errorCard'), errorText:$('errorText'), dismissError:$('dismissError'),
  importLanding:$('importLanding'), appViews:$('appViews'), topActions:$('topActions'), metricOrders:$('metricOrders'), metricAmount:$('metricAmount'), metricSheets:$('metricSheets'), metricFacts:$('metricFacts'), metricDuplicates:$('metricDuplicates'), metricReview:$('metricReview'), metricGift:$('metricGift'),
  accountingSummary:$('accountingSummary'), lineSummary:$('lineSummary'), importSummary:$('importSummary'), sheetList:$('sheetList'), recentOrdersBody:$('recentOrdersBody'), unknownList:$('unknownList'), emptyReview:$('emptyReview'),
  searchInput:$('searchInput'), countrySelect:$('countrySelect'), categorySelect:$('categorySelect'), ordersBody:$('ordersBody'), resultCount:$('resultCount'), tableNote:$('tableNote'),
  navReviewCount:$('navReviewCount'), quickReviewCount:$('quickReviewCount'), systemStatus:$('systemStatus'), lastImportText:$('lastImportText'), sidebarResetButton:$('sidebarResetButton'),
  reimportButton:$('reimportButton'), clearButton:$('clearButton'), topExportButton:$('topExportButton'), quickExportButton:$('quickExportButton'), exportButton:$('exportButton'), heroExportButton:$('heroExportButton'), heroImportButton:$('heroImportButton'), inlineImportButton:$('inlineImportButton'), navImportButton:$('navImportButton'),
  confirmModal:null, modalTitle:null, modalText:null, modalCancel:null, modalConfirm:null
};

const numberFormat = new Intl.NumberFormat('fr-FR');
const moneyFormat = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const decimalFormat = new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
const decimal2Format = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const durationFormat = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const percentDisplayFormat = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
let worker=null, orders=[], sheets=[], classified=null, busy=false, duplicateCount=0, sameOrderIdExtraRows=0, sameWorkbookOrderIdGroups=[], sourceRecordCount=0, crossWorkbookDuplicates=[], importStartedAt=0, importDuration=0, importedFileNames=[], sourceWorkbooks=[];
let modalAction=null;

function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatBytes(n){const v=Number(n)||0;if(v<1024)return `${v} B`;if(v<1024**2)return `${decimalFormat.format(v/1024)} KB`;if(v<1024**3)return `${decimalFormat.format(v/1024**2)} MB`;return `${decimalFormat.format(v/1024**3)} GB`}
function nowText(){return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}

function setBusy(v){busy=v;els.idleState.hidden=v;els.busyState.hidden=!v;els.dropzone.classList.toggle('busy',v)}
function showError(m){els.errorText.textContent=m;els.errorCard.hidden=false}
function hideError(){els.errorCard.hidden=true;els.errorText.textContent=''}

function setView(view){
  document.querySelectorAll('.nav-item[data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  document.querySelectorAll('.view[data-view-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.viewPanel===view));
}
function resetState({showLanding=true}={}){
  worker?.terminate(); worker=null; orders=[]; sheets=[]; classified=null; busy=false; duplicateCount=0; sameOrderIdExtraRows=0; sameWorkbookOrderIdGroups=[]; sourceRecordCount=0; crossWorkbookDuplicates=[]; importDuration=0; importedFileNames=[]; sourceWorkbooks=[];
  setBusy(false); hideError(); els.progressFill.style.width='0%'; els.fileInput.value=''; els.searchInput.value='';
  els.countrySelect.innerHTML='<option value="ALL">全部国家</option>'; els.categorySelect.innerHTML='<option value="ALL">全部会计分类</option>';
  els.appViews.hidden=true; els.topActions.hidden=true; els.importLanding.hidden=!showLanding; els.sidebarResetButton.disabled=true;
  els.systemStatus.textContent='等待导入'; els.lastImportText.textContent='本地处理 · 数据不上传'; document.querySelector('.system-card')?.classList.remove('ready');
  els.navReviewCount.hidden=true; els.quickReviewCount.textContent='0'; setView('dashboard');
}

function ensureConfirmModal(){
  let modal=document.getElementById('confirmModal');
  if(modal) return modal;
  modal=document.createElement('div');
  modal.id='confirmModal';
  modal.className='modal-backdrop';
  modal.hidden=true;
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <div class="modal-icon">⌫</div>
    <h3 id="modalTitle">确认操作</h3>
    <p id="modalText"></p>
    <div class="modal-actions"><button id="modalCancel" class="toolbar-button" type="button">取消</button><button id="modalConfirm" class="toolbar-button danger filled" type="button">确认</button></div>
  </div>`;
  document.body.appendChild(modal);
  els.confirmModal=modal;
  els.modalTitle=modal.querySelector('#modalTitle');
  els.modalText=modal.querySelector('#modalText');
  els.modalCancel=modal.querySelector('#modalCancel');
  els.modalConfirm=modal.querySelector('#modalConfirm');
  els.modalCancel.addEventListener('click',closeConfirm);
  els.modalConfirm.addEventListener('click',()=>{const action=modalAction; closeConfirm(); if(typeof action==='function') action();});
  modal.addEventListener('click',e=>{if(e.target===modal)closeConfirm()});
  return modal;
}
function openConfirm({title,text,confirmText='确认',action}){
  const modal=ensureConfirmModal();
  els.modalTitle.textContent=title; els.modalText.textContent=text; els.modalConfirm.textContent=confirmText; modalAction=action;
  modal.hidden=false; modal.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>els.modalConfirm?.focus());
}
function closeConfirm(){
  const modal=document.getElementById('confirmModal');
  if(modal){modal.hidden=true;modal.setAttribute('aria-hidden','true')}
  modalAction=null;
}


window.addEventListener('unhandledrejection',event=>{
  const reason=event?.reason;
  if(reason){
    console.error('Unhandled promise rejection',reason);
  }
});


async function startImport(fileList){
  clearExportDownloadLink();
  const files=[...fileList].filter(f=>/\.(xlsx|xls|zip|csv|tsv|json|xml|pdf|png|jpe?g)$/i.test(f.name)); if(!files.length||busy)return;
  await window.WRITE_KB?.init?.().catch(()=>{});
  const schemaRules=window.WRITE_SCHEMA?.getRules?.()||[];
  worker?.terminate(); worker=new Worker('./src/workers/import.worker.bundle.js?v=10.0.0-rc1'); importStartedAt=performance.now(); importedFileNames=files.map(f=>f.name);
  setBusy(true); hideError(); els.importLanding.hidden=false; els.appViews.hidden=true; els.topActions.hidden=true;
  els.currentFile.textContent='准备读取…'; els.progressFill.style.width='0%'; els.progressText.textContent='0% · 自适应识别订单结构';
  worker.onmessage=async ({data})=>{
    if(data.type==='file-start')els.currentFile.textContent=data.fileName;
    if(data.type==='progress'){
      const pct=Math.max(0,Math.min(100,Math.round((data.progress||0)*100)));
      els.progressFill.style.width=`${pct}%`;els.progressText.textContent=`${pct}% · ${data.phase==='extract'?'正在从 ZIP 提取工作簿':'正在识别工作表结构'}`;
      if(data.detail)els.currentFile.textContent=data.detail;
    }
    if(data.type==='complete'){
      const schemaCandidates=data.schemaCandidates||[],schemaReviews=data.schemaReviews||[];
      await window.WRITE_SCHEMA?.autoLearn?.(schemaCandidates);
      if(schemaReviews.length){
        setBusy(false);
        els.progressText.textContent='需要确认陌生表格字段 · 确认一次后永久学习';
        els.currentFile.textContent=`${schemaReviews.length} 个新订单结构待确认`;
        worker?.terminate();worker=null;
        window.WRITE_SCHEMA?.promptReview?.(schemaReviews,()=>startImport(files));
        return;
      }
      orders=data.orders||[];sheets=data.sheets||[];sourceWorkbooks=data.workbooks||[];duplicateCount=data.duplicates||0;sameOrderIdExtraRows=data.sameOrderIdExtraRows||0;sameWorkbookOrderIdGroups=data.sameWorkbookOrderIdGroups||[];sourceRecordCount=data.sourceRecordCount||orders.length;crossWorkbookDuplicates=data.crossWorkbookDuplicates||[];
      importDuration=(performance.now()-importStartedAt)/1000;
      const importedOrderSheets=sheets.filter(x=>x.status==='imported'&&Number(x.orderCount)>0);
      const factSheets=sheets.filter(x=>x.status==='ignored_fact');
      if(!orders.length){
        classified=null;els.progressFill.style.width='100%';els.progressText.textContent='100% · 未检测到订单数据';els.currentFile.textContent='解析完成';
        setBusy(false);renderResults();
        if(factSheets.length&&!importedOrderSheets.length)showError(`只检测到 ${factSheets.length} 个 FACT 工作表，没有订单 Sheet。`);
        else showError('没有检测到可安全输出的订单数据。低置信结构会要求确认，不会静默猜测。');
        worker?.terminate();worker=null;return;
      }
      classified=classifyOrders(orders);
      els.progressFill.style.width='100%';els.progressText.textContent='100% · 结构识别、导入与分类完成';els.currentFile.textContent='解析完成';hideError();setBusy(false);renderResults();
      window.dispatchEvent(new CustomEvent('write-import-complete',{detail:{sourceRecordCount,records:orders.length,sameOrderIdGroups:sameWorkbookOrderIdGroups.length}}));
      worker?.terminate();worker=null;
    }
    if(data.type==='error'){setBusy(false);showError(data.message||'未知导入错误');worker?.terminate();worker=null}
  };
  worker.onerror=e=>{setBusy(false);showError(e.message||'导入线程异常');worker?.terminate();worker=null};
  worker.postMessage({files,schemaRules});
}


// V7.0 universal workbook / currency / quality / learning layer
function orderCurrency(order){return String(order?.currency||currencyForWorkbook(order?.sourceFile||'')||'EUR').toUpperCase()}
function currencyTotals(){
  const map=new Map();
  for(const o of (classified?.orders||[])){
    const c=orderCurrency(o),r=map.get(c)||{currency:c,orders:0,amount:0};
    r.orders++;r.amount+=Number(o.orderAmount)||0;map.set(c,r);
  }
  return [...map.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
function workbookModels(){
  const factSet=new Set(sheets.filter(s=>s.status==='ignored_fact').map(s=>s.sourceFile));
  const byFile=new Map();
  for(const o of (classified?.orders||[])){
    const r=byFile.get(o.sourceFile)||{file:o.sourceFile,orders:[],currencies:new Set(),unknown:0,profiles:new Set()};
    r.orders.push(o);r.currencies.add(orderCurrency(o));
    r.unknown+=Number(o.unknownItemCount)||0;
    byFile.set(o.sourceFile,r);
  }
  return [...byFile.values()].map(r=>{
    const profile=detectGeneratedFactProfile(r.file);
    return {...r,profile,hasFact:factSet.has(r.file),orderMin:Math.min(...r.orders.map(o=>orderSequenceNumber(o.orderId)).filter(Number.isFinite),Infinity),orderMax:Math.max(...r.orders.map(o=>orderSequenceNumber(o.orderId)).filter(Number.isFinite),-Infinity)};
  });
}
function qualityIssues(){
  const issues=[];
  const totals=currencyTotals();
  if(totals.length>1)issues.push({level:'warn',type:'多币种',message:`检测到 ${totals.map(x=>x.currency).join(' / ')}，V7 不会把不同币种直接相加。`});
  if(crossWorkbookDuplicates.length)issues.push({level:'warn',type:'跨工作簿重复',message:`发现 ${crossWorkbookDuplicates.length} 个订单号出现在多个工作簿中；已保留各工作簿订单，不再静默删除。`});
  const unknown=classified?.unknown?.length||0;
  if(unknown)issues.push({level:'warn',type:'未识别商品',message:`${unknown} 个商品行需要学习或人工复核。`});
  for(const wb of workbookModels()){
    if(!wb.hasFact && wb.profile==='GENERIC')issues.push({level:'info',type:'无 FACT / 新模型',message:`${basename(wb.file)} 没有 FACT 且未命中已学习 Profile，将生成通用 FACT 并标记未学习成本。`});
    if(wb.currencies.size>1)issues.push({level:'warn',type:'工作簿混合币种',message:`${basename(wb.file)} 内检测到多个币种：${[...wb.currencies].join(' / ')}`});
  }
  return issues;
}
function learnedRuleRows(){
  const map=new Map();
  for(const x of (classified?.lineItems||[])){
    const sku=String(x.sku||'').trim(),name=String(x.productName||'').trim();
    const key=[x.sourceFile,sku||name,x.category].join('\u0001');
    const saved=persistentCategoryFor(name,sku);
    const source=saved?'人工学习':(x.category==='ERASER'||x.category==='NOTEBOOK'?'V7 内置学习':'自动规则');
    if(!map.has(key))map.set(key,{sourceFile:x.sourceFile,sku,name,category:x.categoryLabel||x.category,profile:detectGeneratedFactProfile(x.sourceFile),source,count:0});
    map.get(key).count+=Number(x.quantity)||1;
  }
  return [...map.values()].sort((a,b)=>b.count-a.count);
}
function renderQualityCenter(){
  const host=document.getElementById('qualityList'),summary=document.getElementById('qualitySummary');
  if(!host||!summary)return;
  const issues=qualityIssues(),models=workbookModels(),currencies=currencyTotals();
  summary.innerHTML=`<div><b>${models.length}</b><span>工作簿</span></div><div><b>${currencies.length}</b><span>币种</span></div><div><b>${crossWorkbookDuplicates.length}</b><span>跨文件重复订单</span></div><div><b>${classified?.unknown?.length||0}</b><span>未识别商品行</span></div>`;
  host.innerHTML=issues.length?issues.map(x=>`<article class="quality-item ${x.level}"><strong>${escapeHtml(x.type)}</strong><p>${escapeHtml(x.message)}</p></article>`).join(''):`<div class="empty">✓ 未发现阻断性数据质量问题。</div>`;
  const wbHost=document.getElementById('workbookModelList');
  if(wbHost)wbHost.innerHTML=models.map(w=>`<div class="model-row"><strong>${escapeHtml(basename(w.file))}</strong><span>${escapeHtml(w.profile)}</span><span>${w.hasFact?'已有 FACT':'自动 FACT'}</span><span>${escapeHtml([...w.currencies].join(' / '))}</span><span>${numberFormat.format(w.orders.length)} 单</span></div>`).join('');
}
function renderLearningCenter(){
  const host=document.getElementById('learningList'),meta=document.getElementById('learningMeta');
  if(!host||!meta)return;
  const rules=window.WRITE_KB?.list?.()||[];
  const stats=window.WRITE_KB?.stats?.()||{total:0,productRules:0,priceRules:0,schemaRules:0,costRules:0,currencyRules:0,taxRules:0,factModels:0,conflicts:0};
  meta.textContent=`长期知识库 ${stats.total} 条 · 商品 ${stats.productRules} · 成本 ${stats.costRules||0} · 表格结构 ${stats.schemaRules||0} · 币种 ${stats.currencyRules||0} · FACT模型 ${stats.factModels||0} · 冲突 ${stats.conflicts||0}`;
  window.WRITE_KB?.renderStatus?.();
  host.innerHTML=rules.slice(0,500).map(rule=>{
    const product=rule.type==='PRODUCT_CATEGORY',schema=rule.type==='ORDER_SCHEMA';
    const title=schema?(rule.payload?.sheetName||'订单表结构'):product?(rule.payload?.sku||rule.payload?.productName||rule.lookupKey):(rule.payload?.targetType||rule.lookupKey);
    const subtitle=schema?`${Object.keys(rule.payload?.mapping||{}).length} 个字段 · ${rule.confirmed?'人工确认':'自动识别'}`:product?(rule.payload?.productName||rule.lookupKey):`${rule.payload?.country||''} · ${Number(rule.payload?.unitPrice||0).toLocaleString('fr-FR',{maximumFractionDigits:4})}`;
    const value=schema?'ORDER SCHEMA':product?(rule.payload?.category||'—'):'FACT PRICE';
    const source=rule.confirmed?'人工确认':rule.confidenceLevel==='AUTO_INFERRED'?'自动学习':rule.source;
    return `<div class="learning-row"><div><strong>${escapeHtml(title||'—')}</strong><small>${escapeHtml(subtitle||'')}</small></div><span>${escapeHtml(value)}</span><span>${escapeHtml(source)}</span><span>${rule.syncState==='SYNCED'?'云端':'待同步'}</span></div>`;
  }).join('')||'<div class="empty">还没有长期学习规则。导入订单或人工确认后会自动积累。</div>';
}


function importOrderStats(){
  const records=classified?.orders?.length||orders.length||0;
  return {raw:Number(sourceRecordCount)||records,duplicates:Number(sameOrderIdExtraRows)||0,unique:records};
}
function expectedFactDeliverableCount(){
  const files=new Set((orders||[]).map(o=>o.sourceFile).filter(Boolean));
  return files.size;
}

function renderResults(){
  if(!classified)return;
  const imported=sheets.filter(s=>s.status==='imported'), facts=sheets.filter(s=>s.status==='ignored_fact');
  const currencySummary=currencyTotals(),singleCurrency=currencySummary.length===1;
  const amount=singleCurrency?currencySummary[0].amount:0, review=classified.orders.filter(o=>o.classificationStatus==='需复核').length;
  const itemQty=classified.lineItems.reduce((a,b)=>a+(Number(b.quantity)||1),0), giftQty=classified.lineItems.filter(x=>x.isFree).reduce((a,b)=>a+(Number(b.quantity)||1),0);
  const rawRows=imported.reduce((a,s)=>a+(Number(s.orderCount)||0),0), uniqueBooks=new Set(sheets.map(s=>s.sourceFile)).size, inflated=sheets.reduce((a,s)=>a+(Number(s.inflatedBytes)||0),0);

  const orderStats=importOrderStats(),factOutput=expectedFactDeliverableCount();
  els.metricOrders.textContent=numberFormat.format(orderStats.unique); els.metricAmount.textContent=singleCurrency?(currencySummary[0].currency==='EUR'?moneyFormat.format(amount):`${decimal2Format.format(amount)} ${currencySummary[0].currency}`):'多币种'; els.metricSheets.textContent=numberFormat.format(imported.length);
  els.metricFacts.textContent=numberFormat.format(factOutput); els.metricDuplicates.textContent=`源记录 ${numberFormat.format(orderStats.raw)} · 同订单号额外记录 ${numberFormat.format(orderStats.duplicates)} · 全部保留 ${numberFormat.format(orderStats.unique)}`; els.metricReview.textContent=numberFormat.format(review); els.metricGift.textContent=numberFormat.format(itemQty);
  els.navReviewCount.textContent=numberFormat.format(review); els.navReviewCount.hidden=review===0; els.quickReviewCount.textContent=numberFormat.format(review);
  els.systemStatus.textContent='就绪'; els.lastImportText.textContent=`上次导入 · ${nowText()}`; document.querySelector('.system-card')?.classList.add('ready'); els.sidebarResetButton.disabled=false;

  renderAccounting(amount); renderProductSummary(giftQty); renderUnknown(); renderSheets(); renderOrders(); renderRecent(); renderQualityCenter(); renderLearningCenter();
  const countries=[...new Set(classified.orders.map(o=>o.country).filter(Boolean))].sort();
  els.countrySelect.innerHTML='<option value="ALL">全部国家</option>'+countries.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
  const cats=[...new Set(classified.orders.map(o=>o.accountingCategory))];
  els.categorySelect.innerHTML='<option value="ALL">全部会计分类</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');

  const fileLabel=importedFileNames.length===1?importedFileNames[0]:`${importedFileNames.length} 个上传文件`;
  const orderStatsSummary=importOrderStats(),factOutputSummary=expectedFactDeliverableCount();
  const summaryData=[['文件',fileLabel],['Excel 工作簿',`${uniqueBooks} 个`],['订单 Sheet',`${imported.length} 个`],['原始 FACT Sheet',`${facts.length} 个`],['FACT 输出',`${factOutputSummary} 个${facts.length===0&&factOutputSummary>0?' · 自动生成':''}`],['原始订单行',`${numberFormat.format(orderStatsSummary.raw)} 行`],['同订单号额外记录',`${numberFormat.format(orderStatsSummary.duplicates)} 条（全部保留）`],['结算记录',`${numberFormat.format(orderStatsSummary.unique)} 条`],['解析数据量',formatBytes(inflated)],['处理耗时',`${durationFormat.format(importDuration)} 秒`]];
  els.importSummary.innerHTML=summaryData.map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');

  els.importLanding.hidden=true; els.appViews.hidden=false; els.topActions.hidden=false; hideError(); setView('dashboard');
}

function renderAccounting(totalAmount){
  const rows=classified.orderSummary;
  els.accountingSummary.innerHTML=rows.map(r=>{
    const share=totalAmount>0?(r.amount/totalAmount*100):0;
    return `<div class="summary-row"><strong>${escapeHtml(r.category)}</strong><span>${numberFormat.format(r.orders)}</span><b>${escapeHtml(moneyFormat.format(r.amount))}</b><small>${percentDisplayFormat.format(share)} %</small><i class="share-track" style="width:${Math.min(100,share)}%"></i></div>`;
  }).join('')+`<div class="summary-row total"><strong>合计</strong><span>${numberFormat.format(classified.orders.length)}</span><b>${escapeHtml(moneyFormat.format(totalAmount))}</b><small>100%</small></div>`;
}

function renderProductSummary(giftQty){
  els.lineSummary.innerHTML=classified.lineSummary.map(r=>`<div class="product-row"><strong>${escapeHtml(r.category)}</strong><span>${numberFormat.format(r.quantity)} 件</span><small>${numberFormat.format(r.orders)} 个订单涉及</small><small>${r.freeQuantity?`赠品 ${numberFormat.format(r.freeQuantity)} 件`:'—'}</small></div>`).join('')+
    `<div class="product-row"><strong>赠品合计</strong><span>${numberFormat.format(giftQty)} 件</span><small>🎁 / 100% off 自动识别</small><small>单独标记</small></div>`;
}

function reviewCategoryOptions(selected='AUTO'){
  const options=[['AUTO','自动识别'],...LINE_CATEGORIES.filter(x=>x.code!=='OTHER').map(x=>[x.code,x.label])];
  return options.map(([code,label])=>`<option value="${code}" ${selected===code?'selected':''}>${escapeHtml(label)}</option>`).join('');
}
function renderUnknown(){
  const unknown=classified.unknown||[]; els.emptyReview.hidden=unknown.length>0;
  els.unknownList.innerHTML=unknown.map(x=>{
    const order=orders.find(o=>x.recordKey?String(o.recordKey)===String(x.recordKey):(String(o.orderId)===String(x.orderId)&&(!x.sourceRow||Number(o.sourceRow)===Number(x.sourceRow))))||{};
    const forced=order.manualLineCategories?.[x.lineNo]||'AUTO';
    return `<div class="review-editor" data-record-key="${escapeHtml(x.recordKey||'')}" data-order-id="${escapeHtml(x.orderId)}" data-line-no="${x.lineNo||1}">
      <div class="review-id"><strong>${escapeHtml(x.orderId)}</strong><small>第 ${x.lineNo||1} 个商品 · ${escapeHtml(order.country||x.country||'—')}</small></div>
      <label><span>产品名称</span><input class="review-name" value="${escapeHtml(x.productName||'')}" placeholder="补充或修改产品名称" /></label>
      <label><span>SKU</span><input class="review-sku" value="${escapeHtml(x.sku||'')}" placeholder="补充或修改 SKU" /></label>
      <label><span>分类</span><select class="review-category">${reviewCategoryOptions(forced)}</select></label>
      <button class="review-save" type="button">保存并重新分类</button>
    </div>`;
  }).join('');
}
function setLineValue(order,key,lineNo,value){
  const arr=String(order[key]||'').split(/\n/); while(arr.length<lineNo)arr.push(''); arr[lineNo-1]=String(value||'').trim(); order[key]=arr.join('\n');
}
function saveReviewRow(editor){
  const recordKey=editor.dataset.recordKey||'',orderId=editor.dataset.orderId, lineNo=Number(editor.dataset.lineNo)||1;
  const order=orders.find(o=>recordKey?String(o.recordKey)===String(recordKey):String(o.orderId)===String(orderId)); if(!order)return;
  setLineValue(order,'productNames',lineNo,editor.querySelector('.review-name').value);
  setLineValue(order,'skuLines',lineNo,editor.querySelector('.review-sku').value);
  const chosen=editor.querySelector('.review-category').value;
  order.manualLineCategories={...(order.manualLineCategories||{})};
  if(chosen==='AUTO') delete order.manualLineCategories[lineNo];
  else {
    order.manualLineCategories[lineNo]=chosen;
    savePersistentLineRule(editor.querySelector('.review-name').value,editor.querySelector('.review-sku').value,chosen);
  }
  classified=classifyOrders(orders); renderResults(); setView('review');
}

function renderSheets(){
  els.sheetList.innerHTML=sheets.map(s=>{
    const status=s.status==='imported'?'imported':s.status==='ignored_fact'?'ignored_fact':'ignored_non_order';
    const icon=s.status==='imported'?'✓':s.status==='ignored_fact'?'F':'–';
    const badge=s.status==='imported'?`${numberFormat.format(s.orderCount)} 单`:s.status==='ignored_fact'?'FACT · 已解析':'非订单 · 忽略';
    return `<div class="sheet-row"><div class="sheet-icon ${status}">${icon}</div><div class="sheet-main"><strong>${escapeHtml(s.sheetName)}</strong><span>${escapeHtml(s.sourceFile)}</span></div><div class="sheet-reason">${escapeHtml(s.reason)}</div><div class="badge ${status}">${escapeHtml(badge)}</div></div>`;
  }).join('');
}

function renderRecent(){
  els.recentOrdersBody.innerHTML=classified.orders.slice(-5).reverse().map(o=>`<tr><td class="mono">${escapeHtml(o.orderId)}</td><td>${escapeHtml(o.buyerName||'—')}</td><td>${escapeHtml(o.country||'—')}</td><td>${o.orderAmount==null?'—':escapeHtml(moneyFormat.format(o.orderAmount))}</td><td><span class="tag">${escapeHtml(o.accountingCategory)}</span></td></tr>`).join('');
}

function renderOrders(){
  if(!classified)return; const q=els.searchInput.value.trim().toLowerCase(), country=els.countrySelect.value, cat=els.categorySelect.value;
  const filtered=classified.orders.filter(o=>{if(country!=='ALL'&&o.country!==country)return false;if(cat!=='ALL'&&o.accountingCategory!==cat)return false;if(!q)return true;return[o.orderId,o.buyerName,o.trackingNo,o.productNames,o.country,o.accountingCategory].some(v=>String(v||'').toLowerCase().includes(q))});
  els.resultCount.textContent=`${numberFormat.format(filtered.length)} 条结果`;
  els.ordersBody.innerHTML=filtered.slice(0,700).map(o=>{const product=String(o.productNames||'—').split('\n')[0];return `<tr><td class="mono">${escapeHtml(o.orderId)}</td><td>${o.orderAmount==null?'—':escapeHtml(moneyFormat.format(o.orderAmount))}</td><td>${escapeHtml(o.productCount??'—')}</td><td><span class="accounting-pill ${o.classificationStatus==='需复核'?'review':''}">${escapeHtml(o.accountingCategory)}</span></td><td>${escapeHtml(o.country||'—')}</td><td>${escapeHtml(o.buyerName||'—')}</td><td class="product-cell" title="${escapeHtml(o.productNames||'')}">${escapeHtml(product)}</td><td>${o.hasGift?'是':'—'}</td><td class="mono muted">${escapeHtml(o.trackingNo||'—')}</td></tr>`}).join('');
  els.tableNote.hidden=filtered.length<=700; els.tableNote.textContent=filtered.length>700?`为保持页面流畅，当前预览前 700 条；全部 ${numberFormat.format(filtered.length)} 条已完成分类。`:'';
}


// v7.2.3 — mandatory FACT delivery: generate a FACT when the source workbook has none.
function currencyForWorkbook(workbookName=''){
  const n=String(workbookName||'').toUpperCase();
  if(/\bUSD\b|\$US|US\$/.test(n))return 'USD';
  if(/\bGBP\b|£/.test(n))return 'GBP';
  if(/\bCHF\b/.test(n))return 'CHF';
  if(/\bCAD\b|C\$/.test(n))return 'CAD';
  if(/\bAUD\b|A\$/.test(n))return 'AUD';
  if(/\bJPY\b|¥/.test(n))return 'JPY';
  if(/\bCNY\b|\bRMB\b|人民币/.test(n))return 'CNY';
  return 'EUR';
}
function workbooksWithFact(){
  return new Set(sheets.filter(s=>s.status==='ignored_fact').map(s=>s.sourceFile));
}

const LEARNED_PENCIL_FACT_ROWS = [{"sourceRow":12,"country":"FRANCE","description":"Stylo eternelX1","quantity":209.0,"cogs":0.85,"shipping":5.06,"unitTotal":5.91,"amount":1235.19},{"sourceRow":13,"country":"FRANCE","description":"Stylo eternelX2","quantity":7.0,"cogs":1.7,"shipping":8.07,"unitTotal":9.77,"amount":68.39},{"sourceRow":14,"country":"FRANCE","description":"Stylo eternelX3","quantity":114.0,"cogs":2.55,"shipping":11.01,"unitTotal":13.56,"amount":1545.84},{"sourceRow":15,"country":"FRANCE","description":"Stylo eternelX4","quantity":1.0,"cogs":3.4,"shipping":13.93,"unitTotal":17.33,"amount":17.33},{"sourceRow":16,"country":"FRANCE","description":"Stylo eternelX5","quantity":0,"cogs":4.25,"shipping":17.78,"unitTotal":22.03,"amount":0},{"sourceRow":17,"country":"FRANCE","description":"Stylo eternelX6","quantity":0,"cogs":5.1,"shipping":20.92,"unitTotal":26.02,"amount":0},{"sourceRow":18,"country":"FRANCE","description":"Stylo eternelX7","quantity":0,"cogs":5.95,"shipping":24.05,"unitTotal":30.0,"amount":0},{"sourceRow":19,"country":"FRANCE","description":"Stylo eternelX8","quantity":0,"cogs":6.8,"shipping":27.19,"unitTotal":33.99,"amount":0},{"sourceRow":20,"country":"FRANCE","description":"Stylo eternelX9","quantity":0,"cogs":7.65,"shipping":30.32,"unitTotal":37.97,"amount":0},{"sourceRow":21,"country":"FRANCE","description":"Stylo eternelX10","quantity":0,"cogs":8.5,"shipping":33.46,"unitTotal":41.96,"amount":0},{"sourceRow":22,"country":"FRANCE","description":"Stylo eternelX12","quantity":0,"cogs":11.3,"shipping":34.48,"unitTotal":45.78,"amount":0},{"sourceRow":23,"country":"FRANCE","description":"Stylo eternelX15","quantity":0,"cogs":12.75,"shipping":38.82,"unitTotal":51.57,"amount":0},{"sourceRow":24,"country":"FRANCE","description":"Stylo eternelX16","quantity":0,"cogs":13.6,"shipping":40.35,"unitTotal":53.95,"amount":0},{"sourceRow":25,"country":"FRANCE","description":"Stylo eternelX20","quantity":0,"cogs":17.0,"shipping":45.42,"unitTotal":62.42,"amount":0},{"sourceRow":26,"country":"FRANCE","description":"Stylo eternelX21","quantity":0,"cogs":17.85,"shipping":46.94,"unitTotal":64.79,"amount":0},{"sourceRow":27,"country":"FRANCE","description":"Stylo eternelX24","quantity":0,"cogs":20.4,"shipping":49.5,"unitTotal":69.9,"amount":0},{"sourceRow":28,"country":"FRANCE","description":"Stylo eternelX48","quantity":0,"cogs":40.8,"shipping":73.0,"unitTotal":113.8,"amount":0},{"sourceRow":29,"country":"FRANCE","description":"Lot de 2 gommes","quantity":59.0,"cogs":0.24,"shipping":5.06,"unitTotal":5.3,"amount":312.7},{"sourceRow":30,"country":"FRANCE","description":"Carnet X1","quantity":2.0,"cogs":1.97,"shipping":9.04,"unitTotal":11.01,"amount":22.02},{"sourceRow":31,"country":"FRANCE","description":"Lot de 4 mines rechargeables","quantity":0,"cogs":0.16,"shipping":4.79,"unitTotal":4.95,"amount":0},{"sourceRow":32,"country":"FRANCE","description":"Lot de 6 Mines colorées","quantity":0,"cogs":0.24,"shipping":4.79,"unitTotal":5.03,"amount":0},{"sourceRow":33,"country":"FRANCE","description":"Lot de 12 Mines colorées","quantity":0,"cogs":0.48,"shipping":4.79,"unitTotal":5.27,"amount":0},{"sourceRow":34,"country":"FRANCE","description":"Lot de 2 gommes UPSELL","quantity":201.0,"cogs":2.06,"shipping":null,"unitTotal":2.06,"amount":414.06},{"sourceRow":35,"country":"FRANCE","description":"Carnet  UPSELL","quantity":9.0,"cogs":6.97,"shipping":null,"unitTotal":6.97,"amount":62.73},{"sourceRow":36,"country":"FRANCE","description":"Lot de 4 mines rechargeables UPSELL","quantity":106.0,"cogs":0.76,"shipping":null,"unitTotal":0.76,"amount":80.56},{"sourceRow":37,"country":"FRANCE","description":"Lot de 6 Mines colorées UPSELL","quantity":264.0,"cogs":1.49,"shipping":null,"unitTotal":1.49,"amount":393.36},{"sourceRow":38,"country":"FRANCE","description":"Lot de 12 Mines colorées UPSELL","quantity":122.0,"cogs":2.98,"shipping":null,"unitTotal":2.98,"amount":363.56},{"sourceRow":39,"country":"FRANCE","description":"Mines colorées  UPSELL","quantity":23.0,"cogs":0.25,"shipping":null,"unitTotal":0.25,"amount":5.75},{"sourceRow":41,"country":"BELGIUM","description":"Stylo eternelX1","quantity":43.0,"cogs":0.85,"shipping":4.64,"unitTotal":5.49,"amount":236.07},{"sourceRow":42,"country":"BELGIUM","description":"Stylo eternelX2","quantity":7.0,"cogs":1.7,"shipping":7.58,"unitTotal":9.28,"amount":64.96},{"sourceRow":43,"country":"BELGIUM","description":"Stylo eternelX3","quantity":5.0,"cogs":2.55,"shipping":10.52,"unitTotal":13.07,"amount":65.35},{"sourceRow":44,"country":"BELGIUM","description":"Stylo eternelX4","quantity":0,"cogs":3.4,"shipping":13.46,"unitTotal":16.86,"amount":0},{"sourceRow":45,"country":"BELGIUM","description":"Stylo eternelX5","quantity":0,"cogs":4.25,"shipping":16.41,"unitTotal":20.66,"amount":0},{"sourceRow":46,"country":"BELGIUM","description":"Stylo eternelX6","quantity":1.0,"cogs":5.1,"shipping":19.35,"unitTotal":24.45,"amount":24.45},{"sourceRow":47,"country":"BELGIUM","description":"Stylo eternelX7","quantity":0,"cogs":5.95,"shipping":22.29,"unitTotal":28.24,"amount":0},{"sourceRow":48,"country":"BELGIUM","description":"Stylo eternelX8","quantity":0,"cogs":6.8,"shipping":25.23,"unitTotal":32.03,"amount":0},{"sourceRow":49,"country":"BELGIUM","description":"Stylo eternelX9","quantity":0,"cogs":7.65,"shipping":28.17,"unitTotal":35.82,"amount":0},{"sourceRow":50,"country":"BELGIUM","description":"Stylo eternelX12","quantity":0,"cogs":10.2,"shipping":36.33,"unitTotal":46.53,"amount":0},{"sourceRow":51,"country":"BELGIUM","description":"Lot de 2 gommes","quantity":0,"cogs":0.24,"shipping":4.64,"unitTotal":4.88,"amount":0},{"sourceRow":52,"country":"BELGIUM","description":"Carnet X1","quantity":2.0,"cogs":1.97,"shipping":9.25,"unitTotal":11.22,"amount":22.44},{"sourceRow":53,"country":"BELGIUM","description":"Lot de 4 mines rechargeables","quantity":0,"cogs":0.16,"shipping":3.44,"unitTotal":3.6,"amount":0},{"sourceRow":54,"country":"BELGIUM","description":"Lot de 6 mines rechargeables","quantity":0,"cogs":0.24,"shipping":4.5,"unitTotal":4.74,"amount":0},{"sourceRow":55,"country":"BELGIUM","description":"Lot de 12 Mines colorées","quantity":0,"cogs":0.48,"shipping":3.44,"unitTotal":3.92,"amount":0},{"sourceRow":56,"country":"BELGIUM","description":"Lot de 2 gommes UPSELL","quantity":28.0,"cogs":2.21,"shipping":null,"unitTotal":2.21,"amount":61.88},{"sourceRow":57,"country":"BELGIUM","description":"Carnet  UPSELL","quantity":6.0,"cogs":7.4,"shipping":null,"unitTotal":7.4,"amount":44.4},{"sourceRow":58,"country":"BELGIUM","description":"Lot de 4 mines rechargeables UPSELL","quantity":31.0,"cogs":0.76,"shipping":null,"unitTotal":0.76,"amount":23.56},{"sourceRow":59,"country":"BELGIUM","description":"Lot de 6 Mines colorées UPSELL","quantity":29.0,"cogs":1.49,"shipping":null,"unitTotal":1.49,"amount":43.21},{"sourceRow":60,"country":"BELGIUM","description":"Lot de 12 Mines colorées UPSELL","quantity":26.0,"cogs":2.98,"shipping":null,"unitTotal":2.98,"amount":77.48},{"sourceRow":61,"country":"BELGIUM","description":"Mines colorées  UPSELL","quantity":9.0,"cogs":0.25,"shipping":null,"unitTotal":0.25,"amount":2.25},{"sourceRow":63,"country":"CANADA","description":"Stylo eternelX1","quantity":12.0,"cogs":0.85,"shipping":5.29,"unitTotal":6.14,"amount":73.68},{"sourceRow":64,"country":"CANADA","description":"Stylo eternelX2","quantity":0,"cogs":1.7,"shipping":8.37,"unitTotal":10.07,"amount":0},{"sourceRow":65,"country":"CANADA","description":"Stylo eternelX3","quantity":3.0,"cogs":2.55,"shipping":11.46,"unitTotal":14.01,"amount":42.03},{"sourceRow":66,"country":"CANADA","description":"Stylo eternelX4","quantity":0,"cogs":3.4,"shipping":18.06,"unitTotal":21.46,"amount":0},{"sourceRow":67,"country":"CANADA","description":"Stylo eternelX5","quantity":0,"cogs":4.25,"shipping":21.7,"unitTotal":25.95,"amount":0},{"sourceRow":68,"country":"CANADA","description":"Stylo eternelX6","quantity":0,"cogs":5.1,"shipping":25.34,"unitTotal":30.44,"amount":0},{"sourceRow":69,"country":"CANADA","description":"Stylo eternelX7","quantity":0,"cogs":5.95,"shipping":23.81,"unitTotal":29.76,"amount":0},{"sourceRow":70,"country":"CANADA","description":"Stylo eternelX9","quantity":0,"cogs":7.65,"shipping":29.98,"unitTotal":37.63,"amount":0},{"sourceRow":71,"country":"CANADA","description":"Stylo eternelX12","quantity":0,"cogs":10.2,"shipping":38.12,"unitTotal":48.32,"amount":0},{"sourceRow":72,"country":"CANADA","description":"Lot de 2 gommes","quantity":5.0,"cogs":0.24,"shipping":5.29,"unitTotal":5.53,"amount":27.65},{"sourceRow":73,"country":"CANADA","description":"Carnet X1","quantity":0,"cogs":1.97,"shipping":9.13,"unitTotal":11.1,"amount":0},{"sourceRow":74,"country":"CANADA","description":"Lot de 4 mines rechargeables","quantity":0,"cogs":0.16,"shipping":3.78,"unitTotal":3.94,"amount":0},{"sourceRow":75,"country":"CANADA","description":"Lot de 6 mines rechargeables","quantity":2.0,"cogs":0.24,"shipping":5.09,"unitTotal":5.33,"amount":10.66},{"sourceRow":76,"country":"CANADA","description":"Lot de 12 Mines colorées","quantity":0,"cogs":null,"shipping":null,"unitTotal":0.0,"amount":0},{"sourceRow":77,"country":"CANADA","description":"Lot de 2 gommes UPSELL","quantity":8.0,"cogs":2.24,"shipping":null,"unitTotal":2.24,"amount":17.92},{"sourceRow":78,"country":"CANADA","description":"Carnet  UPSELL","quantity":0,"cogs":null,"shipping":null,"unitTotal":0.0,"amount":0},{"sourceRow":79,"country":"CANADA","description":"Lot de 4 mines rechargeables UPSELL","quantity":12.0,"cogs":0.76,"shipping":null,"unitTotal":0.76,"amount":9.12},{"sourceRow":80,"country":"CANADA","description":"Lot de 6 Mines colorées UPSELL","quantity":14.0,"cogs":1.49,"shipping":null,"unitTotal":1.49,"amount":20.86},{"sourceRow":81,"country":"CANADA","description":"Lot de 12 Mines colorées UPSELL","quantity":8.0,"cogs":2.98,"shipping":null,"unitTotal":2.98,"amount":23.84},{"sourceRow":82,"country":"CANADA","description":"Mines colorées  UPSELL","quantity":0,"cogs":0.25,"shipping":null,"unitTotal":0.25,"amount":0},{"sourceRow":84,"country":"SWITZERLAND","description":"Stylo eternelX1","quantity":32.0,"cogs":0.85,"shipping":5.49,"unitTotal":6.34,"amount":202.88},{"sourceRow":85,"country":"SWITZERLAND","description":"Stylo eternelX2","quantity":8.0,"cogs":1.7,"shipping":9.78,"unitTotal":11.48,"amount":91.84},{"sourceRow":86,"country":"SWITZERLAND","description":"Stylo eternelX3","quantity":4.0,"cogs":2.55,"shipping":14.0,"unitTotal":16.55,"amount":66.2},{"sourceRow":87,"country":"SWITZERLAND","description":"Stylo eternelX4","quantity":1.0,"cogs":3.4,"shipping":18.36,"unitTotal":21.76,"amount":21.76},{"sourceRow":88,"country":"SWITZERLAND","description":"Stylo eternelX5","quantity":0,"cogs":4.25,"shipping":22.66,"unitTotal":26.91,"amount":0},{"sourceRow":89,"country":"SWITZERLAND","description":"Stylo eternelX6","quantity":1.0,"cogs":5.1,"shipping":26.95,"unitTotal":32.05,"amount":32.05},{"sourceRow":90,"country":"SWITZERLAND","description":"Stylo eternelX7","quantity":0,"cogs":5.95,"shipping":31.24,"unitTotal":37.19,"amount":0},{"sourceRow":91,"country":"SWITZERLAND","description":"Stylo eternelX8","quantity":0,"cogs":6.8,"shipping":35.53,"unitTotal":42.33,"amount":0},{"sourceRow":92,"country":"SWITZERLAND","description":"Stylo eternelX9","quantity":0,"cogs":7.65,"shipping":39.82,"unitTotal":47.47,"amount":0},{"sourceRow":93,"country":"SWITZERLAND","description":"Stylo eternelX11","quantity":0,"cogs":9.35,"shipping":42.98,"unitTotal":52.33,"amount":0},{"sourceRow":94,"country":"SWITZERLAND","description":"Stylo eternelX12","quantity":0,"cogs":10.2,"shipping":46.89,"unitTotal":57.09,"amount":0},{"sourceRow":95,"country":"SWITZERLAND","description":"Lot de 2 gommes","quantity":2.0,"cogs":0.24,"shipping":5.49,"unitTotal":5.73,"amount":11.46},{"sourceRow":96,"country":"SWITZERLAND","description":"Carnet X1","quantity":3.0,"cogs":1.97,"shipping":11.23,"unitTotal":13.2,"amount":39.6},{"sourceRow":97,"country":"SWITZERLAND","description":"Lot de 2 gommes UPSELL","quantity":24.0,"cogs":2.64,"shipping":null,"unitTotal":2.64,"amount":63.36},{"sourceRow":98,"country":"SWITZERLAND","description":"Carnet  UPSELL","quantity":2.0,"cogs":10.2,"shipping":null,"unitTotal":10.2,"amount":20.4},{"sourceRow":99,"country":"SWITZERLAND","description":"Lot de 4 mines rechargeables UPSELL","quantity":18.0,"cogs":0.76,"shipping":null,"unitTotal":0.76,"amount":13.68},{"sourceRow":100,"country":"SWITZERLAND","description":"Lot de 6 Mines colorées UPSELL","quantity":21.0,"cogs":1.49,"shipping":null,"unitTotal":1.49,"amount":31.29},{"sourceRow":101,"country":"SWITZERLAND","description":"Lot de 12 Mines colorées UPSELL","quantity":17.0,"cogs":2.98,"shipping":null,"unitTotal":2.98,"amount":50.66},{"sourceRow":102,"country":"SWITZERLAND","description":"Mines colorées  UPSELL","quantity":0,"cogs":0.25,"shipping":null,"unitTotal":0.25,"amount":0},{"sourceRow":104,"country":"LUXEMBOURG","description":"Stylo eternelX1","quantity":2.0,"cogs":0.85,"shipping":6.6,"unitTotal":7.45,"amount":14.9},{"sourceRow":105,"country":"LUXEMBOURG","description":"Stylo eternelX2","quantity":0,"cogs":1.7,"shipping":10.69,"unitTotal":12.39,"amount":0},{"sourceRow":106,"country":"LUXEMBOURG","description":"Stylo eternelX3","quantity":1.0,"cogs":2.55,"shipping":14.79,"unitTotal":17.34,"amount":17.34},{"sourceRow":107,"country":"LUXEMBOURG","description":"Stylo eternelX4","quantity":0,"cogs":3.4,"shipping":18.88,"unitTotal":22.28,"amount":0},{"sourceRow":108,"country":"LUXEMBOURG","description":"Stylo eternelX6","quantity":0,"cogs":5.1,"shipping":27.08,"unitTotal":32.18,"amount":0},{"sourceRow":109,"country":"LUXEMBOURG","description":"Stylo eternelX10","quantity":0,"cogs":8.5,"shipping":43.46,"unitTotal":51.96,"amount":0},{"sourceRow":110,"country":"LUXEMBOURG","description":"Stylo eternelX27","quantity":0,"cogs":22.95,"shipping":51.07,"unitTotal":74.02,"amount":0},{"sourceRow":111,"country":"LUXEMBOURG","description":"Lot de 2 gommes","quantity":0,"cogs":0.24,"shipping":6.6,"unitTotal":6.84,"amount":0},{"sourceRow":112,"country":"LUXEMBOURG","description":"Carnet X1","quantity":0,"cogs":1.97,"shipping":9.87,"unitTotal":11.84,"amount":0},{"sourceRow":113,"country":"LUXEMBOURG","description":"Lot de 2 gommes UPSELL","quantity":3.0,"cogs":2.89,"shipping":null,"unitTotal":2.89,"amount":8.67},{"sourceRow":114,"country":"LUXEMBOURG","description":"Carnet  UPSELL","quantity":0,"cogs":11.23,"shipping":null,"unitTotal":11.23,"amount":0},{"sourceRow":115,"country":"LUXEMBOURG","description":"Lot de 4 mines rechargeables UPSELL","quantity":2.0,"cogs":0.76,"shipping":null,"unitTotal":0.76,"amount":1.52},{"sourceRow":116,"country":"LUXEMBOURG","description":"Lot de 6 Mines colorées UPSELL","quantity":2.0,"cogs":1.49,"shipping":null,"unitTotal":1.49,"amount":2.98},{"sourceRow":117,"country":"LUXEMBOURG","description":"Lot de 12 Mines colorées UPSELL","quantity":1.0,"cogs":2.98,"shipping":null,"unitTotal":2.98,"amount":2.98},{"sourceRow":118,"country":"LUXEMBOURG","description":"Mines colorées  UPSELL","quantity":0,"cogs":null,"shipping":null,"unitTotal":0.0,"amount":0},{"sourceRow":120,"country":"GERMANY","description":"Stylo eternelX1","quantity":0,"cogs":0.85,"shipping":5.76,"unitTotal":6.61,"amount":0},{"sourceRow":121,"country":"GERMANY","description":"Stylo eternelX2","quantity":0,"cogs":1.7,"shipping":9.98,"unitTotal":11.68,"amount":0},{"sourceRow":122,"country":"GERMANY","description":"Stylo eternelX3","quantity":0,"cogs":2.55,"shipping":14.68,"unitTotal":17.23,"amount":0},{"sourceRow":123,"country":"GERMANY","description":"Lot de 4 mines rechargeables UPSELL","quantity":0,"cogs":0.76,"shipping":null,"unitTotal":0.76,"amount":0},{"sourceRow":124,"country":"GERMANY","description":"Lot de 6 Mines colorées UPSELL","quantity":0,"cogs":1.49,"shipping":null,"unitTotal":1.49,"amount":0},{"sourceRow":125,"country":"GERMANY","description":"Mines colorées  UPSELL","quantity":0,"cogs":0.25,"shipping":null,"unitTotal":0.25,"amount":0},{"sourceRow":127,"country":"AUSTRALIA","description":"Stylo eternelX1","quantity":0,"cogs":0.85,"shipping":null,"unitTotal":5.15,"amount":0},{"sourceRow":128,"country":"AUSTRALIA","description":"Stylo eternelX3","quantity":0,"cogs":2.55,"shipping":null,"unitTotal":11.16,"amount":0},{"sourceRow":129,"country":"AUSTRALIA","description":"Lot de 4 mines rechargeables","quantity":0,"cogs":0.17,"shipping":null,"unitTotal":3.1,"amount":0},{"sourceRow":130,"country":"AUSTRALIA","description":"Lot de 4 mines rechargeables UPSELL","quantity":0,"cogs":0.76,"shipping":null,"unitTotal":0.76,"amount":0},{"sourceRow":131,"country":"AUSTRALIA","description":"Lot de 6 Mines colorées UPSELL","quantity":0,"cogs":1.49,"shipping":null,"unitTotal":2.55,"amount":0},{"sourceRow":132,"country":"AUSTRALIA","description":"Mines colorées  UPSELL","quantity":0,"cogs":0.25,"shipping":null,"unitTotal":0.25,"amount":0},{"sourceRow":134,"country":"UNITED STATES","description":"Stylo eternelX1","quantity":0,"cogs":0.85,"shipping":null,"unitTotal":5.44,"amount":0},{"sourceRow":135,"country":"UNITED STATES","description":"Stylo eternelX3","quantity":0,"cogs":2.55,"shipping":null,"unitTotal":12.12,"amount":0},{"sourceRow":136,"country":"UNITED STATES","description":"Stylo eternelX4","quantity":0,"cogs":3.4,"shipping":null,"unitTotal":15.67,"amount":0},{"sourceRow":137,"country":"UNITED STATES","description":"Lot de 4 mines rechargeables UPSELL","quantity":0,"cogs":0.76,"shipping":null,"unitTotal":0.72,"amount":0},{"sourceRow":138,"country":"UNITED STATES","description":"Lot de 6 Mines colorées UPSELL","quantity":0,"cogs":1.49,"shipping":null,"unitTotal":1.47,"amount":0},{"sourceRow":139,"country":"UNITED STATES","description":"Mines colorées  UPSELL","quantity":0,"cogs":0.25,"shipping":null,"unitTotal":0.25,"amount":0},{"sourceRow":141,"country":"SPAIN","description":"Stylo eternelX1","quantity":0,"cogs":0.85,"shipping":5.95,"unitTotal":6.8,"amount":0},{"sourceRow":142,"country":"SPAIN","description":"Lot de 6 Mines colorées UPSELL","quantity":0,"cogs":1.79,"shipping":null,"unitTotal":1.79,"amount":0},{"sourceRow":144,"country":"","description":"Gravure Personnalisée","quantity":375.0,"cogs":0.6,"shipping":null,"unitTotal":0.6,"amount":225.0},{"sourceRow":145,"country":"","description":"Coffret Cadeau （upsell）","quantity":138.0,"cogs":0.37,"shipping":1.05,"unitTotal":1.42,"amount":195.96},{"sourceRow":147,"country":"","description":"Frais d’importation dans l’UE (3 € par colis)","quantity":337.0,"cogs":3.0,"shipping":null,"unitTotal":3.0,"amount":1011.0},{"sourceRow":148,"country":"","description":"Frais d’importation dans l’UE (2 € par colis)","quantity":56.0,"cogs":2.0,"shipping":null,"unitTotal":2.0,"amount":112.0},{"sourceRow":150,"country":"","description":"⁠Coût du moule - Gommes","quantity":0,"cogs":485.0,"shipping":null,"unitTotal":485.0,"amount":0}];

function detectGeneratedFactProfile(workbookName){
  const lines=(classified?.lineItems||[]).filter(x=>String(x.sourceFile||'')===String(workbookName||''));
  if(!lines.length)return 'GENERIC';
  const known=new Set(['PENCIL','REFILL','COLOR_REFILL','ENGRAVING','GIFT_BOX']);
  const hits=lines.filter(x=>known.has(x.category)).length;
  const hasPencil=lines.some(x=>x.category==='PENCIL');
  if(hasPencil && hits/Math.max(1,lines.length)>=0.35)return 'PENCIL_V1';
  if(lines.some(x=>x.category==='B2B'))return 'B2B_V1';
  return 'GENERIC';
}
function learnedCostRateForDescription(description='',country=''){
  const key=norm(description).toLowerCase().replace(/\s+/g,' ');
  const c=normalizeCountry(country);
  if(!key)return null;
  const sources=[
    ...sheets.flatMap(s=>(s.factRows||[])),
    ...LEARNED_PENCIL_FACT_ROWS
  ];
  const candidates=sources.filter(r=>norm(r.description).toLowerCase().replace(/\s+/g,' ')===key && (!c || !r.country || normalizeCountry(r.country)===c));
  if(!candidates.length)return null;
  const exact=candidates.find(r=>c && normalizeCountry(r.country)===c)||candidates[0];
  const num=v=>Number.isFinite(Number(v))?Number(v):null;
  return {cogs:num(exact.cogs),shipping:num(exact.shipping),unitTotal:num(exact.unitTotal)};
}
function generatedPencilFactRowsForWorkbook(workbookName){
  const effectiveRows=factRowsWithAutoLearning(workbookName,LEARNED_PENCIL_FACT_ROWS);
  const {plan}=buildFactBackfillPlan(workbookName,effectiveRows);
  return effectiveRows.map((r,i)=>{
    const v=plan.get(Number(r.sourceRow))||{quantity:Number(r.quantity)||0,amount:Number(r.amount)||0};
    return {
      no:i+1,country:r.country||'',description:r.description,sku:'',quantity:v.quantity,
      cogs:r.cogs,shipping:r.shipping,unitTotal:r.unitTotal,amount:v.amount,currency:'EUR',
      costStatus:r.dynamic?'自动学习当前订单价格':'已使用 WRITE CN FACT 学习价格',
      sourceFile:workbookName,
      sourceSheet:r.dynamic?'AUTO_FACT_DYNAMIC':'AUTO_FACT_PENCIL',
      generated:true
    };
  });
}
function generatedGenericFactRowsForWorkbook(workbookName){
  const rows=[], map=new Map(), currency=currencyForWorkbook(workbookName);
  const sourceLines=(classified?.lineItems||[]).filter(x=>String(x.sourceFile||'')===String(workbookName||''));
  for(const x of sourceLines){
    const category=x.categoryLabel||'待确认';
    const product=String(x.productName||'').trim() || category || '未命名商品';
    const sku=String(x.sku||'').trim();
    const country=String(x.country||'UNKNOWN').trim() || 'UNKNOWN';
    const key=[country,category,product,sku].join('\u0001');
    const cur=map.get(key)||{country,category,product,sku,quantity:0,currency,orders:new Set()};
    cur.quantity += Number(x.quantity)||1;
    cur.orders.add(String(x.recordKey||x.orderId||''));
    map.set(key,cur);
  }
  let no=1;
  for(const x of [...map.values()].sort((a,b)=>a.country.localeCompare(b.country,'en')||a.category.localeCompare(b.category,'zh')||a.product.localeCompare(b.product,'fr'))){
    const learned=learnedCostRateForDescription(x.product,x.country);
    const kbCost=window.WRITE_LEARNING_V2?.calculateCost?.({productName:x.product,sku:x.sku,country:x.country,currency:x.currency,quantity:x.quantity,orderAmount:0})
      || window.WRITE_KB?.calculateCost?.({productName:x.product,sku:x.sku,country:x.country,currency:x.currency,quantity:x.quantity,orderAmount:0});
    const cogs=learned?.cogs??(kbCost?.resolved?kbCost.unitCost:null),shipping=learned?.shipping??(kbCost?.resolved?0:null),unitTotal=learned?.unitTotal??(kbCost?.resolved?kbCost.unitCost:null);
    const calcUnit=Number.isFinite(Number(unitTotal))?Number(unitTotal):((Number.isFinite(Number(cogs))?Number(cogs):0)+(Number.isFinite(Number(shipping))?Number(shipping):0));
    const hasCost=Number.isFinite(Number(unitTotal))||Number.isFinite(Number(cogs))||Number.isFinite(Number(shipping));
    rows.push({
      no:no++,country:x.country,
      description:`${x.category} · ${x.product}`,
      sku:x.sku,quantity:x.quantity,cogs,shipping,unitTotal,
      amount:hasCost?Math.round((x.quantity*calcUnit+Number.EPSILON)*100)/100:null,
      currency:x.currency,
      costStatus:learned?'已使用历史 FACT 学习成本':kbCost?.resolved?(kbCost.session?'仅本次成本规则':'已使用长期成本模型'):hasCost?'已使用学习成本':'UNKNOWN',
      sourceFile:workbookName,sourceSheet:'AUTO_FACT',generated:true,
      orderCount:x.orders.size
    });
  }
  return rows;
}
function generatedFactRowsForWorkbook(workbookName){
  return detectGeneratedFactProfile(workbookName)==='PENCIL_V1'
    ? generatedPencilFactRowsForWorkbook(workbookName)
    : generatedGenericFactRowsForWorkbook(workbookName);
}
function allGeneratedFactRows(){
  const hasFact=workbooksWithFact();
  return (sourceWorkbooks||[])
    .filter(w=>!hasFact.has(w.name))
    .flatMap(w=>generatedFactRowsForWorkbook(w.name));
}
function xmlTextCell(ref,style,text){return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(text??'')}</t></is></c>`}
function xmlNumberCell(ref,style,value){return value===null||value===undefined||value===''?`<c r="${ref}" s="${style}"/>`:`<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`}
function xmlFormulaCell(ref,style,formula){return `<c r="${ref}" s="${style}"><f>${esc(formula)}</f></c>`}
function generatedTemplateDataRow(r,rowNo,index){
  const desc=[r.description||'未命名商品',r.sku?`SKU: ${r.sku}`:'',r.country?`Country: ${r.country}`:''].filter(Boolean).join('\n');
  const c=Number.isFinite(Number(r.cogs))?Number(r.cogs):null, s=Number.isFinite(Number(r.shipping))?Number(r.shipping):null, u=Number.isFinite(Number(r.unitTotal))?Number(r.unitTotal):null;
  let g='',h='';
  if(u!==null){g=xmlNumberCell(`G${rowNo}`,31,u);h=xmlFormulaCell(`H${rowNo}`,31,`D${rowNo}*G${rowNo}`)}
  else if(c!==null&&s!==null){g=xmlFormulaCell(`G${rowNo}`,31,`E${rowNo}+F${rowNo}`);h=xmlFormulaCell(`H${rowNo}`,31,`D${rowNo}*G${rowNo}`)}
  else if(c!==null){g=`<c r="G${rowNo}" s="31"/>`;h=xmlFormulaCell(`H${rowNo}`,31,`D${rowNo}*E${rowNo}`)}
  else if(s!==null){g=`<c r="G${rowNo}" s="31"/>`;h=xmlFormulaCell(`H${rowNo}`,31,`D${rowNo}*F${rowNo}`)}
  else {g=`<c r="G${rowNo}" s="31"/>`;h=`<c r="H${rowNo}" s="31"/>`}
  return `<row r="${rowNo}" s="1" customFormat="1" ht="32" customHeight="1" spans="1:8"><c r="A${rowNo}" s="27"/>${xmlNumberCell(`B${rowNo}`,30,index)}${xmlTextCell(`C${rowNo}`,31,desc)}${xmlNumberCell(`D${rowNo}`,32,r.quantity)}${xmlNumberCell(`E${rowNo}`,31,c)}${xmlNumberCell(`F${rowNo}`,69,s)}${g}${h}</row>`;
}
function shiftTemplateRowXml(rowXml,oldRow,newRow,totalOld,totalNew){
  let out=rowXml.replace(new RegExp(`r="${oldRow}"`,'g'),`r="${newRow}"`);
  out=out.replace(new RegExp(`([A-Z]{1,3})${oldRow}(?=[^0-9]|$)`,'g'),(_,c)=>`${c}${newRow}`);
  out=out.replace(new RegExp(`([A-Z]{1,3})${totalOld}(?=[^0-9]|$)`,'g'),(_,c)=>`${c}${totalNew}`);
  // Formula results cached by the historical template belong to its old data.
  // Keep the formula and style, but force Excel/LibreOffice to calculate the
  // current workbook instead of briefly displaying the historical amount.
  out=out.replace(/(<c\b[^>]*>[\s\S]*?<f\b[^>]*>[\s\S]*?<\/f>)<v>[^<]*<\/v>([\s\S]*?<\/c>)/g,'$1$2');
  if(oldRow===20)out=out.replace(`ref="B${newRow}"`,`ref="B${newRow}"`);
  return out;
}
function shiftTemplateMergeRef(ref,threshold,delta){
  return ref.replace(/([A-Z]{1,3})(\d+)/g,(m,c,r)=>`${c}${Number(r)>=threshold?Number(r)+delta:Number(r)}`);
}
function patchLearnedTemplateSheetXml(xml,data,workbookName){
  const originalCount=4,count=Math.max(1,data.length),delta=count-originalCount,totalRow=12+count,oldTotal=16;
  const rowRe=/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
  const rows=[];let m;while((m=rowRe.exec(xml)))rows.push({n:Number(m[1]),xml:m[0]});
  const before=rows.filter(x=>x.n<12).map(x=>x.xml).join('');
  const after=rows.filter(x=>x.n>=17).map(x=>shiftTemplateRowXml(x.xml,x.n,x.n+delta,oldTotal,totalRow)).join('');
  const dataRows=(data.length?data:[{description:'暂无可统计商品',sku:'',country:'',quantity:0,cogs:null,shipping:null,unitTotal:null}]).map((r,i)=>generatedTemplateDataRow(r,12+i,i+1)).join('');
  const totalXml=`<row r="${totalRow}" ht="32.25" customHeight="1" spans="1:8"><c r="A${totalRow}" s="12"/><c r="B${totalRow}" s="33"/><c r="C${totalRow}" s="33"/><c r="D${totalRow}" s="34"/><c r="E${totalRow}" s="33"/><c r="F${totalRow}" s="70"/><c r="G${totalRow}" s="70"/><c r="H${totalRow}" s="70"><f>SUM(H12:H${totalRow-1})</f></c></row>`;
  const sheetData=xml.match(/<sheetData>[\s\S]*?<\/sheetData>/)?.[0];if(!sheetData)throw new Error('学习 FACT 模板缺少 sheetData');
  let out=xml.replace(sheetData,`<sheetData>${before}${dataRows}${totalXml}${after}</sheetData>`);
  out=out.replace(/<dimension ref="A1:K\d+"\/>/,`<dimension ref="A1:K${35+delta}"/>`);
  out=out.replace(/<mergeCells count="(\d+)">([\s\S]*?)<\/mergeCells>/,(whole,countText,body)=>{
    const shifted=body.replace(/ref="([A-Z]+\d+:[A-Z]+\d+)"/g,(mm,ref)=>`ref="${shiftTemplateMergeRef(ref,17,delta)}"`);
    return `<mergeCells count="${countText}">${shifted}</mergeCells>`;
  });
  const currency=currencyForWorkbook(workbookName);
  const labels=['No','Description','Quantity',`COGs (${currency})`,` Shipping (${currency})`,`COGs + Shipping (${currency})`,`Amount (${currency})`];
  ['B','C','D','E','F','G','H'].forEach((col,i)=>{
    const re=new RegExp(`<c[^>]*\\br="${col}10"[^>]*>[\\s\\S]*?<\\/c>`);out=out.replace(re,xmlTextCell(`${col}10`,col==='D'?26:25,labels[i]));
  });
  const date=new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date());
  out=out.replace(/<c[^>]*\br="E3"[^>]*>[\s\S]*?<\/c>/,xmlTextCell('E3',62,`FACT - AUTO\n\n${date}`));
  const paymentRow=19+delta;
  out=out.replace(new RegExp(`<c[^>]*\\br="B${paymentRow}"[^>]*>[\\s\\S]*?<\\/c>`),xmlTextCell(`B${paymentRow}`,42,`Pour le règlement, merci de faire un virement en ${currency}`));
  return out;
}
async function rebuildArchiveReplacingEntry(archive,path,newBytes){
  const parts=[],central=[],entries=[];let offset=0;
  for(const orig of archive.entries){const nameBytes=enc.encode(orig.name);let e,data;if(orig.name===path){e={...orig,flags:(orig.flags||0)&0x800,method:0,crc:crc32(newBytes),compressedSize:newBytes.length,uncompressedSize:newBytes.length};data=newBytes}else{e={...orig,flags:(orig.flags||0)&0x800};data=await archive.compressedBlob(orig)}const local=zipLocalHeader(e,nameBytes);parts.push(local,data);central.push(zipCentralHeader(e,nameBytes,offset));offset+=local.length+e.compressedSize;entries.push(e)}
  const centralSize=central.reduce((a,b)=>a+b.length,0),centralOffset=offset;parts.push(...central,new Uint8Array([...u32(ZIP_EOCD),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralSize),...u32(centralOffset),...u16(0)]));return new Blob(parts,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function buildGeneratedPencilFactWorkbook(workbookName){
  const resp=await fetch(`./assets/FACT_TEMPLATE_CN_CANONICAL_V1.xlsx?v=7.2.3`,{cache:'no-store'});
  if(!resp.ok)throw new Error(`无法读取 CN 标准 FACT 模板（HTTP ${resp.status}）`);

  const templateBlob=await resp.blob();
  if(!templateBlob?.size)throw new Error('CN 标准 FACT 模板文件为空');
  const archive=await PreserveZipArchive.open(templateBlob);

  // V7.2.3: release-time verified canonical path. This removes runtime XML-discovery as a point of failure.
  const canonicalPath='xl/worksheets/sheet1.xml';
  let factPath=archive.get(canonicalPath)?canonicalPath:'';

  // Fallback only for future template replacements whose physical path changes.
  if(!factPath){
    const wbXml=await archive.text('xl/workbook.xml',4*1024*1024);
    const relsXml=await archive.text('xl/_rels/workbook.xml.rels',4*1024*1024);
    factPath=findFactSheetPath(wbXml,relsXml);
  }
  if(!factPath)throw new Error('CN 标准模板中没有可写入的 worksheet');
  if(!archive.get(factPath))throw new Error(`CN FACT worksheet 不存在：${factPath}`);

  const effectiveRows=factRowsWithAutoLearning(workbookName,LEARNED_PENCIL_FACT_ROWS);
  const audit=factCompletenessAudit(workbookName,effectiveRows);
  const hardIssues=audit.issues.filter(x=>x.type==='UNMAPPED_PRODUCT');
  if(hardIssues.length){
    throw new Error(`仍有无法识别商品：${hardIssues.slice(0,6).map(x=>x.product||x.sku||'未知商品').join(' / ')}`);
  }

  const xml=await archive.text(factPath,16*1024*1024);
  if(!xml.includes('<sheetData'))throw new Error(`CN FACT worksheet 结构异常：${factPath} 缺少 sheetData`);
  let patched=patchFactXml(xml,effectiveRows,workbookName).xml;
  const dynamicRows=effectiveRows.filter(r=>r.dynamic);
  patched=appendDynamicFactRows(patched,dynamicRows);
  if(!patched.includes('<sheetData'))throw new Error('CN FACT 写入后 worksheet 结构异常');

  const rebuilt=await rebuildArchiveReplacingEntry(archive,factPath,enc.encode(patched));
  if(!rebuilt?.size)throw new Error('CN FACT Excel 生成结果为空');

  // Verify generated XLSX is still a ZIP before exposing it for download.
  const sig=new Uint8Array(await rebuilt.slice(0,4).arrayBuffer());
  if(sig[0]!==0x50||sig[1]!==0x4b)throw new Error('CN FACT 生成文件不是有效 XLSX/ZIP');
  return rebuilt;
}
async function buildGeneratedFactWorkbook(workbookName){
  // V7.4.1 UNIVERSAL CONTRACT:
  // every workbook uses source data + canonical FACT template.
  // classification, historical match, cost availability and product familiarity never block generation.
  let data=[];
  try{
    data=generatedGenericFactRowsForWorkbook(workbookName)||[];
  }catch(e){
    console.warn('V7.4.1 generic FACT rows fallback:',e);
  }

  if(!Array.isArray(data)||!data.length){
    const currency=currencyForWorkbook(workbookName);
    const map=new Map();
    for(const x of (classified?.lineItems||[]).filter(x=>String(x.sourceFile||'')===String(workbookName||''))){
      const product=String(x.productName||x.sku||'Article').trim()||'Article';
      const sku=String(x.sku||'').trim();
      const country=String(x.country||'').trim()||'GLOBAL';
      const key=[country,product,sku].join('\u0001');
      const cur=map.get(key)||{country,product,sku,quantity:0,orders:new Set()};
      cur.quantity+=Number(x.quantity)||1;
      cur.orders.add(String(x.recordKey||x.orderId||''));
      map.set(key,cur);
    }
    data=[...map.values()].map((x,i)=>({
      no:i+1,
      country:x.country,
      description:x.product,
      sku:x.sku,
      quantity:x.quantity,
      cogs:null,
      shipping:null,
      unitTotal:null,
      amount:null,
      currency,
      costStatus:'PRICE_BLANK',
      sourceFile:workbookName,
      sourceSheet:'AUTO_FACT_V741',
      generated:true,
      orderCount:x.orders.size
    }));
  }

  const resp=await fetch('./assets/FACT_TEMPLATE_UNIFIED_V1.xlsx?v=7.4.1',{cache:'no-store'});
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
}

function buildFactExportData(){
  const importedFactRows=sheets.flatMap(s=>(s.factRows||[]).map(r=>({...r,sourceFile:r.sourceFile||s.sourceFile,sourceSheet:r.sourceSheet||s.sheetName})));
  const generatedFactRows=allGeneratedFactRows();
  const factRows=[...importedFactRows,...generatedFactRows];
  const active=factRows.filter(r=>(Number(r.quantity)||0)>0 || (Number(r.amount)||0)!==0);

  const normalizeDesc=(v)=>String(v||'未命名分类').replace(/\s+/g,' ').replace(/eternel\s*X/ig,'eternelX').trim();
  const naturalRank=(desc)=>{
    const d=normalizeDesc(desc);
    const m=d.match(/eternelX\s*(\d+)/i);
    if(m)return [0,Number(m[1]),d.toLowerCase()];
    if(/4 mines rechargeables|Lot de 4 mines rechargeables/i.test(d))return [1,0,d.toLowerCase()];
    if(/6 Mines colorées|Mines colorées/i.test(d))return [2,0,d.toLowerCase()];
    if(/Gravure/i.test(d))return [3,0,d.toLowerCase()];
    if(/Coffret/i.test(d))return [4,0,d.toLowerCase()];
    return [9,0,d.toLowerCase()];
  };
  const compareDesc=(a,b)=>{
    const aa=naturalRank(a.description),bb=naturalRank(b.description);
    return aa[0]-bb[0] || aa[1]-bb[1] || aa[2].localeCompare(bb[2],'fr');
  };

  const totalAmount=active.reduce((a,r)=>a+(Number(r.amount)||0),0);
  const totalQty=active.reduce((a,r)=>a+(Number(r.quantity)||0),0);
  const cogsTotal=active.reduce((a,r)=>a+((Number(r.quantity)||0)*(Number(r.cogs)||0)),0);
  const shippingTotal=active.reduce((a,r)=>a+((Number(r.quantity)||0)*(Number(r.shipping)||0)),0);
  const unallocated=totalAmount-cogsTotal-shippingTotal;

  const byDesc=new Map();
  for(const r of factRows){
    const display=normalizeDesc(r.description);
    const key=display.toLowerCase();
    const qty=Number(r.quantity)||0, amount=Number(r.amount)||0;
    const cur=byDesc.get(key)||{
      description:display,quantity:0,cogsAmount:0,shippingAmount:0,unitAmountWeighted:0,amount:0,
      countries:new Set(),files:new Set(),rows:0,rateRows:0,cogsRateSum:0,shippingRateSum:0,unitRateSum:0
    };
    cur.quantity+=qty;
    cur.cogsAmount+=qty*(Number(r.cogs)||0);
    cur.shippingAmount+=qty*(Number(r.shipping)||0);
    cur.unitAmountWeighted+=qty*(Number(r.unitTotal)||0);
    cur.amount+=amount;
    cur.rows+=1;
    if(Number.isFinite(Number(r.cogs))||Number.isFinite(Number(r.shipping))||Number.isFinite(Number(r.unitTotal))){
      cur.rateRows+=1;
      cur.cogsRateSum+=Number(r.cogs)||0;
      cur.shippingRateSum+=Number(r.shipping)||0;
      cur.unitRateSum+=Number(r.unitTotal)||0;
    }
    if(r.country)cur.countries.add(r.country);
    if(r.sourceFile)cur.files.add(r.sourceFile);
    byDesc.set(key,cur);
  }

  const summary=[...byDesc.values()].map(x=>{
    const qty=x.quantity;
    const avgCogs=qty?x.cogsAmount/qty:(x.rateRows?x.cogsRateSum/x.rateRows:0);
    const avgShipping=qty?x.shippingAmount/qty:(x.rateRows?x.shippingRateSum/x.rateRows:0);
    const avgUnit=qty?x.unitAmountWeighted/qty:(x.rateRows?x.unitRateSum/x.rateRows:(avgCogs+avgShipping));
    return {...x,avgCogs,avgShipping,avgUnit};
  }).filter(x=>x.quantity>0 || x.amount!==0).sort(compareDesc);

  const countries=new Map();
  for(const r of factRows){
    const country=String(r.country||'GLOBAL / 附加项目').trim()||'GLOBAL / 附加项目';
    if(!countries.has(country))countries.set(country,[]);
    countries.get(country).push(r);
  }
  const countryOrder=[...countries.keys()].sort((a,b)=>{
    const preferred=['FRANCE','BELGIUM','CANADA','SWITZERLAND','LUXEMBOURG','GERMANY','SPAIN','ITALY','NETHERLANDS','AUSTRIA','PORTUGAL','GLOBAL / 附加项目'];
    const ai=preferred.indexOf(a.toUpperCase()),bi=preferred.indexOf(b.toUpperCase());
    return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'en');
  });

  return {factRows,active,totalAmount,totalQty,cogsTotal,shippingTotal,unallocated,summary,countries,countryOrder};
}

function localDateStamp(){
  try{return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  catch(e){const d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${d.getFullYear()}-${m}-${day}`;}
}
function orderSequenceNumber(orderId){
  const raw=String(orderId??'').trim();
  const suffix=raw.match(/(?:^|[-_])(\d{4,7})$/);
  if(suffix)return Number(suffix[1]);
  return /^\d{4,9}$/.test(raw)?Number(raw):null;
}
function currentOrderRangeLabel(){
  // Prefer the explicit invoice batch range embedded in source workbook names, e.g. (26172-26532).
  // This is more reliable than scanning arbitrary historical/reference IDs that may also exist in a workbook.
  const namedRanges=(sourceWorkbooks||[]).map(w=>String(w?.name||'').match(/\((\d{4,9})\s*[-–—]\s*(\d{4,9})\)/)).filter(Boolean);
  if(namedRanges.length){
    const starts=namedRanges.map(m=>Number(m[1])).filter(Number.isFinite),ends=namedRanges.map(m=>Number(m[2])).filter(Number.isFinite);
    if(starts.length&&ends.length){const min=Math.min(...starts),max=Math.max(...ends);return min===max?String(min):`${min}-${max}`;}
  }
  const nums=(classified?.orders||[]).map(o=>orderSequenceNumber(o.orderId)).filter(Number.isFinite);
  if(!nums.length)return '订单范围未知';
  const min=Math.min(...nums),max=Math.max(...nums);
  return min===max?String(min):`${min}-${max}`;
}
function buildAccountingReport(){
  if(!classified)return;
  const totalAmount=classified.orders.reduce((a,o)=>a+(Number(o.orderAmount)||0),0);
  const reviewOrders=classified.orders.filter(o=>o.classificationStatus==='需复核');
  const reportDate=new Date().toLocaleString('zh-CN',{hour12:false});
  const sourceNames=[...new Set(sheets.map(x=>x.sourceFile).filter(Boolean))];
  const totalItemQty=classified.lineItems.reduce((a,x)=>a+(Number(x.quantity)||1),0);
  const giftQty=classified.lineItems.filter(x=>x.isFree).reduce((a,x)=>a+(Number(x.quantity)||1),0);
  const factData=buildFactExportData();
  const unknownCostRows=(factData.factRows||[]).filter(r=>r.costStatus==='UNKNOWN'||r.amount===null||r.amount===undefined);
  const costComplete=unknownCostRows.length===0;
  const grossProfit=costComplete?totalAmount-factData.totalAmount:null;
  const grossMargin=costComplete&&totalAmount?grossProfit/totalAmount:null;
  const sourceLabel=sourceNames.length===1?sourceNames[0]:`${sourceNames.length} 个文件`;
  const currencySummaryV7=currencyTotals();
  const multiCurrency=currencySummaryV7.length>1;

  // 00: only one clear accounting overview table. No FACT/order tables mixed on this sheet.
  const overview=[
    ['WRITE Settlement Manager — 专业会计结算总览','','',''],
    [`生成时间：${reportDate}｜数据源：${sourceLabel}`,'','',''],
    [],
    ['指标','数值','会计口径','状态'],
    ['销售订单总额',multiCurrency?'见币种总览':totalAmount,multiCurrency?'多币种禁止直接合计':'去重后订单金额合计',multiCurrency?'分币种核算':'已核算'],
    ['FACT 成本总额',costComplete?factData.totalAmount:'—',costComplete?'FACT / 自动生成 FACT 的 Amount 合计':`存在 ${unknownCostRows.length} 个未设置成本项目`,costComplete?(factData.factRows.length?(factData.active?'已解析':'已生成'):'无 FACT 数据'):'成本不完整'],
    ['估算毛利',multiCurrency||!costComplete?'—':grossProfit,multiCurrency?'多币种时不跨币种计算毛利':!costComplete?'存在未设置成本，禁止伪造利润':'销售订单总额 - FACT 成本总额',multiCurrency||!costComplete?'不计算':'估算值'],
    ['估算毛利率',multiCurrency||!costComplete?'—':grossMargin,multiCurrency?'多币种时不跨币种计算毛利率':!costComplete?'成本不完整，毛利率不可计算':'估算毛利 ÷ 销售订单总额',multiCurrency||!costComplete?'不计算':'估算值'],
    ['结算记录数',classified.orders.length,'每个源订单行均保留；订单号不作为删除依据','已核算'],
    ['商品件数',totalItemQty,'所有商品行数量合计','已核算'],
    ['确认包裹数',factData.parcelCount??0,'按订单级确认包裹统计；与商品/SKU分组独立','已核算'],
    ['赠品件数',giftQty,'🎁 / 100% off 自动识别','已识别'],
    ['待复核订单',reviewOrders.length,'正式交付前建议归零',reviewOrders.length?'需处理':'通过']
  ];

  // 01: FACT category summary only.
  const factSummaryRows=[['No','Description','Quantity','COGs (€)','Shipping (€)','COGs + Shipping (€)','Amount (€)']];
  let no=1;
  for(const r of factData.summary) factSummaryRows.push([no++,r.description,r.quantity,r.avgCogs,r.avgShipping,r.avgUnit,r.amount]);
  factSummaryRows.push(['','TOTAL / 合计',factData.totalQty,costComplete&&factData.totalQty?factData.cogsTotal/factData.totalQty:null,costComplete&&factData.totalQty?factData.shippingTotal/factData.totalQty:null,costComplete&&factData.totalQty?(factData.cogsTotal+factData.shippingTotal)/factData.totalQty:null,costComplete?factData.totalAmount:null]);

  // 02: Order accounting categories only.
  const orderCategoryRows=[['会计分类','订单数','订单金额','金额占比','待复核']];
  for(const r of classified.orderSummary) orderCategoryRows.push([r.category,r.orders,r.amount,totalAmount?r.amount/totalAmount:0,r.review||0]);
  orderCategoryRows.push(['合计',classified.orders.length,totalAmount,1,reviewOrders.length]);

  // 03: FACT country detail.
  const factDetailRows=[['国家/地区','No','Description','Quantity','COGs (€)','Shipping (€)','COGs + Shipping (€)','Amount (€)']];
  for(const country of factData.countryOrder){
    for(const r of factData.countries.get(country)||[]){
      factDetailRows.push([country,r.no||'',r.description||'',r.quantity??'',r.cogs??'',r.shipping??'',r.unitTotal??'',r.amount??'']);
    }
  }

  // 04: Order detail.
  const orderRows=[['订单号','日期','客户','国家/地区','订单金额','币种','会计分类','状态','商品件数','含赠品','运单号']];
  for(const o of classified.orders) orderRows.push([o.orderId,o.orderTime||'',o.buyerName||'',o.country||'',Number(o.orderAmount)||0,orderCurrency(o),o.accountingCategory,o.classificationStatus,Number(o.productCount)||0,o.hasGift?'是':'否',o.trackingNo||'']);

  // 05: Product summary.
  const productMap=new Map();
  for(const x of classified.lineItems){
    const key=[x.categoryLabel||'待确认',x.productName||'',x.sku||''].join('\u0001');
    const cur=productMap.get(key)||{category:x.categoryLabel||'待确认',product:x.productName||'',sku:x.sku||'',qty:0,free:0,orders:new Set()};
    const qty=Number(x.quantity)||1; cur.qty+=qty; if(x.isFree)cur.free+=qty; cur.orders.add(x.recordKey||x.orderId); productMap.set(key,cur);
  }
  const productRows=[['商品分类','产品名称','SKU','总件数','付费件数','赠品件数','涉及订单数']];
  [...productMap.values()].sort((a,b)=>b.qty-a.qty||a.category.localeCompare(b.category)).forEach(x=>productRows.push([x.category,x.product,x.sku,x.qty,Math.max(0,x.qty-x.free),x.free,x.orders.size]));

  // 06: Review only.
  const byId=new Map(classified.orders.map(o=>[String(o.recordKey||o.orderId),o]));
  const reviewRows=[['订单号','订单金额','客户','国家/地区','待确认产品','SKU','建议处理']];
  for(const x of classified.unknown){const o=byId.get(String(x.recordKey||x.orderId))||{};reviewRows.push([x.orderId,Number(o.orderAmount)||0,o.buyerName||'',o.country||x.country||'',x.productName||'',x.sku||'','请在 WebApp「待复核」页修改并保存']);}
  if(reviewRows.length===1)reviewRows.push(['—',0,'','','无待复核商品','','全部已完成分类']);

  const auditRows=[['订单号','订单金额','会计分类','分类状态','人工修正','来源文件','来源 Sheet','源行号','店铺账号','付款时间','发货时间']];
  for(const o of classified.orders) auditRows.push([o.orderId,Number(o.orderAmount)||0,o.accountingCategory,o.classificationStatus,Object.keys(o.manualLineCategories||{}).length?'是':'否',o.sourceFile||'',o.sourceSheet||'',o.sourceRow||'',o.storeAccount||'',o.paidTime||'',o.shippedTime||'']);
  const logRows=[['来源文件','Sheet','处理状态','订单行数','处理说明','解压读取字节']];
  for(const x of sheets)logRows.push([x.sourceFile,x.sheetName,x.status,x.orderCount,x.reason,x.inflatedBytes||0]);

  const currencyRows=[['币种','订单数','原币金额','说明']];
  for(const c of currencySummaryV7)currencyRows.push([c.currency,c.orders,c.amount,'原币汇总，不做隐式换算']);
  if(currencySummaryV7.length===0)currencyRows.push(['—',0,0,'未识别币种']);

  const blob=buildXlsx([
    {name:'00_币种总览',rows:currencyRows,widths:[14,14,22,40],headerRows:[1],freezeRow:1,autoFilterRow:1,integerColumns:[2],centerColumns:[1,2],bandedRows:true},
    {name:'01_结算总览',rows:overview,widths:[26,20,38,20],titleRow:1,subtitleRow:2,headerRows:[4],freezeRow:4,freezeCol:1,merges:['A1:D1','A2:D2'],formatRules:[
      {r1:5,r2:7,c1:2,c2:2,kind:'currency'},{r1:8,r2:8,c1:2,c2:2,kind:'percent'},{r1:9,r2:12,c1:2,c2:2,kind:'int'}
    ]},
    {name:'02_FACT分类汇总',rows:factSummaryRows,widths:[10,52,14,16,18,22,20],headerRows:[1],totalRows:[factSummaryRows.length],freezeRow:1,freezeCol:2,autoFilterRow:1,integerColumns:[1,3],currencyColumns:[4,5,6,7],bandedRows:true},
    {name:'03_订单会计分类',rows:orderCategoryRows,widths:[26,14,18,16,14],headerRows:[1],totalRows:[orderCategoryRows.length],freezeRow:1,freezeCol:1,autoFilterRow:1,integerColumns:[2,5],currencyColumns:[3],percentColumns:[4],bandedRows:true},
    {name:'04_FACT国家明细',rows:factDetailRows,widths:[20,10,52,14,16,18,22,20],headerRows:[1],freezeRow:1,freezeCol:3,autoFilterRow:1,integerColumns:[2,4],currencyColumns:[5,6,7,8],bandedRows:true},
    {name:'05_订单明细',rows:orderRows,widths:[22,22,28,18,17,12,22,14,13,12,28],headerRows:[1],freezeRow:1,freezeCol:2,autoFilterRow:1,integerColumns:[9],centerColumns:[6],bandedRows:true},
    {name:'06_商品汇总',rows:productRows,widths:[18,60,36,14,14,14,16],headerRows:[1],freezeRow:1,freezeCol:1,autoFilterRow:1,integerColumns:[4,5,6,7],bandedRows:true},
    {name:'07_待复核',rows:reviewRows,widths:[22,17,28,18,58,36,42],headerRows:[1],freezeRow:1,freezeCol:2,autoFilterRow:1,currencyColumns:[2],reviewMode:true,bandedRows:true},
    {name:'90_订单审计',rows:auditRows,widths:[22,17,22,14,14,54,24,12,28,22,22],headerRows:[1],freezeRow:1,freezeCol:1,autoFilterRow:1,currencyColumns:[2],integerColumns:[8],bandedRows:true},
    {name:'99_导入日志',rows:logRows,widths:[56,26,20,14,56,20],headerRows:[1],freezeRow:1,autoFilterRow:1,integerColumns:[4,6],bandedRows:true}
  ]);
  return {blob,fileName:`WRITE_会计结算_${currentOrderRangeLabel()}_${localDateStamp()}.xlsx`};
}


let exportCenterUrls=[];
function revokeExportCenterUrls(){
  for(const url of exportCenterUrls){try{URL.revokeObjectURL(url)}catch(e){}}
  exportCenterUrls=[];
}
function closeExportCenter(){
  document.getElementById('exportCenter')?.remove();
  revokeExportCenterUrls();
}
function ensureExportCenter(){
  let panel=document.getElementById('exportCenter');
  if(panel)return panel;
  panel=document.createElement('section');
  panel.id='exportCenter';
  panel.className='export-center';
  panel.innerHTML=`
    <div class="export-center-head">
      <div><small>EXPORT CENTER</small><h3>结算报表导出</h3></div>
      <button type="button" class="export-center-close" aria-label="关闭">×</button>
    </div>
    <div class="export-center-stage" id="exportCenterStage">准备生成…</div>
    <div class="export-center-files" id="exportCenterFiles"></div>
    <div class="export-center-log" id="exportCenterLog"></div>`;
  document.body.appendChild(panel);
  panel.querySelector('.export-center-close')?.addEventListener('click',closeExportCenter);
  return panel;
}
function exportCenterStage(message,type='info'){
  const panel=ensureExportCenter();
  const stage=panel.querySelector('#exportCenterStage');
  if(stage){stage.textContent=message;stage.className=`export-center-stage ${type}`;}
}
function exportCenterLog(message,type='info'){
  const panel=ensureExportCenter();
  const log=panel.querySelector('#exportCenterLog');
  if(!log)return;
  const row=document.createElement('div');
  row.className=`export-log-row ${type}`;
  row.textContent=message;
  log.appendChild(row);
}
function addExportFile(blob,filename,label,kind='primary'){
  if(!(blob instanceof Blob)||!blob.size)throw new Error(`${label} 文件为空。`);
  const panel=ensureExportCenter();
  const files=panel.querySelector('#exportCenterFiles');
  const url=URL.createObjectURL(blob);exportCenterUrls.push(url);
  const size=(blob.size/1024/1024).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const row=document.createElement('div');row.className='export-file-row';
  const copy=document.createElement('div');copy.className='export-file-copy';
  const strong=document.createElement('strong');strong.textContent=label;
  const small=document.createElement('small');small.textContent=`${filename} · ${size} MB`;
  copy.append(strong,small);
  const a=document.createElement('a');a.href=url;a.download=filename;a.className=`export-file-download ${kind}`;a.textContent='下载';
  row.append(copy,a);files.appendChild(row);
  return a;
}
function resetExportCenter(){
  closeExportCenter();
  const panel=ensureExportCenter();
  panel.querySelector('#exportCenterFiles').innerHTML='';
  panel.querySelector('#exportCenterLog').innerHTML='';
  exportCenterStage('准备生成…');
}
function setExportBusy(active){
  const buttons=[els.exportButton,els.topExportButton,els.quickExportButton,els.heroExportButton].filter(Boolean);
  for(const btn of buttons){
    if(active){
      if(!btn.dataset.exportOriginalHtml)btn.dataset.exportOriginalHtml=btn.innerHTML;
      btn.disabled=true;btn.setAttribute('aria-busy','true');
      if(btn===els.heroExportButton)btn.innerHTML='<span>…</span><div><b>正在生成结算报表…</b><small>导出中心正在准备文件</small></div>';
      else btn.textContent='正在生成…';
    }else{
      btn.disabled=false;btn.removeAttribute('aria-busy');
      if(btn.dataset.exportOriginalHtml){btn.innerHTML=btn.dataset.exportOriginalHtml;delete btn.dataset.exportOriginalHtml;}
    }
  }
}
async function exportAccounting(){
  if(!classified){
    resetExportCenter();exportCenterStage('当前没有可导出的结算数据。','error');exportCenterLog('请先导入订单。','error');return;
  }
  closeExportCenter();
  hideError();
  let report=null;
  let exportStarted=false;
  let exportPolicy={ok:true,unknownCosts:0,allowUnknownCosts:false,action:'continue'};
  try{
    exportPolicy=await window.WRITE_LEARNING_V2?.beforeExport?.()||exportPolicy;
    setExportBusy(true);
    resetExportCenter();
    exportStarted=true;
    exportCenterLog('✓ 源订单记录已载入；分类/成本未知不会阻断 FACT。','success');
    if(exportPolicy.allowUnknownCosts){
      exportCenterLog(`⚠ 本次允许 未知价格留空导出：${exportPolicy.unknownCosts||0} 组未设置成本；不会写成 0，也不会计算虚假毛利。`,'info');
    }
    exportCenterStage('1/4 正在生成会计 Excel…');
    report=buildAccountingReport();
    if(!report?.blob?.size)throw new Error('会计报表生成失败：Excel 文件为空。');
    addExportFile(report.blob,report.fileName,'会计结算 Excel','secondary');
    exportCenterLog('✓ 会计结算 Excel 已生成，可立即下载。','success');
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));

    exportCenterStage('2/4 正在生成 / 回填 FACT…');
    const hasFact=workbooksWithFact();
    const deliverables=[];
    for(const wb of (sourceWorkbooks||[])){
      exportCenterStage(`2/4 生成统一 FACT · ${basename(wb.name)}`);
      exportCenterLog('→ 读取源订单全部可用字段并套用统一 FACT 模板…','info');

      let generated;
      try{
        generated=await buildGeneratedFactWorkbook(wb.name);
      }catch(factErr){
        throw new Error(`${basename(wb.name)}：统一 FACT 文件生成异常：${factErr?.message||factErr}`);
      }

      if(!generated?.size)throw new Error(`${basename(wb.name)}：统一 FACT 生成结果为空。`);

      const filename=`FACT_已统计_${currentOrderRangeLabel()}_${basename(wb.name).replace(/\.xlsx$/i,'')}.xlsx`;
      deliverables.push({name:filename,data:generated});
      addExportFile(generated,filename,'统一 FACT','secondary');
      exportCenterLog(`✓ ${filename} 已生成。未知价格保持空白，已知数据全部保留。`,'success');
    }

    if(!deliverables.length){
      const fallbackName=(importedFileNames?.[0]||'订单数据.xlsx').replace(/\.zip$/i,'.xlsx');
      const generated=await buildGeneratedFactWorkbook(fallbackName);
      const filename=`FACT_自动生成_${currentOrderRangeLabel()}_${basename(fallbackName).replace(/\.xlsx$/i,'')}.xlsx`;
      if(!generated?.size)throw new Error('没有生成任何 FACT 交付文件。');
      deliverables.push({name:filename,data:generated});
      addExportFile(generated,filename,'自动 FACT','secondary');
    }

    exportCenterStage('3/4 正在打包完整结算 ZIP…');
    const packageBlob=await zipStoreBlobs([{name:report.fileName,data:report.blob},...deliverables]);
    if(!packageBlob?.size)throw new Error('ZIP 打包失败：生成文件为空。');
    const exportName=`WRITE_结算交付包_${currentOrderRangeLabel()}_${localDateStamp()}.zip`;
    addExportFile(packageBlob,exportName,'完整结算包 ZIP','primary');
    exportCenterLog('✓ 完整结算 ZIP 已生成。','success');
    exportCenterStage('4/4 全部文件已生成，请点击“下载”。','success');
    els.systemStatus.textContent='结算包已生成 · 等待下载';
  }catch(err){
    console.error('WRITE export failed',err);
    const message=err?.message||String(err)||'未知导出错误';
    const stackLine=String(err?.stack||'').split('\n').slice(0,3).join(' | ');
    if(exportStarted){
      exportCenterStage(`导出未完成：${message}`,'error');
      exportCenterLog(`✕ ${message}`,'error');
      if(stackLine)exportCenterLog(`诊断：${stackLine}`,'error');
      if(report?.blob?.size)exportCenterLog('会计 Excel 已生成，可先下载；FACT/ZIP 阶段失败不会再影响会计报表下载。','info');
    }else{
      resetExportCenter();
      exportCenterStage(`导出未开始：${message}`,'error');
      exportCenterLog(`✕ ${message}`,'error');
      if(stackLine)exportCenterLog(`诊断：${stackLine}`,'error');
    }
    if(message!=='已取消导出。')showError(`导出失败：${message}`);
  }finally{
    setExportBusy(false);
  }
}

function reimportFlow(){
  if(!classified){els.fileInput.click();return}
  openConfirm({title:'重新导入数据？',text:'当前统计结果会被清空，然后打开文件选择器重新导入。原始文件不会被修改。',confirmText:'清空并重新导入',action:()=>{
document.getElementById('knowledgeSyncNow')?.addEventListener('click',()=>window.WRITE_KB?.sync?.({force:true}));
document.getElementById('knowledgeExportBackup')?.addEventListener('click',()=>window.WRITE_KB?.exportBackup?.());
document.getElementById('knowledgeImportBackup')?.addEventListener('click',()=>document.getElementById('knowledgeBackupFile')?.click());
document.getElementById('knowledgeBackupFile')?.addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    const count=await window.WRITE_KB.importBackup(file);
    alert(`已恢复 ${count} 条规则`);
    renderLearningCenter();
  }catch(err){showError(`规则恢复失败：${err?.message||err}`)}
  event.target.value='';
});
window.addEventListener('write-kb-ready',()=>renderLearningCenter());
window.addEventListener('write-kb-updated',()=>renderLearningCenter());
window.WRITE_KB?.init?.().catch?.(()=>{});

resetState(); setTimeout(()=>els.fileInput.click(),80)}});
}
function clearFlow(){
  if(!classified)return;
  openConfirm({title:'清空当前数据？',text:'订单、分类、导入记录和统计结果将从本页面清除。此操作不会删除你的原始 Excel / ZIP 文件。',confirmText:'确认清空',action:()=>resetState()});
}

els.chooseButton.addEventListener('click',e=>{e.stopPropagation();if(!busy)els.fileInput.click()});
els.dropzone.addEventListener('click',()=>{if(!busy)els.fileInput.click()});
els.fileInput.addEventListener('change',e=>startImport(e.target.files));
els.dropzone.addEventListener('dragover',e=>{e.preventDefault();if(!busy)els.dropzone.classList.add('dragging')});
els.dropzone.addEventListener('dragleave',()=>els.dropzone.classList.remove('dragging'));
els.dropzone.addEventListener('drop',e=>{e.preventDefault();els.dropzone.classList.remove('dragging');startImport(e.dataTransfer.files)});
els.dismissError.addEventListener('click',hideError); els.searchInput.addEventListener('input',renderOrders); els.countrySelect.addEventListener('change',renderOrders); els.categorySelect.addEventListener('change',renderOrders);
[els.exportButton,els.topExportButton,els.quickExportButton,els.heroExportButton].forEach(btn=>btn?.addEventListener('click',exportAccounting));
[els.heroImportButton,els.inlineImportButton,els.navImportButton].forEach(btn=>btn?.addEventListener('click',reimportFlow));
els.reimportButton.addEventListener('click',reimportFlow); els.sidebarResetButton.addEventListener('click',reimportFlow); els.clearButton.addEventListener('click',clearFlow);
document.addEventListener('keydown',e=>{const m=document.getElementById('confirmModal');if(e.key==='Escape'&&m&&!m.hidden)closeConfirm()});
document.getElementById('sideNav').addEventListener('click',e=>{const btn=e.target.closest('[data-view]');if(!btn)return;const view=btn.dataset.view;if(view==='history'){els.importLanding.hidden=true;els.appViews.hidden=false;setView('history');return}if(classified){setView(view);return}if(view==='dashboard'){els.appViews.hidden=true;els.importLanding.hidden=false;document.querySelectorAll('.nav-item[data-view]').forEach(item=>item.classList.toggle('active',item.dataset.view==='dashboard'))}});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-go-view]');if(btn&&classified)setView(btn.dataset.goView)});
document.addEventListener('click',e=>{const btn=e.target.closest('.review-save');if(btn){const editor=btn.closest('.review-editor');if(editor)saveReviewRow(editor)}});


// v6.5.12 theme controller: auto / light / dark
const themeButton=document.getElementById('themeToggleButton');
const themeLabel=document.getElementById('themeLabel');
const themeMedia=window.matchMedia('(prefers-color-scheme: dark)');
function getThemePreference(){
  const value=localStorage.getItem('write-theme')||'auto';
  return /^(auto|light|dark)$/.test(value)?value:'auto';
}
function resolvedTheme(pref){return pref==='auto'?(themeMedia.matches?'dark':'light'):pref}
function applyTheme(pref,{persist=true}={}){
  const safe=/^(auto|light|dark)$/.test(pref)?pref:'auto';
  if(persist)localStorage.setItem('write-theme',safe);
  const resolved=resolvedTheme(safe);
  document.documentElement.dataset.theme=resolved;
  document.documentElement.dataset.themePreference=safe;
  document.documentElement.style.colorScheme=resolved;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',resolved==='dark'?'#1c1c1f':'#ffffff');
  if(themeButton){
    themeButton.dataset.themePref=safe;
    themeButton.setAttribute('aria-label',`当前主题：${safe==='auto'?'自动':safe==='light'?'浅色':'深色'}；点击切换`);
    themeButton.title=`主题：${safe==='auto'?'自动跟随系统':safe==='light'?'浅色':'深色'}（点击切换）`;
  }
  if(themeLabel)themeLabel.textContent=`主题：${safe==='auto'?'自动':safe==='light'?'浅色':'深色'}`;
}
function cycleTheme(){
  const current=getThemePreference();
  const next=current==='auto'?'light':current==='light'?'dark':'auto';
  applyTheme(next);
}
themeButton?.addEventListener('click',cycleTheme);
const onSystemThemeChange=()=>{if(getThemePreference()==='auto')applyTheme('auto',{persist:false})};
if(themeMedia.addEventListener)themeMedia.addEventListener('change',onSystemThemeChange);else themeMedia.addListener(onSystemThemeChange);
applyTheme(getThemePreference(),{persist:false});


// v7.2.3 release notes controller — show once per release per browser
const WRITE_RELEASE_META = window.WRITE_RELEASE_META || {current:{version:document.body.dataset.release||'7.2.3',time:'',title:'WRITE Settlement Manager',sections:[]},history:[]};
const WRITE_RELEASE = {
  version: WRITE_RELEASE_META.current?.version || document.body.dataset.release || '7.2.3',
  date: WRITE_RELEASE_META.current?.time || '',
  title: `WRITE Settlement Manager v${WRITE_RELEASE_META.current?.version || document.body.dataset.release || '7.2.3'}`,
  sections: WRITE_RELEASE_META.current?.sections || []
};
function showReleaseNotesIfNeeded(){
  const version=WRITE_RELEASE.version;
  const key=`write-release-seen-${version}`;
  let seen='';
  try{seen=localStorage.getItem(key)||''}catch(e){}
  if(seen==='1')return;
  const backdrop=document.createElement('div');
  backdrop.className='release-notes-backdrop';
  backdrop.setAttribute('role','dialog');
  backdrop.setAttribute('aria-modal','true');
  backdrop.setAttribute('aria-labelledby','releaseNotesTitle');
  const sections=WRITE_RELEASE.sections.map(section=>`<section class="release-notes-section"><h3>${escapeHtml(section.label)}</h3><ul>${section.items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`).join('');
  backdrop.innerHTML=`<div class="release-notes-card"><div class="release-notes-head"><div><span>本次更新</span><h2 id="releaseNotesTitle">${escapeHtml(WRITE_RELEASE.title)}</h2><p>${escapeHtml(WRITE_RELEASE.date)} · Designed by NEOVORA</p></div><div class="release-version">v${escapeHtml(version)}</div></div><div class="release-notes-body">${sections}</div><div class="release-notes-foot"><small>关闭后，本浏览器在 v${escapeHtml(version)} 版本中不会再次自动弹出。</small><button type="button" class="release-ack">我知道了</button></div></div>`;
  document.body.appendChild(backdrop);
  document.body.classList.add('release-notes-open');
  const close=()=>{
    try{localStorage.setItem(key,'1')}catch(e){}
    backdrop.classList.add('closing');
    document.body.classList.remove('release-notes-open');
    setTimeout(()=>backdrop.remove(),160);
  };
  backdrop.querySelector('.release-ack')?.addEventListener('click',close);
  setTimeout(()=>backdrop.querySelector('.release-ack')?.focus(),80);
}

resetState();
showReleaseNotesIfNeeded();
window.__WRITE_APP_READY__=true;
document.documentElement.dataset.writeReady='true';



// v7.2.3 — version history from unified release metadata
const WRITE_HISTORY = Array.isArray(WRITE_RELEASE_META.history) ? WRITE_RELEASE_META.history : [];
function renderReleaseHistory(){
  const host=document.getElementById('releaseHistory');
  if(!host)return;
  const count=document.getElementById('historyCount');
  if(count)count.textContent=`${WRITE_HISTORY.length} 个版本`;
  const currentVersion=document.getElementById('historyCurrentVersion');
  if(currentVersion)currentVersion.textContent=`v${WRITE_RELEASE.version}`;
  host.innerHTML=WRITE_HISTORY.map((entry,index)=>`<article class="history-item ${index===0?'current':''}"><div class="history-meta"><span class="history-version">v${escapeHtml(entry.version)}</span><time class="history-time">${escapeHtml(entry.time)}</time></div><div class="history-body"><h3>${escapeHtml(entry.title)}</h3><ul>${entry.items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></div></article>`).join('');
}
renderReleaseHistory();
