/* WRITE V10.1.3 — reviewed-learning status center */
(function(g){'use strict';
const VERSION='10.1.3', STORAGE_KEY='write-reviewed-learning-last-v1013';
const clean=v=>String(v??'').trim();
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function buttons(){return [...document.querySelectorAll('.reviewed-import-trigger,#knowledgeImportReviewed')]}
function input(){return document.getElementById('knowledgeReviewedFile')}
function restoreButtons(){
 for(const b of buttons()){
  if(b.dataset.originalHtml)b.innerHTML=b.dataset.originalHtml;
  b.disabled=false;b.removeAttribute('aria-busy');
 }
}
function setButtonsBusy(label){
 for(const b of buttons()){
  if(!b.dataset.originalHtml)b.dataset.originalHtml=b.innerHTML;
  b.disabled=true;b.setAttribute('aria-busy','true');
  b.innerHTML=`<span class="review-learning-spinner" aria-hidden="true"></span><div><b>${esc(label)}</b><small>请勿关闭页面</small></div>`;
 }
}
function ensurePanel(){
 let p=document.getElementById('reviewLearningStatusCenter');if(p)return p;
 p=document.createElement('section');p.id='reviewLearningStatusCenter';p.className='review-learning-center';p.hidden=true;
 p.innerHTML=`<div class="review-learning-card">
  <div class="review-learning-head"><div><span class="review-learning-kicker">KNOWLEDGE LEARNING</span><h3 id="reviewLearningTitle">人工审核学习</h3></div><button id="reviewLearningClose" type="button" aria-label="关闭">×</button></div>
  <div class="review-learning-progress"><div id="reviewLearningProgressBar"></div></div>
  <p id="reviewLearningMessage">等待导入</p>
  <div class="review-learning-stats" id="reviewLearningStats"></div>
  <div class="review-learning-sync" id="reviewLearningSync"></div>
  <div class="review-learning-actions"><button id="reviewLearningAgain" type="button">继续导入审核表</button><button id="reviewLearningDone" type="button">返回首页</button></div>
 </div>`;
 document.body.appendChild(p);
 p.querySelector('#reviewLearningClose').onclick=()=>hide();
 p.querySelector('#reviewLearningDone').onclick=()=>hide();
 p.querySelector('#reviewLearningAgain').onclick=()=>{hide();input()?.click()};
 return p;
}
function show(stage,title,message,percent=0){
 const p=ensurePanel();p.hidden=false;p.dataset.stage=stage;
 p.querySelector('#reviewLearningTitle').textContent=title;
 p.querySelector('#reviewLearningMessage').textContent=message;
 p.querySelector('#reviewLearningProgressBar').style.width=`${Math.max(0,Math.min(100,percent))}%`;
 p.querySelector('.review-learning-actions').hidden=stage==='working';
 return p;
}
function hide(){const p=ensurePanel();p.hidden=true;restoreButtons()}
function statsHtml(r={}){
 const mode=r.mode==='LEGACY_CN'?'历史人工 FACT':'新版审核工作簿';
 const matched=r.matchedRows==null?'—':n(r.matchedRows);
 const ignored=n(r.ignoredFR)+n(r.ignoredFRSheets);
 return `<div><span>识别模式</span><b>${esc(mode)}</b></div>
 <div><span>FACT 规则</span><b>${n(r.factRules)}</b></div>
 <div><span>商品规则</span><b>${n(r.productRules)}</b></div>
 <div><span>成本规则</span><b>${n(r.costRules)}</b></div>
 <div><span>闭环匹配</span><b>${matched}</b></div>
 <div><span>忽略 FR</span><b>${ignored}</b></div>
 <div><span>未闭环</span><b>${n(r.unmatched)}</b></div>
 <div><span>冲突</span><b>${n(r.conflicts)}</b></div>`;
}
function saveLast(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}}
function loadLast(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function renderPersistent(data){
 let box=document.getElementById('reviewLearningPersistent');
 if(!box){
  box=document.createElement('div');box.id='reviewLearningPersistent';box.className='review-learning-persistent';
  const target=document.querySelector('.landing-actions')||document.querySelector('.dashboard-hero .hero-buttons');
  target?.parentElement?.appendChild(box);
 }
 if(!box)return;
 if(!data){box.hidden=true;return}
 box.hidden=false;
 const ok=data.status==='success',r=data.result||{};
 box.innerHTML=`<div class="review-learning-persistent-icon">${ok?'✓':'!'}</div><div><b>${ok?'最近一次学习已完成':'最近一次学习失败'}</b><small>${esc(data.file||'')} · ${esc(data.time||'')}</small><span>${ok?`${n(r.factRules)} FACT / ${n(r.productRules)} 商品 / ${n(r.costRules)} 成本 · 云端${data.cloudConfirmed?'已确认':'未确认'}`:esc(data.error||'未知错误')}</span></div>`;
}
async function confirmCloud(r){
 const kb=g.WRITE_KB;if(!kb?.sync)return {confirmed:false,message:'知识库未提供云同步接口'};
 try{
  show('working','正在上传云端','本地学习完成，正在同步 Cloudflare D1…',82);
  const syncResult=await kb.sync({force:true});
  // sync() returning without throwing is the application's authoritative success signal.
  return {confirmed:true,message:'Cloudflare D1 同步调用成功',detail:syncResult??null};
 }catch(e){
  return {confirmed:false,message:`云端同步失败：${e?.message||e}`};
 }
}
async function run(file){
 setButtonsBusy('正在识别审核表…');
 const p=show('working','正在识别审核表',file.name,12);
 p.querySelector('#reviewLearningStats').innerHTML='';
 p.querySelector('#reviewLearningSync').innerHTML='<span class="sync-dot pending"></span> 等待云端同步';
 try{
  const api=g.WRITE_V101_REVIEW_LEARNING;if(!api?.importReviewedWorkbook)throw new Error('审核学习模块尚未加载');
  show('working','正在学习 CN 数据','正在建立 FACT、SKU、产品名称、配置和成本规则…',45);
  const r=await api.importReviewedWorkbook(file);
  p.querySelector('#reviewLearningStats').innerHTML=statsHtml(r);
  const cloud=await confirmCloud(r);
  const total=n(r.factRules)+n(r.productRules)+n(r.costRules);
  const success=total>0 && cloud.confirmed;
  const title=success?'学习并上传完成':'学习完成，但需要检查';
  const message=success?`已学习 ${total} 条知识规则，并确认云端同步调用成功。`:
    total===0?'没有产生可学习规则；文件可能没有可闭环的 CN 数据。':cloud.message;
  show(success?'success':'warning',title,message,100);
  p.querySelector('#reviewLearningStats').innerHTML=statsHtml(r);
  p.querySelector('#reviewLearningSync').innerHTML=`<span class="sync-dot ${cloud.confirmed?'ok':'bad'}"></span> ${esc(cloud.message)}`;
  const record={status:success?'success':'warning',file:file.name,time:new Date().toLocaleString(),result:r,cloudConfirmed:cloud.confirmed,cloudMessage:cloud.message};
  saveLast(record);renderPersistent(record);
  for(const b of buttons()){b.disabled=false;b.removeAttribute('aria-busy');b.innerHTML=b.dataset.originalHtml||b.innerHTML}
  window.dispatchEvent(new CustomEvent('write-reviewed-learning-finished',{detail:record}));
  return record;
 }catch(err){
  console.error('[WRITE reviewed learning]',err);
  show('error','学习失败',err?.message||String(err),100);
  p.querySelector('#reviewLearningStats').innerHTML='';
  p.querySelector('#reviewLearningSync').innerHTML='<span class="sync-dot bad"></span> 未上传云端';
  const record={status:'error',file:file.name,time:new Date().toLocaleString(),error:err?.message||String(err),cloudConfirmed:false};
  saveLast(record);renderPersistent(record);restoreButtons();
  return record;
 }
}
function install(){
 const i=input();if(!i)return;
 // Capture phase owns the trigger, but never changes application view.
 document.addEventListener('click',e=>{
  const b=e.target?.closest?.('.reviewed-import-trigger,#knowledgeImportReviewed');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();i.click();
 },true);
 i.addEventListener('change',async()=>{const f=i.files?.[0];if(!f)return;i.value='';await run(f)},true);
 renderPersistent(loadLast());
}
function start(){
 install();ensurePanel();document.body.dataset.release=VERSION;
 for(const e of document.querySelectorAll('.brand-copy small'))e.textContent='v10.1.3 Production';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V1013_HERO_LEARNING={VERSION,install,run,show,hide,loadLast};
})(window);
