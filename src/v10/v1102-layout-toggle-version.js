/* WRITE V11.0.2 — final UI closure */
(function(g){'use strict';const VERSION='11.0.2';
function apply(){
  document.body.classList.add('write-v1102');
  const b=document.getElementById('v106SidebarToggle');
  if(b){
    const c=document.querySelector('.app-shell')?.classList.contains('sidebar-collapsed');
    b.setAttribute('aria-label',c?'展开菜单':'折叠菜单');
    b.setAttribute('title',c?'展开菜单':'折叠菜单');
  }
}
function boot(){
  apply();
  const shell=document.querySelector('.app-shell');
  if(shell)new MutationObserver(apply).observe(shell,{attributes:true,attributeFilter:['class']});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
g.WRITE_V1102_UI={VERSION,apply};
})(window);
