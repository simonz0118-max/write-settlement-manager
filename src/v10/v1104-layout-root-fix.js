/* WRITE V11.0.4 — root layout/version authority */
(function(g){'use strict';const VERSION='11.0.4';
function apply(){
  document.body.classList.add('write-v1104');
  document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent='v11.2.0 Production');
  const f=document.querySelector('.v10612-side-footer span:last-of-type');if(f)f.textContent='v11.2.0';
  const b=document.getElementById('v106SidebarToggle');
  if(b){
    const c=document.querySelector('.app-shell')?.classList.contains('sidebar-collapsed');
    b.setAttribute('aria-label',c?'展开菜单':'折叠菜单');
    b.setAttribute('title',c?'展开菜单':'折叠菜单');
  }
}
function boot(){
  apply();
  let q=false;
  new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;apply()})})
    .observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-theme']});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
g.WRITE_V1104_UI={VERSION,apply};
})(window);
