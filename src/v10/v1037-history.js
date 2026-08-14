(function(g){'use strict';const MODULE_VERSION='10.3.7';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pv=v=>{const m=String(v||'').replace(/^v/i,'').match(/^(\d+)\.(\d+)\.(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0]};
const cmp=(a,b)=>{const A=pv(a.version),B=pv(b.version);for(let i=0;i<3;i++)if(A[i]!==B[i])return B[i]-A[i];return 0};
async function load(){const r=await fetch(`./assets/release-history.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`history ${r.status}`);return r.json()}
function authoritativeVersion(meta={}){return String(meta?.current?.version||meta?.currentVersion||document.body?.dataset?.release||'').trim()}
function render(meta){
 const version=authoritativeVersion(meta),host=document.getElementById('releaseHistory');if(!host)return;
 const list=[...(meta.history||[])].sort(cmp);
 document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent=`v${version} Production`);
 const cv=document.getElementById('historyCurrentVersion');if(cv)cv.textContent=`v${version}`;
 const count=document.getElementById('historyCount');if(count)count.textContent=`${list.length} 个版本`;
 host.innerHTML=list.map(e=>`<article class="history-item ${String(e.version)===version?'current':''}"><div class="history-meta"><span class="history-version">v${esc(e.version)}</span><time class="history-time">${esc(e.time||'')}</time></div><div class="history-body"><h3>${esc(e.title||'WRITE Settlement Manager')}</h3><ul>${(e.items||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></article>`).join('');
 g.WRITE_RELEASE_META=meta;
}
async function refresh(){try{render(await load())}catch(e){console.error('[WRITE history]',e)}}
function boot(){refresh();document.querySelector('.nav-item[data-view="history"]')?.addEventListener('click',refresh,{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
g.WRITE_V1037_HISTORY={VERSION:MODULE_VERSION,refresh,render,authoritativeVersion};
})(window);
