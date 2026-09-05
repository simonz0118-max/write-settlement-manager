/* WRITE V11.0.5 — final shell authority */
(function(g){'use strict';const VERSION='11.0.5';
function apply(){
 document.body.classList.add('write-v1105');
 document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent='v11.0.12 Production');
 const f=document.querySelector('.v10612-side-footer span:last-of-type');if(f)f.textContent='v11.0.12';
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',apply,{once:true}):apply();
g.WRITE_V1105_UI={VERSION,apply};
})(window);
