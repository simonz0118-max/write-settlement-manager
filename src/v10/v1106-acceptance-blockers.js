/* WRITE V11.0.6 — visible version authority */
(function(g){'use strict';const VERSION='11.0.6';
function apply(){document.body.classList.add('write-v1106');document.querySelectorAll('.brand-copy small').forEach(x=>{if(x.textContent!=='v11.0.12 Production')x.textContent='v11.0.12 Production'});const f=document.querySelector('.v10612-side-footer span:last-of-type');if(f&&f.textContent!=='v11.0.6')f.textContent='v11.0.12'}
function boot(){apply();let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;apply()})}).observe(document.documentElement,{subtree:true,childList:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();g.WRITE_V1106_UI={VERSION,apply};
})(window);
