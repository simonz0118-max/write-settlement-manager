/* WRITE V10.1.5 — real XLSX/ZIP batch reviewed-learning controller */
(function(g){'use strict';
const VERSION='10.1.8';
const LIMIT_FILES=500,LIMIT_BYTES=250*1024*1024,MAX_NESTED_ZIP_DEPTH=2;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const buttons=()=>[...document.querySelectorAll('.reviewed-import-trigger,#knowledgeImportReviewed')],input=()=>document.getElementById('knowledgeReviewedFile');

function makeNamedBlob(bytes,name){
  let b;
  if(typeof File==='function')b=new File([bytes],name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  else {b=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});Object.defineProperty(b,'name',{value:name,configurable:true})}
  return b;
}
function safeEntryName(name=''){
  return String(name).replace(/\\/g,'/').replace(/^\/+/,'').split('/').filter(x=>x&&x!=='.'&&x!=='..').join('/');
}
async function extractZip(file,label=file.name,depth=0,state={count:0,bytes:0}){
  if(depth>MAX_NESTED_ZIP_DEPTH)throw new Error(`ZIP 嵌套超过 ${MAX_NESTED_ZIP_DEPTH} 层：${label}`);
  const reader=g.WRITE_V101_WORKBOOK?.readZip;if(!reader)throw new Error('ZIP 解析组件未加载');
  let map;try{map=await reader(file)}catch(e){throw new Error(`ZIP 无法读取：${label} · ${e?.message||e}`)}
  const out=[];
  for(const [rawName,bytes] of map.entries()){
    const name=safeEntryName(rawName);
    if(!name||name.endsWith('/')||name.startsWith('__MACOSX/')||/(^|\/)\._/.test(name))continue;
    const lower=name.toLowerCase();
    if(lower.endsWith('.xlsx')){
      state.count++;state.bytes+=bytes.byteLength||bytes.length||0;
      if(state.count>LIMIT_FILES)throw new Error(`ZIP 内 XLSX 超过 ${LIMIT_FILES} 个，已停止`);
      if(state.bytes>LIMIT_BYTES)throw new Error('ZIP 解压后的 XLSX 总大小超过 250 MB，已停止');
      out.push({file:makeNamedBlob(bytes,`${label} › ${name}`),sourceZip:label,entry:name});
    }else if(lower.endsWith('.zip')&&depth<MAX_NESTED_ZIP_DEPTH){
      const nested=new Blob([bytes],{type:'application/zip'});Object.defineProperty(nested,'name',{value:name,configurable:true});
      out.push(...await extractZip(nested,`${label} › ${name}`,depth+1,state));
    }
  }
  return out;
}
async function expandInputFiles(files){
  const expanded=[],sourceSummary=[];
  for(const f of [...files]){
    const name=String(f.name||'');
    if(/\.xlsx$/i.test(name)){expanded.push({file:f,sourceZip:'',entry:name});sourceSummary.push({name,type:'xlsx',count:1})}
    else if(/\.zip$/i.test(name)){
      const rows=await extractZip(f,name,0,{count:0,bytes:0});
      if(!rows.length)sourceSummary.push({name,type:'zip',count:0,error:'ZIP 内没有找到 XLSX'});
      else {expanded.push(...rows);sourceSummary.push({name,type:'zip',count:rows.length})}
    }
  }
  return{expanded,sourceSummary};
}

function panel(){let p=document.getElementById('reviewLearningStatusCenter');if(p)return p;p=document.createElement('section');p.id='reviewLearningStatusCenter';p.className='review-learning-center';p.hidden=true;p.innerHTML=`<div class="review-learning-card"><div class="review-learning-head"><div><span>KNOWLEDGE LEARNING</span><h3 id="rlTitle">人工审核学习</h3></div><button id="rlClose">×</button></div><div class="rl-progress"><i id="rlBar"></i></div><p id="rlMsg"></p><div id="rlSources" class="rl-sources"></div><div id="rlFiles" class="rl-files"></div><div id="rlTotals" class="rl-totals"></div><div id="rlSync" class="rl-sync"></div><div id="rlActions" class="rl-actions"><button id="rlAgain">继续导入</button><button id="rlDone">完成</button></div></div>`;document.body.appendChild(p);p.querySelector('#rlClose').onclick=()=>p.hidden=true;p.querySelector('#rlDone').onclick=()=>p.hidden=true;p.querySelector('#rlAgain').onclick=()=>{p.hidden=true;if(g.WRITE_V106_SIMPLE_WORKFLOW?.handleReviewedImportClick)g.WRITE_V106_SIMPLE_WORKFLOW.handleReviewedImportClick().catch(()=>{});else input()?.click()};return p}
function view(title,msg,pct,working=true){const p=panel();p.hidden=false;p.querySelector('#rlTitle').textContent=title;p.querySelector('#rlMsg').textContent=msg;p.querySelector('#rlBar').style.width=Math.max(0,Math.min(100,pct))+'%';p.querySelector('#rlActions').hidden=working;return p}
function setBusy(v){for(const b of buttons()){if(!b.dataset.originalHtml)b.dataset.originalHtml=b.innerHTML;b.disabled=v;if(!v)b.innerHTML=b.dataset.originalHtml;}}
function aggregate(rows){return rows.reduce((a,x)=>{const r=x.result||{};for(const k of['factRules','productRules','costRules','conflicts','unmatched','ignoredFR','ignoredFRSheets','alreadyLearned','newRules'])a[k]+=num(r[k]);for(const id of(r.ruleIds||[]))a.ruleIds.add(String(id));x.ok?a.success++:a.failed++;return a},{factRules:0,productRules:0,costRules:0,conflicts:0,unmatched:0,ignoredFR:0,ignoredFRSheets:0,alreadyLearned:0,newRules:0,success:0,failed:0,ruleIds:new Set()})}
function renderSources(p,rows){p.querySelector('#rlSources').innerHTML=rows.map(x=>`<div class="rl-source"><b>${esc(x.name)}</b><small>${x.error?esc(x.error):(x.type==='zip'?`已解包 ${x.count} 个 XLSX`:'XLSX')}</small></div>`).join('')}
function renderFiles(p,rows){p.querySelector('#rlFiles').innerHTML=rows.map(x=>`<div class="rl-file ${x.ok?'ok':'bad'}"><i>${x.ok?'✓':'!'}</i><div><b>${esc(x.name)}</b><small>${x.ok?`${num(x.result.newRules)} 新增 · ${num(x.result.alreadyLearned)} 云端已收录 · ${num(x.result.conflicts)} 冲突`:esc(x.error)}</small></div></div>`).join('')}
function syncSummary(x){if(!x||typeof x!=='object')return'';const bits=[];for(const k of['pushed','pulled','uploaded','downloaded','conflicts'])if(Number.isFinite(Number(x[k])))bits.push(`${k} ${x[k]}`);return bits.length?' · '+bits.join(' / '):''}
async function syncCloud(expectedRuleIds=[]){try{if(!g.WRITE_KB?.sync)throw Error('知识库未提供云同步接口');const detail=await g.WRITE_KB.sync({force:true});if(!detail?.ok)throw Error(detail?.error||detail?.reason||'Cloud sync 未确认');const receipt=g.WRITE_KB?.cloudReceiptStatus?.()||{};if(!receipt.cloud||Number(receipt.pending||0)!==0)throw Error('云端回执未闭环：待同步 '+Number(receipt.pending||0));const cloudIds=new Set([...(detail.acceptedRuleIds||[]),...(detail.cloudRuleIds||[])].map(String));const expected=[...expectedRuleIds].map(String).filter(Boolean),missing=expected.filter(id=>!cloudIds.has(id));if(missing.length)throw Error(`云端未验证到 ${missing.length} 条本批知识规则`);return{ok:true,msg:`云端已收录 ${expected.length} 条 · 本次上传 ${num(detail.pushed)} · 云端拉取 ${num(detail.pulled)} · 待同步 0`,detail,receipt,verifiedRuleIds:expected.length}}catch(e){return{ok:false,msg:'云端收录未确认：'+(e?.message||e),detail:null}}}

async function run(files){
  const raw=[...files].filter(f=>/\.(xlsx|zip)$/i.test(String(f.name||'')));if(!raw.length)throw Error('请选择 XLSX 或 ZIP 文件');
  setBusy(true);g.WRITE_KB?.beginBatchLearning?.();let p=view('正在解析批量学习文件',`已选择 ${raw.length} 个文件`,5,true);p.querySelector('#rlFiles').innerHTML='';p.querySelector('#rlTotals').innerHTML='';p.querySelector('#rlSync').innerHTML='<i></i>等待本地学习完成';
  let pack;try{pack=await expandInputFiles(raw)}catch(e){setBusy(false);throw e}
  renderSources(p,pack.sourceSummary);
  if(!pack.expanded.length){setBusy(false);throw Error('没有找到可学习的 XLSX；ZIP 必须包含 .xlsx 文件')}
  const rows=[],api=g.WRITE_V101_REVIEW_LEARNING;if(!api?.importReviewedWorkbook){setBusy(false);throw Error('审核学习模块尚未加载')}
  for(let i=0;i<pack.expanded.length;i++){
    const item=pack.expanded[i],f=item.file;view('正在批量学习',`[${i+1}/${pack.expanded.length}] ${f.name}`,12+Math.round(65*i/pack.expanded.length),true);renderSources(p,pack.sourceSummary);
    try{rows.push({name:f.name,ok:true,result:await api.importReviewedWorkbook(f,{skipSync:true})})}
    catch(e){rows.push({name:f.name,ok:false,error:e?.message||String(e)})}
    renderFiles(p,rows)
  }
  const t=aggregate(rows);view('正在同步 Cloudflare D1',`${t.success} 个工作簿成功 / ${t.failed} 个失败`,84,true);renderSources(p,pack.sourceSummary);renderFiles(p,rows);
  g.WRITE_KB?.endBatchLearning?.();const cloud=await syncCloud(t.ruleIds);view(t.failed?'批量学习完成（部分失败）':'批量学习完成',`源文件 ${raw.length} 个 · 实际 XLSX ${pack.expanded.length} 个`,100,false);renderSources(p,pack.sourceSummary);renderFiles(p,rows);
  p.querySelector('#rlTotals').innerHTML=`<div><span>成功 XLSX</span><b>${t.success}</b></div><div><span>失败 XLSX</span><b>${t.failed}</b></div><div><span>FACT</span><b>${t.factRules}</b></div><div><span>商品</span><b>${t.productRules}</b></div><div><span>新增知识</span><b>${t.newRules}</b></div><div><span>云端已收录</span><b>${t.alreadyLearned}</b></div><div><span>成本</span><b>${t.costRules}</b></div><div><span>未闭环</span><b>${t.unmatched}</b></div><div><span>冲突</span><b>${t.conflicts}</b></div><div><span>忽略 FR</span><b>${t.ignoredFR+t.ignoredFRSheets}</b></div>`;
  p.querySelector('#rlSync').innerHTML=`<i class="${cloud.ok?'ok':'bad'}"></i>${esc(cloud.msg)}`;setBusy(false);
  return{sources:pack.sourceSummary,rows,totals:t,cloud}
}
function install(){const i=input();if(!i)return;i.multiple=true;i.accept='.xlsx,.zip';document.addEventListener('click',e=>{const b=e.target?.closest?.('.reviewed-import-trigger,#knowledgeImportReviewed');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(g.WRITE_V106_SIMPLE_WORKFLOW?.handleReviewedImportClick){g.WRITE_V106_SIMPLE_WORKFLOW.handleReviewedImportClick().catch(err=>{const p=view('学习失败',err?.message||String(err),100,false);p.querySelector('#rlSync').innerHTML='<i class="bad"></i>未完成审核学习'});return}i.click()},true);i.addEventListener('change',async()=>{const fs=[...(i.files||[])];i.value='';if(!fs.length)return;try{await run(fs)}catch(e){g.WRITE_KB?.endBatchLearning?.();setBusy(false);const p=view('学习失败',e?.message||String(e),100,false);p.querySelector('#rlSync').innerHTML='<i class="bad"></i>未上传云端'}},true)}
function start(){install();panel()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V1015_BATCH_LEARNING={VERSION,run,expandInputFiles,extractZip,_test:{safeEntryName,aggregate}};
})(window);