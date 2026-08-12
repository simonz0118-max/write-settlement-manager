/* WRITE V10.0.6 history display hotfix
 * Purpose:
 * - current version badge must follow the actual deployed body[data-release]
 * - current release must be the first history entry
 * - history must be deduplicated and semver-descending
 * - do not trust stale app.bundle cached metadata
 */
(function(g){'use strict';

const VERSION='10.0.6';

function esc(v=''){
  return String(v??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function parseVersion(v=''){
  const raw=String(v||'').trim().replace(/^v/i,'');
  const m=raw.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?(?:[-.]?(.*))?$/);
  if(!m)return [0,0,0,0,-1,raw];
  const nums=[m[1],m[2],m[3],m[4]].map(x=>Number(x||0));
  const suffix=String(m[5]||'');
  // Stable release sorts above rc/beta for the same numeric tuple.
  const stable=suffix?0:1;
  return [...nums,stable,suffix];
}

function cmpVersionDesc(a,b){
  const A=parseVersion(a.version),B=parseVersion(b.version);
  for(let i=0;i<5;i++){
    if(A[i]!==B[i])return B[i]-A[i];
  }
  return String(B[5]).localeCompare(String(A[5]),undefined,{numeric:true,sensitivity:'base'});
}

function currentRelease(meta,actualVersion){
  const fromHistory=(meta.history||[]).find(x=>String(x.version)===String(actualVersion));
  if(fromHistory)return fromHistory;
  if(String(meta.current?.version)===String(actualVersion)){
    return {
      version:actualVersion,
      time:meta.current?.time||'',
      title:meta.current?.title||'WRITE Settlement Manager',
      items:(meta.current?.sections||[]).flatMap(s=>s.items||[])
    };
  }
  return {
    version:actualVersion,
    time:'',
    title:'WRITE Settlement Manager',
    items:['当前部署版本。']
  };
}

function normalizedHistory(){
  const meta=g.WRITE_RELEASE_META||{current:{},history:[]};
  const actualVersion=document.body?.dataset?.release || meta.current?.version || VERSION;

  const map=new Map();
  for(const entry of Array.isArray(meta.history)?meta.history:[]){
    const v=String(entry?.version||'').trim();
    if(!v)continue;
    if(!map.has(v))map.set(v,{...entry,version:v,items:Array.isArray(entry.items)?entry.items:[]});
  }

  const current=currentRelease(meta,actualVersion);
  map.set(String(actualVersion),{
    ...current,
    version:String(actualVersion),
    items:Array.isArray(current.items)?current.items:[]
  });

  const list=[...map.values()].sort(cmpVersionDesc);

  // Hard rule: deployed version is always first, regardless of stale metadata sort.
  const idx=list.findIndex(x=>String(x.version)===String(actualVersion));
  if(idx>0){
    const [cur]=list.splice(idx,1);
    list.unshift(cur);
  }
  return {actualVersion,list};
}

function render(){
  const host=document.getElementById('releaseHistory');
  if(!host)return;

  const {actualVersion,list}=normalizedHistory();

  const current=document.getElementById('historyCurrentVersion');
  if(current)current.textContent=`v${actualVersion}`;

  const count=document.getElementById('historyCount');
  if(count)count.textContent=`${list.length} 个版本`;

  host.innerHTML=list.map((entry,index)=>`
    <article class="history-item ${index===0?'current':''}">
      <div class="history-meta">
        <span class="history-version">v${esc(entry.version)}</span>
        <time class="history-time">${esc(entry.time||'')}</time>
      </div>
      <div class="history-body">
        <h3>${esc(entry.title||'WRITE Settlement Manager')}</h3>
        <ul>${(entry.items||[]).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>
      </div>
    </article>
  `).join('');

  g.WRITE_HISTORY_RENDERED_VERSION=actualVersion;
  g.WRITE_HISTORY_RENDERED_FIRST=list[0]?.version||'';
}

function start(){
  // Run after app.bundle's original history renderer, then once more after late scripts.
  render();
  setTimeout(render,150);
  setTimeout(render,800);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();

g.WRITE_V10_HISTORY={VERSION,render,normalizedHistory,parseVersion,cmpVersionDesc};
})(window);
