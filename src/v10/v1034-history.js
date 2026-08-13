/* WRITE V10.3.4 — authoritative release history */
(function(g){'use strict';
const VERSION='10.3.4';
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function pv(v=''){const m=String(v).replace(/^v/i,'').match(/^(\d+)\.(\d+)\.(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0]}
function desc(a,b){const A=pv(a.version),B=pv(b.version);for(let i=0;i<3;i++)if(A[i]!==B[i])return B[i]-A[i];return 0}
async function loadMeta(){
 const r=await fetch(`./assets/release-history.json?v=${Date.now()}`,{cache:'no-store'});
 if(!r.ok)throw new Error('release history '+r.status);
 return r.json();
}
function render(meta){
 const host=document.getElementById('releaseHistory');if(!host)return;
 const actual=document.body?.dataset?.release||meta.current?.version||VERSION;
 const map=new Map();
 for(const e of(meta.history||[])){const v=String(e?.version||'').trim();if(v&&!map.has(v))map.set(v,{...e,version:v,items:Array.isArray(e.items)?e.items:[]})}
 if(!map.has(actual)){
   const c=meta.current||{};
   map.set(actual,{version:actual,time:c.time||'',title:c.title||'WRITE Settlement Manager',items:(c.sections||[]).flatMap(x=>x.items||[])});
 }
 const list=[...map.values()].sort(desc);
 const idx=list.findIndex(x=>x.version===actual);if(idx>0){const [x]=list.splice(idx,1);list.unshift(x)}
 const cur=document.getElementById('historyCurrentVersion');if(cur)cur.textContent=`v${actual}`;
 const count=document.getElementById('historyCount');if(count)count.textContent=`${list.length} 个版本`;
 host.innerHTML=list.map((e,i)=>`<article class="history-item ${i===0?'current':''}"><div class="history-meta"><span class="history-version">v${esc(e.version)}</span><time class="history-time">${esc(e.time||'')}</time></div><div class="history-body"><h3>${esc(e.title||'WRITE Settlement Manager')}</h3><ul>${(e.items||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></article>`).join('');
 g.WRITE_RELEASE_META=meta;
 g.WRITE_HISTORY_RENDERED_VERSION=actual;
}
async function refresh(){try{render(await loadMeta())}catch(e){console.error('[V10.3.4 history]',e)}}
function boot(){
 refresh();
 document.querySelector('[data-view="history"]')?.addEventListener('click',()=>refresh(),{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
g.WRITE_V1034_HISTORY={VERSION,refresh,render};
})(window);
