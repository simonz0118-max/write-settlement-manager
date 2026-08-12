/* WRITE V10.1.1 hero reviewed-learning access */
(function(g){'use strict';const VERSION='10.1.1';
function buttons(){return [...document.querySelectorAll('.reviewed-import-trigger,#knowledgeImportReviewed')]}
function restore(){for(const b of buttons()){if(b.dataset.originalLabel)b.innerHTML=b.dataset.originalLabel;b.disabled=false}}
function install(){
 const input=document.getElementById('knowledgeReviewedFile');if(!input)return;
 document.addEventListener('click',e=>{const b=e.target?.closest?.('.reviewed-import-trigger,#knowledgeImportReviewed');if(!b)return;e.preventDefault();e.stopPropagation();input.click()},true);
 input.addEventListener('change',async()=>{const f=input.files?.[0];if(!f)return;
  for(const b of buttons()){if(!b.dataset.originalLabel)b.dataset.originalLabel=b.innerHTML;b.disabled=true;b.textContent='正在学习审核结果…'}
  try{const api=g.WRITE_V101_REVIEW_LEARNING;if(!api?.importReviewedWorkbook)throw new Error('审核学习模块尚未加载');
   const r=await api.importReviewedWorkbook(f),msg=`学习完成：${r.factRules} FACT / ${r.productRules} 商品 / ${r.costRules} 成本`;
   for(const b of buttons()){b.disabled=false;b.textContent=msg}
   setTimeout(restore,5000);
  }catch(err){console.error(err);for(const b of buttons()){b.disabled=false;b.textContent='学习失败'};alert(`审核学习失败：${err?.message||err}`);setTimeout(restore,5000)}
  finally{input.value=''}
 });
}
function start(){install();document.body.dataset.release=VERSION;for(const e of document.querySelectorAll('.brand-copy small'))e.textContent='v10.1.1 Production'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
g.WRITE_V1011_HERO_LEARNING={VERSION,install};
})(window);
