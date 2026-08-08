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


const ORDER_HEADERS = [
  '订单号', '订单金额', '产品总数', '多品名', '产品名称', '收货人国家', '买家姓名', '运单号',
  '订单备注', '拣货备注', '客服备注', '地址1+地址2', '下单时间', '付款时间', '店铺账号', '发货时间',
];

const HEADER_TO_KEY = {
  '订单号': 'orderId',
  '订单金额': 'orderAmount',
  '产品总数': 'productCount',
  '多品名': 'skuLines',
  '产品名称': 'productNames',
  '收货人国家': 'country',
  '买家姓名': 'buyerName',
  '运单号': 'trackingNo',
  '订单备注': 'orderNote',
  '拣货备注': 'pickingNote',
  '客服备注': 'customerServiceNote',
  '地址1+地址2': 'address',
  '下单时间': 'orderTime',
  '付款时间': 'paidTime',
  '店铺账号': 'storeAccount',
  '发货时间': 'shippedTime',
};

const REQUIRED_HEADERS = ['订单号', '订单金额', '产品总数', '产品名称', '收货人国家'];

function isFactSheet(name = '') {
  return String(name).trim().toUpperCase() === 'FACT';
}

function scoreOrderHeader(row = []) {
  const normalized = new Set(row.map((v) => String(v ?? '').trim()).filter(Boolean));
  return ORDER_HEADERS.reduce((score, header) => score + (normalized.has(header) ? 1 : 0), 0);
}

function isOrderHeader(row = []) {
  const normalized = new Set(row.map((v) => String(v ?? '').trim()).filter(Boolean));
  return REQUIRED_HEADERS.every((header) => normalized.has(header)) && scoreOrderHeader(row) >= 8;
}

function normalizeNumber(value) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
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

async function parseSheetStream(archive, entry, sharedStrings, sourceFile, sheetName, progressCb) {
  const stream = await archive.stream(entry);
  const reader = stream.getReader();
  let buffer = '';
  let inflated = 0;
  let header = null;
  let headerRow = -1;
  let keyByColumn = null;
  const orders = [];
  let nonEmptyRows = 0;

  function consume() {
    while (true) {
      const start = buffer.indexOf('<row');
      if (start < 0) {
        if (buffer.length > 4096) buffer = buffer.slice(-4096);
        return;
      }
      const end = buffer.indexOf('</row>', start);
      if (end < 0) {
        if (start > 0) buffer = buffer.slice(start);
        return;
      }
      const rowXml = buffer.slice(start, end + 6);
      buffer = buffer.slice(end + 6);
      const row = parseRelevantRow(rowXml, sharedStrings);
      const hasData = row.values.some((v) => String(v ?? '').trim());
      if (hasData) nonEmptyRows++;

      if (!header && row.rowNum <= 30 && isOrderHeader(row.values)) {
        header = row.values.map((v) => String(v ?? '').trim());
        headerRow = row.rowNum;
        keyByColumn = header.map((h) => HEADER_TO_KEY[h] || null);
        continue;
      }
      if (!header || row.rowNum <= headerRow) continue;
      const first = String(row.values[0] ?? '').trim();
      if (!first) continue;
      const order = { sourceFile, sourceSheet: sheetName, sourceRow: row.rowNum };
      keyByColumn.forEach((key, col) => { if (key) order[key] = String(row.values[col] ?? '').trim(); });
      if (!order.orderId) continue;
      order.orderAmount = normalizeNumber(order.orderAmount);
      order.productCount = normalizeNumber(order.productCount);
      orders.push(order);
    }
  }

  let lastProgressBytes = 0;
  let lastProgressAt = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    inflated += value.byteLength;
    buffer += textDecoder.decode(value, { stream: true });
    consume();
    const now = Date.now();
    if (inflated - lastProgressBytes >= 4 * 1024 * 1024 || now - lastProgressAt >= 120) {
      progressCb?.(inflated, entry.uncompressedSize || inflated);
      lastProgressBytes = inflated;
      lastProgressAt = now;
    }
  }
  progressCb?.(inflated, entry.uncompressedSize || inflated);
  buffer += textDecoder.decode();
  consume();

  if (!header) {
    return { sourceFile, sheetName, status: 'ignored_non_order', orderCount: 0, orders: [], inflatedBytes: inflated,
      reason: nonEmptyRows ? '未检测到 WRITE 真实订单表头' : '空工作表' };
  }
  return { sourceFile, sheetName, status: 'imported', orderCount: orders.length, orders, inflatedBytes: inflated,
    reason: `识别到真实订单表头，导入 ${orders.length.toLocaleString('fr-FR')} 行` };
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
    const seen = new Set();
    const orders = [];
    let duplicates = 0;
    for (const order of rawOrders) {
      const key = String(order.orderId || '').trim();
      if (!key) continue;
      if (seen.has(key)) { duplicates++; continue; }
      seen.add(key);
      orders.push(order);
    }
    const sheets = all.map(({ orders: _orders, ...rest }) => rest);
    self.postMessage({ type: 'complete', progress: 1, orders, sheets, duplicates, workbooks });
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || String(error), stack: error?.stack || '' });
  }
};
