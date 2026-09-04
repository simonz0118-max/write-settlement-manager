/* WRITE V10.6.9 — Structural UI Rebuild. Reuses existing business button nodes. */
(function(g){'use strict';const VERSION='10.6.9';
const SVG={
home:'<svg viewBox="0 0 24 24"><path d="M3.5 10.5 12 3.8l8.5 6.7v9a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/></svg>',
orders:'<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
products:'<svg viewBox="0 0 24 24"><path d="M4 6.5V4h2.5L20 17.5 17.5 20 4 6.5z"/><circle cx="7" cy="7" r="1"/></svg>',
review:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/></svg>',
quality:'<svg viewBox="0 0 24 24"><path d="m12 4 8 15H4L12 4z"/><path d="M12 9v4M12 16.5h.01"/></svg>',
data:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="6" ry="2.5"/><path d="M6 6v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6M6 12v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-6"/></svg>',
imports:'<svg viewBox="0 0 24 24"><path d="M12 3v13m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
history:'<svg viewBox="0 0 24 24"><path d="M4.2 7.2A9 9 0 1 1 3.5 14M4 4v4h4"/><path d="M12 7v5l3 2"/></svg>',
upload:'<svg viewBox="0 0 24 24"><path d="M12 16V5m0 0L8 9m4-4 4 4M6.5 18.5H5a3 3 0 0 1-.5-5.96A5.5 5.5 0 0 1 15 10.5h.5A3.5 3.5 0 1 1 16 17.46"/></svg>',
file:'<svg viewBox="0 0 24 24"><rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
db:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="6" ry="2.5"/><path d="M6 6v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6M6 12v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-6"/></svg>',
book:'<svg viewBox="0 0 24 24"><path d="M4 5.5A3 3 0 0 1 7 4c2.2 0 4 .8 5 2 1-1.2 2.8-2 5-2a3 3 0 0 1 3 1.5V19a3 3 0 0 0-3-1.5c-2.2 0-4 .8-5 2-1-1.2-2.8-2-5-2A3 3 0 0 0 4 19z"/><path d="M12 6v13.5"/></svg>'
};
const navMap={dashboard:'home',orders:'orders',products:'products',review:'review',quality:'quality',learning:'data',imports:'imports',history:'history'};
function decorateNav(){document.querySelectorAll('.nav-item[data-view]').forEach(b=>{let s=b.querySelector(':scope>span:first-child');if(!s){s=document.createElement('span');b.prepend(s)}s.className='v1069-nav-icon';s.innerHTML=SVG[navMap[b.dataset.view]]||''})}
function themeClean(){const t=document.getElementById('themeToggleButton');if(!t)return;[...t.children].forEach(x=>{if(x.id!=='themeIcon'&&x.id!=='themeLabel')x.remove()})}
function footer(){const s=document.querySelector('.sidebar');if(!s||s.querySelector('.v1069-side-footer'))return;const f=document.createElement('div');f.className='v1069-side-footer';f.innerHTML='<span>Designed by NEOVORA</span><i></i><span>v10.6.9</span>';s.appendChild(f)}
function utility(){const bar=document.querySelector('.topbar');if(!bar||bar.querySelector('.v1069-utility'))return;const u=document.createElement('div');u.className='v1069-utility';u.innerHTML='<button class="v1069-help" type="button">'+SVG.book+'<span>帮助文档</span></button><i class="v1069-divider"></i><span class="v1069-avatar">S</span>';bar.appendChild(u);u.querySelector('.v1069-help').onclick=()=>document.querySelector('.side-tip')?.scrollIntoView?.({behavior:'smooth',block:'center'})}
function actionIcon(btn,key){if(!btn)return;let s=btn.querySelector(':scope>span:first-child');if(!s){s=document.createElement('span');btn.prepend(s)}s.className='v1069-action-icon';s.innerHTML=SVG[key]}
function wave(){const w=document.createElementNS('http://www.w3.org/2000/svg','svg');w.setAttribute('viewBox','0 0 1600 260');w.setAttribute('preserveAspectRatio','none');w.classList.add('v1069-wave');w.innerHTML='<defs><linearGradient id="g1069a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#294fff" stop-opacity=".58"/><stop offset=".55" stop-color="#14295f" stop-opacity=".62"/><stop offset="1" stop-color="#7644ff" stop-opacity=".30"/></linearGradient><linearGradient id="g1069b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0c1b37" stop-opacity=".98"/><stop offset=".55" stop-color="#162651" stop-opacity=".85"/><stop offset="1" stop-color="#101936" stop-opacity=".96"/></linearGradient></defs><path fill="url(#g1069a)" stroke="#5269ff" stroke-width="1.2" d="M0 110 C210 35 330 60 500 132 C730 230 870 88 1050 128 C1240 171 1370 110 1600 58 L1600 260 L0 260 Z"/><path fill="url(#g1069b)" stroke="#323f88" stroke-width="1" d="M0 172 C240 52 390 230 620 166 C860 100 980 238 1210 184 C1370 147 1470 166 1600 154 L1600 260 L0 260 Z"/>';return w}
function buildHero(host,buttons,kind){if(!host||host.querySelector('.v1069-stage'))return;const stage=document.createElement('div');stage.className='v1069-stage';stage.innerHTML='<div class="v1069-kicker">WRITE SETTLEMENT MANAGER</div><h1 class="v1069-title">让结算<em>更简单</em></h1><p class="v1069-desc">导入订单、生成统计、审核学习。把复杂流程留给系统。</p><div class="v1069-subline">专注跨境结算　·　更少操作　·　更高效率</div><div class="v1069-actions"></div>';const box=stage.querySelector('.v1069-actions');buttons.forEach((b,i)=>{if(!b)return;box.appendChild(b);actionIcon(b,i===0?'upload':i===1?'file':'db')});host.appendChild(stage);host.appendChild(wave())}
function rebuild(){
 document.body.classList.add('write-v1069');decorateNav();themeClean();footer();utility();
 const landing=document.querySelector('#importLanding .landing-hero');buildHero(landing,[document.getElementById('chooseButton'),document.getElementById('landingExportButton'),document.getElementById('landingReviewedImportButton')],'landing');
 const dash=document.querySelector('[data-view-panel="dashboard"] .dashboard-hero');buildHero(dash,[document.getElementById('heroImportButton'),document.getElementById('heroExportButton'),document.getElementById('heroReviewedImportButton')],'dashboard');
}
function boot(){rebuild();let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;rebuild()})}).observe(document.documentElement,{childList:true,subtree:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();g.WRITE_V1069_PIXEL_REBUILD={VERSION,rebuild};})(window);
