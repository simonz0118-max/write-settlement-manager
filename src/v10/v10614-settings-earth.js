/* WRITE V10.6.14 — settings + earth palette */
(function(g){'use strict';const VERSION='10.6.14';
const DB_NAME='WRITE_V106_SETTINGS',STORE='settings',HANDLE_KEY='reviewFolder';

function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function currentFolder(){
  try{
    const d=await openDb();
    return await new Promise((resolve,reject)=>{
      const t=d.transaction(STORE,'readonly'),q=t.objectStore(STORE).get(HANDLE_KEY);
      q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);t.oncomplete=()=>d.close();
    });
  }catch(e){return null}
}
function addSettingsNav(){
  const nav=document.getElementById('sideNav');if(!nav||document.getElementById('v10614SettingsNav'))return;
  const theme=document.getElementById('themeToggleButton');
  const b=document.createElement('button');
  b.id='v10614SettingsNav';b.type='button';b.className='nav-item v10614-settings-nav';
  b.innerHTML='<span class="v10612-nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19 13.8v-3.6l-2.2-.7a7 7 0 0 0-.7-1.6l1-2-2.6-2.6-2 1a7 7 0 0 0-1.6-.7L10.2 1H6.6l-.7 2.2a7 7 0 0 0-1.6.7l-2-1L-.3 5.5l1 2a7 7 0 0 0-.7 1.6L-2.2 9.8v3.6l2.2.7a7 7 0 0 0 .7 1.6l-1 2 2.6 2.6 2-1a7 7 0 0 0 1.6.7l.7 2.2h3.6l.7-2.2a7 7 0 0 0 1.6-.7l2 1 2.6-2.6-1-2a7 7 0 0 0 .7-1.6z" transform="translate(3 0) scale(.75)"/></svg></span><span>设置</span>';
  nav.insertBefore(b,theme||null);
  b.addEventListener('click',e=>{e.preventDefault();openSettings()});
}
function ensureModal(){
  let m=document.getElementById('v10614SettingsModal');if(m)return m;
  m=document.createElement('div');m.id='v10614SettingsModal';m.className='v10614-settings-backdrop';m.hidden=true;
  m.innerHTML='<section class="v10614-settings" role="dialog" aria-modal="true" aria-labelledby="v10614SettingsTitle"><header class="v10614-settings-head"><div><span>WRITE SETTINGS</span><h2 id="v10614SettingsTitle">系统设置</h2></div><button class="v10614-settings-close" type="button" aria-label="关闭">×</button></header><div class="v10614-settings-body"><div class="v10614-setting-row"><div><h3>默认人工审核文件夹</h3><p>“导入审核后数据”会自动读取这里的新 XLSX / ZIP 文件并学习。</p><span class="v10614-folder-name" id="v10614FolderName">读取中…</span></div><button class="v10614-change-folder" type="button">修改文件夹</button></div><p class="v10614-settings-note">修改后不会删除已经学到的规则，只改变以后自动扫描的默认文件夹。</p></div></section>';
  document.body.appendChild(m);
  m.querySelector('.v10614-settings-close').onclick=()=>{m.hidden=true};
  m.addEventListener('click',e=>{if(e.target===m)m.hidden=true});
  m.querySelector('.v10614-change-folder').onclick=async()=>{
    const api=g.WRITE_V106_SIMPLE_WORKFLOW;
    if(!api?.chooseReviewFolder){alert('审核文件夹组件尚未加载');return}
    const h=await api.chooseReviewFolder();
    if(h)await refreshFolder(m);
  };
  return m;
}
async function refreshFolder(m=ensureModal()){
  const n=m.querySelector('#v10614FolderName'),h=await currentFolder();
  n.textContent=h?.name||'尚未设置';
}
async function openSettings(){
  const m=ensureModal();await refreshFolder(m);m.hidden=false;m.querySelector('.v10614-settings-close')?.focus();
}
function installPressedState(){
  /* CSS handles actual press. This class makes pointer/keyboard state inspectable without modifying button markup. */
  document.addEventListener('pointerdown',e=>{const b=e.target.closest?.('button:not(:disabled)');if(b)b.classList.add('is-pressed')},true);
  const clear=e=>{const b=e.target.closest?.('button');if(b)b.classList.remove('is-pressed')};
  document.addEventListener('pointerup',clear,true);document.addEventListener('pointercancel',clear,true);
}
function boot(){
  document.body.classList.add('write-v10614');
  addSettingsNav();ensureModal();installPressedState();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
g.WRITE_V10614_UI={VERSION,openSettings,currentFolder};
})(window);
