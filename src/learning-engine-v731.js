/* WRITE Settlement Manager v7.3.1 — pencil-safe preflight + fully automatic historical rules */
(function(){
'use strict';
const sessionCostModels=new Map(),sessionCurrencyPolicies=new Map(),skippedCostKeys=new Set();
function norm(v=''){return String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ')}
function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function recordKeyOf(o={}){return String(o.recordKey||[o.sourceFile,o.sourceSheet,o.sourceRow,o.orderId,o.trackingNo].map(v=>String(v??'')).join('\u0001'))}
function currentOrders(){try{return Array.isArray(classified?.orders)?classified.orders:[]}catch{return[]}}
function currentLines(){try{return Array.isArray(classified?.lineItems)?classified.lineItems:[]}catch{return[]}}
function currentSheets(){try{return Array.isArray(sheets)?sheets:[]}catch{return[]}}
function conservationAudit(){
 const os=currentOrders(),ls=currentLines(),ss=currentSheets(),sourceRecords=ss.filter(s=>s.status==='imported').reduce((a,s)=>a+(Number(s.orderCount)||0),0),orderRecords=os.length;
 const expectedQty=os.reduce((a,o)=>a+(Number(o.productCount)||0),0),actualQty=ls.reduce((a,x)=>a+(Number(x.quantity)||1),0),issues=[];
 if(sourceRecords!==orderRecords)issues.push({type:'ORDER_RECORD_LOSS',message:`源订单记录 ${sourceRecords} 行，但进入结算 ${orderRecords} 行，差 ${sourceRecords-orderRecords} 行。`});
 if(expectedQty>0&&expectedQty!==actualQty)issues.push({type:'PRODUCT_QUANTITY_MISMATCH',message:`源订单产品总数 ${expectedQty}，解析商品数量 ${actualQty}，差 ${expectedQty-actualQty}。`});
 const missing=os.filter(o=>!o.recordKey);if(missing.length)issues.push({type:'MISSING_RECORD_KEY',message:`${missing.length} 条订单记录缺少源记录身份。`});
 return {ok:issues.length===0,sourceRecords,orderRecords,expectedQty,actualQty,issues};
}
function costKey(s={}){return [norm(s.sku)||norm(s.productName),String(s.country||'GLOBAL').toUpperCase(),String(s.currency||'EUR').toUpperCase()].join('\u0001')}
function calculateFromModel(m,s={}){
 if(!m)return {resolved:false};const q=Math.max(0,Number(s.quantity)||0),amount=Number(s.orderAmount)||0;let total=null,unit=null;
 if(m.strategy==='UNIT_FIXED'){unit=Number(m.unitCost);if(Number.isFinite(unit))total=q*unit}
 else if(m.strategy==='ORDER_FIXED'){total=Number(m.orderCost);if(Number.isFinite(total))unit=q?total/q:total}
 else if(m.strategy==='PERCENT_ORDER'){const p=Number(m.percent);if(Number.isFinite(p)){total=amount*p/100;unit=q?total/q:total}}
 else if(m.strategy==='TIER_UNIT'){const t=(m.tiers||[]).find(x=>q>=Number(x.min||0)&&(x.max==null||q<=Number(x.max)));if(t){unit=Number(t.unitCost);if(Number.isFinite(unit))total=q*unit}}
 return Number.isFinite(total)?{resolved:true,totalCost:total,unitCost:unit,strategy:m.strategy,session:true}:{resolved:false};
}
function calculateCost(s={}){
 const k=costKey(s);
 if(sessionCostModels.has(k))return calculateFromModel(sessionCostModels.get(k),s);
 // V7.3.0 priority: compiled verified history BEFORE generic learned rules.
 // Bundle-level pricing is applied by the FACT history engine; this per-line lookup is useful for direct/exact families.
 const fam=window.WRITE_HISTORY_V730?.familyFor?.(s.productName,s.sku);
 const history=fam?window.WRITE_HISTORY_V730?.inferRate?.(fam,s.country,Math.max(1,Number(s.quantity)||1)):window.WRITE_HISTORY_V730?.inferExactDescriptionRate?.(s.productName,s.country);
 if(history?.resolved){
   const unit=Number.isFinite(Number(history.unitTotal))?Number(history.unitTotal):((Number(history.cogs)||0)+(Number(history.shipping)||0));
   return {resolved:true,totalCost:unit*(Number(s.quantity)||1),unitCost:unit,cogs:history.cogs,shipping:history.shipping,strategy:'HISTORICAL_RULE',source:history.source,confidence:history.confidence};
 }
 const kb=window.WRITE_KB?.calculateCost?.(s);
 if(kb?.resolved)return kb;
 return {resolved:false,unknown:skippedCostKeys.has(k)};
}
function similar(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length);const aa=new Set(a.split(/\s+/)),bb=new Set(b.split(/\s+/));let hit=0;for(const x of aa)if(bb.has(x))hit++;return hit/Math.max(aa.size,bb.size,1)}
async function learnFromHistoricalFact(){
 if(!window.WRITE_KB?.learnFactModel)return {factModels:0,costModels:0};
 const ss=currentSheets(),lines=currentLines();let factModels=0,costModels=0;
 for(const s of ss.filter(x=>x.status==='ignored_fact'&&Array.isArray(x.factRows))){
  const rows=s.factRows||[];if(!rows.length)continue;
  const currency=(()=>{try{return currencyForWorkbook(s.sourceFile)}catch{return'EUR'}})();
  // Always persist the FACT model itself.
  await window.WRITE_KB.learnFactModel({
    sourceFile:s.sourceFile,sheetName:s.sheetName,currency,
    rows:rows.map(r=>({country:r.country||'',description:r.description||'',cogs:r.cogs,shipping:r.shipping,unitTotal:r.unitTotal,sourceRow:r.sourceRow}))
  },false);factModels++;

  // V7.3.0: DO NOT convert bundle FACT rows (Chemise*3 / Jelly*3 / Gilet*3 / CN FACT)
  // into per-SKU UNIT_FIXED rules. That was the regression source in V7.2.x.
  // Only learn an exact per-product COST_MODEL when a FACT description has an almost-exact,
  // unique product-name match and the compiled history engine does not already know that family.
  const wbLines=lines.filter(x=>String(x.sourceFile||'')===String(s.sourceFile||''));
  for(const r of rows){
   if(window.WRITE_HISTORY_V730?.familyFor?.(r.description,''))continue;
   const unit=Number.isFinite(Number(r.unitTotal))?Number(r.unitTotal):((Number.isFinite(Number(r.cogs))?Number(r.cogs):0)+(Number.isFinite(Number(r.shipping))?Number(r.shipping):0));
   if(!Number.isFinite(unit)||unit<0||!String(r.description||'').trim())continue;
   const ranked=wbLines.map(line=>({line,score:Math.max(similar(r.description,line.productName),similar(r.description,line.sku))}))
     .filter(x=>x.score>=.95).sort((a,b)=>b.score-a.score);
   if(ranked.length!==1)continue;
   const line=ranked[0].line;
   await window.WRITE_KB.learnCostModel({
     productName:line.productName,sku:line.sku,country:r.country||line.country||'',currency,
     strategy:'UNIT_FIXED',unitCost:unit,cogs:r.cogs,shipping:r.shipping,
     sourceFactDescription:r.description,sourceFile:s.sourceFile,confidence:ranked[0].score
   },false);costModels++;
  }
 }
 return {factModels,costModels};
}
function legacyCnFactManagedLine(x={}){
 const legacy=new Set(['PENCIL','ENGRAVING','REFILL','COLOR_REFILL','GIFT_BOX','ERASER','NOTEBOOK','B2B','GIFT_CARD']);
 if(!legacy.has(String(x.category||'')))return false;
 try{return typeof detectGeneratedFactProfile==='function'&&detectGeneratedFactProfile(x.sourceFile)==='PENCIL_V1'}catch(e){return false}
}
function unresolvedCostGroups(){
 const out=new Map();
 for(const x of currentLines().filter(x=>!x.isFree)){
  if(legacyCnFactManagedLine(x))continue;
  const spec={productName:x.productName,sku:x.sku,country:x.country,currency:x.currency||'EUR',quantity:Number(x.quantity)||1,orderAmount:Number(x.orderAmount)||0};
  if(calculateCost(spec)?.resolved)continue;
  // Known historical families are priced later at ORDER BUNDLE level, not per SKU.
  if(window.WRITE_HISTORY_V730?.familyFor?.(x.productName,x.sku))continue;
  const key=costKey(spec);
  if(!out.has(key))out.set(key,{key,productName:x.productName||'',sku:x.sku||'',category:x.category||'GENERIC_GOODS',categoryLabel:x.categoryLabel||'一般商品',country:x.country||'',currency:x.currency||'EUR',quantity:0,orders:new Set()});
  const g=out.get(key);g.quantity+=Number(x.quantity)||1;g.orders.add(recordKeyOf(x));
 }
 return [...out.values()];
}
function parseModel(strategy,raw){
 const m={strategy};
 if(strategy==='UNIT_FIXED')m.unitCost=Number(raw);else if(strategy==='ORDER_FIXED')m.orderCost=Number(raw);else if(strategy==='PERCENT_ORDER')m.percent=Number(raw);
 else{m.tiers=[];for(const p of String(raw||'').split(',')){const x=p.trim().match(/^(\d+)(?:-(\d+)|\+)?\s*:\s*([0-9.]+)$/);if(x)m.tiers.push({min:Number(x[1]),max:x[2]?Number(x[2]):null,unitCost:Number(x[3])})}}
 return m;
}
function validModel(m){if(m.strategy==='UNIT_FIXED')return Number.isFinite(m.unitCost)&&m.unitCost>=0;if(m.strategy==='ORDER_FIXED')return Number.isFinite(m.orderCost)&&m.orderCost>=0;if(m.strategy==='PERCENT_ORDER')return Number.isFinite(m.percent)&&m.percent>=0;if(m.strategy==='TIER_UNIT')return Array.isArray(m.tiers)&&m.tiers.length>0;return false}
function ensureModal(){let h=document.getElementById('v722BatchModal');if(!h){h=document.createElement('div');h.id='v722BatchModal';h.className='modal-backdrop';h.hidden=true;document.body.appendChild(h)}return h}
function categoryOptions(){const a=(typeof LINE_CATEGORIES!=='undefined'?LINE_CATEGORIES:[]).filter(x=>x.code!=='OTHER');return '<option value="">不修改分类</option>'+a.map(x=>`<option value="${esc(x.code)}">${esc(x.label)}</option>`).join('')}
function batchRuleModal({forExport=false}={}){
 return new Promise(resolve=>{
  const groups=unresolvedCostGroups(),host=ensureModal();if(!groups.length){resolve({action:'continue',unknown:0});return}
  host.innerHTML=`<div class="modal-card v722-batch-card" role="dialog" aria-modal="true" aria-labelledby="v722BatchTitle">
  <div class="v722-batch-header">
    <div>
      <span class="eyebrow">BATCH RULES</span>
      <h3 id="v722BatchTitle">${forExport?'导出前批量处理':'批量规则编辑器'}</h3>
      <p>还有 <b>${groups.length}</b> 组商品没有成本规则。可批量设置，也可以不填写直接导出。</p>
    </div>
    <button class="v722-close" id="v722Close" type="button" aria-label="关闭">×</button>
  </div>
  <div class="v722-batch-body">
  <div class="v722-bulk-toolbar"><label><input type="checkbox" id="v722SelectAll" checked> 全选当前结果</label><input id="v722Search" placeholder="筛选商品 / SKU / 国家 / 币种">
  <select id="v722BulkCategory">${categoryOptions()}</select><select id="v722BulkStrategy"><option value="">不修改成本</option><option value="UNIT_FIXED">数量 × 单位成本</option><option value="ORDER_FIXED">每订单固定成本</option><option value="PERCENT_ORDER">订单金额百分比</option><option value="TIER_UNIT">数量阶梯单位成本</option></select>
  <input id="v722BulkValue" placeholder="成本值 / 阶梯"><select id="v722CurrencyMode"><option value="">不修改开票币种</option><option value="ORIGINAL">保持原币种</option><option value="CONVERT_EUR">转换 EUR</option></select><button class="toolbar-button" id="v722ApplyBulk">应用到选中</button></div>
  <div class="v722-batch-table-wrap"><table class="data-table"><thead><tr><th>选</th><th>商品/SKU</th><th>国家</th><th>币种</th><th>件数</th><th>分类</th><th>成本方式</th><th>数值</th><th>开票币种</th></tr></thead><tbody>
  ${groups.map((g,i)=>`<tr data-index="${i}" data-search="${esc([g.productName,g.sku,g.country,g.currency].join(' ').toLowerCase())}"><td><input class="v722-row-check" type="checkbox" checked></td><td><strong>${esc(g.productName||'未命名商品')}</strong><small>${esc(g.sku||'')}</small></td><td>${esc(g.country||'GLOBAL')}</td><td>${esc(g.currency)}</td><td>${g.quantity}</td><td><select class="v722-category">${categoryOptions()}</select></td><td><select class="v722-strategy"><option value="">未设置</option><option value="UNIT_FIXED">单位成本</option><option value="ORDER_FIXED">订单固定</option><option value="PERCENT_ORDER">订单百分比</option><option value="TIER_UNIT">阶梯成本</option></select></td><td><input class="v722-value"></td><td><select class="v722-currency-mode"><option value="">默认</option><option value="ORIGINAL">原币</option><option value="CONVERT_EUR">EUR</option></select></td></tr>`).join('')}
  </tbody></table></div>
  <div class="schema-hint v722-hint">“不填写直接导出”会标记 UNKNOWN，不会写成 0，也不会生成虚假毛利。</div>
  </div>
  <div class="modal-actions v722-actions">
    <button class="toolbar-button" id="v722Cancel">取消</button>
    ${forExport?'<button class="toolbar-button" id="v722Skip">不填写，直接导出</button>':''}
    <button class="toolbar-button" id="v722Session">仅本次使用</button>
    <button class="toolbar-button filled" id="v722Learn">保存全部并永久学习</button>
  </div>
</div>`;
  host.hidden=false;
  document.documentElement.classList.add('v722-modal-open');
  const finish=(payload)=>{
    document.documentElement.classList.remove('v722-modal-open');
    document.removeEventListener('keydown',onKey);
    host.onclick=null;
    host.hidden=true;
    resolve(payload);
  };
  const onKey=(e)=>{
    if(e.key==='Escape'){
      e.preventDefault();
      finish({action:'cancel'});
    }
  };
  document.addEventListener('keydown',onKey);
  host.onclick=(e)=>{
    if(e.target===host)finish({action:'cancel'});
  };
  host.querySelector('#v722Close').onclick=()=>finish({action:'cancel'});
  const selectedRows=()=>[...host.querySelectorAll('tbody tr')].filter(tr=>!tr.hidden&&tr.querySelector('.v722-row-check').checked);
  host.querySelector('#v722Search').oninput=e=>{const q=e.target.value.trim().toLowerCase();host.querySelectorAll('tbody tr').forEach(tr=>tr.hidden=!!q&&!tr.dataset.search.includes(q))};
  host.querySelector('#v722SelectAll').onchange=e=>host.querySelectorAll('tbody tr:not([hidden]) .v722-row-check').forEach(x=>x.checked=e.target.checked);
  host.querySelector('#v722ApplyBulk').onclick=()=>{const cat=host.querySelector('#v722BulkCategory').value,st=host.querySelector('#v722BulkStrategy').value,val=host.querySelector('#v722BulkValue').value,cm=host.querySelector('#v722CurrencyMode').value;for(const tr of selectedRows()){if(cat)tr.querySelector('.v722-category').value=cat;if(st){tr.querySelector('.v722-strategy').value=st;tr.querySelector('.v722-value').value=val}if(cm)tr.querySelector('.v722-currency-mode').value=cm}};
  const collect=()=>selectedRows().map(tr=>({g:groups[Number(tr.dataset.index)],category:tr.querySelector('.v722-category').value,strategy:tr.querySelector('.v722-strategy').value,value:tr.querySelector('.v722-value').value.trim(),currencyMode:tr.querySelector('.v722-currency-mode').value}));
  host.querySelector('#v722Cancel').onclick=()=>finish({action:'cancel'});
  const skip=host.querySelector('#v722Skip');if(skip)skip.onclick=()=>{for(const g of groups)skippedCostKeys.add(g.key);finish({action:'skip',unknown:groups.length})};
  host.querySelector('#v722Session').onclick=async()=>{for(const x of collect()){if(x.strategy){const m=parseModel(x.strategy,x.value);if(!validModel(m)){alert(`成本格式无效：${x.g.productName||x.g.sku}`);return}sessionCostModels.set(x.g.key,m)}if(x.currencyMode)sessionCurrencyPolicies.set(`${x.g.country}\u0001${x.g.currency}`,{mode:x.currencyMode})}finish({action:'session'})};
  host.querySelector('#v722Learn').onclick=async()=>{let conflicts=0;for(const x of collect()){if(x.category)await window.WRITE_KB?.learnProduct?.(x.g.productName,x.g.sku,x.category,true);if(x.strategy){const m=parseModel(x.strategy,x.value);if(!validModel(m)){alert(`成本格式无效：${x.g.productName||x.g.sku}`);return}const r=await window.WRITE_KB?.learnCostModel?.({...x.g,...m},true);if(r?.conflict)conflicts++}if(x.currencyMode){const r=await window.WRITE_KB?.learnCurrencyPolicy?.(`${x.g.country}\u0001${x.g.currency}`,{mode:x.currencyMode,sourceCurrency:x.g.currency},true);if(r?.conflict)conflicts++}}await window.WRITE_KB?.sync?.().catch(()=>{});if(conflicts)alert(`${conflicts} 条规则冲突，未覆盖旧规则。`);finish({action:'learn',conflicts})};
 });
}
async function beforeExport(){
 const audit=conservationAudit();

 // ORDER RECORD loss is always a hard error.
 const hard=audit.issues.filter(x=>x.type==='ORDER_RECORD_LOSS'||x.type==='MISSING_RECORD_KEY');
 if(hard.length)throw new Error('V7.3.1 数据守恒未通过：'+hard.map(x=>x.message).join('；'));

 // The generic productCount-vs-lineItems check is not authoritative for mature CN/PENCIL workbooks:
 // their SKU "*N" bundle semantics are validated later by the dedicated CN FACT audit.
 const profileNames=[...new Set(currentLines().map(x=>x.sourceFile).filter(Boolean))];
 const allPencil=profileNames.length>0&&profileNames.every(name=>{
   try{return typeof detectGeneratedFactProfile==='function'&&detectGeneratedFactProfile(name)==='PENCIL_V1'}catch{return false}
 });
 const qtyWarnings=audit.issues.filter(x=>x.type==='PRODUCT_QUANTITY_MISMATCH');
 if(qtyWarnings.length&&!allPencil){
   throw new Error('V7.3.1 商品数量守恒未通过：'+qtyWarnings.map(x=>x.message).join('；'));
 }

 // Fully automatic: known historical families use learned prices; truly unseen products export with blank prices.
 const groups=unresolvedCostGroups();
 for(const g of groups)skippedCostKeys.add(g.key);
 return {
   ok:true,
   unknownCosts:groups.length,
   allowUnknownCosts:groups.length>0,
   skipped:groups.length>0,
   action:groups.length?'AUTO_BLANK_PRICE':'AUTO_HISTORY',
   fullyAutomatic:true,
   pencilLegacyAudit:allPencil,
   warnings:allPencil?qtyWarnings:[]
 };
}
function installReviewBatchButton(){
 const panel=document.querySelector('[data-view-panel="review"]'),head=panel?.querySelector('.page-head');if(!head||document.getElementById('v722ReviewBatchButton'))return;
 const b=document.createElement('button');b.id='v722ReviewBatchButton';b.className='ghost-btn';b.textContent='可选：人工覆盖规则';b.onclick=()=>batchRuleModal({forExport:false});head.appendChild(b);
}
window.addEventListener('write-import-complete',async()=>{installReviewBatchButton();try{const x=await learnFromHistoricalFact();if(x.factModels||x.costModels){await window.WRITE_KB?.sync?.().catch(()=>{});window.dispatchEvent(new CustomEvent('write-kb-updated'))}}catch(e){console.warn('V7.2.1 FACT learning skipped',e)}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installReviewBatchButton);else installReviewBatchButton();
window.WRITE_LEARNING_V2={conservationAudit,learnFromHistoricalFact,unresolvedCostGroups,batchRuleModal,beforeExport,calculateCost,sessionCostModels,sessionCurrencyPolicies,skippedCostKeys};
})();