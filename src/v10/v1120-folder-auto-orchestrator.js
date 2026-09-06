/* WRITE V11.2.0 — unattended reviewed-folder learning orchestrator */
(function(g){'use strict';
const VERSION='11.2.0';
const DB_NAME='WRITE_V106_SETTINGS',STORE='settings';
const CONFIG_KEY='folderAutomationConfigV1',STATUS_KEY='folderAutomationStatusV1';
const LOCK='WRITE_REVIEW_FOLDER_AUTO_SCAN';
const MIN_INTERVAL_MS=30_000,DEFAULT_INTERVAL_MS=60_000,MAX_INTERVAL_MS=15*60_000;
const DEFAULT_CONFIG=Object.freeze({enabled:true,intervalMs:DEFAULT_INTERVAL_MS,scanOnStartup:true,scanOnFocus:true,scanOnOnline:true});
let intervalTimer=0,retryTimer=0,activeRun=null,queuedReason='',failureCount=0;
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbGet(k){const d=await openDb();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,'readonly'),q=t.objectStore(STORE).get(k);q.onsuccess=()=>resolve(q.result??null);q.onerror=()=>reject(q.error);t.oncomplete=()=>d.close()})}
async function dbPut(k,v){const d=await openDb();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put(v,k);t.oncomplete=()=>{d.close();resolve()};t.onerror=()=>{d.close();reject(t.error)}})}
function normalizedConfig(raw){const v=raw&&typeof raw==='object'?raw:{},intervalMs=Math.max(MIN_INTERVAL_MS,Math.min(MAX_INTERVAL_MS,Number(v.intervalMs)||DEFAULT_INTERVAL_MS));return{...DEFAULT_CONFIG,...v,intervalMs}}
async function getConfig(){return normalizedConfig(await dbGet(CONFIG_KEY).catch(()=>null))}
async function setConfig(patch={}){const next=normalizedConfig({...await getConfig(),...patch});await dbPut(CONFIG_KEY,next);installInterval(next);await publish({phase:next.enabled?'IDLE':'DISABLED',config:next});return next}
async function publish(patch={}){const prev=await dbGet(STATUS_KEY).catch(()=>null)||{},next={...prev,...patch,version:VERSION,updatedAt:new Date().toISOString()};await dbPut(STATUS_KEY,next).catch(()=>{});g.dispatchEvent?.(new CustomEvent('write-folder-automation-status',{detail:next}));return next}
function retryDelayFor(count){return Math.min(MAX_INTERVAL_MS,30_000*(2**Math.min(Math.max(0,Number(count)||0),5)))}
function classifyOutcomes(outcomes=[]){
 const rows=Array.isArray(outcomes)?outcomes:[];
 const retryable=rows.filter(x=>['FAILED','INVALID_RESULT'].includes(x?.localStatus)||(x?.localStatus==='LOCAL_SUCCESS'&&x?.syncStatus==='SYNC_PENDING'));
 const attention=rows.filter(x=>['UNMATCHED','CONFLICT'].includes(x?.localStatus));
 const authRequired=retryable.some(x=>/\b401\b|UNAUTHORIZED|AUTH/i.test(String(x?.retryReason||x?.error||'')));
 return{retryable,attention,retryCount:retryable.length,attentionCount:attention.length,authRequired};
}
function scheduleRetry(){clearTimeout(retryTimer);const delay=retryDelayFor(failureCount);retryTimer=setTimeout(()=>requestScan('retry'),delay);publish({phase:'RETRY_WAIT',retryAt:new Date(Date.now()+delay).toISOString(),failureCount})}
function runWithLock(fn){if(navigator.locks?.request)return navigator.locks.request(LOCK,{mode:'exclusive'},fn);return fn()}
async function execute(reason){
 const config=await getConfig();if(!config.enabled)return publish({phase:'DISABLED',reason});
 if(reason==='interval'&&document.visibilityState!=='visible')return publish({phase:'IDLE',reason:'hidden-skip'});
 const workflow=g.WRITE_V106_SIMPLE_WORKFLOW;if(!workflow?.scanStoredFolder)throw new Error('FOLDER_WORKFLOW_NOT_READY');
 await publish({phase:'SCANNING',reason,startedAt:new Date().toISOString()});
 const result=await workflow.scanStoredFolder({interactive:false,silent:true,reason});
 if(result?.needsPermission){failureCount=0;clearTimeout(retryTimer);return publish({phase:'NEEDS_PERMISSION',reason,message:'需要点击一次重新授权文件夹',lastResult:result})}
 if(result?.notConfigured){failureCount=0;clearTimeout(retryTimer);return publish({phase:'NOT_CONFIGURED',reason,lastResult:result})}
 if(result?.unsupported){failureCount=0;clearTimeout(retryTimer);return publish({phase:'DISABLED',reason:'unsupported',lastResult:result})}
 const c=classifyOutcomes(result?.outcomes||[]);
 if(c.retryCount){failureCount+=1;scheduleRetry();return publish({phase:'PARTIAL',reason,retryCount:c.retryCount,attentionCount:c.attentionCount,authRequired:c.authRequired,failureCount,checked:Number(result.files||0),changed:Number(result.changed||0),learned:Number(result.learned||0),syncOnly:Number(result.syncOnly||0),lastResult:result})}
 failureCount=0;clearTimeout(retryTimer);
 if(c.attentionCount)return publish({phase:'PARTIAL',reason,retryCount:0,attentionCount:c.attentionCount,authRequired:false,checked:Number(result.files||0),changed:Number(result.changed||0),learned:Number(result.learned||0),syncOnly:Number(result.syncOnly||0),lastResult:result});
 return publish({phase:'SUCCESS',reason,retryCount:0,attentionCount:0,authRequired:false,checked:Number(result.files||0),changed:Number(result.changed||0),learned:Number(result.learned||0),syncOnly:Number(result.syncOnly||0),lastSuccessAt:new Date().toISOString(),lastResult:result})
}
function requestScan(reason='manual'){if(activeRun){queuedReason=queuedReason||reason;return activeRun}activeRun=runWithLock(()=>execute(reason)).catch(async e=>{failureCount+=1;scheduleRetry();return publish({phase:'FAILED',reason,failureCount,error:String(e?.message||e)})}).finally(()=>{activeRun=null;if(queuedReason){const next=queuedReason;queuedReason='';queueMicrotask(()=>requestScan(next))}});return activeRun}
function installInterval(config){clearInterval(intervalTimer);if(config.enabled)intervalTimer=setInterval(()=>requestScan('interval'),config.intervalMs)}
async function initialize(){const config=await getConfig();installInterval(config);if(config.scanOnFocus){g.addEventListener('focus',()=>requestScan('focus'));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')requestScan('visible')})}if(config.scanOnOnline)g.addEventListener('online',()=>requestScan('online'));g.addEventListener('write-review-folder-selected',()=>requestScan('folder-selected'));if(config.enabled&&config.scanOnStartup)setTimeout(()=>requestScan('startup'),1500);return publish({phase:config.enabled?'IDLE':'DISABLED',config})}
const api={VERSION,initialize,requestScan,getConfig,setConfig,getStatus:()=>dbGet(STATUS_KEY),_test:{retryDelayFor,classifyOutcomes,normalizedConfig}};g.WRITE_V112_FOLDER_AUTOMATION=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})(window);
