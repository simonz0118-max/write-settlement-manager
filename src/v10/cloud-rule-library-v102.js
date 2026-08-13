/* WRITE V10.2.1 — Rule Learning accessibility + canonical release history */
(function(g){'use strict';
const VERSION='10.2.6',API='/api/rules/catalog';let data=null,selected=new Set(),loading=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null||v===''?'—':String(v),byId=id=>document.getElementById(id);
const semver=v=>String(v||'0').replace(/^v/i,'').split('.').map(x=>Number.parseInt(x,10)||0);
function compareVersions(a,b){const A=semver(a),B=semver(b),n=Math.max(A.length,B.length);for(let i=0;i<n;i++){if((A[i]||0)!==(B[i]||0))return(B[i]||0)-(A[i]||0)}return 0}
function sortedHistory(list){return [...(list||[])].sort((a,b)=>compareVersions(a?.version,b?.version))}
function showView(name){
  const landing=byId('importLanding'),app=byId('appViews');if(app)app.hidden=false;if(landing)landing.hidden=true;
  document.querySelectorAll('.view[data-view-panel]').forEach(v=>v.classList.toggle('active',v.dataset.viewPanel===name));
  document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const panel=document.querySelector(`.view[data-view-panel="${name}"]`);panel?.scrollIntoView?.({block:'start'});
  if(name==='learning'){normalizeDataManagementPage();inject();setTimeout(()=>refresh(byId('crSearch')?.value.trim()||''),30)}
  if(name==='history')repairHistory();
}

function ensureV1026MenuStyle(){
  if(document.querySelector('style[data-v1026-menu-style]'))return;
  const st=document.createElement('style');st.setAttribute('data-v1026-menu-style','1');
  st.textContent='.nav-item[data-view="learning"]{display:flex!important;align-items:center!important;gap:12px!important}.nav-item[data-view="learning"] .v1026-nav-icon{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:18px!important;min-width:18px!important;font-size:14px!important;line-height:1!important;font-weight:600!important}.nav-item[data-view="learning"] .v1024-nav-label{display:inline-block!important;font-size:13px!important;line-height:1.2!important;font-weight:650!important;writing-mode:horizontal-tb!important;white-space:nowrap!important;letter-spacing:0!important}';
  document.head.appendChild(st);
}
function normalizeDataManagementPage(){
  ensureV1026MenuStyle();
  const nav=document.querySelector('.nav-item[data-view="learning"]');
  if(nav){
    [...nav.childNodes].forEach(n=>{if(n.nodeType===3)n.textContent=''});
    let icon=nav.querySelector('[data-v1026-nav-icon]');
    if(!icon){icon=document.createElement('span');nav.prepend(icon)}
    icon.setAttribute('data-v1026-nav-icon','1');icon.className='v1026-nav-icon';icon.textContent='⌘';
    let label=nav.querySelector('[data-v1024-nav-label]');
    if(!label){label=document.createElement('span');nav.appendChild(label)}
    label.setAttribute('data-v1024-nav-label','1');label.className='v1024-nav-label';label.textContent='数据管理';
    nav.setAttribute('aria-label','数据管理');nav.title='数据管理';
  }
  const host=document.querySelector('[data-view-panel="learning"]');
  if(!host)return;
  const head=host.querySelector('.page-head');
  if(head){const h1=head.querySelector('h1');if(h1)h1.textContent='数据管理';const eyebrow=head.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='CLOUD DATA';const sub=head.querySelector('p');if(sub)sub.textContent='Cloudflare D1 云端权威数据，可查询、修改、删除和维护。'}
  [...host.children].forEach(el=>{if(el===head||el.id==='cloudRuleLibrary')return;el.remove()});
}

function forceNavigation(){
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('.nav-item[data-view="learning"],.nav-item[data-view="history"]');if(!b)return;
    e.preventDefault();
    setTimeout(()=>showView(b.dataset.view),0);
  },true);
}
function inject(){
  const host=document.querySelector('[data-view-panel="learning"]');if(!host)return;normalizeDataManagementPage();if(byId('cloudRuleLibrary'))return;
  const sec=document.createElement('section');sec.id='cloudRuleLibrary';sec.className='panel cloud-rule-library';
  sec.innerHTML=`<div class="panel-head cloud-rule-head"><div><h2>云端数据管理</h2><p>Cloudflare D1 权威数据 · 按产品聚合展示，可检索、修改、删除。</p></div><div class="cloud-rule-badge"><i></i><span id="crCloudState">等待读取</span></div></div>
  <div class="cr-toolbar"><label class="cr-search">⌕ <textarea id="crSearch" rows="2" placeholder="搜索 SKU、产品名、FACT Description；多个关键词可用逗号或换行"></textarea></label><button id="crSearchBtn">模糊查找</button><button id="crClearBtn">清除</button><button id="crRefreshBtn">↻ 云端刷新</button></div>
  <div class="cr-batchbar"><label><input id="crSelectAll" type="checkbox"> 全选当前结果</label><span id="crSelectedCount">已选 0</span><button id="crBatchEdit" disabled>批量修改</button><button class="danger" id="crBatchDelete" disabled>批量删除</button></div>
  <div id="crSummary" class="cr-summary"></div><div id="crTable" class="cr-table"></div>
  <div class="cr-other"><button id="crOtherToggle">查看非产品规则 <b id="crOtherCount">0</b></button><div id="crOtherRules" hidden></div></div>`;
  const head=host.querySelector('.page-head');head?.after(sec);if(!head)host.appendChild(sec);normalizeDataManagementPage();bind();
}
async function request(url=API,opts){const r=await fetch(url,opts);const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw Object.assign(new Error(j.error||`HTTP ${r.status}`),{status:r.status,data:j});return j}
async function refresh(q=''){
  if(loading||!byId('crCloudState'))return;loading=true;byId('crCloudState').textContent='正在读取云端…';
  try{data=await request(API+(q?'?q='+encodeURIComponent(q):''));selected.clear();render();byId('crCloudState').textContent=`已同步 · ${data.counts.totalRules} 条规则`}
  catch(e){byId('crCloudState').textContent='云端读取失败';byId('crTable').innerHTML=`<div class="cr-empty bad">${esc(e.message)}</div>`}
  finally{loading=false}
}
function selectedProducts(){return(data?.products||[]).filter(p=>selected.has(p.id))}
function render(){
  const c=data?.counts||{};byId('crSummary').innerHTML=`<div><span>产品</span><b>${c.products||0}</b></div><div><span>Product规则</span><b>${c.reviewedProduct||0}</b></div><div><span>成本规则</span><b>${c.costModel||0}</b></div><div><span>FACT规则</span><b>${c.reviewedFact||0}</b></div><div class="cr-conflict-card" title="同一知识键出现两个不同人工结论。这里显示去重后的待处理冲突，不再把历史重复记录重复计数。"><span>待处理冲突</span><b>${c.conflicts||0}</b><small>${c.historicalConflictDuplicates?`历史重复 ${c.historicalConflictDuplicates}`:'无重复'}</small></div>`;
  const ps=data?.products||[];byId('crTable').innerHTML=ps.length?`<div class="cr-grid cr-th"><span></span><span>产品 / SKU</span><span>分类</span><span>范围</span><span>FACT / 成本</span><span>更新</span><span>操作</span></div>`+ps.map(row).join(''):`<div class="cr-empty">没有匹配的云端产品规则</div>`;
  byId('crOtherCount').textContent=(data?.otherRules||[]).length;renderOther();updateSelection();
}
function row(p){
  const scope=[...(p.origins||[]),...(p.countries||[]),...(p.currencies||[])].join(' · '),desc=(p.descriptions||[])[0]||'—';
  return `<div class="cr-row-wrap" data-id="${esc(p.id)}"><div class="cr-grid cr-row"><span><input class="cr-check" type="checkbox" data-id="${esc(p.id)}" ${selected.has(p.id)?'checked':''}></span>
  <span class="cr-cell cr-product"><b>${esc(p.productName||'待命名')}</b><small>${p.displayKind==='PACKAGE'?'套装 / Configuration':esc(p.sku||'无 SKU')}</small></span><span class="cr-cell cr-category">${esc(p.family||'—')}<small>${esc(p.role||'—')}</small></span><span class="cr-cell cr-scope">${esc(scope||'—')}</span>
  <span class="cr-cell cr-fact"><b>${p.factCount||0} FACT</b><small>${p.costCount||0} 成本 · ${esc(desc)}</small></span><span class="cr-cell cr-updated"><small>${esc((p.updatedAt||'').replace('T',' ').slice(0,19)||'—')}</small></span>
  <span class="cr-actions"><button data-detail="${esc(p.id)}">详情</button><button data-edit="${esc(p.id)}">修改</button><button class="danger" data-delete="${esc(p.id)}">删除</button></span></div>
  <div class="cr-details" id="crd-${cssId(p.id)}" hidden>${detailHtml(p)}</div></div>`;
}
const cssId=s=>String(s).replace(/[^a-z0-9_-]/gi,'_');
function ruleCard(r){return `<div class="cr-rule"><div><b>${esc(r.type)}</b><small>${esc(r.ruleId)} · v${r.version||1} · ${esc(r.source||'')}</small></div><pre>${esc(JSON.stringify(r.payload||{},null,2))}</pre><div><button data-rule-edit="${esc(r.ruleId)}">编辑 JSON</button><button class="danger" data-rule-delete="${esc(r.ruleId)}">删除规则</button></div></div>`}
function detailHtml(p){return `<div class="cr-detail-head"><b>${esc(p.productName||p.sku||p.id)}</b><span>${p.ruleCount||0} 条关联规则</span></div>${[...(p.rules||[]),...(p.factRules||[])].map(ruleCard).join('')}`}
function renderOther(){const o=data?.otherRules||[];byId('crOtherRules').innerHTML=o.map(ruleCard).join('')||'<div class="cr-empty">无其他规则</div>'}
function updateSelection(){byId('crSelectedCount').textContent=`已选 ${selected.size}`;byId('crBatchEdit').disabled=!selected.size;byId('crBatchDelete').disabled=!selected.size}
function findRule(id){for(const p of data?.products||[])for(const r of[...(p.rules||[]),...(p.factRules||[])])if(r.ruleId===id)return r;return(data?.otherRules||[]).find(r=>r.ruleId===id)}
function productMain(p){return(p.rules||[]).find(r=>r.type==='REVIEWED_PRODUCT')||(p.rules||[])[0]}
async function syncLocal(){try{await g.WRITE_KB?.sync?.({force:true})}catch{}}
async function mutate(operations){const j=await request(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operations})});await syncLocal();await refresh(byId('crSearch').value.trim());return j}
function editRule(rule){if(!rule)return;const txt=prompt(`编辑 ${rule.type} payload JSON：`,JSON.stringify(rule.payload||{},null,2));if(txt==null)return;let payload;try{payload=JSON.parse(txt)}catch{return alert('JSON 格式错误')}mutate([{action:'update',ruleId:rule.ruleId,expectedUpdatedAt:rule.updatedAt,payload}]).catch(e=>alert(e.status===409?'云端规则已被其他设备修改，请刷新后重试。':e.message))}
function editProduct(p){const r=productMain(p);if(!r)return alert('该产品没有可修改的主规则');const payload={...(r.payload||{})};const name=prompt('产品名称',payload.productName||p.productName||'');if(name==null)return;payload.productName=name;const sku=prompt('SKU',payload.sku||p.sku||'');if(sku==null)return;payload.sku=sku;const family=prompt('产品分类 / Family',payload.family||'');if(family==null)return;payload.family=family;const role=prompt('Role（PACKAGE / UPSELL / SERVICE / FEE / FREE_GIFT）',payload.role||'');if(role==null)return;payload.role=role;const desc=prompt('标准 Description',payload.normalizedDescription||payload.approvedFactDescription||'');if(desc==null)return;payload.normalizedDescription=desc;mutate([{action:'update',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt,payload}]).catch(e=>alert(e.status===409?'云端规则已被其他设备修改，请刷新后重试。':e.message))}
function deleteProduct(p){const rules=(p.rules||[]).filter(r=>['REVIEWED_PRODUCT','COST_MODEL','PRODUCT_CATEGORY'].includes(r.type));if(!rules.length)return;if(!confirm(`确定删除「${p.productName||p.sku||p.id}」的 ${rules.length} 条产品学习规则？共享 FACT 规则不会被连带删除。`))return;mutate(rules.map(r=>({action:'delete',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt}))).catch(e=>alert(e.message))}
function batchEdit(){const ps=selectedProducts();if(!ps.length)return;const family=prompt(`批量修改 ${ps.length} 个产品的 Family。留空表示不修改：`,'');if(family==null)return;const role=prompt('批量修改 Role。留空表示不修改：','');if(role==null)return;const ops=[];for(const p of ps){const r=productMain(p);if(!r)continue;const payload={...(r.payload||{})};if(family)payload.family=family;if(role)payload.role=role;if(family||role)ops.push({action:'update',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt,payload})}if(!ops.length)return alert('没有填写需要修改的字段');mutate(ops).catch(e=>alert(e.message))}
function batchDelete(){const ps=selectedProducts();if(!ps.length||!confirm(`确定批量删除 ${ps.length} 个产品的产品学习规则？共享 FACT 不删除。`))return;const ops=[];for(const p of ps)for(const r of(p.rules||[]))if(['REVIEWED_PRODUCT','COST_MODEL','PRODUCT_CATEGORY'].includes(r.type))ops.push({action:'delete',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt});mutate(ops).catch(e=>alert(e.message))}
function bind(){
  byId('crSearchBtn').onclick=()=>refresh(byId('crSearch').value.trim());byId('crClearBtn').onclick=()=>{byId('crSearch').value='';refresh('')};byId('crRefreshBtn').onclick=()=>refresh(byId('crSearch').value.trim());
  byId('crSearch').addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')refresh(e.currentTarget.value.trim())});
  byId('crSelectAll').onchange=e=>{for(const p of data?.products||[])e.target.checked?selected.add(p.id):selected.delete(p.id);render()};
  byId('crBatchEdit').onclick=batchEdit;byId('crBatchDelete').onclick=batchDelete;byId('crOtherToggle').onclick=()=>{const x=byId('crOtherRules');x.hidden=!x.hidden};
  byId('crTable').addEventListener('change',e=>{if(e.target.matches('.cr-check')){e.target.checked?selected.add(e.target.dataset.id):selected.delete(e.target.dataset.id);updateSelection()}});
  document.addEventListener('click',e=>{const d=e.target.closest('[data-detail]');if(d){const x=byId('crd-'+cssId(d.dataset.detail));if(x)x.hidden=!x.hidden;return}const ep=e.target.closest('[data-edit]');if(ep){editProduct((data?.products||[]).find(x=>x.id===ep.dataset.edit));return}const dp=e.target.closest('[data-delete]');if(dp){deleteProduct((data?.products||[]).find(x=>x.id===dp.dataset.delete));return}const re=e.target.closest('[data-rule-edit]');if(re){editRule(findRule(re.dataset.ruleEdit));return}const rd=e.target.closest('[data-rule-delete]');if(rd){const r=findRule(rd.dataset.ruleDelete);if(r&&confirm(`删除云端规则 ${r.type} / ${r.ruleId}？`))mutate([{action:'delete',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt}]).catch(e=>alert(e.message))}});
}
function releaseEntry(e){return `<article class="canonical-release-entry"><div class="canonical-release-version"><b>v${esc(e.version||'')}</b><small>${esc(e.time||'')}</small></div><div><h3>${esc(e.title||'WRITE Settlement Manager')}</h3>${(e.items||[]).map(x=>`<p>— ${esc(x)}</p>`).join('')}</div></article>`}
function repairHistory(){
  const host=document.querySelector('[data-view-panel="history"]');if(!host)return;
  const meta=g.WRITE_RELEASE_META||{},history=sortedHistory(meta.history||[]),current='10.2.5';
  host.querySelectorAll('.panel,.release-list,.history-list').forEach(x=>{if(x.id!=='canonicalReleaseHistory')x.hidden=true});
  let box=byId('canonicalReleaseHistory');if(!box){box=document.createElement('section');box.id='canonicalReleaseHistory';box.className='panel canonical-release-history';const head=host.querySelector('.page-head');head?.after(box)}
  box.innerHTML=`<div class="canonical-current"><span>当前版本</span><b>v${current}</b></div><div class="canonical-history-summary">WRITE Settlement Manager · ${history.length} 个历史版本</div><div class="canonical-release-list">${history.map(releaseEntry).join('')}</div>`;
}
function start(){normalizeDataManagementPage();inject();forceNavigation();document.body.dataset.release=VERSION;document.querySelectorAll('.brand-copy small').forEach(e=>e.textContent='v10.2.5 Production');if(document.querySelector('[data-view-panel="learning"].active'))refresh();if(document.querySelector('[data-view-panel="history"].active'))repairHistory()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_CLOUD_RULE_LIBRARY={VERSION,refresh,showView,repairHistory,_test:{compareVersions,sortedHistory}};
})(window);