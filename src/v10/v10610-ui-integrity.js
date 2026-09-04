/* WRITE V10.6.10 — UI Integrity Closure.
   Keeps existing business buttons/events; ensures exactly one hero surface is rendered. */
(function(g){'use strict';const VERSION='10.6.10';
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
function nav(){document.querySelectorAll('.nav-item[data-view]').forEach(b=>{let s=b.querySelector(':scope>span:first-child');if(!s){s=document.createElement('span');b.prepend(s)}s.className='v10610-nav-icon';s.innerHTML=SVG[navMap[b.dataset.view]]||''})}
function theme(){const t=document.getElementById('themeToggleButton');if(!t)return;[...t.children].forEach(x=>{if(x.id!=='themeIcon'&&x.id!=='themeLabel')x.remove()})}
function footer(){const side=document.querySelector('.sidebar');if(!side)return;side.querySelectorAll('.v1069-side-footer,.v1068-side-footer,.v1067-side-footer').forEach(x=>x.remove());if(side.querySelector('.v10610-side-footer'))return;const f=document.createElement('div');f.className='v10610-side-footer';f.innerHTML='<span>Designed by NEOVORA</span><i></i><span>v10.6.10</span>';side.appendChild(f)}
function utility(){const bar=document.querySelector('.topbar');if(!bar)return;bar.querySelectorAll('.v1069-utility,.v1068-utility,.v1067-utility').forEach(x=>x.remove());if(bar.querySelector('.v10610-utility'))return;const u=document.createElement('div');u.className='v10610-utility';u.innerHTML='<button class="v10610-help" type="button">'+SVG.book+'<span>帮助文档</span></button><i class="v10610-divider"></i><span class="v10610-avatar">S</span>';bar.appendChild(u);u.querySelector('.v10610-help').onclick=()=>document.querySelector('.side-tip')?.scrollIntoView?.({behavior:'smooth',block:'center'})}
function icon(btn,key){if(!btn)return;let s=btn.querySelector(':scope>span:first-child');if(!s){s=document.createElement('span');btn.prepend(s)}s.className='v10610-action-icon';s.innerHTML=SVG[key]||''}
function wave(){const w=document.createElementNS('http://www.w3.org/2000/svg','svg');w.setAttribute('viewBox','0 0 1600 220');w.setAttribute('preserveAspectRatio','none');w.classList.add('v10610-wave');w.innerHTML='<defs><linearGradient id="g10610a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#294fff" stop-opacity=".50"/><stop offset=".58" stop-color="#14295f" stop-opacity=".56"/><stop offset="1" stop-color="#7644ff" stop-opacity=".26"/></linearGradient><linearGradient id="g10610b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0c1b37" stop-opacity=".96"/><stop offset=".58" stop-color="#162651" stop-opacity=".80"/><stop offset="1" stop-color="#101936" stop-opacity=".94"/></linearGradient></defs><path fill="url(#g10610a)" stroke="#4e65f8" stroke-width="1.1" d="M0 92 C215 30 350 55 520 118 C750 202 885 80 1060 116 C1250 156 1385 100 1600 52 L1600 220 L0 220 Z"/><path fill="url(#g10610b)" stroke="#303d82" stroke-width="1" d="M0 148 C245 46 400 202 630 150 C860 96 990 204 1215 160 C1380 128 1485 148 1600 138 L1600 220 L0 220 Z"/>';return w}
function removeOldStage(host){host?.querySelectorAll('.v1069-stage,.v1069-wave,.v1068-stage,.v1068-wave,.v1067-stage,.v1067-wave').forEach(x=>x.remove())}
function build(host,buttons){if(!host)return;removeOldStage(host);if(host.querySelector('.v10610-stage'))return;const stage=document.createElement('div');stage.className='v10610-stage';stage.innerHTML='<div class="v10610-kicker">WRITE SETTLEMENT MANAGER</div><h1 class="v10610-title">让结算<em>更简单</em></h1><p class="v10610-desc">导入订单、生成统计、审核学习。把复杂流程留给系统。</p><div class="v10610-subline">专注跨境结算　·　更少操作　·　更高效率</div><div class="v10610-actions"></div>';const box=stage.querySelector('.v10610-actions');buttons.forEach((b,i)=>{if(!b)return;box.appendChild(b);icon(b,i===0?'upload':i===1?'file':'db')});host.appendChild(stage);host.appendChild(wave())}
function mode(){const app=document.getElementById('appViews');const active=!!app&&!app.hidden;document.body.dataset.v10610Mode=active?'app':'landing'}
function rebuild(){
 document.body.classList.add('write-v10610');
 document.body.classList.remove('write-v1069','write-v1068','write-v1067');
 mode();nav();theme();footer();utility();
 build(document.querySelector('#importLanding .landing-hero'),[document.getElementById('chooseButton'),document.getElementById('landingExportButton'),document.getElementById('landingReviewedImportButton')]);
 build(document.querySelector('[data-view-panel="dashboard"] .dashboard-hero'),[document.getElementById('heroImportButton'),document.getElementById('heroExportButton'),document.getElementById('heroReviewedImportButton')]);
}
function boot(){rebuild();let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;rebuild()})}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
g.WRITE_V10610_UI={VERSION,rebuild,mode};
})(window);
