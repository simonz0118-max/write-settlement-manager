(function(g){'use strict';const VERSION='10.6.13';
function clean(){
  document.body.classList.add('write-v10613');
  const b=document.getElementById('v106SidebarToggle');
  if(b){
    const collapsed=document.querySelector('.app-shell')?.classList.contains('sidebar-collapsed');
    b.setAttribute('title',collapsed?'展开菜单':'折叠菜单');
  }
}
function boot(){
  clean();
  let q=false;
  new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;clean()})})
    .observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
g.WRITE_V10613_UI={VERSION,clean};
})(window);
