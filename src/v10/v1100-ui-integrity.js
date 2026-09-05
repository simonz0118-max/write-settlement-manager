/* WRITE V11.0 Production — UI integrity */
(function(g){'use strict';const VERSION='11.0';
const ICONS={
 settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.4v-4h.1A1.7 1.7 0 0 0 4.2 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.66 3.8l.06.06A1.7 1.7 0 0 0 8.6 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2.4h4v.1a1.7 1.7 0 0 0 1 1.7 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.6a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7 1z"/></svg>',
 upload:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5"/><path d="m8 9 4-4 4 4"/><path d="M7 19H6a4 4 0 0 1-.7-7.94A6.2 6.2 0 0 1 17 9.8a4.1 4.1 0 0 1 .8 8.12H17"/></svg>',
 file:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
 db:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="6" ry="2.5"/><path d="M6 6v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6"/><path d="M6 12v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-6"/></svg>'
};
function icon(btn,key,klass){
  if(!btn)return;
  let s=btn.querySelector(':scope>span:first-child');
  if(!s){s=document.createElement('span');btn.prepend(s)}
  s.className=klass;s.innerHTML=ICONS[key];
}
function repair(){
  document.body.classList.add('write-v1100');
  const set=document.getElementById('v10614SettingsNav');
  if(set) icon(set,'settings','v10612-nav-icon');
  icon(document.getElementById('chooseButton'),'upload','v10612-action-icon');
  icon(document.getElementById('landingExportButton'),'file','v10612-action-icon');
  icon(document.getElementById('landingReviewedImportButton'),'db','v10612-action-icon');
  /* Dashboard order differs: export / import / reviewed. */
  icon(document.getElementById('heroExportButton'),'file','v10612-action-icon');
  icon(document.getElementById('heroImportButton'),'upload','v10612-action-icon');
  icon(document.getElementById('heroReviewedImportButton'),'db','v10612-action-icon');
  document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent='v11.0.6 Production');
  const f=document.querySelector('.v10612-side-footer span:last-of-type');if(f)f.textContent='v11.0.6';
}
function boot(){
  repair();let q=false;
  new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;repair()})})
    .observe(document.documentElement,{childList:true,subtree:true});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
g.WRITE_V1100_UI={VERSION,repair};
})(window);
