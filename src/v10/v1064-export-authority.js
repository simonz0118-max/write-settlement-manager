/* WRITE V10.6.4 - single export authority; UI/workflow only */
(function(g){'use strict';
const VERSION='10.6.4';
const OPTIONAL=['01_结算总览','02_订单明细','03_商品汇总','04_审计记录'];
const IDS=['heroExportButton','topExportButton','quickExportButton','landingExportButton','exportButton'];
function chooseSheets(){return new Promise(resolve=>{
 document.getElementById('v1064ExportBackdrop')?.remove();
 const d=document.createElement('div');d.id='v1064ExportBackdrop';d.className='v1064-export-backdrop';
 d.innerHTML=`<section class="v1064-export-dialog"><div class="v1064-kicker">WRITE SETTLEMENT MANAGER</div><h2>选择导出内容</h2><p>FACT 固定生成，其他页面按需要勾选。</p><div class="v1064-list"><label class="required"><input checked disabled type="checkbox"><span><b>FACT</b><small>结算发票主表</small></span><i>必选</i></label>${OPTIONAL.map(x=>`<label><input type="checkbox" data-sheet="${x}"><span><b>${x}</b><small>附加统计页面</small></span><i>可选</i></label>`).join('')}</div><footer><button data-a="cancel">取消</button><button class="primary" data-a="go">生成 Excel</button></footer></section>`;
 document.body.appendChild(d);
 const done=v=>{d.remove();resolve(v)};
 d.onclick=e=>{if(e.target===d)return done(null);let a=e.target.closest('[data-a]');if(!a)return;if(a.dataset.a==='cancel')return done(null);done(['FACT',...Array.from(d.querySelectorAll('[data-sheet]:checked')).map(x=>x.dataset.sheet)])};
});}
async function exportSelected(){
 const selected=await chooseSheets(); if(!selected)return;
 const api=g.WRITE_V10_EXPORT, books=g.WRITE_V8_SOURCE_BRIDGE?.()?.sourceWorkbooks||[];
 if(!api?.buildUnified)throw Error('正式导出组件尚未加载'); if(!books.length)throw Error('没有可导出的订单');
 for(const w of books){
   const r=await api.buildUnified(w.name);
   const W=g.WRITE_V101_WORKBOOK;if(!W?.readZip||!W?.writeZip)throw Error('工作簿组件尚未加载');
   const enc=new TextEncoder(),dec=new TextDecoder(),map=await W.readZip(r.blob);
   let wb=dec.decode(map.get('xl/workbook.xml')), relxml=dec.decode(map.get('xl/_rels/workbook.xml.rels')), ct=dec.decode(map.get('[Content_Types].xml'));
   const rels=W.rels(relxml), all=W.sheets(wb), wanted=new Set([...selected,'WRITE_LEARNING_SOURCE']), keep=[],drop=[];
   for(const s of all){let p=rels.get(s.rid)||'';p=p.startsWith('/')?p.slice(1):(p.startsWith('xl/')?p:'xl/'+p);(wanted.has(s.name)?keep:drop).push({...s,path:p})}
   if(!keep.some(x=>x.name==='FACT'))throw Error('FACT 工作表不存在');
   for(const x of drop)map.delete(x.path);
   const esc=x=>String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
   wb=wb.replace(/<sheets>[\s\S]*?<\/sheets>/,`<sheets>${keep.map(s=>`<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="${esc(s.name)}" sheetId="${s.id}"${s.name==='WRITE_LEARNING_SOURCE'?' state="veryHidden"':''} r:id="${s.rid}"/>`).join('')}</sheets>`);
   const kr=new Set(keep.map(x=>x.rid));relxml=relxml.replace(/<Relationship\b[^>]*Id="([^"]+)"[^>]*\/>/g,(a,id)=>(/worksheets\//.test(a)&&!kr.has(id))?'':a);
   const dp=new Set(drop.map(x=>'/'+x.path));ct=ct.replace(/<Override\b[^>]*PartName="([^"]+)"[^>]*\/>/g,(a,p)=>dp.has(p)?'':a);
   map.set('xl/workbook.xml',enc.encode(wb));map.set('xl/_rels/workbook.xml.rels',enc.encode(relxml));map.set('[Content_Types].xml',enc.encode(ct));
   const blob=await W.writeZip(map),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`WRITE_结算_${selected.length===1?'FACT':'自选报表'}_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
 }
}
function takeover(){
 for(const id of IDS){const old=document.getElementById(id);if(!old||old.dataset.v1064==='1')continue;const n=old.cloneNode(true);n.dataset.v1064='1';old.replaceWith(n);n.addEventListener('click',async e=>{if(n.disabled)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();try{await exportSelected()}catch(x){console.error(x);alert('导出失败：'+x.message)}},true);}
}
function wrap(){const a=g.WRITE_V10_EXPORT;if(!a||a.__v1064)return;const legacy=a.downloadProductionPackage?.bind(a);a.__v1064Legacy=legacy;a.downloadProductionPackage=()=>exportSelected();a.__v1064=true;}
function boot(){document.body.dataset.exportAuthority='v10.6.4';takeover();wrap();new MutationObserver(()=>{takeover();wrap()}).observe(document.documentElement,{childList:true,subtree:true});setInterval(()=>{takeover();wrap()},500)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
g.WRITE_V1064_EXPORT_AUTHORITY={VERSION,OPTIONAL,chooseSheets,exportSelected,takeover};
})(window);
