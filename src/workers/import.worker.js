/* WRITE Import Worker v7.2.0 build 20260809-1825 */
/* WRITE Settlement Manager v5.3.3 - standalone import worker */
const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

const utf8 = new TextDecoder('utf-8');

function findSignatureBackwards(bytes, signature) {
  for (let i = bytes.length - 4; i >= 0; i--) {
    if (bytes[i] === (signature & 0xff) &&
        bytes[i + 1] === ((signature >>> 8) & 0xff) &&
        bytes[i + 2] === ((signature >>> 16) & 0xff) &&
        bytes[i + 3] === ((signature >>> 24) & 0xff)) return i;
  }
  return -1;
}

function decodeFilename(bytes, flags) {
  // WRITE files use UTF-8 for relevant names. The fallback still keeps ASCII XLSX paths intact.
  return utf8.decode(bytes);
}

class ZipArchive {
  constructor(blob, entries) {
    this.blob = blob;
    this.entries = entries;
    this.byName = new Map(entries.map((entry) => [entry.name, entry]));
  }

  static async open(blob) {
    if (!(blob instanceof Blob)) throw new Error('ZIP source must be a Blob/File');
    const tailSize = Math.min(blob.size, 65557);
    const tailOffset = blob.size - tailSize;
    const tail = new Uint8Array(await blob.slice(tailOffset).arrayBuffer());
    const eocdPos = findSignatureBackwards(tail, EOCD_SIG);
    if (eocdPos < 0) throw new Error('不是有效的 ZIP/XLSX：找不到中央目录');
    const eocd = new DataView(tail.buffer, tail.byteOffset + eocdPos);
    const entriesTotal = eocd.getUint16(10, true);
    const centralSize = eocd.getUint32(12, true);
    const centralOffset = eocd.getUint32(16, true);
    if (entriesTotal === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
      throw new Error('暂不支持 ZIP64 文件');
    }

    const central = new Uint8Array(await blob.slice(centralOffset, centralOffset + centralSize).arrayBuffer());
    const view = new DataView(central.buffer, central.byteOffset, central.byteLength);
    const entries = [];
    let pos = 0;
    while (pos + 46 <= central.length && entries.length < entriesTotal) {
      if (view.getUint32(pos, true) !== CEN_SIG) break;
      const flags = view.getUint16(pos + 8, true);
      const method = view.getUint16(pos + 10, true);
      const compressedSize = view.getUint32(pos + 20, true);
      const uncompressedSize = view.getUint32(pos + 24, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localOffset = view.getUint32(pos + 42, true);
      const name = decodeFilename(central.slice(pos + 46, pos + 46 + nameLen), flags).replace(/^\//, '');
      entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    if (!entries.length) throw new Error('ZIP 中没有可读取的条目');
    return new ZipArchive(blob, entries);
  }

  get(name) {
    return this.byName.get(String(name).replace(/^\//, ''));
  }

  list(predicate = null) {
    return predicate ? this.entries.filter(predicate) : [...this.entries];
  }

  async dataRange(entry) {
    const header = new DataView(await this.blob.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
    if (header.getUint32(0, true) !== LOC_SIG) throw new Error(`ZIP 条目损坏：${entry.name}`);
    const nameLen = header.getUint16(26, true);
    const extraLen = header.getUint16(28, true);
    const start = entry.localOffset + 30 + nameLen + extraLen;
    return { start, end: start + entry.compressedSize };
  }

  async stream(entryOrName) {
    const entry = typeof entryOrName === 'string' ? this.get(entryOrName) : entryOrName;
    if (!entry) throw new Error(`ZIP 中找不到：${entryOrName}`);
    const { start, end } = await this.dataRange(entry);
    const source = this.blob.slice(start, end).stream();
    if (entry.method === 0) return source;
    if (entry.method === 8) {
      try {
        return source.pipeThrough(new DecompressionStream('deflate-raw'));
      } catch (err) {
        throw new Error('当前浏览器不支持 ZIP Deflate 流式解压，请升级 Chrome / Edge / Safari。');
      }
    }
    throw new Error(`不支持 ZIP 压缩方法 ${entry.method}：${entry.name}`);
  }

  async bytes(entryOrName, maxBytes = 32 * 1024 * 1024) {
    const entry = typeof entryOrName === 'string' ? this.get(entryOrName) : entryOrName;
    if (!entry) return new Uint8Array();
    if (entry.uncompressedSize > maxBytes) throw new Error(`条目过大，禁止整块载入：${entry.name}`);
    const stream = await this.stream(entry);
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(`条目过大，禁止整块载入：${entry.name}`);
      chunks.push(value);
    }
    const merged = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
    return merged;
  }

  async text(entryOrName, maxBytes = 32 * 1024 * 1024) {
    return utf8.decode(await this.bytes(entryOrName, maxBytes));
  }

  async toBlob(entryOrName, onProgress = null) {
    const entry = typeof entryOrName === 'string' ? this.get(entryOrName) : entryOrName;
    if (!entry) throw new Error(`ZIP 中找不到：${entryOrName}`);
    const stream = await this.stream(entry);
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      onProgress?.(size, entry.uncompressedSize || size);
    }
    return new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}




const FIELD_ALIASES = {
  orderId:['订单号','订单编号','订单id','order id','order','order number','order no','order #','commande','n° commande','numero commande','numéro commande','id commande','bestellnummer','pedido','numero pedido'],
  orderAmount:['订单金额','订单总额','实付金额','金额','总金额','amount','total','order total','paid amount','total price','gross total','montant','montant total','total commande','prix total','umsatz','importe total'],
  currency:['币种','货币','currency','devise','currency code','money'],
  productCount:['产品总数','商品总数','商品数量','件数','数量','qty','quantity','quantité','quantite','items','item count','units','unités'],
  skuLines:['多品名','sku','skus','variant sku','variant','reference','référence','reference produit','product sku','item sku','merchant sku'],
  productNames:['产品名称','商品名称','商品','品名','货品名称','product name','product','products','item','item name','title','produit','nom produit','article','designation','désignation'],
  country:['收货人国家','国家','目的国家','country','shipping country','destination country','delivery country','pays','pays livraison','pays de livraison','land'],
  buyerName:['买家姓名','客户姓名','收件人','buyer','buyer name','customer','customer name','client','nom client','recipient','recipient name','shipping name'],
  trackingNo:['运单号','物流单号','追踪号','tracking','tracking no','tracking number','tracking code','numéro suivi','numero suivi','parcel number'],
  orderNote:['订单备注','order note','note commande','note'],
  pickingNote:['拣货备注','picking note','warehouse note'],
  customerServiceNote:['客服备注','customer service note','cs note'],
  address:['地址1+地址2','地址','收货地址','address','shipping address','delivery address','adresse','adresse livraison'],
  orderTime:['下单时间','订单时间','order time','created at','created','date commande','order date'],
  paidTime:['付款时间','支付时间','paid time','paid at','date paiement','payment date'],
  storeAccount:['店铺账号','店铺','store','store account','shop','boutique','sales channel'],
  shippedTime:['发货时间','shipped time','shipped at','date expédition','date expedition','shipping date']
};
const CORE_FIELDS=['orderId','orderAmount','productNames','country'];
const OPTIONAL_FIELDS=['productCount','skuLines','buyerName','trackingNo','currency','address','orderTime','paidTime','storeAccount','shippedTime'];
let LEARNED_SCHEMAS=[];

const normalizeHeaderText=(v='')=>String(v??'').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\p{L}\p{N}#]+/gu,' ')
  .replace(/[–—_-]+/g,' ')
  .replace(/\s+/g,' ').trim();
const ALIAS_TO_KEY=new Map();
for(const [key,aliases] of Object.entries(FIELD_ALIASES)){
  for(const a of aliases)ALIAS_TO_KEY.set(normalizeHeaderText(a),key);
}
function keyForHeader(v=''){
  const n=normalizeHeaderText(v);
  if(ALIAS_TO_KEY.has(n))return ALIAS_TO_KEY.get(n);
  if(/\bsku\b|variant sku|reference produit|product reference|item reference/.test(n))return 'skuLines';
  if(/tracking|suivi|parcel/.test(n))return 'trackingNo';
  if(/currency|devise|币种|货币/.test(n))return 'currency';
  if(/order.*(id|number|no)|commande.*(id|numero)|订单.*(号|编号)/.test(n))return 'orderId';
  if(/(order|commande).*(amount|total|montant)|订单.*(金额|总额)|total.*price/.test(n))return 'orderAmount';
  if(/(product|item|produit|article).*(name|title|nom)|产品.*名称|商品.*名称|品名/.test(n))return 'productNames';
  if(/shipping.*country|delivery.*country|pays.*livraison|收货.*国家|目的.*国家/.test(n))return 'country';
  return null;
}
function scoreOrderHeader(row=[]){
  const keys=row.map(keyForHeader).filter(Boolean);
  return new Set(keys).size;
}
function isOrderHeader(row=[]){
  const keys=new Set(row.map(keyForHeader).filter(Boolean));
  return CORE_FIELDS.every(k=>keys.has(k)) && keys.size>=5;
}
function schemaFingerprint(headers=[]){
  return headers.map(normalizeHeaderText).join('|');
}
function median(nums=[]){
  const a=nums.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return 0;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function ratio(arr,fn){
  const a=arr.filter(v=>String(v??'').trim()!=='');
  if(!a.length)return 0;
  return a.filter(fn).length/a.length;
}
const COUNTRY_WORDS=new Set(['france','belgium','belgique','switzerland','suisse','germany','allemagne','italy','italie','spain','espagne','portugal','netherlands','pays bas','luxembourg','austria','autriche','ireland','irlande','united kingdom','uk','canada','usa','united states','reunion island','réunion island','reunion','monaco','denmark','sweden','norway','finland','poland','romania','greece','croatia','czech republic']);
function contentScores(values=[]){
  const vals=values.map(v=>String(v??'').trim()).filter(Boolean);
  const nums=vals.map(v=>normalizeNumber(v));
  const numeric=ratio(vals,v=>Number.isFinite(normalizeNumber(v)));
  const integers=ratio(vals,v=>{const n=normalizeNumber(v);return Number.isFinite(n)&&Math.abs(n-Math.round(n))<1e-9});
  const lens=vals.map(v=>v.length);
  const medLen=median(lens);
  const lineBreak=ratio(vals,v=>/\n/.test(v));
  const skuish=ratio(vals,v=>/(?:^|\n|;|\s)\w{4,}[^\n]*\*\s*\d+/.test(v)||/^\d{8,}$/.test(v));
  const orderish=ratio(vals,v=>/^[A-Z0-9]{2,}[-_][A-Z0-9-]{2,}$/i.test(v)||/^\d{6,}$/.test(v));
  const trackingish=ratio(vals,v=>/^[A-Z]{1,4}\d{8,}[A-Z]{0,3}$/i.test(v)||/^\d[A-Z0-9]{10,}$/.test(v));
  const countryish=ratio(vals,v=>{
    const n=normalizeHeaderText(v);
    return COUNTRY_WORDS.has(n)||(/^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ .'-]{2,24}$/.test(v)&&v.length<28);
  });
  const nameish=ratio(vals,v=>/^[\p{L} .'-]{3,50}$/u.test(v)&&v.split(/\s+/).length<=7);
  const textish=1-numeric;
  const numericVals=nums.filter(Number.isFinite);
  const medNum=median(numericVals);
  const unique=vals.length?new Set(vals).size/vals.length:0;
  return {
    orderId:Math.min(1,orderish*.72+unique*.18+(numeric<.3?.10:0)),
    orderAmount:Math.min(1,numeric*.65+(medNum>2?.15:0)+(integers<.85?.12:0)+(unique>.3?.08:0)),
    productCount:Math.min(1,numeric*.45+integers*.35+(medNum>0&&medNum<=30?.20:0)),
    skuLines:Math.min(1,skuish*.78+lineBreak*.12+(medLen>6?.10:0)),
    productNames:Math.min(1,textish*.35+(medLen>12?.27:0)+lineBreak*.18+unique*.20),
    country:Math.min(1,countryish*.80+(unique<.35?.12:0)+(medLen<25?.08:0)),
    buyerName:Math.min(1,nameish*.64+textish*.16+(medLen>=4&&medLen<=40?.12:0)+unique*.08),
    trackingNo:Math.min(1,trackingish*.85+unique*.15)
  };
}
function headerDataLikeRatio(headers=[]){
  const vals=headers.map(v=>String(v??'').trim()).filter(Boolean);
  if(!vals.length)return 1;
  const like=vals.filter(v=>{
    const nv=normalizeNumber(v);
    const n=normalizeHeaderText(v);
    return Number.isFinite(nv)
      || /^[A-Z0-9]{2,}[-_][A-Z0-9-]{2,}$/i.test(v)
      || /(?:^|\s)\w{4,}[^\n]*\*\s*\d+/.test(v)
      || /^[A-Z]{1,4}\d{8,}[A-Z]{0,3}$/i.test(v)
      || COUNTRY_WORDS.has(n);
  }).length;
  return like/vals.length;
}
function learnedMappingFor(headers=[]){
  const fp=schemaFingerprint(headers);
  for(const raw of LEARNED_SCHEMAS||[]){
    const r=raw?.payload?raw.payload:raw;
    const ruleFp=String(raw?.fingerprint||raw?.lookupKey||r?.fingerprint||'');
    if(ruleFp===fp && r?.mapping)return {mapping:r.mapping,confidence:1,mode:'learned'};
  }
  const normalized=headers.map(normalizeHeaderText);
  for(const raw of LEARNED_SCHEMAS||[]){
    const r=raw?.payload?raw.payload:raw;
    const by=r?.mappingByHeader||{};
    const overlap=normalized.filter(x=>by[x]).length;
    if(overlap>=4){
      const mapping={};
      normalized.forEach((h,i)=>{if(by[h])mapping[i]=by[h]});
      if(CORE_FIELDS.every(k=>Object.values(mapping).includes(k)))return {mapping,confidence:.98,mode:'learned'};
    }
  }
  return null;
}
function inferSchema(rows=[]){
  let best=null;
  const maxHeader=Math.min(rows.length,50);
  for(let hi=0;hi<maxHeader;hi++){
    const header=rows[hi].values.map(v=>String(v??'').trim());
    const nonempty=header.filter(Boolean).length;
    if(nonempty<3)continue;
    const learned=learnedMappingFor(header);
    if(learned){
      const candidate={headerIndex:hi,headerRow:rows[hi].rowNum,headers:header,normalizedHeaders:header.map(normalizeHeaderText),fingerprint:schemaFingerprint(header),...learned};
      if(!best||candidate.confidence>best.confidence)best=candidate;
      continue;
    }
    const samples=rows.slice(hi+1,Math.min(rows.length,hi+26));
    if(samples.length<2)continue;
    const mapping={},fieldConfidence={},used=new Set();
    header.forEach((h,col)=>{
      const key=keyForHeader(h);
      if(key&&!used.has(col)){
        mapping[col]=key;fieldConfidence[key]=1;used.add(col);
      }
    });
    const scoresByCol=header.map((_,col)=>contentScores(samples.map(r=>r.values[col])));
    const wanted=['orderId','orderAmount','country','skuLines','trackingNo','productCount','productNames','buyerName','currency','address','orderTime','paidTime','storeAccount','shippedTime'];
    for(const key of wanted){
      if(Object.values(mapping).includes(key))continue;
      let bestCol=-1,bestScore=0;
      scoresByCol.forEach((scores,col)=>{
        if(used.has(col))return;
        const score=Number(scores[key]||0);
        if(score>bestScore){bestScore=score;bestCol=col}
      });
      const threshold=key==='orderId'?.70:key==='orderAmount'?.66:key==='productNames'?.64:key==='country'?.62:.72;
      if(bestCol>=0&&bestScore>=threshold){
        mapping[bestCol]=key;fieldConfidence[key]=bestScore;used.add(bestCol);
      }
    }
    const values=Object.values(mapping);
    const required=CORE_FIELDS.map(k=>fieldConfidence[k]||0);
    const direct=header.map(keyForHeader).filter(Boolean).length;
    const complete=CORE_FIELDS.every(k=>values.includes(k));
    const coreAvg=required.reduce((a,b)=>a+b,0)/CORE_FIELDS.length;
    let confidence=coreAvg+(Math.min(6,direct)/6)*.08;
    const headerData=headerDataLikeRatio(header);
    confidence-=headerData*.45;
    if(headerData>.45)confidence-=.20;
    if(!complete)confidence-=.24;
    if(!values.includes('productCount'))confidence-=.015;
    confidence=Math.max(0,Math.min(1,confidence));
    const candidate={
      headerIndex:hi,headerRow:rows[hi].rowNum,headers:header,normalizedHeaders:header.map(normalizeHeaderText),
      fingerprint:schemaFingerprint(header),mapping,fieldConfidence,confidence,
      mode:confidence>=.92&&complete?'auto':confidence>=.60?'review':'reject'
    };
    if(!best||candidate.confidence>best.confidence)best=candidate;
  }
  return best;
}
function deriveCount(order){
  const explicit=normalizeNumber(order.productCount);
  if(Number.isFinite(explicit)&&explicit>0)return explicit;
  const sku=String(order.skuLines||'').trim();
  if(sku){
    const qty=[...sku.matchAll(/\*\s*(\d+(?:[.,]\d+)?)/g)].map(m=>Number(String(m[1]).replace(',','.'))).filter(Number.isFinite);
    if(qty.length)return qty.reduce((a,b)=>a+b,0);
    const lines=sku.split(/\n+/).filter(Boolean);if(lines.length)return lines.length;
  }
  const names=String(order.productNames||'').split(/\n+/).filter(x=>x.trim());
  return names.length||1;
}


function inferCurrency(sourceFile='',value=''){
  const explicit=String(value||'').trim().toUpperCase();
  const aliases={EURO:'EUR','€':'EUR','$':'USD','US$':'USD','£':'GBP','¥':'JPY','RMB':'CNY'};
  if(/^[A-Z]{3}$/.test(explicit))return explicit;
  if(aliases[explicit])return aliases[explicit];
  const n=String(sourceFile||'').toUpperCase();
  for(const c of ['USD','EUR','GBP','CHF','CAD','AUD','JPY','CNY']){
    if(new RegExp(`(^|[^A-Z])${c}([^A-Z]|$)`).test(n))return c;
  }
  if(n.includes('€'))return 'EUR';
  if(n.includes('£'))return 'GBP';
  return 'EUR';
}

function isFactSheet(name = '') {
  const n=String(name||'').trim().toUpperCase();
  return /^FACT(?:\b|[-_ ])/.test(n) || /^\d+[-_ ]*FACT(?:\b|[-_ ])/.test(n);
}

function normalizeNumber(value) {
  if (value === '' || value == null) return null;
  const raw=String(value).trim().replace(/\s/g,'').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}


const textDecoder = new TextDecoder('utf-8');

function xmlDecode(value = '') {
  return value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function parseSharedStrings(xml) {
  const result = [];
  const siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siRe.exec(xml))) {
    const text = [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((m) => xmlDecode(m[1])).join('');
    result.push(text);
  }
  return result;
}

function normalizeTarget(target) {
  const clean = xmlDecode(target).replace(/^\//, '').replace(/^\.\//, '');
  return clean.startsWith('xl/') ? clean : `xl/${clean}`;
}

function parseWorkbookMap(workbookXml, relsXml) {
  const rels = new Map();
  const relRe = /<Relationship\b([^>]*)\/?\s*>/g;
  let m;
  while ((m = relRe.exec(relsXml))) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && target) rels.set(id, normalizeTarget(target));
  }
  const map = new Map();
  const sheetRe = /<sheet\b([^>]*)\/?\s*>/g;
  while ((m = sheetRe.exec(workbookXml))) {
    const name = /\bname="([^"]+)"/.exec(m[1])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(m[1])?.[1];
    const target = rid ? rels.get(rid) : null;
    if (name && target) map.set(target, xmlDecode(name));
  }
  return map;
}

function columnNumber(cellRef = '') {
  const m = /^([A-Z]+)/.exec(cellRef);
  if (!m) return 99999;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

function resolveCell(cellXml, attrs, sharedStrings) {
  const type = /\bt="([^"]+)"/.exec(attrs)?.[1] || '';
  if (type === 'inlineStr') {
    return [...cellXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1])).join('');
  }
  const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(cellXml)?.[1] ?? '';
  if (type === 's') return sharedStrings[Number(raw)] ?? '';
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  return xmlDecode(raw);
}

function parseRelevantRow(rowXml, sharedStrings) {
  const rowNum = Number(/<row[^>]*\br="(\d+)"/.exec(rowXml)?.[1] || 0);
  // The pathological 150 MB workbook expands to ~1.3 GB because rows contain styled cells up to XFD.
  // WRITE order data only uses A:P, so discard the row suffix starting at Q before parsing cells.
  const qCell = rowXml.search(/<c\b[^>]*\br="Q\d+"/);
  const relevant = qCell >= 0 ? rowXml.slice(0, qCell) : rowXml;
  const values = new Array(16).fill('');
  // Match both self-closing styled cells (<c .../>) and normal value cells.
  // This matters on FACT sheets, where column A is often an empty self-closing cell before the real data in B:H.
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match;
  while ((match = cellRe.exec(relevant))) {
    const ref = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
    const col = columnNumber(ref);
    if (col >= 1 && col <= 16) values[col - 1] = resolveCell(match[2] || '', match[1], sharedStrings);
  }
  return { rowNum, values };
}


function isRepeatedHeaderDataRow(values=[]){
  const recognized=values.map(v=>keyForHeader(v)).filter(Boolean);
  const unique=new Set(recognized);
  return CORE_FIELDS.every(field=>unique.has(field)) && unique.size>=5;
}
function looksLikeNarrativeOrFooter(value=''){
  const text=String(value||'').trim();
  if(!text)return false;
  if(text.length>=70 && /\s/.test(text))return true;
  if(/^(total|totaux|summary|résumé|resume|note|备注|说明|合计)\b/i.test(text))return true;
  if(/colis|expédi|expedie|entrep[oô]t|warehouse|shipment|已发货|包裹/.test(text.toLowerCase()))return true;
  return false;
}
function isPlausibleOrderData(order,rawValues=[]){
  if(!order || !String(order.orderId||'').trim())return false;
  if(isRepeatedHeaderDataRow(rawValues))return false;

  const id=String(order.orderId||'').trim();
  if(keyForHeader(id)==='orderId')return false;

  const productText=String(order.productNames||'').trim();
  const skuText=String(order.skuLines||'').trim();
  const country=String(order.country||'').trim();
  const amountRaw=order.orderAmount;
  const productCountRaw=order.productCount;

  const signals=[
    productText.length>0,
    skuText.length>0,
    country.length>0,
    amountRaw!=='' && amountRaw!=null,
    productCountRaw!=='' && productCountRaw!=null
  ].filter(Boolean).length;

  if(signals===0 && looksLikeNarrativeOrFooter(id))return false;
  if(signals===0)return false;
  if(keyForHeader(productText)==='productNames')return false;
  if(keyForHeader(country)==='country')return false;
  return true;
}


async function parseSheetStream(archive, entry, sharedStrings, sourceFile, sheetName, progressCb) {
  const stream=await archive.stream(entry),reader=stream.getReader();
  let buffer='',inflated=0,nonEmptyRows=0,schema=null,processedBuffered=false;
  const preRows=[],orders=[];
  function buildOrder(row){
    const order={sourceFile,sourceSheet:sheetName,sourceRow:row.rowNum};
    Object.entries(schema.mapping||{}).forEach(([col,key])=>{if(key)order[key]=String(row.values[Number(col)]??'').trim()});
    if(!order.orderId)return;
    if(!isPlausibleOrderData(order,row.values))return;
    order.orderAmount=normalizeNumber(order.orderAmount);
    order.productCount=deriveCount(order);
    order.currency=inferCurrency(sourceFile,order.currency);
    orders.push(order);
  }
  function activateSchema(force=false){
    if(schema)return true;
    if(preRows.length<8&&!force)return false;
    const c=inferSchema(preRows);
    if(!c)return false;
    schema=c;
    if(c.mode==='reject'){schema=null;return false}
    if(c.mode==='review')return false;
    for(const row of preRows){
      if(row.rowNum>c.headerRow)buildOrder(row);
    }
    processedBuffered=true;
    return true;
  }
  function consume(){
    while(true){
      const start=buffer.indexOf('<row');if(start<0){if(buffer.length>4096)buffer=buffer.slice(-4096);return}
      const end=buffer.indexOf('</row>',start);if(end<0){if(start>0)buffer=buffer.slice(start);return}
      const rowXml=buffer.slice(start,end+6);buffer=buffer.slice(end+6);
      const row=parseRelevantRow(rowXml,sharedStrings);
      const hasData=row.values.some(v=>String(v??'').trim());if(hasData)nonEmptyRows++;
      if(!schema){
        if(preRows.length<80)preRows.push(row);
        if(preRows.length>=30)activateSchema(false);
        continue;
      }
      if(schema.mode==='review')continue;
      if(processedBuffered && row.rowNum<=preRows[preRows.length-1]?.rowNum)continue;
      if(row.rowNum>schema.headerRow)buildOrder(row);
    }
  }
  let lastProgressBytes=0,lastProgressAt=0;
  while(true){
    const {value,done}=await reader.read();if(done)break;
    inflated+=value.byteLength;buffer+=textDecoder.decode(value,{stream:true});consume();
    const now=Date.now();
    if(inflated-lastProgressBytes>=4*1024*1024||now-lastProgressAt>=120){
      progressCb?.(inflated,entry.uncompressedSize||inflated);lastProgressBytes=inflated;lastProgressAt=now;
    }
  }
  buffer+=textDecoder.decode();consume();progressCb?.(inflated,entry.uncompressedSize||inflated);
  if(!schema){
    const c=inferSchema(preRows);
    schema=c;
    if(c?.mode==='auto'||c?.mode==='learned'){
      for(const row of preRows){if(row.rowNum>c.headerRow)buildOrder(row)}
    }
  }
  if(!schema){
    return {sourceFile,sheetName,status:'ignored_non_order',orderCount:0,orders:[],inflatedBytes:inflated,
      reason:nonEmptyRows?'未检测到可信订单结构':'空工作表'};
  }
  const schemaCandidate={sourceFile,sheetName,headerRow:schema.headerRow,headers:schema.headers,normalizedHeaders:schema.normalizedHeaders,
    fingerprint:schema.fingerprint,mapping:schema.mapping,confidence:schema.confidence,mode:schema.mode};
  if(schema.mode==='review'){
    return {sourceFile,sheetName,status:'needs_schema_review',orderCount:0,orders:[],inflatedBytes:inflated,schemaCandidate,
      reason:`检测到陌生订单结构，置信度 ${Math.round(schema.confidence*100)}%，需要一次字段确认`};
  }
  return {sourceFile,sheetName,status:'imported',orderCount:orders.length,orders,inflatedBytes:inflated,schemaCandidate,
    reason:`${schema.mode==='learned'?'已学习结构':'自适应识别'} · 导入 ${orders.length.toLocaleString('fr-FR')} 行 · 置信度 ${Math.round(schema.confidence*100)}%`};
}


async function parseFactSheetStream(archive, entry, sharedStrings, sourceFile, sheetName, progressCb) {
  const stream = await archive.stream(entry);
  const reader = stream.getReader();
  let buffer = '';
  let inflated = 0;
  let headerFound = false;
  let currentCountry = '';
  let afterBlank = false;
  const factRows = [];

  function num(v) {
    const n = normalizeNumber(v);
    return Number.isFinite(n) ? n : null;
  }
  function consume() {
    while (true) {
      const start = buffer.indexOf('<row');
      if (start < 0) { if (buffer.length > 4096) buffer = buffer.slice(-4096); return; }
      const end = buffer.indexOf('</row>', start);
      if (end < 0) { if (start > 0) buffer = buffer.slice(start); return; }
      const rowXml = buffer.slice(start, end + 6);
      buffer = buffer.slice(end + 6);
      const row = parseRelevantRow(rowXml, sharedStrings);
      const v = row.values.map(x => String(x ?? '').trim());
      const hasData = v.slice(1,8).some(Boolean);
      if (!hasData) { afterBlank = headerFound; continue; }
      if (!headerFound) {
        const joined = v.slice(1,8).join('|').toLowerCase();
        if (joined.includes('description') && joined.includes('quantity') && joined.includes('cogs')) { headerFound = true; }
        continue;
      }
      const b=v[1], c=v[2], d=v[3], e=v[4], f=v[5], g=v[6], h=v[7];
      // Country section labels in FACT are stored in column B with the rest of B:H empty.
      if (b && !c && !d && !e && !f && !g && !h && /^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ .'-]{2,}$/.test(b)) {
        currentCountry=b; afterBlank=false; continue;
      }
      if (!c) { afterBlank=false; continue; }
      if (afterBlank) currentCountry = 'GLOBAL / 附加项目';
      const quantity=num(d);
      const cogs=num(e);
      const shipping=num(f);
      const unitTotal=num(g);
      const amount=num(h);
      const no = b || '';
      // Only retain genuine FACT cost/category rows.
      if (quantity!==null || cogs!==null || shipping!==null || unitTotal!==null || amount!==null) {
        factRows.push({
          sourceFile, sourceSheet: sheetName, sourceRow: row.rowNum, country: currentCountry || 'GLOBAL / 附加项目',
          no, description: c, quantity, cogs, shipping, unitTotal, amount
        });
      }
      afterBlank=false;
    }
  }
  let lastProgressAt=0, lastProgressBytes=0;
  while (true) {
    const {value,done}=await reader.read(); if(done) break;
    inflated += value.byteLength; buffer += textDecoder.decode(value,{stream:true}); consume();
    const now=Date.now();
    if (inflated-lastProgressBytes>=1024*1024 || now-lastProgressAt>=120) {
      progressCb?.(inflated, entry.uncompressedSize || inflated); lastProgressBytes=inflated; lastProgressAt=now;
    }
  }
  buffer += textDecoder.decode(); consume(); progressCb?.(inflated, entry.uncompressedSize || inflated);
  return { sourceFile, sheetName, status:'ignored_fact', orderCount:0, factRows, inflatedBytes:inflated,
    reason:`FACT 成本页已解析：${factRows.length.toLocaleString('fr-FR')} 条分类明细（不作为订单导入）` };
}

async function parseXlsxBlob(blob, sourceFile, progressCb) {
  const archive = await ZipArchive.open(blob);
  const workbookXml = await archive.text('xl/workbook.xml', 4 * 1024 * 1024);
  const relsXml = await archive.text('xl/_rels/workbook.xml.rels', 4 * 1024 * 1024);
  const sharedXml = archive.get('xl/sharedStrings.xml') ? await archive.text('xl/sharedStrings.xml', 16 * 1024 * 1024) : '';
  const sharedStrings = parseSharedStrings(sharedXml);
  const sheetMap = parseWorkbookMap(workbookXml, relsXml);
  const results = [];
  const sheets = [...sheetMap.entries()];
  let workIndex = 0;

  for (const [path, sheetName] of sheets) {
    workIndex++;
    if (isFactSheet(sheetName)) {
      const factEntry = archive.get(path);
      if (!factEntry) {
        results.push({ sourceFile, sheetName, status:'ignored_fact', orderCount:0, factRows:[], inflatedBytes:0, reason:'FACT 工作表存在，但找不到工作表 XML' });
        continue;
      }
      const factResult = await parseFactSheetStream(archive, factEntry, sharedStrings, sourceFile, sheetName, (done,total)=>{
        const within=total?Math.min(1,done/total):0;
        progressCb?.((workIndex-1+within)/sheets.length, sheetName, 'fact');
      });
      results.push(factResult);
      continue;
    }
    const entry = archive.get(path);
    if (!entry) {
      results.push({ sourceFile, sheetName, status: 'ignored_non_order', orderCount: 0, inflatedBytes: 0, reason: '找不到工作表 XML' });
      continue;
    }
    const result = await parseSheetStream(archive, entry, sharedStrings, sourceFile, sheetName, (done, total) => {
      const within = total ? Math.min(1, done / total) : 0;
      progressCb?.((workIndex - 1 + within) / sheets.length, sheetName, 'sheet');
    });
    results.push(result);
  }
  return results;
}

async function parseUploadedZip(file, overallCb) {
  const outer = await ZipArchive.open(file);
  const xlsxEntries = outer.list((e) => /\.xlsx$/i.test(e.name) && !e.name.includes('__MACOSX/') && !/(^|\/)\._/.test(e.name));
  const results = [];
  const workbooks = [];
  for (let i = 0; i < xlsxEntries.length; i++) {
    const entry = xlsxEntries[i];
    overallCb?.((i / Math.max(1, xlsxEntries.length)), entry.name, 'extract');
    const xlsxBlob = await outer.toBlob(entry, (done, total) => {
      overallCb?.((i + 0.25 * (done / Math.max(1, total))) / xlsxEntries.length, entry.name, 'extract');
    });
    const workbookResults = await parseXlsxBlob(xlsxBlob, entry.name, (p, sheetName, phase) => {
      overallCb?.((i + 0.25 + p * 0.75) / xlsxEntries.length, `${entry.name} · ${sheetName}`, phase);
    });
    results.push(...workbookResults);
    workbooks.push({ name: entry.name, blob: xlsxBlob });
  }
  return { results, workbooks };
}

async function parseInput(file, progressCb) {
  if (/\.zip$/i.test(file.name)) return parseUploadedZip(file, progressCb);
  if (/\.xlsx$/i.test(file.name)) {
    const results = await parseXlsxBlob(file, file.name, (p, sheetName, phase) => progressCb?.(p, `${file.name} · ${sheetName}`, phase));
    return { results, workbooks: [{ name: file.name, blob: file }] };
  }
  throw new Error(`不支持的文件：${file.name}`);
}

self.onmessage = async ({ data }) => {
  const files = data.files || [];
  LEARNED_SCHEMAS=Array.isArray(data.schemaRules)?data.schemaRules:[];
  try {
    const all = [];
    const workbooks = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      self.postMessage({ type: 'file-start', fileName: file.name, index: i, total: files.length });
      const parsed = await parseInput(file, (p, detail, phase) => {
        self.postMessage({ type: 'progress', progress: (i + p) / files.length, detail, phase });
      });
      all.push(...(parsed.results || []));
      workbooks.push(...(parsed.workbooks || []));
    }

    const rawOrders = all.flatMap((s) => s.orders || []);
    // V7.2 invariant: orderId is a business association key, NOT a unique row key.
    // Never silently delete a source row merely because another row has the same orderId.
    const byOrderId = new Map();
    const byLocalOrderId = new Map();
    const orders = [];
    for (const order of rawOrders) {
      const orderId = String(order.orderId || '').trim();
      if (!orderId) continue;
      order.recordKey=[order.sourceFile,order.sourceSheet,order.sourceRow,orderId,order.trackingNo||''].map(v=>String(v??'')).join('\u0001');
      orders.push(order);
      const globalRefs=byOrderId.get(orderId)||[];
      globalRefs.push({recordKey:order.recordKey,sourceFile:order.sourceFile,sourceSheet:order.sourceSheet,sourceRow:order.sourceRow,trackingNo:order.trackingNo||'',amount:order.orderAmount,productCount:order.productCount});
      byOrderId.set(orderId,globalRefs);
      const localKey=`${order.sourceFile}\u0001${orderId}`;
      const localRefs=byLocalOrderId.get(localKey)||[];
      localRefs.push(globalRefs[globalRefs.length-1]);byLocalOrderId.set(localKey,localRefs);
    }
    const sameWorkbookOrderIdGroups=[...byLocalOrderId.entries()]
      .filter(([,refs])=>refs.length>1)
      .map(([key,refs])=>({key,orderId:key.split('\u0001').pop(),refs}));
    const sameOrderIdExtraRows=sameWorkbookOrderIdGroups.reduce((a,g)=>a+Math.max(0,g.refs.length-1),0);
    const crossWorkbookDuplicates=[...byOrderId.entries()]
      .filter(([,refs])=>new Set(refs.map(r=>r.sourceFile)).size>1)
      .map(([orderId,refs])=>({orderId,refs}));
    const duplicates=0;
    const sheets = all.map(({ orders: _orders, ...rest }) => rest);
    const schemaCandidates=all.map(s=>s.schemaCandidate).filter(Boolean);
    const schemaReviews=all.filter(s=>s.status==='needs_schema_review').map(s=>s.schemaCandidate).filter(Boolean);
    self.postMessage({ type: 'complete', progress: 1, orders, sheets, duplicates, sameOrderIdExtraRows, sameWorkbookOrderIdGroups, sourceRecordCount:rawOrders.length, crossWorkbookDuplicates, workbooks, schemaCandidates, schemaReviews });
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || String(error), stack: error?.stack || '' });
  }
};
