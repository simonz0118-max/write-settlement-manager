/* WRITE Settlement Manager v5.3.3 - single-file browser bundle */
const norm = (v='') => String(v ?? '').trim();
const low = (v='') => norm(v).toLowerCase();

const LINE_CATEGORIES = [
  ['PENCIL','铅笔','Le Crayon Intemporel / 铅笔本体'],
  ['ENGRAVING','雕刻服务','Gravure Personnalisée / 雕刻'],
  ['REFILL','普通笔芯','可替换普通笔芯'],
  ['COLOR_REFILL','彩色笔芯','彩色笔芯 / Mines colorées'],
  ['GIFT_BOX','礼盒','Coffret Cadeau / 礼盒'],
  ['GIFT_CARD','礼品卡','Carte-cadeau'],
  ['B2B','B2B / 专业订单','Commande Professionnelle'],
  ['OTHER','待确认','未命中已知规则'],
].map(([code,label,description])=>({code,label,description}));

const LABEL = Object.fromEntries(LINE_CATEGORIES.map(x=>[x.code,x.label]));

function quantityFromSku(sku='') {
  const m = norm(sku).match(/\*(\d+(?:\.\d+)?)\s*$/);
  return m ? Number(m[1]) : 1;
}

function classifyLine(productName='', sku='') {
  const name = norm(productName), n = low(name), s = low(sku);
  const isFree = /^🎁/.test(name) || /100%\s*off|gratuit|cadeau offert/.test(n);
  let category = 'OTHER';
  if (/commande professionnelle|professional order|cmd pro/.test(n)) category = 'B2B';
  else if (/carte[- ]cadeau|gift\s*card/.test(n)) category = 'GIFT_CARD';
  else if (/gravure|雕刻/.test(n) || /(^|\D)50505594077448/.test(s) || /雕刻/.test(s)) category = 'ENGRAVING';
  else if (/coffret cadeau|礼盒|盒子/.test(n) || /(^|\D)52838739738888/.test(s) || /盒子/.test(s)) category = 'GIFT_BOX';
  else if (/mines? color[ée]es?|彩色.*笔芯|pack.*mines/.test(n) || /qb-csbt/.test(s) || /(^|\D)(49624586256648|52725633384712)(\D|$)/.test(s) || /qb-6/.test(s)) category = 'COLOR_REFILL';
  else if (/mines? rechargeables?|\b4\s*mines\b|笔芯/.test(n) || /qb-4/.test(s) || /(^|\D)(45407586615560|45157341331720)(\D|$)/.test(s)) category = 'REFILL';
  else if (/le crayon intemporel|铅笔|crayon/.test(n) || /qb-(obsidienne|aluminium|carmin|nuit|jade|saturne)/.test(s) || /(^|\D)(45242109231368|45242109329672)(\D|$)/.test(s) || /铅笔/.test(s)) category = 'PENCIL';
  return { category, categoryLabel: LABEL[category], isFree, quantity: quantityFromSku(sku) };
}

function parseLineItems(order) {
  const names = norm(order.productNames).split(/\n+/).map(x=>x.trim());
  const skus = norm(order.skuLines).split(/\n+/).map(x=>x.trim());
  const manual = order.manualLineCategories || {};
  const count = Math.max(names.filter(Boolean).length ? names.length : 0, skus.filter(Boolean).length ? skus.length : 0, 1);
  const items=[];
  for(let i=0;i<count;i++) {
    const productName=names[i]||''; const sku=skus[i]||'';
    if(!productName && !sku && count>1) continue;
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
  else if (paidCategories.has('GIFT_BOX')) [code,label]=['ACCESSORY_ORDER','礼盒 / 配件订单'];
  else if (paidCategories.has('ENGRAVING')) [code,label]=['SERVICE_ORDER','雕刻服务订单'];
  else if (amount===0) [code,label]=['ZERO_OTHER','0€待确认订单'];
  const unknownItems=items.filter(x=>x.category==='OTHER');
  return {...order, accountingCode:code, accountingCategory:label, lineItems:items, unknownItemCount:unknownItems.length,
    hasGift:items.some(x=>x.isFree), classificationStatus:unknownItems.length?'需复核':'已分类'};
}

function classifyOrders(orders=[]) {
  const classified=orders.map(classifyOrder);
  const lineItems=[];
  for(const o of classified) for(const item of o.lineItems) lineItems.push({...item, orderId:o.orderId, orderAmount:o.orderAmount, country:o.country, sourceFile:o.sourceFile, sourceSheet:o.sourceSheet});
  const orderMap=new Map();
  for(const o of classified){
    const k=o.accountingCategory; const r=orderMap.get(k)||{category:k,orders:0,amount:0,review:0}; r.orders++; r.amount+=Number(o.orderAmount)||0; if(o.classificationStatus==='需复核')r.review++; orderMap.set(k,r);
  }
  const lineMap=new Map();
  for(const item of lineItems){
    const k=item.categoryLabel; const r=lineMap.get(k)||{category:k,lines:0,quantity:0,freeQuantity:0,orders:new Set(),touchedAmountOrders:new Map()};
    r.lines++; r.quantity+=Number(item.quantity)||1; if(item.isFree)r.freeQuantity+=Number(item.quantity)||1; r.orders.add(item.orderId); r.touchedAmountOrders.set(item.orderId,Number(item.orderAmount)||0); lineMap.set(k,r);
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

const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 [$€-fr-FR]"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="7"><font><sz val="11"/><name val="Aptos"/><color rgb="FF1D1D1F"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="20"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font><font><sz val="11"/><name val="Aptos"/><color rgb="FF6E6E73"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FF1D1D1F"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FF9A3412"/></font><font><sz val="11"/><name val="Aptos"/><color rgb="FF6E6E73"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1C1C1E"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F7"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E5EA"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFAFAFC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7F7F8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E5EA"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FFC7C7CC"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="20">
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
function downloadBlob(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}



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

const numberFormat = new Intl.NumberFormat('zh-CN');
const moneyFormat = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const decimalFormat = new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1});
let worker=null, orders=[], sheets=[], classified=null, busy=false, duplicateCount=0, importStartedAt=0, importDuration=0, importedFileNames=[];
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
  worker?.terminate(); worker=null; orders=[]; sheets=[]; classified=null; busy=false; duplicateCount=0; importDuration=0; importedFileNames=[];
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

function startImport(fileList){
  const files=[...fileList].filter(f=>/\.(xlsx|zip)$/i.test(f.name)); if(!files.length||busy)return;
  worker?.terminate(); worker=new Worker('./src/workers/import.worker.bundle.js?v=5.3.3'); importStartedAt=performance.now(); importedFileNames=files.map(f=>f.name);
  setBusy(true); hideError(); els.importLanding.hidden=false; els.appViews.hidden=true; els.topActions.hidden=true;
  els.currentFile.textContent='准备读取…'; els.progressFill.style.width='0%'; els.progressText.textContent='0% · 大文件在独立线程运行';
  worker.onmessage=({data})=>{
    if(data.type==='file-start') els.currentFile.textContent=data.fileName;
    if(data.type==='progress'){
      const pct=Math.max(0,Math.min(100,Math.round((data.progress||0)*100)));
      els.progressFill.style.width=`${pct}%`; els.progressText.textContent=`${pct}% · ${data.phase==='extract'?'正在从 ZIP 提取工作簿':'正在流式读取工作表'}`;
      if(data.detail) els.currentFile.textContent=data.detail;
    }
    if(data.type==='complete'){
      orders=data.orders||[]; sheets=data.sheets||[]; duplicateCount=data.duplicates||0; classified=classifyOrders(orders); importDuration=(performance.now()-importStartedAt)/1000;
      els.progressFill.style.width='100%'; els.progressText.textContent='100% · 导入并分类完成'; els.currentFile.textContent='解析完成'; hideError(); setBusy(false); renderResults();
      worker?.terminate(); worker=null;
    }
    if(data.type==='error'){
      setBusy(false); showError(data.message||'未知导入错误'); worker?.terminate(); worker=null;
    }
  };
  worker.onerror=e=>{setBusy(false);showError(e.message||'导入线程异常');worker?.terminate();worker=null};
  worker.postMessage({files});
}

function renderResults(){
  if(!classified)return;
  const imported=sheets.filter(s=>s.status==='imported'), facts=sheets.filter(s=>s.status==='ignored_fact');
  const amount=orders.reduce((a,o)=>a+(Number(o.orderAmount)||0),0), review=classified.orders.filter(o=>o.classificationStatus==='需复核').length;
  const itemQty=classified.lineItems.reduce((a,b)=>a+(Number(b.quantity)||1),0), giftQty=classified.lineItems.filter(x=>x.isFree).reduce((a,b)=>a+(Number(b.quantity)||1),0);
  const rawRows=imported.reduce((a,s)=>a+(Number(s.orderCount)||0),0), uniqueBooks=new Set(sheets.map(s=>s.sourceFile)).size, inflated=sheets.reduce((a,s)=>a+(Number(s.inflatedBytes)||0),0);

  els.metricOrders.textContent=numberFormat.format(orders.length); els.metricAmount.textContent=moneyFormat.format(amount); els.metricSheets.textContent=numberFormat.format(imported.length);
  els.metricFacts.textContent=numberFormat.format(facts.length); els.metricDuplicates.textContent=`${numberFormat.format(duplicateCount)} 个重复订单已去重`; els.metricReview.textContent=numberFormat.format(review); els.metricGift.textContent=numberFormat.format(itemQty);
  els.navReviewCount.textContent=numberFormat.format(review); els.navReviewCount.hidden=review===0; els.quickReviewCount.textContent=numberFormat.format(review);
  els.systemStatus.textContent='就绪'; els.lastImportText.textContent=`上次导入 · ${nowText()}`; document.querySelector('.system-card')?.classList.add('ready'); els.sidebarResetButton.disabled=false;

  renderAccounting(amount); renderProductSummary(giftQty); renderUnknown(); renderSheets(); renderOrders(); renderRecent();
  const countries=[...new Set(classified.orders.map(o=>o.country).filter(Boolean))].sort();
  els.countrySelect.innerHTML='<option value="ALL">全部国家</option>'+countries.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
  const cats=[...new Set(classified.orders.map(o=>o.accountingCategory))];
  els.categorySelect.innerHTML='<option value="ALL">全部会计分类</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');

  const fileLabel=importedFileNames.length===1?importedFileNames[0]:`${importedFileNames.length} 个上传文件`;
  const summaryData=[['文件',fileLabel],['Excel 工作簿',`${uniqueBooks} 个`],['订单 Sheet',`${imported.length} 个`],['FACT 成本 Sheet',`${facts.length} 个`],['原始订单行',`${numberFormat.format(rawRows)} 行`],['重复订单',`${numberFormat.format(duplicateCount)} 个`],['解析数据量',formatBytes(inflated)],['处理耗时',`${importDuration.toFixed(2)} 秒`]];
  els.importSummary.innerHTML=summaryData.map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');

  els.importLanding.hidden=true; els.appViews.hidden=false; els.topActions.hidden=false; hideError(); setView('dashboard');
}

function renderAccounting(totalAmount){
  const rows=classified.orderSummary;
  els.accountingSummary.innerHTML=rows.map(r=>{
    const share=totalAmount>0?(r.amount/totalAmount*100):0;
    return `<div class="summary-row"><strong>${escapeHtml(r.category)}</strong><span>${numberFormat.format(r.orders)}</span><b>${escapeHtml(moneyFormat.format(r.amount))}</b><small>${share.toFixed(1)}%</small><i class="share-track" style="width:${Math.min(100,share)}%"></i></div>`;
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
    const order=orders.find(o=>String(o.orderId)===String(x.orderId))||{};
    const forced=order.manualLineCategories?.[x.lineNo]||'AUTO';
    return `<div class="review-editor" data-order-id="${escapeHtml(x.orderId)}" data-line-no="${x.lineNo||1}">
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
  const orderId=editor.dataset.orderId, lineNo=Number(editor.dataset.lineNo)||1;
  const order=orders.find(o=>String(o.orderId)===String(orderId)); if(!order)return;
  setLineValue(order,'productNames',lineNo,editor.querySelector('.review-name').value);
  setLineValue(order,'skuLines',lineNo,editor.querySelector('.review-sku').value);
  const chosen=editor.querySelector('.review-category').value;
  order.manualLineCategories={...(order.manualLineCategories||{})};
  if(chosen==='AUTO') delete order.manualLineCategories[lineNo]; else order.manualLineCategories[lineNo]=chosen;
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

function buildFactExportData(){
  const factRows=sheets.flatMap(s=>(s.factRows||[]).map(r=>({...r,sourceFile:r.sourceFile||s.sourceFile,sourceSheet:r.sourceSheet||s.sheetName})));
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

function exportAccounting(){
  if(!classified)return;
  const totalAmount=classified.orders.reduce((a,o)=>a+(Number(o.orderAmount)||0),0);
  const reviewOrders=classified.orders.filter(o=>o.classificationStatus==='需复核');
  const reportDate=new Date().toLocaleString('zh-CN',{hour12:false});
  const sourceNames=[...new Set(sheets.map(x=>x.sourceFile).filter(Boolean))];
  const totalItemQty=classified.lineItems.reduce((a,x)=>a+(Number(x.quantity)||1),0);
  const giftQty=classified.lineItems.filter(x=>x.isFree).reduce((a,x)=>a+(Number(x.quantity)||1),0);
  const factData=buildFactExportData();
  const grossProfit=totalAmount-factData.totalAmount;
  const grossMargin=totalAmount?grossProfit/totalAmount:0;
  const sourceLabel=sourceNames.length===1?sourceNames[0]:`${sourceNames.length} 个文件`;

  // 00: only one clear accounting overview table. No FACT/order tables mixed on this sheet.
  const overview=[
    ['WRITE Settlement Manager — 专业会计结算总览','','',''],
    [`生成时间：${reportDate}｜数据源：${sourceLabel}`,'','',''],
    [],
    ['指标','数值','会计口径','状态'],
    ['销售订单总额',totalAmount,'去重后订单金额合计','已核算'],
    ['FACT 成本总额',factData.totalAmount,'FACT 页面 Amount (€) 合计',factData.active?'已解析':'无 FACT 数据'],
    ['估算毛利',grossProfit,'销售订单总额 - FACT 成本总额','估算值'],
    ['估算毛利率',grossMargin,'估算毛利 ÷ 销售订单总额','估算值'],
    ['去重后订单数',classified.orders.length,'最终纳入结算的唯一订单','已核算'],
    ['商品件数',totalItemQty,'所有商品行数量合计','已核算'],
    ['赠品件数',giftQty,'🎁 / 100% off 自动识别','已识别'],
    ['待复核订单',reviewOrders.length,'正式交付前建议归零',reviewOrders.length?'需处理':'通过']
  ];

  // 01: FACT category summary only.
  const factSummaryRows=[['No','Description','Quantity','COGs (€)','Shipping (€)','COGs + Shipping (€)','Amount (€)']];
  let no=1;
  for(const r of factData.summary) factSummaryRows.push([no++,r.description,r.quantity,r.avgCogs,r.avgShipping,r.avgUnit,r.amount]);
  factSummaryRows.push(['','TOTAL / 合计',factData.totalQty,factData.totalQty?factData.cogsTotal/factData.totalQty:0,factData.totalQty?factData.shippingTotal/factData.totalQty:0,factData.totalQty?(factData.cogsTotal+factData.shippingTotal)/factData.totalQty:0,factData.totalAmount]);

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
  const orderRows=[['订单号','日期','客户','国家/地区','订单金额','会计分类','状态','商品件数','含赠品','运单号']];
  for(const o of classified.orders) orderRows.push([o.orderId,o.orderTime||'',o.buyerName||'',o.country||'',Number(o.orderAmount)||0,o.accountingCategory,o.classificationStatus,Number(o.productCount)||0,o.hasGift?'是':'否',o.trackingNo||'']);

  // 05: Product summary.
  const productMap=new Map();
  for(const x of classified.lineItems){
    const key=[x.categoryLabel||'待确认',x.productName||'',x.sku||''].join('\u0001');
    const cur=productMap.get(key)||{category:x.categoryLabel||'待确认',product:x.productName||'',sku:x.sku||'',qty:0,free:0,orders:new Set()};
    const qty=Number(x.quantity)||1; cur.qty+=qty; if(x.isFree)cur.free+=qty; cur.orders.add(x.orderId); productMap.set(key,cur);
  }
  const productRows=[['商品分类','产品名称','SKU','总件数','付费件数','赠品件数','涉及订单数']];
  [...productMap.values()].sort((a,b)=>b.qty-a.qty||a.category.localeCompare(b.category)).forEach(x=>productRows.push([x.category,x.product,x.sku,x.qty,Math.max(0,x.qty-x.free),x.free,x.orders.size]));

  // 06: Review only.
  const byId=new Map(classified.orders.map(o=>[o.orderId,o]));
  const reviewRows=[['订单号','订单金额','客户','国家/地区','待确认产品','SKU','建议处理']];
  for(const x of classified.unknown){const o=byId.get(x.orderId)||{};reviewRows.push([x.orderId,Number(o.orderAmount)||0,o.buyerName||'',o.country||x.country||'',x.productName||'',x.sku||'','请在 WebApp「待复核」页修改并保存']);}
  if(reviewRows.length===1)reviewRows.push(['—',0,'','','无待复核商品','','全部已完成分类']);

  const auditRows=[['订单号','订单金额','会计分类','分类状态','人工修正','来源文件','来源 Sheet','源行号','店铺账号','付款时间','发货时间']];
  for(const o of classified.orders) auditRows.push([o.orderId,Number(o.orderAmount)||0,o.accountingCategory,o.classificationStatus,Object.keys(o.manualLineCategories||{}).length?'是':'否',o.sourceFile||'',o.sourceSheet||'',o.sourceRow||'',o.storeAccount||'',o.paidTime||'',o.shippedTime||'']);
  const logRows=[['来源文件','Sheet','处理状态','订单行数','处理说明','解压读取字节']];
  for(const x of sheets)logRows.push([x.sourceFile,x.sheetName,x.status,x.orderCount,x.reason,x.inflatedBytes||0]);

  const blob=buildXlsx([
    {name:'00_结算总览',rows:overview,widths:[26,20,38,20],titleRow:1,subtitleRow:2,headerRows:[4],freezeRow:4,freezeCol:1,merges:['A1:D1','A2:D2'],formatRules:[
      {r1:5,r2:7,c1:2,c2:2,kind:'currency'},{r1:8,r2:8,c1:2,c2:2,kind:'percent'},{r1:9,r2:12,c1:2,c2:2,kind:'int'}
    ]},
    {name:'01_FACT分类汇总',rows:factSummaryRows,widths:[10,52,14,16,18,22,20],headerRows:[1],totalRows:[factSummaryRows.length],freezeRow:1,freezeCol:2,autoFilterRow:1,integerColumns:[1,3],currencyColumns:[4,5,6,7],bandedRows:true},
    {name:'02_订单会计分类',rows:orderCategoryRows,widths:[26,14,18,16,14],headerRows:[1],totalRows:[orderCategoryRows.length],freezeRow:1,freezeCol:1,autoFilterRow:1,integerColumns:[2,5],currencyColumns:[3],percentColumns:[4],bandedRows:true},
    {name:'03_FACT国家明细',rows:factDetailRows,widths:[20,10,52,14,16,18,22,20],headerRows:[1],freezeRow:1,freezeCol:3,autoFilterRow:1,integerColumns:[2,4],currencyColumns:[5,6,7,8],bandedRows:true},
    {name:'04_订单明细',rows:orderRows,widths:[22,22,28,18,17,22,14,13,12,28],headerRows:[1],freezeRow:1,freezeCol:2,autoFilterRow:1,currencyColumns:[5],integerColumns:[8],bandedRows:true},
    {name:'05_商品汇总',rows:productRows,widths:[18,60,36,14,14,14,16],headerRows:[1],freezeRow:1,freezeCol:1,autoFilterRow:1,integerColumns:[4,5,6,7],bandedRows:true},
    {name:'06_待复核',rows:reviewRows,widths:[22,17,28,18,58,36,42],headerRows:[1],freezeRow:1,freezeCol:2,autoFilterRow:1,currencyColumns:[2],reviewMode:true,bandedRows:true},
    {name:'90_订单审计',rows:auditRows,widths:[22,17,22,14,14,54,24,12,28,22,22],headerRows:[1],freezeRow:1,freezeCol:1,autoFilterRow:1,currencyColumns:[2],integerColumns:[8],bandedRows:true},
    {name:'99_导入日志',rows:logRows,widths:[56,26,20,14,56,20],headerRows:[1],freezeRow:1,autoFilterRow:1,integerColumns:[4,6],bandedRows:true}
  ]);
  downloadBlob(blob,`WRITE_会计结算_${new Date().toISOString().slice(0,10)}.xlsx`);
}
function reimportFlow(){
  if(!classified){els.fileInput.click();return}
  openConfirm({title:'重新导入数据？',text:'当前统计结果会被清空，然后打开文件选择器重新导入。原始文件不会被修改。',confirmText:'清空并重新导入',action:()=>{resetState(); setTimeout(()=>els.fileInput.click(),80)}});
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
document.getElementById('sideNav').addEventListener('click',e=>{const btn=e.target.closest('[data-view]');if(btn&&classified)setView(btn.dataset.view)});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-go-view]');if(btn&&classified)setView(btn.dataset.goView)});
document.addEventListener('click',e=>{const btn=e.target.closest('.review-save');if(btn){const editor=btn.closest('.review-editor');if(editor)saveReviewRow(editor)}});

resetState();
window.__WRITE_APP_READY__=true;
document.documentElement.dataset.writeReady='true';

