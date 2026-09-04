/* WRITE V10.6.0 — Simple Workflow */
(function(g){'use strict';
const VERSION='10.6.0';
const DB_NAME='WRITE_V106_SETTINGS',STORE='settings',HANDLE_KEY='reviewFolder';
const MANIFEST_KEY='write-v106-reviewed-folder-manifest-v1';
let folderHandle=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbGet(k){const d=await openDb();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,'readonly'),r=t.objectStore(STORE).get(k);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);t.oncomplete=()=>d.close()})}
async function dbPut(k,v){const d=await openDb();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put(v,k);t.oncomplete=()=>{d.close();resolve()};t.onerror=()=>{d.close();reject(t.error)}})}
function toast(msg,bad=false){let n=$('#v106Toast');if(!n){n=document.createElement('div');n.id='v106Toast';n.className='v106-toast';document.body.appendChild(n)}n.textContent=msg;n.classList.toggle('bad',!!bad);n.hidden=false;clearTimeout(n._t);n._t=setTimeout(()=>n.hidden=true,4200)}
function modalBase(id,title,body){let m=document.getElementById(id);if(m)m.remove();m=document.createElement('div');m.id=id;m.className='v106-modal-backdrop';m.innerHTML=`<div class="v106-modal"><button class="v106-x" type="button" aria-label="关闭">×</button><h3>${esc(title)}</h3><p>${esc(body)}</p><div class="v106-modal-actions"></div></div>`;document.body.appendChild(m);return m}
async function chooseReviewFolder(){
 if(typeof g.showDirectoryPicker!=='function'){document.getElementById('knowledgeReviewedFile')?.click();toast('当前浏览器不支持固定审核文件夹，已切换为手动选择文件。',true);return null}
 try{const h=await g.showDirectoryPicker({mode:'read',id:'write-reviewed-folder'});folderHandle=h;await dbPut(HANDLE_KEY,h);localStorage.removeItem(MANIFEST_KEY);toast(`审核文件夹已设置：${h.name}`);return h}catch(e){if(e?.name!=='AbortError')toast('文件夹设置失败：'+(e?.message||e),true);return null}
}
async function ensurePermission(h){if(!h)return false;try{if((await h.queryPermission?.({mode:'read'}))==='granted')return true;return (await h.requestPermission?.({mode:'read'}))==='granted'}catch(e){return false}}
async function digest(file){const b=await file.arrayBuffer(),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function collect(dir,prefix='',out=[]){for await(const [name,h] of dir.entries()){const path=prefix?`${prefix}/${name}`:name;if(h.kind==='directory'){await collect(h,path,out);continue}if(!/\.(xlsx|zip)$/i.test(name)||/^\.?~\$/.test(name))continue;const f=await h.getFile();Object.defineProperty(f,'__writeRelativePath',{value:path,configurable:true});out.push({file:f,path})}return out}
function loadManifest(){try{return JSON.parse(localStorage.getItem(MANIFEST_KEY)||'{}')||{}}catch(e){return{}}}
function saveManifest(x){localStorage.setItem(MANIFEST_KEY,JSON.stringify(x))}
async function scanChanged(h){const old=loadManifest(),rows=await collect(h),changed=[],next={...old};for(const x of rows){const hash=await digest(x.file),sig={size:x.file.size,lastModified:x.file.lastModified,sha256:hash};const prev=old[x.path];if(!prev||prev.sha256!==hash)changed.push(x);next[x.path]=sig}return{rows,changed,next}}
async function importReviewedFolder(){
 if(typeof g.showDirectoryPicker!=='function'){document.getElementById('knowledgeReviewedFile')?.click();return{fallback:true}}
 if(!folderHandle)folderHandle=await dbGet(HANDLE_KEY).catch(()=>null);
 if(!folderHandle){folderHandle=await chooseReviewFolder();if(!folderHandle)return{cancelled:true}}
 if(!await ensurePermission(folderHandle)){folderHandle=await chooseReviewFolder();if(!folderHandle)return{cancelled:true}}
 toast('正在读取审核文件夹并检查新数据…');
 const pack=await scanChanged(folderHandle);
 if(!pack.rows.length){toast('审核文件夹里没有 XLSX / ZIP 文件。');return{files:0,changed:0}}
 if(!pack.changed.length){toast(`已检查 ${pack.rows.length} 个文件，没有新的审核数据。`);return{files:pack.rows.length,changed:0}}
 const api=g.WRITE_V1015_BATCH_LEARNING;if(!api?.run)throw new Error('批量学习模块尚未加载');
 const result=await api.run(pack.changed.map(x=>x.file));
 if(Number(result?.totals?.failed||0)===0)saveManifest(pack.next);
 toast(`审核学习完成：检查 ${pack.rows.length} 个文件，新处理 ${pack.changed.length} 个。`,Number(result?.totals?.failed||0)>0);
 return{files:pack.rows.length,changed:pack.changed.length,result}
}
function handleReviewedImportClick(){return importReviewedFolder().catch(e=>{toast('审核数据导入失败：'+(e?.message||e),true);throw e})}
function chooseExportMode(){return new Promise(resolve=>{const m=modalBase('v106ExportMode','导出统计发票','默认只生成 FACT。是否需要同时生成其他统计页面？');const a=m.querySelector('.v106-modal-actions');a.innerHTML='<button class="v106-secondary" data-mode="full">FACT + 其他页面</button><button class="v106-primary" data-mode="fact">仅生成 FACT</button>';const done=v=>{m.remove();resolve(v)};m.querySelector('.v106-x').onclick=()=>done('cancel');a.onclick=e=>{const b=e.target.closest('[data-mode]');if(b)done(b.dataset.mode)};setTimeout(()=>a.querySelector('[data-mode="fact"]')?.focus(),0)})}
function installSidebar(){const shell=$('.app-shell'),side=$('.sidebar');if(!shell||!side)return;document.body.classList.add('write-v106-simple');shell.classList.add('sidebar-collapsed');let b=$('#v106SidebarToggle');if(!b){b=document.createElement('button');b.id='v106SidebarToggle';b.className='v106-sidebar-toggle';b.type='button';b.setAttribute('aria-label','展开侧边栏');b.textContent='☰';side.prepend(b)}b.onclick=()=>{const c=shell.classList.toggle('sidebar-collapsed');b.setAttribute('aria-label',c?'展开侧边栏':'折叠侧边栏');b.textContent=c?'☰':'‹'}}
function installLandingExport(){const b=$('#landingExportButton');if(!b)return;b.onclick=e=>{e.preventDefault();toast('请先导入订单，再导出统计发票。')}}
function intro(){if(typeof g.showDirectoryPicker!=='function')return;dbGet(HANDLE_KEY).then(h=>{folderHandle=h;if(h)return;const m=modalBase('v106FolderIntro','设置人工审核文件夹','第一次使用请指定一个人工审核表文件夹。以后点击“导入审核后数据”，WRITE 会自动读取这个文件夹里的新文件并学习。');const a=m.querySelector('.v106-modal-actions');a.innerHTML='<button class="v106-secondary" data-later>稍后设置</button><button class="v106-primary" data-pick>选择文件夹</button>';m.querySelector('.v106-x').onclick=()=>m.remove();a.querySelector('[data-later]').onclick=()=>m.remove();a.querySelector('[data-pick]').onclick=async()=>{const h2=await chooseReviewFolder();if(h2)m.remove()}}).catch(()=>{})}
function start(){installSidebar();installLandingExport();intro()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V106_SIMPLE_WORKFLOW={VERSION,chooseExportMode,chooseReviewFolder,handleReviewedImportClick,importReviewedFolder,_test:{collect,scanChanged,digest}};
})(window);
