/* WRITE V10.6.0 — Simple Workflow */
(function(g){'use strict';
const VERSION='11.2.0';
const DB_NAME='WRITE_V106_SETTINGS',STORE='settings',HANDLE_KEY='reviewFolder';
const MANIFEST_KEY='write-v106-reviewed-folder-manifest-v5';
const REVIEW_PARSER_VERSION='11.0.12';
const LEARNING_SCHEMA_VERSION='5';
const LEGACY_MANIFEST_KEYS=['write-v106-reviewed-folder-manifest-v1','write-v106-reviewed-folder-manifest-v2','write-v106-reviewed-folder-manifest-v3','write-v106-reviewed-folder-manifest-v4'];
let folderHandle=null,folderScopeId='';
const FOLDER_SCOPE_KEY='reviewFolderScopeV5';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbGet(k){const d=await openDb();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,'readonly'),r=t.objectStore(STORE).get(k);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);t.oncomplete=()=>d.close()})}
async function dbPut(k,v){const d=await openDb();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put(v,k);t.oncomplete=()=>{d.close();resolve()};t.onerror=()=>{d.close();reject(t.error)}})}
function toast(msg,bad=false){let n=$('#v106Toast');if(!n){n=document.createElement('div');n.id='v106Toast';n.className='v106-toast';document.body.appendChild(n)}n.textContent=msg;n.classList.toggle('bad',!!bad);n.hidden=false;clearTimeout(n._t);n._t=setTimeout(()=>n.hidden=true,4200)}
function modalBase(id,title,body){let m=document.getElementById(id);if(m)m.remove();m=document.createElement('div');m.id=id;m.className='v106-modal-backdrop';m.innerHTML=`<div class="v106-modal"><button class="v106-x" type="button" aria-label="关闭">×</button><h3>${esc(title)}</h3><p>${esc(body)}</p><div class="v106-modal-actions"></div></div>`;document.body.appendChild(m);return m}
async function chooseReviewFolder(){
 if(typeof g.showDirectoryPicker!=='function'){document.getElementById('knowledgeReviewedFile')?.click();toast('当前浏览器不支持固定审核文件夹，已切换为手动选择文件。',true);return null}
 try{const h=await g.showDirectoryPicker({mode:'read',id:'write-reviewed-folder'});folderHandle=h;await dbPut(HANDLE_KEY,h);folderScopeId=crypto?.randomUUID?.()||`folder-${Date.now()}-${Math.random().toString(36).slice(2)}`;await dbPut(FOLDER_SCOPE_KEY,folderScopeId);for(const k of [...LEGACY_MANIFEST_KEYS,MANIFEST_KEY])localStorage.removeItem(k);toast(`审核文件夹已设置：${h.name}`);g.dispatchEvent?.(new CustomEvent('write-review-folder-selected',{detail:{name:h.name,scopeId:folderScopeId}}));return h}catch(e){if(e?.name!=='AbortError')toast('文件夹设置失败：'+(e?.message||e),true);return null}
}
async function ensurePermission(h){if(!h)return false;try{if((await h.queryPermission?.({mode:'read'}))==='granted')return true;return (await h.requestPermission?.({mode:'read'}))==='granted'}catch(e){return false}}
async function digest(file){if(Number(file?.size||0)>250*1024*1024)throw new Error('文件超过 250 MB 上限：'+String(file?.name||''));const b=await file.arrayBuffer(),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function collect(dir,prefix='',out=[],errors=[]){let entries=[];try{for await(const x of dir.entries())entries.push(x)}catch(e){errors.push({path:prefix||'.',error:String(e?.message||e)});return out}entries.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));for(const [name,h] of entries){const path=prefix?`${prefix}/${name}`:name;try{if(h.kind==='directory'){await collect(h,path,out,errors);continue}if(!/\.(xlsx|zip)$/i.test(name)||/^\.?~\$/.test(name))continue;const f=await h.getFile();if(Number(f.size||0)>250*1024*1024){errors.push({path,error:'FILE_TOO_LARGE'});continue}Object.defineProperty(f,'__writeRelativePath',{value:path,configurable:true});out.push({file:f,path})}catch(e){errors.push({path,error:String(e?.message||e)})}}return out}
function manifestDbKey(path){return `${MANIFEST_KEY}:${folderScopeId||'UNSCOPED'}:${path}`}
function opId(){return crypto?.randomUUID?.()||`op-${Date.now()}-${Math.random().toString(36).slice(2)}`}
function cleanIds(values){
 const out=new Set();let list=[];
 if(Array.isArray(values))list=values;
 else if(values&&typeof values!=='string'&&typeof values[Symbol.iterator]==='function'){try{list=[...values]}catch{list=[]}}
 for(const id of list){const v=String(id??'').trim();if(v)out.add(v)}
 return [...out]
}
function toRuleIds(result){
 const out=new Set(cleanIds(result?.totals?.ruleIds));
 for(const row of(Array.isArray(result?.rows)?result.rows:[]))for(const id of cleanIds(row?.result?.ruleIds))out.add(id);
 return [...out].sort()
}
function idsDigest(ids=[]){return cleanIds(ids).sort().join('\u0001')}
function validBatchContract(result){
 if(!result||typeof result!=='object'||Array.isArray(result))return false;
 if(!Array.isArray(result.rows)||result.rows.length===0)return false;
 if(!result.totals||typeof result.totals!=='object'||Array.isArray(result.totals))return false;
 for(const row of result.rows){if(!row||typeof row!=='object'||typeof row.ok!=='boolean')return false;if(row.ok&&(!row.result||typeof row.result!=='object'||Array.isArray(row.result)))return false}
 return true
}
function receiptCovers(result,expectedRuleIds=[]){
 const expected=cleanIds(expectedRuleIds);if(!expected.length)return false;
 const cloud=result?.cloud,receipt=cloud?.receipt,detail=cloud?.detail||{};
 if(cloud?.ok!==true||!receipt||receipt.cloud!==true||Number(receipt.pending||0)!==0)return false;
 const actual=new Set([...cleanIds(detail.acceptedRuleIds),...cleanIds(detail.cloudRuleIds)]);
 return expected.every(id=>actual.has(id))
}
function classifyBatchResult(result){
 if(!validBatchContract(result))return{localStatus:'INVALID_RESULT',syncStatus:'NOT_READY',retryReason:'INVALID_RESULT_CONTRACT',expectedRuleIds:[],entries:[],totals:{}};
 const totals=result.totals||{},rows=result.rows,expectedRuleIds=toRuleIds(result),n=k=>Number(totals[k]||0);
 const summary={failed:n('failed'),unmatched:n('unmatched'),conflicts:n('conflicts'),factRules:n('factRules'),productRules:n('productRules'),costRules:n('costRules'),componentEquations:n('componentEquations'),componentCostRules:n('componentCostRules'),alreadyLearned:n('alreadyLearned'),newRules:n('newRules'),ignoredFR:n('ignoredFR'),ignoredFRSheets:n('ignoredFRSheets')};
 const entries=rows.map(x=>String(x.name||'')).filter(Boolean);
 if(rows.some(x=>!x.ok)||summary.failed>0)return{localStatus:'FAILED',syncStatus:'NOT_READY',retryReason:'WORKBOOK_FAILED',expectedRuleIds,entries,totals:summary};
 if(summary.unmatched>0)return{localStatus:'UNMATCHED',syncStatus:'NOT_READY',retryReason:`UNMATCHED:${summary.unmatched}`,expectedRuleIds,entries,totals:summary};
 if(summary.conflicts>0)return{localStatus:'CONFLICT',syncStatus:'NOT_READY',retryReason:`CONFLICT:${summary.conflicts}`,expectedRuleIds,entries,totals:summary};
 const activity=summary.factRules+summary.productRules+summary.costRules+summary.componentEquations+summary.componentCostRules+summary.alreadyLearned+summary.newRules,ignored=summary.ignoredFR+summary.ignoredFRSheets;
 if(activity===0&&expectedRuleIds.length===0&&ignored>0)return{localStatus:'NO_APPLICABLE_DATA',syncStatus:'NOT_REQUIRED',retryReason:'',expectedRuleIds:[],entries,totals:summary};
 if(expectedRuleIds.length===0)return{localStatus:'INVALID_RESULT',syncStatus:'NOT_READY',retryReason:'EXPECTED_RULE_IDS_MISSING',expectedRuleIds:[],entries,totals:summary};
 const synced=receiptCovers(result,expectedRuleIds);
 return{localStatus:'LOCAL_SUCCESS',syncStatus:synced?'SYNCED':'SYNC_PENDING',retryReason:synced?'':'CLOUD_RECEIPT_INCOMPLETE',expectedRuleIds,entries,totals:summary}
}
function legacyRecordFor(path){
 try{for(const k of LEGACY_MANIFEST_KEYS){const m=JSON.parse(localStorage.getItem(k)||'{}')||{},x=m[path];if(!x)continue;return{observedHash:String(x.observedHash||x.sha256||''),learnedHash:'',learnedParserVersion:'',learnedSchemaVersion:'',localStatus:'MIGRATION_PENDING',syncStatus:'NOT_READY',retryReason:'LEGACY_REVALIDATION_REQUIRED',expectedRuleIds:[],revision:0,migratedFrom:k}}}catch{}
 return null
}
async function manifestGet(path){
 let x=await dbGet(manifestDbKey(path)).catch(()=>null);if(x)return x;
 const legacy=legacyRecordFor(path);if(legacy){await dbPut(manifestDbKey(path),legacy).catch(()=>{});return legacy}
 return null
}
async function manifestBegin(path,kind,patch={}){
 const d=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=d.transaction(STORE,'readwrite'),st=tx.objectStore(STORE),key=manifestDbKey(path),get=st.get(key);let out=null;
  get.onsuccess=()=>{const cur=get.result||{},revision=Number(cur.revision||0)+1,operationId=opId();out={...cur,...patch,revision,operationId,operationKind:kind,operationStartedAt:new Date().toISOString()};st.put(out,key)};
  get.onerror=()=>reject(get.error);tx.oncomplete=()=>{d.close();resolve(out)};tx.onerror=()=>{d.close();reject(tx.error)};tx.onabort=()=>{d.close();reject(tx.error||new Error('manifest begin aborted'))}
 })
}
async function manifestCas(path,snapshot,patch={}){
 const d=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=d.transaction(STORE,'readwrite'),st=tx.objectStore(STORE),key=manifestDbKey(path),get=st.get(key);let out={ok:false,stale:false,current:null};
  get.onsuccess=()=>{const cur=get.result||null;if(!cur||Number(cur.revision)!==Number(snapshot?.revision)||String(cur.operationId||'')!==String(snapshot?.operationId||'')){out={ok:false,stale:true,current:cur};return}const next={...cur,...patch,operationId:'',operationKind:'',operationFinishedAt:new Date().toISOString()};st.put(next,key);out={ok:true,stale:false,current:next}};
  get.onerror=()=>reject(get.error);tx.oncomplete=()=>{d.close();resolve(out)};tx.onerror=()=>{d.close();reject(tx.error)};tx.onabort=()=>{d.close();reject(tx.error||new Error('manifest cas aborted'))}
 })
}
function manifestAction(prev,observedHash){
 if(!prev)return'LEARN';
 if(String(prev.learnedHash||'')!==String(observedHash||''))return'LEARN';
 if(prev.learnedParserVersion!==REVIEW_PARSER_VERSION||prev.learnedSchemaVersion!==LEARNING_SCHEMA_VERSION)return'LEARN';
 if(prev.localStatus==='NO_APPLICABLE_DATA')return'SKIP';
 if(prev.localStatus!=='LOCAL_SUCCESS')return'LEARN';
 if(!cleanIds(prev.expectedRuleIds).length)return'LEARN';
 if(prev.syncStatus!=='SYNCED')return'SYNC';
 return'SKIP'
}
async function scanChanged(h){
 const collectErrors=[],rows=await collect(h,'',[],collectErrors),learn=[],syncOnly=[];
 for(const x of rows){const observedHash=await digest(x.file),prev=await manifestGet(x.path),action=manifestAction(prev,observedHash),item={...x,observedHash,action,prev};if(action==='LEARN')learn.push(item);else if(action==='SYNC')syncOnly.push(item)}
 return{rows,learn,syncOnly,changed:[...learn,...syncOnly],collectErrors}
}
async function withPathLock(path,fn){const locks=g.navigator?.locks;if(locks?.request)return locks.request(`WRITE_REVIEW:${path}`,{mode:'exclusive'},fn);return fn()}
async function strictSyncRecord(path,observedHash){
 return withPathLock(path,async()=>{
  const current=await manifestGet(path);if(!current)return null;if(manifestAction(current,observedHash)!=='SYNC')return current;
  const expected=cleanIds(current.expectedRuleIds);
  if(!expected.length){const snap=await manifestBegin(path,'SYNC',{syncStatus:'SYNC_PENDING',retryReason:'EXPECTED_RULE_IDS_MISSING'}),done=await manifestCas(path,snap,{syncStatus:'SYNC_PENDING',retryReason:'EXPECTED_RULE_IDS_MISSING'});return done.current}
  const snap=await manifestBegin(path,'SYNC',{syncStatus:'SYNCING',retryReason:'',syncSnapshotDigest:idsDigest(expected),syncSnapshotLearnedHash:String(current.learnedHash||'')});
  let detail=null,receipt=null,ok=false,reason='';
  try{if(!g.WRITE_KB?.sync)throw new Error('知识库未提供云同步接口');if(!g.WRITE_KB?.cloudReceiptStatus)throw new Error('知识库未提供云端回执接口');detail=await g.WRITE_KB.sync({force:true});receipt=g.WRITE_KB.cloudReceiptStatus();const actual=new Set([...cleanIds(detail?.acceptedRuleIds),...cleanIds(detail?.cloudRuleIds)]),missing=expected.filter(id=>!actual.has(id));ok=detail?.ok===true&&receipt?.cloud===true&&Number(receipt.pending||0)===0&&missing.length===0;if(!ok)reason=missing.length?`MISSING_RULE_IDS:${missing.join(',')}`:(detail?.error||detail?.reason||'CLOUD_RECEIPT_INVALID')}catch(e){reason=e?.message||String(e)}
  const done=await manifestCas(path,snap,{syncStatus:ok?'SYNCED':'SYNC_PENDING',retryReason:ok?'':reason,lastSyncAt:new Date().toISOString()});
  return done.stale?{...(done.current||{}),staleResponseIgnored:true}:done.current
 })
}
async function processOneLearn(x,api,options={}){
 return withPathLock(x.path,async()=>{
  const latest=await manifestGet(x.path),action=manifestAction(latest,x.observedHash);if(action!=='LEARN')return{path:x.path,action:'SKIP_AFTER_LOCK',...(latest||{})};
  const snap=await manifestBegin(x.path,'LEARN',{observedHash:x.observedHash,size:x.file.size,lastModified:x.file.lastModified,localStatus:'PENDING',syncStatus:'NOT_READY',retryReason:'LEARNING_IN_PROGRESS'});
  let result=null,error='';try{result=options.silent&&api.learnBatch?await api.learnBatch([x.file],{silent:true}):await api.run([x.file])}catch(e){error=e?.message||String(e)}
  const state=classifyBatchResult(result);if(error){state.localStatus='FAILED';state.syncStatus='NOT_READY';state.retryReason='EXCEPTION:'+error}
  const patch={observedHash:x.observedHash,size:x.file.size,lastModified:x.file.lastModified,...state,sourcePath:x.path,processedAt:new Date().toISOString()};
  if(state.localStatus==='LOCAL_SUCCESS'||state.localStatus==='NO_APPLICABLE_DATA'){patch.learnedHash=x.observedHash;patch.learnedParserVersion=REVIEW_PARSER_VERSION;patch.learnedSchemaVersion=LEARNING_SCHEMA_VERSION}
  const done=await manifestCas(x.path,snap,patch);
  return done.stale?{path:x.path,action:'LEARN',staleResponseIgnored:true,...(done.current||{}),error,result}:{path:x.path,action:'LEARN',...done.current,error,result}
 })
}
async function processReviewedFolderHandle(h,options={}){
 const pack=await scanChanged(h),outcomes=[];
 for(const e of(pack.collectErrors||[]))outcomes.push({path:e.path,action:'COLLECT',localStatus:'FAILED',syncStatus:'NOT_READY',retryReason:'COLLECT:'+e.error});
 if(!pack.changed.length)return{files:pack.rows.length,changed:0,learned:0,syncOnly:0,outcomes,pack};
 const api=g.WRITE_V1015_BATCH_LEARNING;if(!api?.run)throw new Error('批量学习模块尚未加载');
 for(const x of pack.learn)outcomes.push(await processOneLearn(x,api,options));for(const x of pack.syncOnly)outcomes.push({path:x.path,action:'SYNC',...(await strictSyncRecord(x.path,x.observedHash)||{})});
 return{files:pack.rows.length,changed:pack.changed.length,learned:pack.learn.length,syncOnly:pack.syncOnly.length,outcomes,pack}
}
async function loadStoredFolderContext(){if(!folderHandle)folderHandle=await dbGet(HANDLE_KEY).catch(()=>null);if(!folderScopeId)folderScopeId=await dbGet(FOLDER_SCOPE_KEY).catch(()=>null)||'';return{folderHandle,folderScopeId}}
async function scanStoredFolder({interactive=false,silent=false,reason='manual'}={}){
 if(typeof g.showDirectoryPicker!=='function'&&!folderHandle)return{unsupported:true,reason,outcomes:[]};
 await loadStoredFolderContext();
 if(!folderHandle){if(!interactive)return{notConfigured:true,reason,outcomes:[]};folderHandle=await chooseReviewFolder();if(!folderHandle)return{cancelled:true,reason,outcomes:[]}}
 let permission='granted';try{if(typeof folderHandle.queryPermission==='function')permission=await folderHandle.queryPermission({mode:'read'})}catch{permission='prompt'}
 if(permission!=='granted'){if(!interactive)return{needsPermission:true,reason,outcomes:[]};try{permission=typeof folderHandle.requestPermission==='function'?await folderHandle.requestPermission({mode:'read'}):'denied'}catch{permission='denied'};if(permission!=='granted')return{needsPermission:true,reason,outcomes:[]}}
 const out=await processReviewedFolderHandle(folderHandle,{silent,reason});return{...out,reason}
}
async function importReviewedFolder(){
 if(typeof g.showDirectoryPicker!=='function'){document.getElementById('knowledgeReviewedFile')?.click();return{fallback:true}}
 toast('正在读取审核文件夹并检查新数据…');const out=await scanStoredFolder({interactive:true,silent:false,reason:'manual'});
 if(out?.cancelled||out?.needsPermission)return out;if(!out.files){toast('审核文件夹里没有 XLSX / ZIP 文件。');return out}
 if(!out.changed&&!out.outcomes?.length){toast(`已检查 ${out.files} 个文件，没有新的审核数据。`);return out}
 const retry=(out.outcomes||[]).filter(x=>['FAILED','INVALID_RESULT'].includes(x.localStatus)||(x.localStatus==='LOCAL_SUCCESS'&&x.syncStatus==='SYNC_PENDING')).length,attention=(out.outcomes||[]).filter(x=>['UNMATCHED','CONFLICT'].includes(x.localStatus)).length,bad=retry+attention>0;
 toast(`审核学习完成：检查 ${out.files} 个文件，本次处理 ${out.changed} 个${retry?`，${retry} 个待重试`:''}${attention?`，${attention} 个待人工处理`:''}。`,bad);return out
}
function handleReviewedImportClick(){return importReviewedFolder().catch(e=>{toast('审核数据导入失败：'+(e?.message||e),true);throw e})}
function chooseExportMode(){return new Promise(resolve=>{const m=modalBase('v106ExportMode','导出统计发票','默认只生成 FACT。是否需要同时生成其他统计页面？');const a=m.querySelector('.v106-modal-actions');a.innerHTML='<button class="v106-secondary" data-mode="full">FACT + 其他页面</button><button class="v106-primary" data-mode="fact">仅生成 FACT</button>';const done=v=>{m.remove();resolve(v)};m.querySelector('.v106-x').onclick=()=>done('cancel');a.onclick=e=>{const b=e.target.closest('[data-mode]');if(b)done(b.dataset.mode)};setTimeout(()=>a.querySelector('[data-mode="fact"]')?.focus(),0)})}
function installSidebar(){const shell=$('.app-shell'),side=$('.sidebar');if(!shell||!side)return;document.body.classList.add('write-v106-simple');shell.classList.add('sidebar-collapsed');let b=$('#v106SidebarToggle');if(!b){b=document.createElement('button');b.id='v106SidebarToggle';b.className='v106-sidebar-toggle';b.type='button';b.setAttribute('aria-label','展开侧边栏');b.textContent='☰';side.prepend(b)}b.onclick=()=>{const c=shell.classList.toggle('sidebar-collapsed');b.setAttribute('aria-label',c?'展开侧边栏':'折叠侧边栏');b.textContent=c?'☰':'‹'}}
function installLandingExport(){const b=$('#landingExportButton');if(!b)return;b.onclick=e=>{e.preventDefault();toast('请先导入订单，再导出统计发票。')}}
function intro(){if(typeof g.showDirectoryPicker!=='function')return;dbGet(HANDLE_KEY).then(h=>{folderHandle=h;if(h)return;const m=modalBase('v106FolderIntro','设置人工审核文件夹','第一次使用请指定一个人工审核表文件夹。以后点击“导入审核后数据”，WRITE 会自动读取这个文件夹里的新文件并学习。');const a=m.querySelector('.v106-modal-actions');a.innerHTML='<button class="v106-secondary" data-later>稍后设置</button><button class="v106-primary" data-pick>选择文件夹</button>';m.querySelector('.v106-x').onclick=()=>m.remove();a.querySelector('[data-later]').onclick=()=>m.remove();a.querySelector('[data-pick]').onclick=async()=>{const h2=await chooseReviewFolder();if(h2)m.remove()}}).catch(()=>{})}
function start(){installSidebar();installLandingExport();intro()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V106_SIMPLE_WORKFLOW={VERSION,chooseExportMode,chooseReviewFolder,handleReviewedImportClick,importReviewedFolder,scanStoredFolder,getFolderStatus:loadStoredFolderContext,_test:{collect,scanChanged,digest,cleanIds,toRuleIds,idsDigest,validBatchContract,receiptCovers,classifyBatchResult,manifestGet,manifestBegin,manifestCas,manifestAction,strictSyncRecord,processOneLearn,processReviewedFolderHandle,setFolderHandle:h=>folderHandle=h,setFolderContext:async(h,scope='TEST_SCOPE',persist=false)=>{folderHandle=h;folderScopeId=scope;if(persist){await dbPut(HANDLE_KEY,h);await dbPut(FOLDER_SCOPE_KEY,scope)}return{folderHandle,folderScopeId}}}};
})(window);
