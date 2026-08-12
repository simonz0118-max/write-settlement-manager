/* WRITE V8.3.1 Classification + Trace Fidelity Runtime */
(function(g){'use strict';
let state=null;
function panel(){
  let e=document.getElementById('v831TraceFidelityPanel');if(e)return e;
  const p=document.getElementById('v83FidelityPanel')?.parentElement||document.querySelector('[data-view-panel="dashboard"] .dashboard-grid');
  if(!p)return null;
  e=document.createElement('section');e.id='v831TraceFidelityPanel';e.className='panel wide v831-trace-panel';
  e.innerHTML='<div class="panel-head"><div><h2>V8.3.1 追踪一致性</h2><p>49/49 必须由真实源订单与商品逐条支撑</p></div><span id="v831TraceStatus">等待订单</span></div><div class="v8-audit-grid" id="v831TraceGrid"></div><div id="v831TraceNote"></div>';
  p.appendChild(e);return e;
}
function render(x){
  panel();const s=document.getElementById('v831TraceStatus'),d=document.getElementById('v831TraceGrid'),n=document.getElementById('v831TraceNote');
  if(!s||!d||!n)return;
  d.innerHTML=[
    ['FACT来源覆盖',`${x.factRowsWithSource}/${x.factRows}`],
    ['有MAIN订单',x.billableOrders],
    ['占位订单',x.placeholderOnlyOrders],
    ['计费商品路由',`${x.billableItems} / ${x.billableItems}`],
    ['重复商品路由',x.duplicateItems.length],
    ['追踪错误',x.errors.length]
  ].map(([k,v])=>`<article><span>${k}</span><strong>${v}</strong></article>`).join('');
  s.textContent=x.exactTracePass?'TRACE PASS':'TRACE FAIL';
  n.innerHTML=x.exactTracePass
    ?'<div class="success-strip">✓ 每个计费商品唯一有去向；每个MAIN订单唯一进入一个MAIN Configuration。正式FACT接管仍为OFF。</div>'
    :'<div class="error-card" style="display:block"><b>TRACE FIDELITY FAILED</b><span>存在无来源、重复路由或计费商品未路由。</span></div>';
}
async function run(){
  try{
    const bridge=g.WRITE_V8_SOURCE_BRIDGE?.();if(!bridge?.orders?.length)return null;
    const rules=await g.WRITE_RULE_STORE_V8?.getAll?.().catch(()=>[])||[];
    const sem=bridge.orders.map(o=>g.WRITE_SEMANTIC_V8.semanticizeOrder(o,rules));
    const rows=g.WRITE_SEMANTIC_V8.aggregateSemanticOrders(sem);
    state=g.WRITE_TRACE_FIDELITY_V831.audit(sem,rows);
    g.WRITE_V831_TRACE_AUDIT=state;render(state);return state;
  }catch(e){console.error('[V8.3.1 trace fidelity]',e);return{error:e?.message||String(e)}}
}
function start(){panel();setTimeout(run,800);setInterval(run,4500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V831_TRACE_RUNTIME={VERSION:'8.3.1',run,getState:()=>state};
})(window);
