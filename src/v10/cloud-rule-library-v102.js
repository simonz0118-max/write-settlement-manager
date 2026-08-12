/* WRITE V10.2.0 — Cloud Rule Learning Center */
(function(g){'use strict';
const VERSION='10.2.0',API='/api/rules/catalog';let data=null,selected=new Set(),loading=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null||v===''?'—':String(v);const byId=id=>document.getElementById(id);
function selectedProducts(){return (data?.products||[]).filter(p=>selected.has(p.id))}
function inject(){
  const host=document.querySelector('[data-view-panel="learning"]');if(!host||byId('cloudRuleLibrary'))return;
  const sec=document.createElement('section');sec.id='cloudRuleLibrary';sec.className='panel cloud-rule-library';
  sec.innerHTML=`<div class="panel-head cloud-rule-head"><div><h2>云端规则学习库</h2><p>Cloudflare D1 权威数据 · 每个产品一条，可检索、修改、删除。</p></div><div class="cloud-rule-badge"><i></i><span id="crCloudState">等待读取</span></div></div>
  <div class="cr-toolbar"><label class="cr-search">⌕ <textarea id="crSearch" rows="2" placeholder="SKU / 产品名 / FACT Description；多个关键词用逗号或换行分隔"></textarea></label><button id="crSearchBtn">模糊查找</button><button id="crClearBtn">清除</button><button id="crRefreshBtn">↻ 云端刷新</button></div>
  <div class="cr-batchbar"><label><input id="crSelectAll" type="checkbox"> 全选当前结果</label><span id="crSelectedCount">已选 0</span><button id="crBatchEdit" disabled>批量修改</button><button class="danger" id="crBatchDelete" disabled>批量删除</button></div>
  <div id="crSummary" class="cr-summary"></div><div id="crTable" class="cr-table"></div>
  <div class="cr-other"><button id="crOtherToggle">查看非产品规则 <b id="crOtherCount">0</b></button><div id="crOtherRules" hidden></div></div>`;
  host.appendChild(sec);
  bind();
}
async function request(url=API,opts){const r=await fetch(url,opts);const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw Object.assign(new Error(j.error||`HTTP ${r.status}`),{status:r.status,data:j});return j}
async function refresh(q=''){
  if(loading)return;loading=true;byId('crCloudState').textContent='正在读取云端…';
  try{data=await request(API+(q?'?q='+encodeURIComponent(q):''));selected.clear();render();byId('crCloudState').textContent=`已同步 · ${data.counts.totalRules} 条规则`}
  catch(e){byId('crCloudState').textContent='云端读取失败';byId('crTable').innerHTML=`<div class="cr-empty bad">${esc(e.message)}</div>`}
  finally{loading=false}
}
function render(){
  const c=data?.counts||{};byId('crSummary').innerHTML=`<div><span>产品</span><b>${c.products||0}</b></div><div><span>Product规则</span><b>${c.reviewedProduct||0}</b></div><div><span>成本规则</span><b>${c.costModel||0}</b></div><div><span>FACT规则</span><b>${c.reviewedFact||0}</b></div><div><span>冲突</span><b>${c.conflicts||0}</b></div>`;
  const ps=data?.products||[];byId('crTable').innerHTML=ps.length?`<div class="cr-grid cr-th"><span></span><span>产品 / SKU</span><span>分类</span><span>范围</span><span>FACT / 成本</span><span>更新</span><span>操作</span></div>`+ps.map(row).join(''):`<div class="cr-empty">没有匹配的云端产品规则</div>`;
  byId('crOtherCount').textContent=(data?.otherRules||[]).length;renderOther();updateSelection();
}
function row(p){
  const scope=[...(p.origins||[]),...(p.countries||[]),...(p.currencies||[])].join(' · ');
  const desc=(p.descriptions||[])[0]||'—';
  return `<div class="cr-row-wrap" data-id="${esc(p.id)}"><div class="cr-grid cr-row">
    <span><input class="cr-check" type="checkbox" data-id="${esc(p.id)}" ${selected.has(p.id)?'checked':''}></span>
    <span><b>${esc(p.productName||'未命名产品')}</b><small>${esc(p.sku||'无 SKU')}</small></span>
    <span>${esc(p.family||'—')}<small>${esc(p.role||'—')}</small></span><span>${esc(scope||'—')}</span>
    <span><b>${p.factCount||0} FACT</b><small>${p.costCount||0} 成本 · ${esc(desc)}</small></span>
    <span><small>${esc((p.updatedAt||'').replace('T',' ').slice(0,19)||'—')}</small></span>
    <span class="cr-actions"><button data-detail="${esc(p.id)}">详情</button><button data-edit="${esc(p.id)}">修改</button><button class="danger" data-delete="${esc(p.id)}">删除</button></span>
  </div><div class="cr-details" id="crd-${cssId(p.id)}" hidden>${detailHtml(p)}</div></div>`;
}
const cssId=s=>String(s).replace(/[^a-z0-9_-]/gi,'_');
function ruleCard(r){
  return `<div class="cr-rule"><div><b>${esc(r.type)}</b><small>${esc(r.ruleId)} · v${r.version||1} · ${esc(r.source||'')}</small></div><pre>${esc(JSON.stringify(r.payload||{},null,2))}</pre><div><button data-rule-edit="${esc(r.ruleId)}">编辑 JSON</button><button class="danger" data-rule-delete="${esc(r.ruleId)}">删除规则</button></div></div>`;
}
function detailHtml(p){return `<div class="cr-detail-head"><b>${esc(p.productName||p.sku||p.id)}</b><span>${p.ruleCount||0} 条关联规则</span></div>${[...(p.rules||[]),...(p.factRules||[])].map(ruleCard).join('')}`}
function renderOther(){const o=data?.otherRules||[];byId('crOtherRules').innerHTML=o.map(ruleCard).join('')||'<div class="cr-empty">无其他规则</div>'}
function updateSelection(){byId('crSelectedCount').textContent=`已选 ${selected.size}`;byId('crBatchEdit').disabled=!selected.size;byId('crBatchDelete').disabled=!selected.size}
function findRule(id){for(const p of data?.products||[]){for(const r of [...(p.rules||[]),...(p.factRules||[])])if(r.ruleId===id)return r}return (data?.otherRules||[]).find(r=>r.ruleId===id)}
function productMain(p){return (p.rules||[]).find(r=>r.type==='REVIEWED_PRODUCT')||(p.rules||[])[0]}
async function syncLocal(){try{await g.WRITE_KB?.sync?.({force:true})}catch{}}
async function mutate(operations){const j=await request(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operations})});await syncLocal();await refresh(byId('crSearch').value.trim());return j}
function editRule(rule){
  if(!rule)return;const txt=prompt(`编辑 ${rule.type} payload JSON：`,JSON.stringify(rule.payload||{},null,2));if(txt==null)return;
  let payload;try{payload=JSON.parse(txt)}catch{return alert('JSON 格式错误')}
  mutate([{action:'update',ruleId:rule.ruleId,expectedUpdatedAt:rule.updatedAt,payload}]).catch(e=>alert(e.status===409?'云端规则已被其他设备修改，请刷新后重试。':e.message));
}
function editProduct(p){
  const r=productMain(p);if(!r)return alert('该产品没有可修改的主规则');
  const payload={...(r.payload||{})};
  const name=prompt('产品名称',payload.productName||p.productName||'');if(name==null)return;payload.productName=name;
  const sku=prompt('SKU',payload.sku||p.sku||'');if(sku==null)return;payload.sku=sku;
  const family=prompt('产品分类 / Family',payload.family||'');if(family==null)return;payload.family=family;
  const role=prompt('Role（PACKAGE / UPSELL / SERVICE / FEE / FREE_GIFT）',payload.role||'');if(role==null)return;payload.role=role;
  const desc=prompt('标准 Description',payload.normalizedDescription||payload.approvedFactDescription||'');if(desc==null)return;payload.normalizedDescription=desc;
  mutate([{action:'update',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt,payload}]).catch(e=>alert(e.status===409?'云端规则已被其他设备修改，请刷新后重试。':e.message));
}
function deleteProduct(p){
  const rules=(p.rules||[]).filter(r=>['REVIEWED_PRODUCT','COST_MODEL','PRODUCT_CATEGORY'].includes(r.type));
  if(!rules.length)return;if(!confirm(`确定删除「${p.productName||p.sku||p.id}」的 ${rules.length} 条产品学习规则？共享 FACT 规则不会被连带删除。`))return;
  mutate(rules.map(r=>({action:'delete',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt}))).catch(e=>alert(e.message));
}
function batchEdit(){
  const ps=selectedProducts();if(!ps.length)return;
  const family=prompt(`批量修改 ${ps.length} 个产品的 Family。留空表示不修改：`,'');if(family==null)return;
  const role=prompt('批量修改 Role。留空表示不修改：','');if(role==null)return;
  const ops=[];for(const p of ps){const r=productMain(p);if(!r)continue;const payload={...(r.payload||{})};if(family)payload.family=family;if(role)payload.role=role;if(family||role)ops.push({action:'update',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt,payload})}
  if(!ops.length)return alert('没有填写需要修改的字段');mutate(ops).catch(e=>alert(e.message));
}
function batchDelete(){
  const ps=selectedProducts();if(!ps.length||!confirm(`确定批量删除 ${ps.length} 个产品的产品学习规则？共享 FACT 不删除。`))return;
  const ops=[];for(const p of ps)for(const r of(p.rules||[]))if(['REVIEWED_PRODUCT','COST_MODEL','PRODUCT_CATEGORY'].includes(r.type))ops.push({action:'delete',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt});
  mutate(ops).catch(e=>alert(e.message));
}
function bind(){
  byId('crSearchBtn').onclick=()=>refresh(byId('crSearch').value.trim());byId('crClearBtn').onclick=()=>{byId('crSearch').value='';refresh('')};byId('crRefreshBtn').onclick=()=>refresh(byId('crSearch').value.trim());
  byId('crSearch').addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')refresh(e.currentTarget.value.trim())});
  byId('crSelectAll').onchange=e=>{for(const p of data?.products||[])e.target.checked?selected.add(p.id):selected.delete(p.id);render()};
  byId('crBatchEdit').onclick=batchEdit;byId('crBatchDelete').onclick=batchDelete;
  byId('crOtherToggle').onclick=()=>{const x=byId('crOtherRules');x.hidden=!x.hidden};
  byId('crTable').addEventListener('change',e=>{if(e.target.matches('.cr-check')){e.target.checked?selected.add(e.target.dataset.id):selected.delete(e.target.dataset.id);updateSelection()}});
  document.addEventListener('click',e=>{
    const d=e.target.closest('[data-detail]');if(d){const x=byId('crd-'+cssId(d.dataset.detail));if(x)x.hidden=!x.hidden;return}
    const ep=e.target.closest('[data-edit]');if(ep){const p=(data?.products||[]).find(x=>x.id===ep.dataset.edit);editProduct(p);return}
    const dp=e.target.closest('[data-delete]');if(dp){const p=(data?.products||[]).find(x=>x.id===dp.dataset.delete);deleteProduct(p);return}
    const re=e.target.closest('[data-rule-edit]');if(re){editRule(findRule(re.dataset.ruleEdit));return}
    const rd=e.target.closest('[data-rule-delete]');if(rd){const r=findRule(rd.dataset.ruleDelete);if(r&&confirm(`删除云端规则 ${r.type} / ${r.ruleId}？`))mutate([{action:'delete',ruleId:r.ruleId,expectedUpdatedAt:r.updatedAt}]).catch(e=>alert(e.message))}
  });
  document.addEventListener('click',e=>{if(e.target.closest('[data-view="learning"]'))setTimeout(()=>refresh(byId('crSearch')?.value.trim()||''),60)},true);
}
function start(){inject();if(document.querySelector('[data-view-panel="learning"].active'))refresh()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_CLOUD_RULE_LIBRARY={VERSION,refresh};
})(window);