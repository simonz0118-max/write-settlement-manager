/* WRITE V10.3.5 */
(function(g){'use strict';
const VERSION='10.3.5';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pv=v=>{const m=String(v||'').replace(/^v/i,'').match(/^(\d+)\.(\d+)\.(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0]};
const cmp=(a,b)=>{const A=pv(a.version),B=pv(b.version);for(let i=0;i<3;i++)if(A[i]!==B[i])return B[i]-A[i];return 0};
async function load(){const r=await fetch(`./assets/release-history.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`history ${r.status}`);return r.json()}
function render(meta){document.body.dataset.release=VERSION;document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent=`v${VERSION} Production`);document.getElementById('canonicalReleaseHistory')?.remove();const panel=document.querySelector('[data-view-panel="history"] .history-panel');if(panel)panel.hidden=false;const host=document.getElementById('releaseHistory');if(!host)return;const map=new Map();for(const e of(meta.history||[])){const v=String(e?.version||'').trim();if(v&&!map.has(v))map.set(v,{...e,version:v,items:Array.isArray(e.items)?e.items:[]})}const list=[...map.values()].sort(cmp);const i=list.findIndex(x=>x.version===VERSION);if(i>0){const[e]=list.splice(i,1);list.unshift(e)}const cv=document.getElementById('historyCurrentVersion');if(cv)cv.textContent=`v${VERSION}`;const count=document.getElementById('historyCount');if(count)count.textContent=`${list.length} 个版本`;host.innerHTML=list.map((e,i)=>`<article class="history-item ${i===0?'current':''}"><div class="history-meta"><span class="history-version">v${esc(e.version)}</span><time class="history-time">${esc(e.time||'')}</time></div><div class="history-body"><h3>${esc(e.title||'WRITE Settlement Manager')}</h3><ul>${(e.items||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></article>`).join('');g.WRITE_RELEASE_META=meta}
async function refresh(){try{render(await load())}catch(e){console.error('[V10.3.5 history]',e)}}
function boot(){refresh();document.querySelector('.nav-item[data-view="history"]')?.addEventListener('click',refresh,{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
g.WRITE_V1035_HISTORY={VERSION,refresh,render};
})(window);
