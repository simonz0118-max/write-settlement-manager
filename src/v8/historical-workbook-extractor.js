/* WRITE V8.8 — Historical Workbook Auto-Extractor
 * Reads workbook structure into conservative Order/FACT evidence.
 * Extraction success never equals training permission.
 */
(function(g){'use strict';
const VERSION='8.8.0';
const SHEET_ROLE=Object.freeze({ORDER:'ORDER',FACT:'FACT',REFERENCE:'REFERENCE',UNKNOWN:'UNKNOWN'});
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const lower=v=>clean(v).toLowerCase();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const COUNTRY_MAP=new Map([
 ['france','FRANCE'],['belgium','BELGIUM'],['belgique','BELGIUM'],['greece','GREECE'],['grèce','GREECE'],
 ['canada','CANADA'],['germany','GERMANY'],['allemagne','GERMANY'],['spain','SPAIN'],['espagne','SPAIN'],
 ['italy','ITALY'],['italie','ITALY'],['switzerland','SWITZERLAND'],['suisse','SWITZERLAND'],
 ['luxembourg','LUXEMBOURG'],['netherlands','NETHERLANDS'],['pays-bas','NETHERLANDS'],['austria','AUSTRIA'],
 ['autriche','AUSTRIA'],['portugal','PORTUGAL'],['réunion','REUNION ISLAND'],['reunion island','REUNION ISLAND'],
 ['united kingdom','UNITED KINGDOM'],['uk','UNITED KINGDOM'],['usa','USA'],['united states','USA']
]);
const HEADER_ALIASES={
 orderId:['order id','order','order number','order no','订单号','订单编号','numéro de commande','numero de commande'],
 quantity:['quantity','qty','数量','产品总数','quantité','quantite'],
 sku:['sku','sku(s)','商品sku','产品sku'],
 productName:['product name','product','description produit','商品名称','产品名称','nom du produit'],
 country:['country','pays','国家','国家/地区'],
 tracking:['tracking','tracking number','waybill','运单号','物流单号','numéro de suivi','numero de suivi'],
 packageId:['package id','parcel id','包裹号','包裹id'],
 notes:['notes','note','remark','remarks','备注','拣货备注','commentaire'],
 shippedAt:['shipped at','ship time','shipping time','发货时间','出库时间'],
 description:['description','désignation','designation','商品描述'],
 cogs:['cogs','cost','成本'],
 shipping:['shipping','frais de livraison','运费'],
 handling:['frais trait.','handling','处理费'],
 unitPrice:['unit price','prix unitaire','单价'],
 amount:['amount','montant','total amount','金额']
};
function headerToken(v){return lower(v).replace(/[：:]/g,'').trim()}
function aliasMatch(v,aliases){const t=headerToken(v);return aliases.some(a=>t===a||t.includes(a))}
function findHeader(rows=[],kind='ORDER'){
 const max=Math.min(rows.length,25);let best=null;
 for(let r=0;r<max;r++){
  const row=rows[r]||[],map={},scoreParts=[];
  for(let c=0;c<row.length;c++){
   for(const [field,aliases] of Object.entries(HEADER_ALIASES)){
    if(map[field]===undefined&&aliasMatch(row[c],aliases))map[field]=c;
   }
  }
  let score=0;
  if(kind==='ORDER'){
   if(map.orderId!==undefined)score+=3;if(map.productName!==undefined)score+=3;if(map.sku!==undefined)score+=2;
   if(map.country!==undefined)score+=1;if(map.quantity!==undefined)score+=1;if(map.tracking!==undefined)score+=1;if(map.notes!==undefined)score+=.5;
  }else{
   if(map.description!==undefined)score+=4;if(map.quantity!==undefined)score+=2;if(map.cogs!==undefined)score+=1;
   if(map.shipping!==undefined)score+=1;if(map.unitPrice!==undefined)score+=1;if(map.amount!==undefined)score+=1;if(map.handling!==undefined)score+=.5;
  }
  if(!best||score>best.score)best={rowIndex:r,map,score};
 }
 return best||{rowIndex:-1,map:{},score:0};
}
function detectSheetRole(name='',rows=[]){
 const n=lower(name),orderHeader=findHeader(rows,'ORDER'),factHeader=findHeader(rows,'FACT');
 let factScore=factHeader.score,orderScore=orderHeader.score,referenceScore=0;
 if(/\bfact\b|invoice|facture/i.test(name))factScore+=6;
 if(/backup|archive|old|copy|copie|备份|原始|参考/i.test(name))referenceScore+=5;
 if(/\bcn\b|\bfr\b/i.test(name)){factScore+=.25;orderScore+=.25}
 if(/\d+\s*[-–]\s*\d+/.test(name))orderScore+=2;
 if(orderHeader.map.orderId!==undefined&&orderHeader.map.productName!==undefined)orderScore+=2;
 if(factHeader.map.description!==undefined&&factHeader.map.quantity!==undefined)factScore+=2;
 const max=Math.max(factScore,orderScore,referenceScore);
 if(max<4)return{role:SHEET_ROLE.UNKNOWN,confidence:Math.min(1,max/10),factScore,orderScore,referenceScore,orderHeader,factHeader};
 if(referenceScore===max&&referenceScore>factScore&&referenceScore>orderScore)return{role:SHEET_ROLE.REFERENCE,confidence:.8,factScore,orderScore,referenceScore,orderHeader,factHeader};
 if(factScore>=orderScore)return{role:SHEET_ROLE.FACT,confidence:Math.min(1,factScore/10),factScore,orderScore,referenceScore,orderHeader,factHeader};
 return{role:SHEET_ROLE.ORDER,confidence:Math.min(1,orderScore/10),factScore,orderScore,referenceScore,orderHeader,factHeader};
}
function originFromName(name=''){
 if(/(?:^|[\s_-])fr(?:$|[\s_-])|fact\s*fr|france\s*warehouse/i.test(name))return'FR';
 if(/(?:^|[\s_-])cn(?:$|[\s_-])|fact\s*cn|china/i.test(name))return'CN';
 return'UNKNOWN';
}
function normalizeCountry(v){
 const t=lower(v);if(!t)return null;
 if(COUNTRY_MAP.has(t))return COUNTRY_MAP.get(t);
 for(const [k,vv] of COUNTRY_MAP)if(t===k||t.includes(k))return vv;
 return clean(v).toUpperCase();
}
function singleCountryToken(row=[]){
 const vals=row.map(clean).filter(Boolean);
 if(vals.length!==1)return null;
 return normalizeCountry(vals[0]);
}
function splitLines(v){return String(v??'').replace(/\r/g,'').split(/\n/).map(clean)}
function qtyFromSku(v){
 const m=clean(v).match(/(?:\*|×|x)\s*(\d+(?:[.,]\d+)?)\s*$/i);
 return m?Number(m[1].replace(',','.')):null;
}
function extractFactSheet(sheet={}){
 const rows=sheet.rows||[],h=findHeader(rows,'FACT'),origin=originFromName(sheet.name),out=[];
 if(h.score<4)return{sheet:sheet.name,origin,header:h,rows:[],warnings:['FACT_HEADER_NOT_CONFIDENT']};
 let country=null;
 for(let r=h.rowIndex+1;r<rows.length;r++){
  const row=rows[r]||[];
  const desc=clean(row[h.map.description]);
  const qty=h.map.quantity!==undefined?num(row[h.map.quantity]):null;
  const countryCell=h.map.country!==undefined?normalizeCountry(row[h.map.country]):null;
  if(countryCell)country=countryCell;
  if(!desc){
   const token=singleCountryToken(row);
   if(token)country=token;
   continue;
  }
  // Country headings can also sit in description column; don't emit them as products.
  const descCountry=normalizeCountry(desc);
  if(COUNTRY_MAP.has(lower(desc))&&qty===null){country=descCountry;continue}
  out.push({
   sourceSheet:sheet.name,sourceRow:r+1,origin,country:country||countryCell||'GLOBAL',
   description:desc,configuration:desc,quantity:qty,
   cogs:h.map.cogs!==undefined?num(row[h.map.cogs]):null,
   shipping:h.map.shipping!==undefined?num(row[h.map.shipping]):null,
   handling:h.map.handling!==undefined?num(row[h.map.handling]):null,
   unitPrice:h.map.unitPrice!==undefined?num(row[h.map.unitPrice]):null,
   amount:h.map.amount!==undefined?num(row[h.map.amount]):null,
   templateOnly:qty===null
  });
 }
 return{sheet:sheet.name,origin,header:h,rows:out,warnings:[]};
}
function extractOrderSheet(sheet={}){
 const rows=sheet.rows||[],h=findHeader(rows,'ORDER'),origin=originFromName(sheet.name),records=[];
 if(h.score<5)return{sheet:sheet.name,origin,header:h,records:[],warnings:['ORDER_HEADER_NOT_CONFIDENT']};
 for(let r=h.rowIndex+1;r<rows.length;r++){
  const row=rows[r]||[];
  const orderId=h.map.orderId!==undefined?clean(row[h.map.orderId]):'';
  const productCell=h.map.productName!==undefined?row[h.map.productName]:'';
  const skuCell=h.map.sku!==undefined?row[h.map.sku]:'';
  if(!orderId&&!clean(productCell)&&!clean(skuCell))continue;
  const names=splitLines(productCell),skus=splitLines(skuCell),L=Math.max(names.length,skus.length,1);
  while(names.length<L)names.push('');while(skus.length<L)skus.push('');
  const lineItems=[];
  for(let i=0;i<L;i++){
   if(!names[i]&&!skus[i])continue;
   lineItems.push({productName:names[i],sku:skus[i],quantity:qtyFromSku(skus[i])??1});
  }
  const rawQty=h.map.quantity!==undefined?num(row[h.map.quantity]):null;
  const tracking=h.map.tracking!==undefined?clean(row[h.map.tracking]):'';
  const notes=h.map.notes!==undefined?clean(row[h.map.notes]):'';
  const shippedAt=h.map.shippedAt!==undefined?clean(row[h.map.shippedAt]):'';
  const packageId=h.map.packageId!==undefined?clean(row[h.map.packageId]):'';
  const country=h.map.country!==undefined?normalizeCountry(row[h.map.country]):null;
  records.push({
   sourceSheet:sheet.name,sourceRow:r+1,orderId,recordKey:orderId||`${sheet.name}:${r+1}`,
   packageId,trackingNumber:tracking,notes,shippedAt,
   fulfillmentOrigin:origin,country:country||'GLOBAL',
   declaredProductCount:rawQty,lineItems,
   sourceRawFields:row.slice()
  });
 }
 return{sheet:sheet.name,origin,header:h,records,warnings:[]};
}
function rowFingerprint(rows=[]){
 let s='';for(const row of rows.slice(0,300))s+=row.map(v=>clean(v)).join('\u0002')+'\u0003';
 let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16);
}
function extractWorkbook(descriptor={}){
 const sheets=(descriptor.sheets||[]).map(s=>({...s,rows:Array.isArray(s.rows)?s.rows:[]}));
 const detected=sheets.map(s=>({sheet:s,...detectSheetRole(s.name,s.rows),fingerprint:rowFingerprint(s.rows)}));
 const duplicateFingerprints=new Map(),duplicates=[];
 for(const d of detected){
  if(!d.fingerprint)continue;
  if(duplicateFingerprints.has(d.fingerprint))duplicates.push({sheet:d.sheet.name,duplicateOf:duplicateFingerprints.get(d.fingerprint)});
  else duplicateFingerprints.set(d.fingerprint,d.sheet.name);
 }
 const factSheets=[],orderSheets=[],referenceSheets=[],unknownSheets=[];
 for(const d of detected){
  if(duplicates.some(x=>x.sheet===d.sheet.name)){referenceSheets.push({name:d.sheet.name,reason:'DUPLICATE_SHEET_CONTENT'});continue}
  if(d.role===SHEET_ROLE.FACT)factSheets.push(extractFactSheet(d.sheet));
  else if(d.role===SHEET_ROLE.ORDER)orderSheets.push(extractOrderSheet(d.sheet));
  else if(d.role===SHEET_ROLE.REFERENCE)referenceSheets.push({name:d.sheet.name,reason:'REFERENCE_SHEET'});
  else unknownSheets.push({name:d.sheet.name,reason:'UNKNOWN_STRUCTURE'});
 }
 return{
  version:VERSION,fileName:descriptor.fileName||'',
  factSheets,orderSheets,referenceSheets,unknownSheets,duplicates,
  factRows:factSheets.flatMap(x=>x.rows),
  orderRecords:orderSheets.flatMap(x=>x.records),
  extractionQuality:{
   factSheets:factSheets.length,orderSheets:orderSheets.length,
   referenceSheets:referenceSheets.length,unknownSheets:unknownSheets.length,
   hasSourceAndFact:factSheets.length>0&&orderSheets.length>0
  }
 };
}
function fromSheetJSWorkbook(workbook,XLSX,fileName=''){
 if(!workbook||!XLSX?.utils?.sheet_to_json)throw new Error('SHEETJS_ADAPTER_REQUIRES_XLSX');
 const sheets=(workbook.SheetNames||[]).map(name=>({
   name,rows:XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,raw:true,defval:null})
 }));
 return extractWorkbook({fileName,sheets});
}
g.WRITE_HISTORICAL_EXTRACTOR_V88={VERSION,SHEET_ROLE,findHeader,detectSheetRole,extractFactSheet,extractOrderSheet,extractWorkbook,fromSheetJSWorkbook,originFromName,normalizeCountry};
})(window);