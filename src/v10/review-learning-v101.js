/* WRITE V10.1.2 — Universal CN Reviewed FACT Learning
 * Supports:
 *   A) V10.1+ unified reviewed workbook with WRITE_LEARNING_SOURCE
 *   B) legacy human FACT workbook containing FACT + source-order sheet(s)
 *
 * Hard policy:
 *   - learn CN only
 *   - FACT-FR / FR source sheets are ignored before candidate generation
 *   - legacy learning requires deterministic source closure; ambiguous rows are skipped
 */
(function(g){'use strict';

const VERSION='11.0.8';
const dec=new TextDecoder();
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
const upper=v=>clean(v).toUpperCase();
const baseReviewedSku=v=>clean(v).replace(/\s*(?:\*|x|×)\s*\d+(?:[.,]\d+)?\s*$/i,'').trim();
function reviewedBusinessRankV1051(fileName=''){
 const t=String(fileName||'');
 let date='';
 const y=t.match(/(?:^|[_\-\s])(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?:[_\-\s.]|$)/);
 if(y)date=`${y[1]}-${String(Number(y[2])).padStart(2,'0')}-${String(Number(y[3])).padStart(2,'0')}`;
 if(!date){
  const d=t.match(/(?:^|[_\-\s])(\d{1,2})[-_.](\d{1,2})[-_.](\d{2,4})(?:[_\-\s.]|$)/);
  if(d){let yy=Number(d[3]);if(yy<100)yy+=2000;date=`${yy}-${String(Number(d[2])).padStart(2,'0')}-${String(Number(d[1])).padStart(2,'0')}`;}
 }
 const om=[...t.matchAll(/(?:order|commande|cmd)[-_.\s#]*(\d{1,12})/gi)].map(m=>Number(m[1])).filter(Number.isFinite);
 return {businessDate:date,latestOrderNumber:om.length?Math.max(...om):0,reviewedAt:new Date().toISOString()};
}
const restoreInternalKey=v=>String(v??'').replace(/\\u(0002|0003)/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));
function provenanceOrigin(p={}){
 const raw=upper(p.origin);
 if(['CN','CHINA','CHINE','中国'].includes(raw))return'CN';
 if(['FR','FRANCE','法国'].includes(raw))return'FR';
 const hay=[p.origin,p.workbook,p.sourceSheet,p.shortDescription].map(x=>String(x||'')).join(' ');
 if(/法国仓|FRANCE\s*WAREHOUSE|WAREHOUSE\s*FR|ENTREP[OÔ]T\s*FR/i.test(hay))return'FR';
 if(/SHIPSTER|\bJJ\b|中国仓|CHINA\s*WAREHOUSE|\bCN\b/i.test(hay))return'CN';
 return'UNKNOWN';
}
const finite=v=>(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))?null:Number(v);
const unesc=s=>String(s)
  .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
  .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

function xmlTag(name){return`(?:[A-Za-z_][\\w.-]*:)?${name}`}
function xmlAttr(attrs,name){
  const m=new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`,'i').exec(String(attrs||''));
  return m?m[2]:'';
}
function sharedStrings(map){
  const b=map.get('xl/sharedStrings.xml');if(!b)return[];
  const x=dec.decode(b),si=new RegExp(`<${xmlTag('si')}\\b[^>]*>([\\s\\S]*?)<\\/${xmlTag('si')}>`,'gi');
  return [...x.matchAll(si)].map(m=>{
    const tr=new RegExp(`<${xmlTag('t')}\\b[^>]*>([\\s\\S]*?)<\\/${xmlTag('t')}>`,'gi');
    return unesc([...m[1].matchAll(tr)].map(x=>x[1]).join(''));
  });
}
function cellValue(cell,ss){
  const open=/<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)/i.exec(cell);
  const type=xmlAttr(open?.[1]||'','t').toLowerCase();
  if(type==='inlinestr'){
    const tr=new RegExp(`<${xmlTag('t')}\\b[^>]*>([\\s\\S]*?)<\\/${xmlTag('t')}>`,'gi');
    return unesc([...cell.matchAll(tr)].map(m=>m[1]).join(''));
  }
  const vr=new RegExp(`<${xmlTag('v')}\\b[^>]*>([\\s\\S]*?)<\\/${xmlTag('v')}>`,'i');
  const v=vr.exec(cell)?.[1]??'';
  if(type==='s')return ss[Number(v)]??'';
  if(type==='b')return v==='1';
  const n=Number(v);return v!==''&&Number.isFinite(n)?n:unesc(v);
}
function matrix(xml,ss){
  const out=[],rowRe=new RegExp(`<${xmlTag('row')}\\b([^>]*)>([\\s\\S]*?)<\\/${xmlTag('row')}>`,'gi');
  for(const rm of xml.matchAll(rowRe)){
    const ri=Number(xmlAttr(rm[1],'r'))-1;if(!Number.isFinite(ri)||ri<0)continue;
    const row=out[ri]||[],cellRe=new RegExp(`<${xmlTag('c')}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${xmlTag('c')}>)`,'gi');
    for(const cm of rm[2].matchAll(cellRe)){
      const ref=/^([A-Za-z]+)(\d+)$/.exec(xmlAttr(cm[1],'r'));if(!ref)continue;
      let ci=0;for(const ch of ref[1].toUpperCase())ci=ci*26+(ch.charCodeAt(0)-64);
      row[ci-1]=cellValue(cm[0],ss);
    }
    out[ri]=row;
  }
  return out;
}
function normalizeTarget(t=''){
  return t.startsWith('/xl/')?t.slice(1):(t.startsWith('xl/')?t:'xl/'+t.replace(/^\//,''));
}
function locateSheets(map){
  const w=dec.decode(map.get('xl/workbook.xml')||new Uint8Array());
  const r=dec.decode(map.get('xl/_rels/workbook.xml.rels')||new Uint8Array());
  const rels=g.WRITE_V101_WORKBOOK.rels(r);
  return g.WRITE_V101_WORKBOOK.sheets(w).map(s=>({...s,path:normalizeTarget(rels.get(s.rid)||'')}));
}
function rowsFor(map,sheet,ss){
  const bytes=map.get(sheet.path);return bytes?matrix(dec.decode(bytes),ss):[];
}
function normLabel(v=''){
  return clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[™®©]/g,'').replace(/[^a-z0-9\u4e00-\u9fff]+/g,' ').trim();
}
function canonDesc(v=''){
  return normLabel(v)
    .replace(/\bupsell\b/g,' ')
    .replace(/\bx\s*1\b/g,' ')
    .replace(/\*\s*1\b/g,' ')
    .replace(/\s+/g,' ').trim();
}
function tokens(v=''){
  const stop=new Set(['de','du','des','le','la','les','et','avec','pour','sur','votre','vos','un','une','pack','lot','the','and','of']);
  return new Set(normLabel(v).split(/\s+/).filter(x=>x.length>1&&!stop.has(x)));
}
function similarity(a,b){
  const ca=canonDesc(a),cb=canonDesc(b);if(!ca||!cb)return 0;if(ca===cb)return 1;
  const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;
  let inter=0;for(const x of A)if(B.has(x))inter++;
  const j=inter/(A.size+B.size-inter);
  const containment=(ca.includes(cb)||cb.includes(ca))?1:0;
  const numsA=[...ca.matchAll(/\b\d+\b/g)].map(x=>x[0]),numsB=[...cb.matchAll(/\b\d+\b/g)].map(x=>x[0]);
  const numberAgreement=numsA.length&&numsB.length&&numsA.join(',')===numsB.join(',')?1:0;
  return Math.min(1,.72*j+.18*containment+.10*numberAgreement);
}

function currencyFromRows(rows){
  const hay=rows.slice(0,25).flat().map(clean).join(' ');
  if(/(?:\$|\bUSD\b)/i.test(hay))return'USD';
  if(/(?:£|\bGBP\b)/i.test(hay))return'GBP';
  return'EUR';
}
function findFactHeader(rows){
  for(let i=0;i<Math.min(rows.length,40);i++){
    const labels=(rows[i]||[]).map(normLabel);
    if(labels.some(x=>x.includes('description'))&&labels.some(x=>x.includes('quantity'))){
      const map={headerRow:i};
      labels.forEach((x,j)=>{
        if(x==='no'||x==='n')map.no=j;
        else if(x.includes('description'))map.description=j;
        else if(x.includes('quantity'))map.quantity=j;
        else if(x.includes('cogs shipping'))map.unitTotal=j;
        else if((x.includes('shipping')||x.includes('expedition'))&&!x.includes('cogs'))map.shipping=j;
        else if(x.includes('cogs')&&!x.includes('shipping'))map.cogs=j;
        else if(x.includes('amount')||x.includes('montant'))map.amount=j;
      });
      if(map.no===undefined)map.no=1;
      if(map.description===undefined)map.description=2;
      if(map.quantity===undefined)map.quantity=3;
      return map;
    }
  }
  return null;
}
function parseLegacyFactRows(rows,sheetName=''){
  const h=findFactHeader(rows);if(!h)return[];
  const cur=currencyFromRows(rows),out=[];let country='';
  for(let i=h.headerRow+1;i<rows.length;i++){
    const r=rows[i]||[],no=r[h.no],desc=clean(r[h.description]),q=finite(r[h.quantity]);
    if(typeof no==='string'&&clean(no)&&!desc){country=upper(no);continue}
    if(!Number.isFinite(Number(no))||!desc||desc.toLowerCase()==='total colis')continue;
    out.push({
      sheetName,rowNo:i+1,no:Number(no),country:country||'GLOBAL',description:desc,quantity:q,
      cogs:h.cogs===undefined?null:finite(r[h.cogs]),
      shipping:h.shipping===undefined?null:finite(r[h.shipping]),
      unitTotal:h.unitTotal===undefined?null:finite(r[h.unitTotal]),
      amount:h.amount===undefined?null:finite(r[h.amount]),
      currency:cur,origin:'CN'
    });
  }
  return out;
}

const HEADER_ALIASES={
  orderId:['订单号','order id','order number','order no','commande'],
  amount:['订单金额','order amount','amount','montant'],
  skuLines:['多品名','sku','skus','variant','variants'],
  productNames:['产品名称','product name','product','produit','description'],
  country:['收货人国家','country','destination country','pays'],
  tracking:['运单号','tracking','tracking number','waybill','parcel id'],
  note:['订单备注','拣货备注','客服备注','note','notes','remark','remarks']
};
function findHeader(rows){
  for(let i=0;i<Math.min(rows.length,20);i++){
    const labels=(rows[i]||[]).map(normLabel),map={headerRow:i};
    for(const[k,aliases]of Object.entries(HEADER_ALIASES)){
      const idx=labels.findIndex(x=>aliases.some(a=>String(x||'')===normLabel(a)||String(x||'').includes(normLabel(a))));
      if(idx>=0)map[k]=idx;
    }
    if(map.orderId!==undefined&&map.productNames!==undefined&&map.country!==undefined)return map;
  }
  return null;
}
function splitLines(v=''){return String(v??'').split(/\r?\n+/).map(clean).filter(Boolean)}
function parseSkuQty(v=''){
  const s=clean(v),m=s.match(/^(.*?)(?:\s*\*\s*(\d+(?:[.,]\d+)?))\s*$/);
  return m?{sku:clean(m[1]),quantity:Number(m[2].replace(',','.'))}:{sku:s,quantity:1};
}
function frSignal(rows,h){
  let total=0,fr=0;
  for(let i=h.headerRow+1;i<Math.min(rows.length,h.headerRow+250);i++){
    const r=rows[i]||[];if(!clean(r[h.orderId]))continue;total++;
    const note=[h.note===undefined?'':r[h.note],...r].map(clean).join(' ');
    if(/法国仓库|法国发货|france\s*warehouse|warehouse\s*fr/i.test(note))fr++;
  }
  return total?fr/total:0;
}
function parseLegacyOrders(rows,sheetName=''){
  const h=findHeader(rows);if(!h)return{orders:[],isOrderSheet:false,frRatio:0};
  const ratio=frSignal(rows,h);
  if(/\bFR\b/i.test(sheetName)||ratio>.45)return{orders:[],isOrderSheet:true,frRatio:ratio,ignoredFR:true};
  const orders=[];
  for(let i=h.headerRow+1;i<rows.length;i++){
    const r=rows[i]||[],oid=clean(r[h.orderId]);if(!oid)continue;
    const skuLines=h.skuLines===undefined?[]:splitLines(r[h.skuLines]);
    const productLines=splitLines(r[h.productNames]);
    const n=Math.max(skuLines.length,productLines.length,1),lineItems=[];
    for(let k=0;k<n;k++){
      const skuRaw=skuLines[k]??(skuLines.length===1?skuLines[0]:'');
      const product=productLines[k]??(productLines.length===1?productLines[0]:skuRaw);
      const sq=parseSkuQty(skuRaw);
      lineItems.push({sku:sq.sku,productName:product||sq.sku||'Article',quantity:sq.quantity});
    }
    orders.push({
      orderId:oid,trackingNumber:h.tracking===undefined?'':clean(r[h.tracking]),
      destinationCountry:upper(r[h.country])||'GLOBAL',fulfillmentOrigin:'CN',
      currency:'EUR',lineItems,sourceSheet:sheetName,sourceRow:i+1,sourceFile:'LEGACY_REVIEWED_WORKBOOK'
    });
  }
  return{orders,isOrderSheet:true,frRatio:ratio,ignoredFR:false};
}

function newFactRows(rows){
  let country='';const by=new Map(),byNo=new Map(),all=[];
  for(const r of rows){
    const b=r?.[1],c=r?.[2],d=r?.[3];
    if(typeof b==='string'&&b&&!clean(c)&&(d==null||d==='')){country=upper(b)||'GLOBAL';continue}
    if(Number.isFinite(Number(b))&&clean(c)){
      const x={country:upper(country)||'GLOBAL',no:Number(b),description:clean(c),quantity:finite(d),cogs:finite(r?.[4]),shipping:finite(r?.[5]),unitTotal:finite(r?.[6]),amount:finite(r?.[7])};
      if(x.description.toLowerCase()!=='total colis'){all.push(x);by.set(`${x.country}\u0001${x.no}`,x);if(!byNo.has(x.no))byNo.set(x.no,x);else byNo.set(x.no,null)}
    }
  }
  return{all,by,byNo};
}
function parseProv(rows){
  if(String(rows?.[0]?.[0]||'')!=='WRITE_LEARNING_SOURCE_V1')throw new Error('INVALID_PROVENANCE');
  const h=rows[0].map(String);
  return rows.slice(1).filter(r=>r?.some(v=>v!==''&&v!=null))
    .map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])));
}

function representativeComponents(items=[]){
  const groups=new Map();
  for(const p of items||[]){const oid=clean(p.orderId)||'__NO_ORDER__';if(!groups.has(oid))groups.set(oid,[]);groups.get(oid).push(p)}
  const list=[...groups.values()][0]||[],m=new Map();
  for(const p of list){
    const sku=baseReviewedSku(p.sku),productName=clean(p.productName||p.rawProductName||p.shortDescription),key=sku?'sku:'+sku.toLowerCase():'name:'+normLabel(productName);
    if(!key.replace(/^(sku:|name:)$/,''))continue;
    const q=Math.max(0,Number(p.multiplicity||p.quantity||1)||0);if(!q)continue;
    const x=m.get(key)||{sku,productName,quantity:0};x.quantity+=q;m.set(key,x)
  }
  return [...m.values()]
}
function reviewedGoodsCogs(spec={}){
  const c=finite(spec.cogs);if(c!==null)return c;
  const u=finite(spec.unitTotal),sh=finite(spec.shipping);return u!==null&&sh!==null?u-sh:null
}

async function learnExact(spec,items,fileName){
  const businessRank=reviewedBusinessRankV1051(fileName);spec={...spec,...businessRank};
  let factRules=0,productRules=0,costRules=0,componentEquations=0,componentCostRules=0,conflicts=0,alreadyLearned=0,newRules=0,ruleIds=[];
  const count=result=>{
    const rid=String(result?.ruleId||result?.rule?.ruleId||'');if(rid&&!ruleIds.includes(rid))ruleIds.push(rid);
    if(result?.conflict){conflicts++;return'conflict'}
    if(result?.unchanged||result?.alreadyLearned){alreadyLearned++;return'already'}
    if(result){newRules++;return'new'}
    return'none'
  };
  const fr=await g.WRITE_KB.learnReviewedFact(spec,true);if(count(fr)==='new')factRules++;
  const components=representativeComponents(items),goodsCogs=reviewedGoodsCogs(spec);
  if(components.length&&Number.isFinite(goodsCogs)&&g.WRITE_KB?.learnComponentCostEquation){
    const er=await g.WRITE_KB.learnComponentCostEquation({origin:'CN',country:spec.country,currency:spec.currency,components,totalCogs:goodsCogs,configurationFingerprint:spec.configurationFingerprint,sourceFile:fileName,...businessRank},true).catch(()=>null);
    if(er){componentEquations++;componentCostRules+=Number(er.solved?.learned)||0}
  }
  // V10.4.0: Configuration total remains FACT semantic evidence only.
  // SKU COGS and per-package fee are learned independently.
  for(const p of items||[]){
    if(!clean(p.productName||p.rawProductName)&&!clean(p.sku))continue;
    const pr=await g.WRITE_KB.learnReviewedProduct({
      productName:clean(p.productName||p.rawProductName),sku:baseReviewedSku(p.sku),family:clean(p.family),role:clean(p.role),
      normalizedDescription:clean(p.normalizedDescription||p.shortDescription),
      approvedFactDescription:spec.description,country:spec.country,origin:'CN',currency:spec.currency,
      configurationFingerprint:spec.configurationFingerprint,sourceFile:fileName,...businessRank
    },true);
    if(count(pr)==='new')productRules++;
  }
  return{factRules,productRules,costRules,componentEquations,componentCostRules,conflicts,alreadyLearned,newRules,ruleIds};
}
function addCounts(a,b){for(const k of['factRules','productRules','costRules','componentEquations','componentCostRules','conflicts','alreadyLearned','newRules'])a[k]=(a[k]||0)+(b[k]||0);a.ruleIds=[...new Set([...(a.ruleIds||[]),...(b.ruleIds||[])])];return a}

async function importNewCN(file,map,ss,sheets){
  const factS=sheets.find(s=>upper(s.name)==='FACT')||sheets.find(s=>/FACT/i.test(s.name)&&!/FR/i.test(s.name));
  const provS=sheets.find(s=>s.name==='WRITE_LEARNING_SOURCE');
  if(!factS||!provS)throw new Error('NEW_CN_STRUCTURE_MISSING');
  const facts=newFactRows(rowsFor(map,factS,ss)),prov=parseProv(rowsFor(map,provS,ss)),groups=new Map();
  for(const p of prov){
    const origin=provenanceOrigin(p);
    if(origin==='FR')continue;
    if(origin!=='CN'&&(!clean(p.configurationFingerprint)||!Number.isFinite(Number(p.factNo))))continue;
    const key=`${upper(p.factCountry)||'GLOBAL'}\u0001${Number(p.factNo)}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
  }
  const totals={factRules:0,productRules:0,costRules:0,componentEquations:0,componentCostRules:0,conflicts:0,alreadyLearned:0,newRules:0,ruleIds:[]},seen=new Set();let unmatched=0;
  for(const[key,items]of groups){
    const f=facts.by.get(key)||facts.byNo.get(Number(items?.[0]?.factNo));if(!f){unmatched++;continue}
    const h=items[0],unit=Number.isFinite(f.unitTotal)?f.unitTotal:
      (Number.isFinite(f.cogs)&&Number.isFinite(f.shipping)?f.cogs+f.shipping:null);
    const spec={invoiceEntity:clean(h.invoiceEntity)||'DEFAULT',origin:'CN',country:upper(h.factCountry)||upper(f.country)||'GLOBAL',
      currency:upper(h.currency)||'EUR',taxRegime:clean(h.taxRegime)||'UNSPECIFIED',role:clean(h.role)||'PACKAGE',
      configurationFingerprint:restoreInternalKey(clean(h.configurationFingerprint)),description:f.description,cogs:f.cogs,shipping:f.shipping,
      unitTotal:unit,amount:f.amount,quantity:f.quantity,sourceFile:file.name};
    if(!spec.configurationFingerprint){unmatched++;continue}
    addCounts(totals,await learnExact(spec,items,file.name));seen.add(key);
  }
  return{mode:'NEW_CN',...totals,factRows:facts.all.length,cnGroups:groups.size,unmatched,ignoredFR:prov.length-[...groups.values()].reduce((n,x)=>n+x.length,0)};
}

function alignLegacy(humanRows,predictedRows){
  const candidates=[],used=new Set();
  for(const f of humanRows){
    if(!Number.isFinite(f.quantity))continue; // quantity closure required
    const pool=predictedRows.filter((p,idx)=>!used.has(idx)&&upper(p.origin)==='CN'&&upper(p.country)===upper(f.country)&&
      Number.isFinite(Number(p.quantity))&&Math.abs(Number(p.quantity)-f.quantity)<1e-9);
    if(!pool.length)continue;
    const scored=pool.map(p=>({p,score:similarity(f.description,p.description)})).sort((a,b)=>b.score-a.score);
    const best=scored[0],second=scored[1];
    const exact=canonDesc(f.description)===canonDesc(best.p.description);
    if(!(exact||best.score>=.58))continue;
    if(second&&!exact&&best.score-second.score<.12)continue;
    const realIndex=predictedRows.indexOf(best.p);used.add(realIndex);
    candidates.push({fact:f,predicted:best.p,score:exact?1:best.score});
  }
  return candidates;
}
async function importLegacyCN(file,map,ss,sheets){
  const explicitCNFacts=sheets.filter(s=>/FACT/i.test(s.name)&&/CN/i.test(s.name)&&!/FR/i.test(s.name));
  const genericFacts=sheets.filter(s=>/^FACT(?:\b|\s|-|_)/i.test(s.name)&&!/FR/i.test(s.name));
  const factSheets=explicitCNFacts.length?explicitCNFacts:genericFacts;
  if(!factSheets.length)throw new Error('旧版文件未找到可学习的 CN FACT');
  const human=factSheets.flatMap(s=>parseLegacyFactRows(rowsFor(map,s,ss),s.name));
  const orders=[];let ignoredFRSheets=0,orderSheets=0;
  for(const s of sheets){
    if(/FACT/i.test(s.name))continue;
    const parsed=parseLegacyOrders(rowsFor(map,s,ss),s.name);
    if(!parsed.isOrderSheet)continue;orderSheets++;
    if(parsed.ignoredFR){ignoredFRSheets++;continue}
    orders.push(...parsed.orders);
  }
  if(!orders.length)throw new Error('旧版 CN FACT 没有找到可闭环的 CN 订单源 Sheet');
  if(!g.WRITE_V10_PRODUCTION?.build)throw new Error('V10 production engine 未加载，无法做旧版闭环学习');
  const built=g.WRITE_V10_PRODUCTION.build(orders);
  const predicted=(built.rows||[]).filter(r=>upper(r.origin)==='CN');
  const matches=alignLegacy(human,predicted);
  const totals={factRules:0,productRules:0,costRules:0,componentEquations:0,componentCostRules:0,conflicts:0,alreadyLearned:0,newRules:0,ruleIds:[]};
  for(const m of matches){
    const f=m.fact,p=m.predicted,unit=Number.isFinite(f.unitTotal)?f.unitTotal:
      (Number.isFinite(f.cogs)&&Number.isFinite(f.shipping)?f.cogs+f.shipping:null);
    const spec={invoiceEntity:p.invoiceEntity||'DEFAULT',origin:'CN',country:upper(p.country),currency:p.currency||f.currency||'EUR',
      taxRegime:p.taxRegime||'UNSPECIFIED',role:p.role||'PACKAGE',configurationFingerprint:p.configurationFingerprint,
      description:f.description,cogs:f.cogs,shipping:f.shipping,unitTotal:unit,amount:f.amount,quantity:f.quantity,sourceFile:file.name};
    addCounts(totals,await learnExact(spec,p.rawEvidence||[],file.name));
  }
  return{mode:'LEGACY_CN',...totals,factRows:human.length,orderSheets,sourceOrders:orders.length,
    predictedRows:predicted.length,matchedRows:matches.length,unmatched:Math.max(0,human.filter(x=>Number.isFinite(x.quantity)).length-matches.length),
    ignoredFRSheets,hardSourcePass:!!built.audit?.hardPass};
}

async function importReviewedWorkbook(file,options={}){
  await g.WRITE_KB?.init?.();
  const map=await g.WRITE_V101_WORKBOOK.readZip(file),ss=sharedStrings(map),sheets=locateSheets(map);
  const hasProv=sheets.some(s=>s.name==='WRITE_LEARNING_SOURCE');
  const result=hasProv?await importNewCN(file,map,ss,sheets):await importLegacyCN(file,map,ss,sheets);
  if(!options.skipSync)await g.WRITE_KB.sync?.({force:true}).catch(()=>{});
  window.dispatchEvent(new CustomEvent('write-kb-updated',{detail:result}));
  return result;
}

// UI is intentionally owned by review-learning-hero-v1011.js to avoid duplicate input listeners.
g.WRITE_V101_REVIEW_LEARNING={
  VERSION,importReviewedWorkbook,importNewCN,importLegacyCN,
  _test:{matrix,locateSheets,parseLegacyFactRows,parseLegacyOrders,alignLegacy,similarity,canonDesc}
};
})(window);
