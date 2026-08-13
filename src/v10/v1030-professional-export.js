/* WRITE V10.3.1 — invoice/statistics integrity hotfix */
(function(g){'use strict';
const VERSION='10.3.1',enc=new TextEncoder(),dec=new TextDecoder();
const reEsc=s=>String(s??'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function styleOf(x,ref){return /\bs="(\d+)"/.exec((new RegExp(`<c\\b[^>]*\\br="${reEsc(ref)}"[^>]*>`)).exec(x)?.[0]||'')?.[1]||''}
function rowBlocks(x){return [...x.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)].map(m=>({raw:m[0],row:+m[1],index:m.index}))}
function cleanFactSummary(x){
  const rows=rowBlocks(x);
  const marker=rows.find(r=>r.raw.includes('PRODUCT SALES SUMMARY / 商品销售统计'));
  if(!marker)return x;
  return x.replace(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g,(raw,n)=>+n>=marker.row?'':raw);
}
function pathOf(t){return t.startsWith('/xl/')?t.slice(1):(t.startsWith('xl/')?t:'xl/'+t.replace(/^\//,''))}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function col(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function cell(ref,v,st=''){const a=st?` s="${st}"`:'';if(v==null||v==='')return `<c r="${ref}"${a}/>`;if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"${a}><v>${v}</v></c>`;return `<c r="${ref}"${a} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`}
function simpleStyledSheet(rows,styles){
  let body='';rows.forEach((r,i)=>{const rn=i+1,st=rn===1?styles.head:styles.body;body+=`<row r="${rn}">${r.map((v,j)=>cell(col(j+1)+rn,v,st)).join('')}</row>`});
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="7" width="16" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>`
}
function productSummaryRows(res){
  const s=Array.isArray(res?.productSalesSummary)?res.productSalesSummary:[];
  return [['产品','SKU','销售数量','赠品数量','总件数','其中多商品订单','涉及订单'],
    ...s.map(x=>[x.product||'',x.sku||'',Number(x.paidQty)||0,Number(x.giftQty)||0,Number(x.totalQty)||0,Number(x.multiItemQty)||0,Number(x.involvedOrders)||0])];
}
function totals(res){
  const s=Array.isArray(res?.productSalesSummary)?res.productSalesSummary:[];
  const total=s.reduce((a,x)=>a+(Number(x.totalQty)||0),0);
  const gifts=s.reduce((a,x)=>a+(Number(x.giftQty)||0),0);
  const paid=s.reduce((a,x)=>a+(Number(x.paidQty)||0),0);
  const reviewOrders=new Set();
  for(const r of (res?.rows||[]))if(r?.needsReview)for(const id of (r.sourceOrderKeys||[]))if(id)reviewOrders.add(String(id));
  return {total,gifts,paid,review:reviewOrders.size};
}
function replaceOverviewMetric(x,label,value){
  return x.replace(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g,(raw,rn)=>{
    if(!raw.includes(`>${label}<`))return raw;
    const ref=`B${rn}`,re=new RegExp(`<c\\b([^>]*\\br="${ref}"[^>]*)>([\\s\\S]*?)<\\/c>`);
    if(re.test(raw))return raw.replace(re,`<c $1><v>${Number(value)||0}</v></c>`);
    return raw.replace('</row>',`${cell(ref,Number(value)||0)}</row>`);
  });
}
function styleAccounting(x,styles,overview=false){
  return x.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g,(all,a,c,r)=>{
    if(/\bs="\d+"/.test(a))return all;
    r=+r;const st=overview?(r===1?styles.title:(r===4?styles.head:styles.body)):(r===1?styles.head:styles.body);
    return st?`<c ${a} s="${st}">`:all;
  });
}
function polish(map,W,res){
  let wb=dec.decode(map.get('xl/workbook.xml')),relsXml=dec.decode(map.get('xl/_rels/workbook.xml.rels')),ct=dec.decode(map.get('[Content_Types].xml'));
  const rels=W.rels(relsXml),all=W.sheets(wb),fact=all.find(s=>String(s.name).toUpperCase()==='FACT')||all[0];if(!fact)return;
  const fp=pathOf(rels.get(fact.rid)||'');if(!map.has(fp))return;
  let fx=cleanFactSummary(dec.decode(map.get(fp)));map.set(fp,enc.encode(fx));
  const styles={title:styleOf(fx,'B8')||styleOf(fx,'B2'),head:styleOf(fx,'B10')||styleOf(fx,'B9'),body:styleOf(fx,'B12')||styleOf(fx,'B11')};
  const keepMap=new Map([['FACT','FACT'],['01_结算总览','01_结算总览'],['05_订单明细','02_订单明细'],['06_商品汇总','03_商品汇总'],['90_订单审计','04_审计记录'],['WRITE_LEARNING_SOURCE','WRITE_LEARNING_SOURCE']]);
  const keep=[];
  for(const sh of all){
    const nn=keepMap.get(sh.name),p=pathOf(rels.get(sh.rid)||'');
    if(nn){
      keep.push({...sh,newName:nn});
      if(map.has(p)&&sh.name==='01_结算总览'){
        let x=dec.decode(map.get(p)),t=totals(res);
        x=replaceOverviewMetric(x,'商品件数',t.total);
        x=replaceOverviewMetric(x,'赠品件数',t.gifts);
        x=replaceOverviewMetric(x,'待复核订单',t.review);
        map.set(p,enc.encode(styleAccounting(x,styles,true)));
      }else if(map.has(p)&&sh.name==='06_商品汇总'){
        map.set(p,enc.encode(simpleStyledSheet(productSummaryRows(res),styles)));
      }else if(map.has(p)&&sh.name!=='FACT'&&sh.name!=='WRITE_LEARNING_SOURCE'){
        map.set(p,enc.encode(styleAccounting(dec.decode(map.get(p)),styles,false)));
      }
    }else if(p)map.delete(p);
  }
  wb=wb.replace(/<sheets>[\s\S]*?<\/sheets>/,`<sheets>${keep.map(s=>`<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="${s.newName}" sheetId="${s.id}"${s.newName==='WRITE_LEARNING_SOURCE'?' state="veryHidden"':''} r:id="${s.rid}"/>`).join('')}</sheets>`);
  const keepRids=new Set(keep.map(s=>s.rid));
  relsXml=relsXml.replace(/<Relationship\b[^>]*Id="([^"]+)"[^>]*\/>/g,(a,id)=>(/worksheets\//.test(a)&&!keepRids.has(id))?'':a);
  const keepPaths=new Set(keep.map(s=>'/'+pathOf(rels.get(s.rid)||'')));
  ct=ct.replace(/<Override\b[^>]*PartName="(\/xl\/worksheets\/sheet\d+\.xml)"[^>]*\/>/g,(a,p)=>keepPaths.has(p)?a:'');
  map.set('xl/workbook.xml',enc.encode(wb));map.set('xl/_rels/workbook.xml.rels',enc.encode(relsXml));map.set('[Content_Types].xml',enc.encode(ct));
}
function patchWorkbook(){
  const W=g.WRITE_V101_WORKBOOK;if(!W?.mergeFactAndAccounting||W.__v1031)return;
  const base=W.mergeFactAndAccounting.bind(W);
  W.mergeFactAndAccounting=async function(f,a,res,n){const blob=await base(f,a,res,n),m=await W.readZip(blob);polish(m,W,res);return W.writeZip(m)};
  W.__v1031=true;
}
function fixNav(){
  const root=document.getElementById('sideNav');if(!root)return;
  try{root.__v1029?.disconnect?.();root.__v1029=null}catch{}
  document.getElementById('v1029NavStyle')?.remove();
  document.querySelector('style[data-v1026-menu-style]')?.remove();
  const n=root.querySelector('.nav-item[data-view="learning"]');if(!n)return;
  n.replaceChildren();
  const i=document.createElement('span');i.className='v1031-nav-icon';i.textContent='⌘';
  const l=document.createElement('span');l.className='v1031-nav-label';l.textContent='数据管理';
  n.append(i,l);n.title='数据管理';n.setAttribute('aria-label','数据管理');
}
function boot(){patchWorkbook();fixNav();setTimeout(()=>{patchWorkbook();fixNav()},300)}
if(typeof document!=='undefined'){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot()}else patchWorkbook();
g.WRITE_V1031={VERSION,_test:{rowBlocks,cleanFactSummary,productSummaryRows,totals,replaceOverviewMetric}};
})(typeof window!=='undefined'?window:globalThis);
