/* WRITE V11.0.1 Production Hotfix */
(function(g){'use strict';const VERSION='11.0.1';
function apply(){
  document.body.classList.add('write-v1101');
  const theme=document.documentElement.dataset.theme||'light';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',theme==='dark'?'#151513':'#f1ede4');
  document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent='v11.0.13 Production');
  const f=document.querySelector('.v10612-side-footer span:last-of-type');if(f)f.textContent='v11.0.13';
}
function boot(){
  apply();
  const ob=new MutationObserver(ms=>{
    if(ms.some(m=>m.type==='attributes'&&m.attributeName==='data-theme'))apply();
  });
  ob.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
g.WRITE_V1101_THEME={VERSION,apply};
})(window);
