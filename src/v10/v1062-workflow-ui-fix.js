/* WRITE V10.6.2 — Workflow + UI Closure. UI/workflow controller only. */
(function(g){'use strict';
const VERSION='10.6.2';
const $=s=>document.querySelector(s);
const byId=id=>document.getElementById(id);
function cloneClean(el){if(!el)return null;const c=el.cloneNode(true);for(const k of [...c.attributes].map(a=>a.name)){if(k.startsWith('data-v1050'))c.removeAttribute(k)}el.replaceWith(c);return c}
function sameHero(){
 const hero=$('[data-view-panel="dashboard"] .dashboard-hero .hero-copy');
 if(!hero)return;
 const eye=hero.querySelector('.eyebrow');if(eye)eye.textContent='WRITE SETTLEMENT MANAGER';
 const h=hero.querySelector('h1');if(h)h.innerHTML='让结算<em>更简单</em>';
 const p=hero.querySelector(':scope > p');if(p)p.textContent='订单已处理完成。继续导出统计、重新导入或读取审核数据。';
}
function forceCollapsed(){const shell=$('.app-shell');if(shell)shell.classList.add('sidebar-collapsed')}
function bindSidebar(){
 const shell=$('.app-shell'),side=$('.sidebar'),old=byId('v106SidebarToggle');if(!shell||!side)return;
 forceCollapsed();
 const b=old?cloneClean(old):document.createElement('button');
 if(!old){b.id='v106SidebarToggle';b.className='v106-sidebar-toggle';b.type='button';side.prepend(b)}
 b.textContent='';b.setAttribute('aria-label','展开菜单');
 b.onclick=e=>{e.preventDefault();const collapsed=shell.classList.toggle('sidebar-collapsed');b.setAttribute('aria-label',collapsed?'展开菜单':'折叠菜单')};
}
async function exportWithChoice(){
 const wf=g.WRITE_V106_SIMPLE_WORKFLOW,api=g.WRITE_V10_EXPORT;
 if(!api?.downloadProductionPackage)throw new Error('导出组件尚未加载');
 const mode=await (wf?.chooseExportMode?.()||Promise.resolve('fact'));
 if(mode==='cancel')return {cancelled:true};
 return api.downloadProductionPackage({mode:mode==='full'?'full':'fact'});
}
function bindExportButton(id){
 let el=byId(id);if(!el)return;el=cloneClean(el);el.dataset.v1050Export='1';
 el.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();try{await exportWithChoice()}catch(err){console.error('[WRITE V10.6.2 export]',err);alert('导出失败：'+(err?.message||err))}},true);
}
async function importFolder(){
 const wf=g.WRITE_V106_SIMPLE_WORKFLOW;if(!wf?.handleReviewedImportClick)throw new Error('审核文件夹组件尚未加载');
 return wf.handleReviewedImportClick();
}
function bindReviewedButton(id){
 let el=byId(id);if(!el)return;el=cloneClean(el);el.classList.remove('reviewed-import-trigger');
 el.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();try{await importFolder()}catch(err){console.error('[WRITE V10.6.2 reviewed folder]',err)}},true);
}
function hideTopActions(){const x=byId('topActions');if(x)x.hidden=true}
function install(){
 document.body.classList.add('write-v1062');
 sameHero();bindSidebar();hideTopActions();
 ['heroExportButton','topExportButton','quickExportButton'].forEach(bindExportButton);
 ['landingReviewedImportButton','heroReviewedImportButton'].forEach(bindReviewedButton);
 const landingExport=byId('landingExportButton');if(landingExport){landingExport.disabled=true}
}
function lateRebind(){sameHero();hideTopActions();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
g.addEventListener?.('write-production-result-updated',()=>setTimeout(lateRebind,0));
setTimeout(lateRebind,500);
g.WRITE_V1062_WORKFLOW_UI_FIX={VERSION,install,exportWithChoice,importFolder};
})(window);
