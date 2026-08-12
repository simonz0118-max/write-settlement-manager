/* WRITE V8.4 Unified Human Workflow Shadow Runtime */
(function(g){'use strict';let last=null;
function ensure(){
  let e=document.getElementById('v84HumanWorkflowPanel');if(e)return e;
  const p=document.getElementById('v831TraceFidelityPanel')?.parentElement||
          document.getElementById('v82ZeroLossPanel')?.parentElement||
          document.querySelector('[data-view-panel="dashboard"] .dashboard-grid');
  if(!p)return null;
  e=document.createElement('section');e.id='v84HumanWorkflowPanel';e.className='panel wide v84-human-panel';
  e.innerHTML='<div class="panel-head"><div><h2>V8.4 人工操作模拟</h2><p>履约记录 → 商品角色 → 包裹配置 → 国家/仓库 → FACT</p></div><span id="v84Status">SHADOW</span></div><div class="v8-audit-grid" id="v84Grid"></div><div id="v84Note"></div>';
  p.appendChild(e);return e;
}
function render(x){ensure();const d=document.getElementById('v84Grid'),n=document.getElementById('v84Note');if(!d||!n)return;
 d.innerHTML=[['履约记录',x.records],['Package配置',x.packageRows],['独立UPSELL',x.upsellRows],['待审核/非收费',x.auditOnly],['未知组件',x.unknown],['正式接管','OFF']]
   .map(([k,v])=>`<article><span>${k}</span><strong>${v}</strong></article>`).join('');
 n.innerHTML='<div class="success-strip">✓ FACT无订单来源不学习；无法闭环的数量/组合不部分学习；缺价格不阻断。</div>';
}
async function run(){
 try{
  const b=g.WRITE_V8_SOURCE_BRIDGE?.();if(!b?.orders?.length)return null;
  const records=b.orders.map((o,i)=>g.WRITE_HUMAN_WORKFLOW_V84.buildRecord({...o,orderId:o.orderId||o.recordKey},{index:i}));
  const agg=g.WRITE_HUMAN_WORKFLOW_V84.aggregate(records);
  const unknown=records.flatMap(r=>r.items).filter(x=>x.componentRole==='UNKNOWN').length;
  last={records:records.length,packageRows:agg.packageRows.length,upsellRows:agg.upsellRows.length,auditOnly:agg.auditOnly.length,unknown,aggregate:agg};
  g.WRITE_V84_HUMAN_AUDIT=last;render(last);return last;
 }catch(e){console.error('[V8.4 human workflow]',e);return{error:e?.message||String(e)}}
}
function start(){ensure();setTimeout(run,900);setInterval(run,5000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V84_HUMAN_RUNTIME={VERSION:'8.4.0',run,getLast:()=>last};
})(window);
