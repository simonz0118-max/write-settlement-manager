/* WRITE V10.6.3 — authoritative export selection controller. Workflow/UI only. */
(function(g){'use strict';
const VERSION='10.6.3';
const OPTIONAL=['01_结算总览','02_订单明细','03_商品汇总','04_审计记录'];
const EXPORT_IDS=new Set(['heroExportButton','topExportButton','quickExportButton','landingExportButton','exportButton']);
const enc=new TextEncoder(),dec=new TextDecoder();
const pathOf=t=>t.startsWith('/xl/')?t.slice(1):(t.startsWith('xl/')?t:'xl/'+t.replace(/^\//,''));
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function chooseSheets(){return new Promise(resolve=>{
 const old=document.getElementById('v1063ExportBackdrop');if(old)old.remove();
 const wrap=document.createElement('div');wrap.id='v1063ExportBackdrop';wrap.className='v1063-export-backdrop';
 wrap.innerHTML=`<section class="v1063-export-dialog" role="dialog" aria-modal="true" aria-labelledby="v1063ExportTitle"><h2 id="v1063ExportTitle">选择导出内容</h2><p>FACT 为结算与人工审核主表，默认必须生成。其他页面按需要勾选；未勾选的页面不会出现在 Excel 中。</p><div class="v1063-sheet-list"><label class="v1063-sheet-row is-required"><input type="checkbox" checked disabled><b>FACT</b><small>默认必选</small></label>${OPTIONAL.map(x=>`<label class="v1063-sheet-row"><input type="checkbox" data-sheet="${esc(x)}"><b>${esc(x)}</b><small>可选</small></label>`).join('')}</div><div class="v1063-export-actions"><button type="button" data-act="cancel">取消</button><button type="button" class="primary" data-act="export">导出 Excel</button></div></section>`;
 document.body.appendChild(wrap);
 const done=v=>{wrap.remove();resolve(v)};
 wrap.addEventListener('click',e=>{if(e.target===wrap)done(null);const a=e.target.closest('[data-act]');if(!a)return;if(a.dataset.act==='cancel')done(null);else{const selected=['FACT',...Array.from(wrap.querySelectorAll('[data-sheet]:checked')).map(x=>x.dataset.sheet)];done(selected)}});
 const key=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',key,true);done(null)}};document.addEventListener('keydown',key,true);
 })}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2500)}
async function pruneWorkbook(blob,selected){
 const W=g.WRITE_V101_WORKBOOK;if(!W?.readZip||!W?.writeZip||!W?.sheets||!W?.rels)throw new Error('工作簿组件尚未加载');
 const map=await W.readZip(blob);let wb=dec.decode(map.get('xl/workbook.xml')),rx=dec.decode(map.get('xl/_rels/workbook.xml.rels')),ct=dec.decode(map.get('[Content_Types].xml'));const rels=W.rels(rx),all=W.sheets(wb),wanted=new Set([...selected,'WRITE_LEARNING_SOURCE']);
 const keep=[],drop=[];for(const sh of all){const p=pathOf(rels.get(sh.rid)||'');if(wanted.has(sh.name))keep.push({...sh,path:p});else drop.push({...sh,path:p})}
 if(!keep.some(x=>x.name==='FACT'))throw new Error('FACT 工作表不存在');
 for(const x of drop)if(x.path)map.delete(x.path);
 wb=wb.replace(/<sheets>[\s\S]*?<\/sheets>/,`<sheets>${keep.map(s=>`<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="${esc(s.name)}" sheetId="${s.id}"${s.name==='WRITE_LEARNING_SOURCE'?' state="veryHidden"':''} r:id="${s.rid}"/>`).join('')}</sheets>`);
 const keepR=new Set(keep.map(x=>x.rid));rx=rx.replace(/<Relationship\b[^>]*Id="([^"]+)"[^>]*\/>/g,(a,id)=>(/worksheets\//.test(a)&&!keepR.has(id))?'':a);
 const dropPaths=new Set(drop.map(x=>'/'+x.path).filter(Boolean));ct=ct.replace(/<Override\b[^>]*PartName="([^"]+)"[^>]*\/>/g,(a,p)=>dropPaths.has(p)?'':a);
 map.set('xl/workbook.xml',enc.encode(wb));map.set('xl/_rels/workbook.xml.rels',enc.encode(rx));map.set('[Content_Types].xml',enc.encode(ct));return W.writeZip(map)
}
async function exportSelected(){
 const selected=await chooseSheets();if(!selected)return {cancelled:true};
 const api=g.WRITE_V10_EXPORT,books=g.WRITE_V8_SOURCE_BRIDGE?.()?.sourceWorkbooks||[];if(!api?.buildUnified)throw new Error('正式导出组件尚未加载');if(!books.length)throw new Error('没有可导出的订单工作簿');
 const files=[];for(const w of books){const r=await api.buildUnified(w.name),blob=await pruneWorkbook(r.blob,selected),suffix=selected.length===1?'FACT':'自选报表',safe=String(w.name||'ORDERS').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_.-]+/gu,'_').slice(0,90),name=`WRITE_结算_${suffix}_${safe}_${new Date().toISOString().slice(0,10)}.xlsx`;download(blob,name);files.push(name)}
 return{selected,workbooks:books.length,files}
}
function intercept(e){const b=e.target?.closest?.('button');if(!b||!EXPORT_IDS.has(b.id)||b.disabled)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();exportSelected().catch(err=>{console.error('[WRITE V10.6.3 export]',err);alert('导出失败：'+(err?.message||err))})}
function boot(){document.addEventListener('click',intercept,true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
g.WRITE_V1063_EXPORT_SELECTION={VERSION,OPTIONAL,chooseSheets,pruneWorkbook,exportSelected};
})(window);
