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
function downloadBlob(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}


// v6.5.11 FACT template preservation + backfill engine.
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
  const rels=new Map();let m;
  const rr=/<Relationship\b([^>]*)\/?\s*>/g;
  while((m=rr.exec(relsXml))){const id=/\bId="([^"]+)"/.exec(m[1])?.[1],target=/\bTarget="([^"]+)"/.exec(m[1])?.[1];if(id&&target)rels.set(id,normalizeTargetLocal(target))}
  const sr=/<sheet\b([^>]*)\/?\s*>/g;
  while((m=sr.exec(workbookXml))){const name=xmlDecodeLocal(/\bname="([^"]+)"/.exec(m[1])?.[1]||''),rid=/\br:id="([^"]+)"/.exec(m[1])?.[1];if(name.trim().toUpperCase()==='FACT'&&rels.get(rid))return rels.get(rid)}
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
  const d=norm(desc).toLowerCase();
  const pencil=/stylo\s*eternel\s*x\s*(\d+)/i.exec(d);
  if(pencil)return {type:'pencil',bucket:Number(pencil[1])};
  if(/lot de 4 mines rechargeables/.test(d))return {type:'refill'};
  if(/lot de 6 mines color/.test(d))return {type:'color6'};
  if(/mines color/.test(d))return {type:'colorSingle'};
  if(/gravure personnalis/.test(d))return {type:'engraving'};
  if(/coffret cadeau/.test(d))return {type:'giftBox'};
  return {type:'unknown'};
}
function sourceDataForWorkbook(workbookName){
  const wbOrders=(classified?.orders||[]).filter(o=>o.sourceFile===workbookName);
  const wbLines=(classified?.lineItems||[]).filter(x=>x.sourceFile===workbookName);
  const orderById=new Map(wbOrders.map(o=>[String(o.orderId),o]));
  const pencilQtyByOrder=new Map();
  for(const x of wbLines){if(x.category==='PENCIL')pencilQtyByOrder.set(String(x.orderId),(pencilQtyByOrder.get(String(x.orderId))||0)+(Number(x.quantity)||1))}
  const pencilBucket=new Map(),refill=new Map(),color6=new Map(),colorSingle=new Map();
  const add=(map,country,n)=>map.set(country,(map.get(country)||0)+n);
  for(const o of wbOrders){
    const country=normalizeCountry(o.country),qty=Math.round(pencilQtyByOrder.get(String(o.orderId))||0);
    if(qty>0){const k=`${country}\u0001${qty}`;pencilBucket.set(k,(pencilBucket.get(k)||0)+1)}
  }
  let engraving=0,boxWithPencil=0,boxWithoutPencil=0;
  for(const x of wbLines){
    const q=Number(x.quantity)||1,country=normalizeCountry(x.country);
    if(x.category==='REFILL')add(refill,country,q);
    else if(x.category==='COLOR_REFILL')add(isColorPack6(x)?color6:colorSingle,country,q);
    else if(x.category==='ENGRAVING')engraving+=q;
    else if(x.category==='GIFT_BOX'){
      if((pencilQtyByOrder.get(String(x.orderId))||0)>0)boxWithPencil+=q;else boxWithoutPencil+=q;
    }
  }
  return {wbOrders,wbLines,orderById,pencilBucket,refill,color6,colorSingle,engraving,boxWithPencil,boxWithoutPencil};
}
function buildFactBackfillPlan(workbookName,factRows){
  const src=sourceDataForWorkbook(workbookName), plan=new Map(), boxRows=factRows.filter(r=>factDescriptionType(r.description).type==='giftBox').sort((a,b)=>a.sourceRow-b.sourceRow);
  let firstBoxRow=boxRows[0]?.sourceRow, secondBoxRow=boxRows[1]?.sourceRow;
  let total=0;
  for(const r of factRows){
    const kind=factDescriptionType(r.description), country=normalizeCountry(r.country), unit=Number.isFinite(Number(r.unitTotal))?Number(r.unitTotal):((Number(r.cogs)||0)+(Number(r.shipping)||0));
    let quantity=0;
    if(kind.type==='pencil')quantity=src.pencilBucket.get(`${country}\u0001${kind.bucket}`)||0;
    else if(kind.type==='refill')quantity=src.refill.get(country)||0;
    else if(kind.type==='color6')quantity=src.color6.get(country)||0;
    else if(kind.type==='colorSingle')quantity=src.colorSingle.get(country)||0;
    else if(kind.type==='engraving')quantity=src.engraving;
    else if(kind.type==='giftBox'){
      if(r.sourceRow===firstBoxRow)quantity=src.boxWithPencil;
      else if(r.sourceRow===secondBoxRow)quantity=src.boxWithoutPencil;
      else quantity=0;
    }
    quantity=Math.max(0,Math.round(quantity));
    const amount=Math.round((quantity*unit+Number.EPSILON)*100)/100;
    plan.set(Number(r.sourceRow),{quantity,amount});
    total+=amount;
  }
  return {plan,total:Math.round((total+Number.EPSILON)*100)/100};
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
    // V6.5.11: FACT templates sometimes store decimal-looking COGs/Shipping cells as shared strings.
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
const durationFormat = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const percentDisplayFormat = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
let worker=null, orders=[], sheets=[], classified=null, busy=false, duplicateCount=0, importStartedAt=0, importDuration=0, importedFileNames=[], sourceWorkbooks=[];
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
  worker?.terminate(); worker=null; orders=[]; sheets=[]; classified=null; busy=false; duplicateCount=0; importDuration=0; importedFileNames=[]; sourceWorkbooks=[];
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
  worker?.terminate(); worker=new Worker('./src/workers/import.worker.bundle.js?v=6.5.8'); importStartedAt=performance.now(); importedFileNames=files.map(f=>f.name);
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
      orders=data.orders||[]; sheets=data.sheets||[]; sourceWorkbooks=data.workbooks||[]; duplicateCount=data.duplicates||0; classified=classifyOrders(orders); importDuration=(performance.now()-importStartedAt)/1000;
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
  const summaryData=[['文件',fileLabel],['Excel 工作簿',`${uniqueBooks} 个`],['订单 Sheet',`${imported.length} 个`],['FACT 成本 Sheet',`${facts.length} 个`],['原始订单行',`${numberFormat.format(rawRows)} 行`],['重复订单',`${numberFormat.format(duplicateCount)} 个`],['解析数据量',formatBytes(inflated)],['处理耗时',`${durationFormat.format(importDuration)} 秒`]];
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
  return {blob,fileName:`WRITE_会计结算_${currentOrderRangeLabel()}_${localDateStamp()}.xlsx`};
}

async function exportAccounting(){
  if(!classified)return;
  const report=buildAccountingReport();
  const factBooks=sourceWorkbooks.filter(w=>sheets.some(s=>s.sourceFile===w.name&&s.status==='ignored_fact'));
  if(!factBooks.length){downloadBlob(report.blob,report.fileName);return;}
  try{
    const updated=[];
    for(const wb of factBooks){
      const patched=await rebuildFactWorkbook(wb.blob,wb.name);
      updated.push({name:`FACT_已回填_${currentOrderRangeLabel()}_${basename(wb.name)}`,data:patched});
    }
    const packageBlob=await zipStoreBlobs([{name:report.fileName,data:report.blob},...updated]);
    downloadBlob(packageBlob,`WRITE_结算交付包_${currentOrderRangeLabel()}_${localDateStamp()}.zip`);
  }catch(err){
    console.error(err);
    showError(`FACT 回填导出失败：${err?.message||err}`);
  }
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
document.getElementById('sideNav').addEventListener('click',e=>{const btn=e.target.closest('[data-view]');if(!btn)return;const view=btn.dataset.view;if(view==='history'){els.importLanding.hidden=true;els.appViews.hidden=false;setView('history');return}if(classified){setView(view);return}if(view==='dashboard'){els.appViews.hidden=true;els.importLanding.hidden=false;document.querySelectorAll('.nav-item[data-view]').forEach(item=>item.classList.toggle('active',item.dataset.view==='dashboard'))}});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-go-view]');if(btn&&classified)setView(btn.dataset.goView)});
document.addEventListener('click',e=>{const btn=e.target.closest('.review-save');if(btn){const editor=btn.closest('.review-editor');if(editor)saveReviewRow(editor)}});


// v6.5.11 theme controller: auto / light / dark
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


// v6.5.11 release notes controller — show once per release per browser
const WRITE_RELEASE = {
  version: document.body.dataset.release || '6.5.8',
  date: '2026-08-09 00:14',
  title: 'WRITE Settlement Manager v6.5.11',
  sections: [
    {label:'修复', items:[
      '修复 FACT / Commercial Invoice 中部分小数实际为文本、导致 Excel 公式无法计算的问题。',
      '回填时 COGs、Shipping 等运算字段统一写为真正的数值单元格，同时保持法国/欧洲小数逗号显示。'
    ]},
    {label:'优化', items:[
      '导出交付包、会计报表和回填 FACT 文件名自动标注本批订单号范围。'
    ]}
  ]
};
function showReleaseNotesIfNeeded(){
  const version=WRITE_RELEASE.version;
  const key='write-release-seen';
  let seen='';
  try{seen=localStorage.getItem(key)||''}catch(e){}
  if(seen===version)return;
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
    try{localStorage.setItem(key,version)}catch(e){}
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



// v6.5.11 — built-in version history (mirrors GitHub CHANGELOG)
const WRITE_HISTORY = [
  {version:'6.5.8',time:'2026-08-09 00:14',title:'发票数值类型与订单范围',items:['修复 FACT / Commercial Invoice 中部分小数被保存为文本导致 Excel 计算失败的问题。','COGs、Shipping 等运算字段回填为真正数值，显示继续采用法国/欧洲小数逗号。','导出 ZIP、会计报表与回填 FACT 文件名自动包含订单号范围。']},
  {version:'6.5.7',time:'2026-08-09 00:10',title:'历史更新中心',items:['左侧菜单新增「历史更新」，无需导入订单即可查看。','按时间倒序展示所有可追溯正式版本的更新时间与更新摘要。','从本版本开始，发布时间固定精确记录到分钟，并与 GitHub CHANGELOG 同步。']},
  {version:'6.5.6',time:'2026-08-09 00:05',title:'欧洲数字格式统一',items:['所有用户可见小数统一使用逗号作为小数分隔符。','WebApp、会计 Excel 与金额/百分比显示统一采用法国/欧洲数字格式。']},
  {version:'6.5.5',time:'2026-08-08 23:32',title:'FACT 原格式回填',items:['无论 FACT 原有统计是否为空，导出前均清空旧统计并按 WebApp 当前分析重新计算。','只修改 FACT 统计值，保留原工作表样式、列宽、行高、边框、合并单元格和工作簿其他内容。','导出升级为专业会计报表 + 已回填 FACT 的结算交付包。']},
  {version:'6.5.4',time:'2026-08-08 · 时间未记录',title:'版本发布机制',items:['每个新版本首次打开自动显示更新日志；阅读后同浏览器不重复弹出。','新增 CHANGELOG.md，并要求 README、版本号与部署脚本同步更新。']},
  {version:'6.5.2',time:'2026-08-08 22:37',title:'三态主题',items:['新增自动 / 浅色 / 深色三态主题切换。','自动模式实时跟随 macOS、iPadOS、iOS 系统主题；手动选择写入本地记忆。']},
  {version:'6.5.1',time:'2026-08-08 21:45',title:'品牌与文案修正',items:['左上角使用选定的 Version C 简笔熊猫头像。','顶部品牌署名改为 Designed by NEOVORA，并精简英雄页说明。']},
  {version:'6.5',time:'2026-08-08 21:32',title:'英雄页重构',items:['英雄页移除熊猫照片/熊猫头，改为黑白灰会计报表抽象视觉。','继续沿用克制的灰阶工作台设计语言。']},
  {version:'6.1',time:'2026-08-08 21:20',title:'灰阶工作台视觉',items:['界面重构为严格黑 / 白 / 灰视觉体系。','导航、卡片、按钮、徽标和弹窗移除彩色强调色。']},
  {version:'6.0',time:'2026-08-08 · 时间未记录',title:'全设备响应式',items:['适配桌面、iPad 横竖屏与 iPhone Safari。','修复 KPI、金额、文件名、商品名及表格文本溢出，移动端表格支持触控横向滚动。']},
  {version:'5.3.3',time:'2026-08-08 · 时间未记录',title:'专业会计工作簿',items:['导出结构改为一个 Sheet 只承担一个用途。','统一居中、列宽、冻结表头、筛选与金额格式，减少文字遮挡。']},
  {version:'5.3.2',time:'2026-08-08 · 时间未记录',title:'前端启动稳定化',items:['移除脆弱的 ES Module 启动依赖，主程序与 Worker 改为稳定 bundle。']},
  {version:'5.3.1',time:'2026-08-08 · 时间未记录',title:'全按钮失效 Hotfix',items:['修复 JavaScript 解析错误导致整个 UI 事件层未启动的问题。']},
  {version:'5.3.0',time:'2026-08-08 · 时间未记录',title:'待复核可编辑',items:['待复核订单可直接修改商品名、SKU 和分类并保存后重新统计。','重写清空数据确认流程，并重构结算摘要。']},
  {version:'5.2.2',time:'2026-08-08 · 时间未记录',title:'页面层重建',items:['恢复正确英雄页结构，修复弹窗锁死、熊猫资源丢失和旧 UI 混用问题。','引入资源版本指纹与更可靠的页面启动机制。']},
  {version:'5.2.1',time:'2026-08-08 · 时间未记录',title:'弹窗 Hotfix',items:['修复 CSS 覆盖 hidden 状态导致清空确认弹窗始终显示的问题。']},
  {version:'5.2',time:'2026-08-08 · 时间未记录',title:'FACT 风格分类汇总',items:['新增 Quantity、COGs、Shipping、COGs + Shipping、Amount 的 FACT 风格汇总。','增加国家级 FACT 明细结构。']},
  {version:'5.1',time:'2026-08-08 · 时间未记录',title:'FACT 解析修复',items:['修复带样式空单元格导致的 FACT 列错位。','在不把 FACT 当订单的前提下可靠读取成本结构。']},
  {version:'5.0',time:'2026-08-08 · 时间未记录',title:'首次正式英雄页',items:['加入明显的英雄页导出操作，并进行首次大规模 UI 重构。','会计导出拆分为摘要、明细、复核、审计和导入日志层。']},
  {version:'4.1',time:'2026-08-08 · 时间未记录',title:'首个可追溯正式版本',items:['建立真实 WRITE 订单工作簿的稳定本地浏览器导入流程。','加入 GitHub 发布与 Cloudflare Pages 部署脚本。']}
];
function renderReleaseHistory(){
  const host=document.getElementById('releaseHistory');
  if(!host)return;
  document.getElementById('historyCount').textContent=`${WRITE_HISTORY.length} 个版本`;
  host.innerHTML=WRITE_HISTORY.map((entry,index)=>`<article class="history-item ${index===0?'current':''}"><div class="history-meta"><span class="history-version">v${escapeHtml(entry.version)}</span><time class="history-time">${escapeHtml(entry.time)}</time></div><div class="history-body"><h3>${escapeHtml(entry.title)}</h3><ul>${entry.items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></div></article>`).join('');
}
renderReleaseHistory();
