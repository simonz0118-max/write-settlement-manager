/* WRITE Settlement Manager v7.1.10 - adaptive order schema learning UI */
(function(){
'use strict';

const FIELD_DEFS=[
  ['orderId','订单号',true],
  ['orderAmount','订单金额',true],
  ['productNames','产品名称',true],
  ['country','收货人国家',true],
  ['productCount','产品总数',false],
  ['skuLines','SKU / 多品名',false],
  ['buyerName','买家姓名',false],
  ['trackingNo','运单号',false],
  ['currency','币种',false],
  ['address','地址',false],
  ['orderTime','下单时间',false],
  ['paidTime','付款时间',false],
  ['storeAccount','店铺账号',false]
];

function rules(){
  return (window.WRITE_KB?.schemaRules?.()||[]).map(r=>({
    fingerprint:r.lookupKey,
    mapping:r.payload?.mapping||{},
    mappingByHeader:r.payload?.mappingByHeader||{},
    headers:r.payload?.headers||[],
    sheetName:r.payload?.sheetName||'',
    confidence:r.payload?.confidence||1,
    confirmed:!!r.confirmed
  }));
}
async function learn(candidate,mapping,manual=true){
  if(!window.WRITE_KB?.learnSchema)throw new Error('规则库尚未初始化');
  return window.WRITE_KB.learnSchema({
    fingerprint:candidate.fingerprint,
    headers:candidate.headers||[],
    mapping,
    mappingByHeader:Object.fromEntries((candidate.headers||[]).map((h,i)=>[candidate.normalizedHeaders?.[i]||String(h||'').trim().toLowerCase(),mapping[i]||null]).filter(([,v])=>v)),
    sheetName:candidate.sheetName||'',
    sourceFile:candidate.sourceFile||'',
    confidence:Number(candidate.confidence)||0
  },manual);
}
async function autoLearn(candidates=[]){
  for(const c of candidates){
    if(c?.mode==='auto' && Number(c.confidence)>=0.92 && c.fingerprint && c.mapping){
      try{await learn(c,c.mapping,false)}catch(e){console.warn('schema auto learn skipped',e)}
    }
  }
}
function ensureModal(){
  let host=document.getElementById('schemaReviewModal');
  if(host)return host;
  host=document.createElement('div');
  host.id='schemaReviewModal';
  host.className='modal-backdrop schema-review-backdrop';
  host.hidden=true;
  document.body.appendChild(host);
  return host;
}
function optionHtml(headers,selectedCol){
  const empty='<option value="">— 不使用 —</option>';
  return empty+headers.map((h,i)=>`<option value="${i}" ${Number(selectedCol)===i?'selected':''}>${String.fromCharCode(65+i)} · ${escapeHtml(h||'(空表头)')}</option>`).join('');
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function promptReview(candidates=[],onDone){
  const queue=(candidates||[]).filter(Boolean);
  if(!queue.length){onDone?.();return}
  const host=ensureModal();
  let index=0;

  function render(){
    const c=queue[index];
    const mapping=c.mapping||{};
    const selectedByKey={};
    Object.entries(mapping).forEach(([col,key])=>{if(key)selectedByKey[key]=Number(col)});
    const score=Math.round((Number(c.confidence)||0)*100);
    host.innerHTML=`<div class="modal-card schema-review-card" role="dialog" aria-modal="true">
      <div class="modal-icon">⌘</div>
      <h3>确认陌生订单表字段</h3>
      <p><b>${escapeHtml(c.sourceFile||'')}</b> · ${escapeHtml(c.sheetName||'')}<br>
      系统自动识别置信度 ${score}%。只需确认一次，以后同类表格会自动识别并同步到云端。</p>
      <div class="schema-map-grid">
        ${FIELD_DEFS.map(([key,label,required])=>`<label><span>${escapeHtml(label)}${required?' *':''}</span>
          <select data-schema-key="${key}">${optionHtml(c.headers||[],selectedByKey[key])}</select></label>`).join('')}
      </div>
      <div class="schema-hint">* 必填：订单号、订单金额、产品名称、收货人国家。系统不会在核心字段不明确时静默输出错误报表。</div>
      <div class="modal-actions">
        <button class="toolbar-button" id="schemaCancel" type="button">取消导入</button>
        <button class="toolbar-button filled" id="schemaSave" type="button">确认并永久学习</button>
      </div>
    </div>`;
    host.hidden=false;
    const save=host.querySelector('#schemaSave');
    const cancel=host.querySelector('#schemaCancel');
    cancel.onclick=()=>{host.hidden=true};
    save.onclick=async()=>{
      const result={};
      host.querySelectorAll('[data-schema-key]').forEach(sel=>{
        if(sel.value!=='')result[Number(sel.value)]=sel.dataset.schemaKey;
      });
      const vals=new Set(Object.values(result));
      for(const [key,label,required] of FIELD_DEFS){
        if(required && !vals.has(key)){
          alert(`请确认必填字段：${label}`);
          return;
        }
      }
      save.disabled=true;save.textContent='正在保存…';
      try{
        await learn(c,result,true);
        index++;
        if(index<queue.length)render();
        else{
          host.hidden=true;
          await window.WRITE_KB?.sync?.().catch(()=>{});
          onDone?.();
        }
      }catch(err){
        save.disabled=false;save.textContent='确认并永久学习';
        alert('保存表格结构规则失败：'+(err?.message||err));
      }
    };
  }
  render();
}

window.WRITE_SCHEMA={
  getRules:rules,
  learn,
  autoLearn,
  promptReview,
  fieldDefs:FIELD_DEFS
};
})();