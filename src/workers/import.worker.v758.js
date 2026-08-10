/* WRITE Settlement Manager v7.5.8 — Source Fidelity Import Worker
 * Layered over the production V7.4.1 worker.
 * Contract: preserve every non-empty source cell, never drop an order row only
 * because orderId/amount/category/cost is unknown, and never truncate at column P.
 */
importScripts('./import.worker.bundle.js?v=7.4.1-001');

const V750_LEGACY_INFER_SCHEMA = inferSchema;

function v750ColumnLabel(n){
  let s=''; n=Number(n)||0;
  while(n>0){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26)}
  return s||'?';
}

// Sparse, value-only parsing across the entire XLSX row. Empty styled cells are
// deliberately ignored, so pathological sheets that style cells through XFD do
// not become 16,384-column dense arrays. Any non-empty cell is still retained.
parseRelevantRow = function(rowXml, sharedStrings) {
  const rowNum = Number(/<row[^>]*\br="(\d+)"/.exec(rowXml)?.[1] || 0);
  const values = [];
  const rawCells = {};
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match;
  while ((match = cellRe.exec(rowXml))) {
    const ref = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
    const col = columnNumber(ref);
    if (!Number.isFinite(col) || col < 1 || col > 16384) continue;
    const value = resolveCell(match[2] || '', match[1], sharedStrings);
    if (String(value ?? '').trim() === '') continue;
    values[col - 1] = value;
    rawCells[col - 1] = value;
  }
  return { rowNum, values, rawCells };
};

function v750SchemaSignals(mapping={}){
  const values=new Set(Object.values(mapping||{}));
  const product=values.has('productNames')||values.has('skuLines');
  const strong=['orderId','country','productCount','orderAmount','trackingNo'].filter(k=>values.has(k)).length;
  const context=['buyerName','currency','orderTime','paidTime','storeAccount','address'].filter(k=>values.has(k)).length;
  return {product,strong,context,total:values.size};
}

// Keep the mature inference engine, but remove the old requirement that
// orderId + amount + product + country must all exist. Product/SKU plus enough
// order context is sufficient. A low-confidence category is not an import gate.
inferSchema = function(rows=[]) {
  let candidate = V750_LEGACY_INFER_SCHEMA(rows);
  if (candidate?.mapping) {
    const s=v750SchemaSignals(candidate.mapping);
    if (s.product && (s.strong>=1 || s.context>=2 || s.total>=3)) {
      candidate={...candidate,mode:candidate.mode==='learned'?'learned':'adaptive',confidence:Math.max(.68,Number(candidate.confidence)||0)};
      return candidate;
    }
  }

  let best=null;
  const maxHeader=Math.min(rows.length,50);
  for(let hi=0;hi<maxHeader;hi++){
    const header=rows[hi].values.map(v=>String(v??'').trim());
    const mapping={};
    header.forEach((h,col)=>{const k=keyForHeader(h);if(k&&!Object.values(mapping).includes(k))mapping[col]=k});
    const s=v750SchemaSignals(mapping);
    if(!s.product || !(s.strong>=1 || s.context>=2 || s.total>=3)) continue;
    const score=s.total*10+s.strong*4+s.context*2-headerDataLikeRatio(header)*8;
    if(!best||score>best.score){
      best={score,headerIndex:hi,headerRow:rows[hi].rowNum,headers:header,normalizedHeaders:header.map(normalizeHeaderText),fingerprint:schemaFingerprint(header),mapping,fieldConfidence:{},confidence:.70,mode:'adaptive'};
    }
  }
  return best||candidate;
};

function v750RawFields(row,schema){
  const out={};
  for(const [idxText,value] of Object.entries(row.rawCells||{})){
    const idx=Number(idxText);
    let key=String(schema?.headers?.[idx]||'').trim()||`COL_${v750ColumnLabel(idx+1)}`;
    if(Object.prototype.hasOwnProperty.call(out,key))key=`${key} [${v750ColumnLabel(idx+1)}]`;
    out[key]=String(value??'');
  }
  return out;
}

function v750PlausibleData(order,row){
  if(isRepeatedHeaderDataRow(row.values||[]))return false;
  const rawCount=Object.keys(row.rawCells||{}).length;
  if(!rawCount)return false;
  const product=String(order.productNames||order.skuLines||'').trim();
  const signals=[product,order.country,order.orderAmount,order.productCount,order.trackingNo,order.buyerName]
    .filter(v=>String(v??'').trim()!=='').length;
  // Once a sheet has a trusted/adaptive order schema, a row with at least two
  // non-empty source cells is retained even if some semantic fields are blank.
  return signals>0 || rawCount>=2;
}

parseSheetStream = async function(archive, entry, sharedStrings, sourceFile, sheetName, progressCb) {
  const stream=await archive.stream(entry),reader=stream.getReader();
  let buffer='',inflated=0,nonEmptyRows=0,schema=null,processedBuffered=false;
  const preRows=[],orders=[];

  function buildOrder(row){
    const order={sourceFile,sourceSheet:sheetName,sourceRow:row.rowNum};
    Object.entries(schema.mapping||{}).forEach(([col,key])=>{
      if(key)order[key]=String(row.values[Number(col)]??'').trim();
    });
    order.sourceRawFields=v750RawFields(row,schema);
    order.sourceRawCellCount=Object.keys(row.rawCells||{}).length;
    order.sourceProductCountValue=normalizeNumber(order.productCount);
    order.sourceProductCountWasExplicit=String(order.productCount??'').trim()!=='';
    if(!v750PlausibleData(order,row))return;

    if(!String(order.orderId||'').trim()){
      order.orderId=`ROW-${row.rowNum}`;
      order.orderIdSynthetic=true;
    }
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
    const sig=v750SchemaSignals(c.mapping||{});
    if(c.mode==='reject' && !(sig.product&&(sig.strong>=1||sig.context>=2||sig.total>=3)))return false;
    schema={...c,mode:c.mode==='learned'?'learned':'adaptive'};
    for(const row of preRows){if(row.rowNum>schema.headerRow)buildOrder(row)}
    processedBuffered=true;
    return true;
  }

  function consume(){
    while(true){
      const start=buffer.indexOf('<row');
      if(start<0){if(buffer.length>4096)buffer=buffer.slice(-4096);return}
      const end=buffer.indexOf('</row>',start);
      if(end<0){if(start>0)buffer=buffer.slice(start);return}
      const rowXml=buffer.slice(start,end+6);buffer=buffer.slice(end+6);
      const row=parseRelevantRow(rowXml,sharedStrings);
      const hasData=Object.keys(row.rawCells||{}).length>0;if(hasData)nonEmptyRows++;
      if(!schema){
        if(preRows.length<80)preRows.push(row);
        if(preRows.length>=30)activateSchema(false);
        continue;
      }
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

  if(!schema)activateSchema(true);
  if(!schema){
    return {sourceFile,sheetName,status:'ignored_non_order',orderCount:0,orders:[],inflatedBytes:inflated,
      reason:nonEmptyRows?'未检测到足够的订单语义字段（源 Sheet 未改动）':'空工作表'};
  }
  const schemaCandidate={sourceFile,sheetName,headerRow:schema.headerRow,headers:schema.headers,normalizedHeaders:schema.normalizedHeaders,
    fingerprint:schema.fingerprint,mapping:schema.mapping,confidence:schema.confidence,mode:schema.mode};
  return {sourceFile,sheetName,status:'imported',orderCount:orders.length,orders,inflatedBytes:inflated,schemaCandidate,
    reason:`V7.5 源数据保真 · 导入 ${orders.length.toLocaleString('fr-FR')} 行 · ${Object.keys(schema.mapping||{}).length} 个语义字段 · 全部非空源字段保留`};
};

// Rebuild final message handling so rows without a business order id are never
// discarded. Synthetic ROW-n identifiers are display/association keys only;
// recordKey remains source-file + sheet + row based.
self.onmessage = async ({ data }) => {
  const files = data.files || [];
  LEARNED_SCHEMAS=Array.isArray(data.schemaRules)?data.schemaRules:[];
  try {
    const all = [],workbooks=[];
    for (let i=0;i<files.length;i++){
      const file=files[i];
      self.postMessage({type:'file-start',fileName:file.name,index:i,total:files.length});
      const parsed=await parseInput(file,(p,detail,phase)=>{
        self.postMessage({type:'progress',progress:(i+p)/files.length,detail,phase});
      });
      all.push(...(parsed.results||[]));workbooks.push(...(parsed.workbooks||[]));
    }

    const rawOrders=all.flatMap(s=>s.orders||[]);
    const byOrderId=new Map(),byLocalOrderId=new Map(),orders=[];
    for(const order of rawOrders){
      let orderId=String(order.orderId||'').trim();
      if(!orderId){orderId=`ROW-${order.sourceRow||orders.length+1}`;order.orderId=orderId;order.orderIdSynthetic=true}
      order.recordKey=[order.sourceFile,order.sourceSheet,order.sourceRow,orderId,order.trackingNo||''].map(v=>String(v??'')).join('\u0001');
      orders.push(order);
      const globalRefs=byOrderId.get(orderId)||[];
      globalRefs.push({recordKey:order.recordKey,sourceFile:order.sourceFile,sourceSheet:order.sourceSheet,sourceRow:order.sourceRow,trackingNo:order.trackingNo||'',amount:order.orderAmount,productCount:order.productCount,synthetic:!!order.orderIdSynthetic});
      byOrderId.set(orderId,globalRefs);
      const localKey=`${order.sourceFile}\u0001${orderId}`;
      const localRefs=byLocalOrderId.get(localKey)||[];localRefs.push(globalRefs[globalRefs.length-1]);byLocalOrderId.set(localKey,localRefs);
    }
    const sameWorkbookOrderIdGroups=[...byLocalOrderId.entries()].filter(([,refs])=>refs.length>1).map(([key,refs])=>({key,orderId:key.split('\u0001').pop(),refs}));
    const sameOrderIdExtraRows=sameWorkbookOrderIdGroups.reduce((a,g)=>a+Math.max(0,g.refs.length-1),0);
    const crossWorkbookDuplicates=[...byOrderId.entries()].filter(([,refs])=>new Set(refs.map(r=>r.sourceFile)).size>1).map(([orderId,refs])=>({orderId,refs}));
    const sheets=all.map(({orders:_orders,...rest})=>rest);
    const schemaCandidates=all.map(s=>s.schemaCandidate).filter(Boolean);
    self.postMessage({type:'complete',progress:1,orders,sheets,duplicates:0,sameOrderIdExtraRows,sameWorkbookOrderIdGroups,
      sourceRecordCount:rawOrders.length,crossWorkbookDuplicates,workbooks,schemaCandidates,schemaReviews:[],sourceFidelityVersion:'7.5.8'});
  } catch (error) {
    self.postMessage({type:'error',message:error?.message||String(error),stack:error?.stack||''});
  }
};
