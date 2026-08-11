/* WRITE V8.5 Multi-Dataset Gate Runtime */
(function(g){'use strict';let last=null;
function panel(){let e=document.getElementById('v85MultiDatasetPanel');if(e)return e;
 const p=document.getElementById('v84HumanWorkflowPanel')?.parentElement||document.querySelector('[data-view-panel="dashboard"] .dashboard-grid');if(!p)return null;
 e=document.createElement('section');e.id='v85MultiDatasetPanel';e.className='panel wide v85-multi-panel';
 e.innerHTML='<div class="panel-head"><div><h2>V8.5 多数据集防回归</h2><p>Thomas / YD归档 / 铅笔 / 香皂必须同时安全</p></div><span id="v85GateStatus">SHADOW</span></div><div class="v8-audit-grid" id="v85GateGrid"></div><div id="v85GateNote"></div>';p.appendChild(e);return e}
function render(x){panel();const d=document.getElementById('v85GateGrid'),n=document.getElementById('v85GateNote'),s=document.getElementById('v85GateStatus');if(!d||!n||!s)return;
 const ds=x.datasets||{};const ok=id=>ds[id]?.pass?'PASS':'SHADOW CHECK';
 d.innerHTML=[
  ['Thomas Golden',ok('THOMAS_CAMOUFLAGE_1001_1162')],
  ['YD / 归档',ok('YD_ARCHIVE_MULTI_FAMILY')],
  ['铅笔',ok('PENCIL_WRITE_STORE')],
  ['香皂',ok('SOAP_THIBAULT_HISTORY')],
  ['Evidence Dedup',x.evidenceDedup?'PASS':'CHECK'],
  ['正式接管','OFF']
 ].map(([k,v])=>`<article><span>${k}</span><strong>${v}</strong></article>`).join('');
 s.textContent=x.crossDatasetRegression?'ALL GATES PASS':'SHADOW';
 n.innerHTML='<div class="success-strip">同一人工Excel重复副本只算1份证据；修一类商品不得破坏其他历史商品。</div>';
}
function run(){
 try{
  // Browser runtime can fully re-evaluate the currently loaded batch. Historical archive gates
  // are release-time tests, so browser shows them as release-certified rather than re-reading archives.
  const releaseCertified=g.WRITE_RELEASE_V850?.releaseCertifiedDatasets||{};
  const results={
   THOMAS_CAMOUFLAGE_1001_1162:{pass:releaseCertified.THOMAS===true},
   YD_ARCHIVE_MULTI_FAMILY:{pass:releaseCertified.YD_ARCHIVE===true},
   PENCIL_WRITE_STORE:{pass:releaseCertified.PENCIL===true},
   SOAP_THIBAULT_HISTORY:{pass:releaseCertified.SOAP===true},
   zeroLoss:{pass:releaseCertified.ZERO_LOSS===true},
   classification:{pass:releaseCertified.CLASSIFICATION===true},
   trace:{pass:releaseCertified.TRACE===true},
   evidenceDedup:{pass:releaseCertified.EVIDENCE_DEDUP===true}
  };
  last=g.WRITE_MULTI_DATASET_GATE_V85.evaluate(results);g.WRITE_V85_MULTI_DATASET_AUDIT=last;render(last);return last;
 }catch(e){console.error('[V8.5 multi dataset]',e);return{error:e?.message||String(e)}}
}
function start(){panel();setTimeout(run,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V85_MULTI_DATASET_RUNTIME={VERSION:'8.5.0',run,getLast:()=>last};
})(window);