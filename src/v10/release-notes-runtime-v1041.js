/* WRITE V10.4.1 — authoritative release-notes runtime */
(function(g){'use strict';
const RUNTIME_VERSION='10.4.1';
const SEEN_PREFIX='write-release-notes-seen-v2-';
const HISTORY_URL='./assets/release-history.json';
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function actualVersion(){return String(document.body?.dataset?.release||'').trim()}
function normalizeRelease(meta,version){
  const hist=Array.isArray(meta?.history)?meta.history:[];
  const entry=hist.find(x=>String(x?.version||'')===version);
  const current=String(meta?.current?.version||'')===version?meta.current:null;
  if(current){
    const sections=Array.isArray(current.sections)&&current.sections.length
      ? current.sections.map(s=>({label:String(s?.label||'本次更新'),items:Array.isArray(s?.items)?s.items:[]}))
      : [{label:'本次更新',items:Array.isArray(entry?.items)?entry.items:[]}];
    return {version,time:String(current.time||entry?.time||''),title:String(current.title||entry?.title||`WRITE Settlement Manager v${version}`),sections};
  }
  if(entry)return {version,time:String(entry.time||''),title:String(entry.title||`WRITE Settlement Manager v${version}`),sections:[{label:'本次更新',items:Array.isArray(entry.items)?entry.items:[]}]};
  return {version,time:'',title:`WRITE Settlement Manager v${version}`,sections:[{label:'本次更新',items:['当前版本已更新。']}]};
}
function seenKey(v){return SEEN_PREFIX+v}
function hasSeen(v){try{return localStorage.getItem(seenKey(v))==='1'}catch{return false}}
function markSeen(v){try{localStorage.setItem(seenKey(v),'1')}catch{}}
function removeLegacyPopup(){document.querySelectorAll('.release-notes-backdrop').forEach(x=>x.remove());document.body?.classList?.remove('release-notes-open')}
function render(rel){
  removeLegacyPopup();
  const backdrop=document.createElement('div');
  backdrop.className='release-notes-backdrop write-authoritative-release-notes';
  backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-modal','true');backdrop.setAttribute('aria-labelledby','releaseNotesTitle');
  const sections=(rel.sections||[]).map(s=>`<section class="release-notes-section"><h3>${esc(s.label||'本次更新')}</h3><ul>${(s.items||[]).map(i=>`<li>${esc(i)}</li>`).join('')}</ul></section>`).join('');
  backdrop.innerHTML=`<div class="release-notes-card"><div class="release-notes-head"><div><span>本次更新</span><h2 id="releaseNotesTitle">WRITE Settlement Manager v${esc(rel.version)}</h2><p>${esc(rel.time)} · Designed by NEOVORA</p></div><div class="release-version">v${esc(rel.version)}</div></div><div class="release-notes-body">${sections}</div><div class="release-notes-foot"><small>关闭后，本浏览器在 v${esc(rel.version)} 版本中不会再次自动弹出。</small><button type="button" class="release-ack">我知道了</button></div></div>`;
  document.body.appendChild(backdrop);document.body.classList.add('release-notes-open');
  const close=()=>{markSeen(rel.version);backdrop.classList.add('closing');document.body.classList.remove('release-notes-open');setTimeout(()=>backdrop.remove(),180)};
  backdrop.querySelector('.release-ack')?.addEventListener('click',close,{once:true});
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});
  return backdrop;
}
async function loadMeta(){const r=await fetch(`${HISTORY_URL}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`release-history ${r.status}`);return r.json()}
async function start({force=false}={}){
  const version=actualVersion();if(!version)return {shown:false,reason:'NO_DEPLOYED_VERSION'};
  removeLegacyPopup();if(!force&&hasSeen(version))return {shown:false,reason:'ALREADY_SEEN',version};
  try{const meta=await loadMeta();const rel=normalizeRelease(meta,version);render(rel);g.WRITE_RELEASE_META=meta;return {shown:true,version,release:rel}}
  catch(e){console.error('[WRITE V10.4.1 release notes]',e);return {shown:false,reason:'HISTORY_LOAD_FAILED',version}}
}
function boot(){setTimeout(()=>start(),0)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
g.WRITE_V1041_RELEASE_NOTES={RUNTIME_VERSION,HISTORY_URL,SEEN_PREFIX,start,loadMeta,normalizeRelease,actualVersion,hasSeen,markSeen,removeLegacyPopup};
})(window);
