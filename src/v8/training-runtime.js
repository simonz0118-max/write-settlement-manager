/* WRITE V8.1 Training Shadow Runtime
 * Loads registry/verified seeds. Never changes production FACT automatically.
 */
(function(global){
'use strict';
let state={registry:null,seeds:[],plan:null,error:null};

async function json(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
function panel(){
  let el=document.getElementById('v81TrainingPanel');
  if(el)return el;
  const parent=document.getElementById('v8SemanticAuditPanel')?.parentElement||
               document.querySelector('[data-view-panel="dashboard"] .dashboard-grid');
  if(!parent)return null;
  el=document.createElement('section');
  el.id='v81TrainingPanel';el.className='panel wide v81-training-panel';
  el.innerHTML=`<div class="panel-head"><div><h2>V8.1 历史训练安全</h2>
    <p>只有 COMPLETE 历史 FACT 可贡献规则；PARTIAL 永久隔离</p></div><span id="v81TrainingStatus">加载中</span></div>
    <div class="v8-audit-grid" id="v81TrainingGrid"></div>
    <div id="v81TrainingNote"></div>`;
  parent.appendChild(el);return el;
}
function render(){
  panel();
  const g=document.getElementById('v81TrainingGrid'),s=document.getElementById('v81TrainingStatus'),n=document.getElementById('v81TrainingNote');
  if(!g||!s||!n)return;
  if(state.error){s.textContent='训练资料异常（不影响开票）';n.textContent=state.error;return}
  const docs=state.registry?.documents||[],p=state.plan||{accepted:[],excluded:[],duplicates:[]};
  const partial=docs.filter(x=>x.status==='PARTIAL').length;
  const reference=docs.filter(x=>x.status==='REFERENCE_ONLY').length;
  g.innerHTML=[
    ['已登记资料',docs.length],['可训练 COMPLETE',p.accepted.length],
    ['隔离 PARTIAL',partial],['仅参考',reference],
    ['验证种子规则',state.seeds.length],['重复资料',p.duplicates.length]
  ].map(([k,v])=>`<article><span>${k}</span><strong>${Number(v||0).toLocaleString('fr-FR')}</strong></article>`).join('');
  s.textContent='训练安全门正常';
  n.innerHTML=`<div class="success-strip">✓ PARTIAL / REFERENCE_ONLY / REJECTED 不会写入长期规则库</div>`;
}
async function load(){
  try{
    const [registry,seedsDoc]=await Promise.all([
      json('./data/v8/historical-training-registry.json?v=8.1.0-001'),
      json('./data/v8/verified-seed-rules.json?v=8.1.0-001')
    ]);
    state.registry=registry;state.seeds=seedsDoc.rules||[];
    state.plan=global.WRITE_HISTORICAL_TRAINING_V81.trainingPlan(registry.documents||[]);
    // Seed only verified rules and never overwrite an existing human correction.
    const existing=await global.WRITE_RULE_STORE_V8?.getAll?.().catch(()=>[])||[];
    const ids=new Set(existing.map(x=>x.id));
    const safeSeeds=state.seeds.filter(r=>!ids.has(r.id)&&r.humanConfirmed&&
      ['VERIFIED_MANUAL_FACT','VERIFIED_HISTORICAL_RULE'].includes(r.sourceType));
    if(safeSeeds.length)await global.WRITE_RULE_STORE_V8?.putMany?.(safeSeeds).catch(()=>{});
  }catch(e){state.error=e?.message||String(e)}
  render();return state;
}
function start(){panel();load()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
global.WRITE_V81_TRAINING={VERSION:'8.1.0',load,getState:()=>state};
})(window);
