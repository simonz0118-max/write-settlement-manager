/* WRITE V11.0.3 — measured workspace layout fix */
(function(g){'use strict';const VERSION='11.0.3';

function px(n){return Math.max(0,Math.floor(n))+'px'}

function applyLayout(){
  document.body.classList.add('write-v1103');

  const shell=document.querySelector('.app-shell');
  const workspace=document.querySelector('.workspace');
  if(!workspace)return;

  const ww=Math.max(0,workspace.clientWidth||workspace.getBoundingClientRect().width||0);
  const sideExpanded=shell && !shell.classList.contains('sidebar-collapsed');

  /* Reserve real inner margins from the ACTUAL workspace width.
     This bypasses all historical max-width rules that caused card 1 to slide
     underneath the fixed sidebar. */
  const horizontalPad=sideExpanded ? 72 : 84;
  const usable=Math.max(320,ww-horizontalPad);
  const row=Math.min(1080,usable);

  document.querySelectorAll(
    '#importLanding .landing-actions,[data-view-panel="dashboard"] .hero-buttons'
  ).forEach(el=>{
    el.style.setProperty('width',px(row),'important');
    el.style.setProperty('max-width',px(row),'important');
    el.style.setProperty('min-width','0','important');
    el.style.setProperty('margin-left','auto','important');
    el.style.setProperty('margin-right','auto','important');
    el.style.setProperty('transform','none','important');
    el.style.setProperty('position','relative','important');
    el.style.setProperty('left','auto','important');
    el.style.setProperty('right','auto','important');
  });

  document.querySelectorAll(
    '#importLanding .hero-copy,[data-view-panel="dashboard"] .hero-copy'
  ).forEach(el=>{
    const copyW=Math.max(320,ww-(sideExpanded?48:64));
    el.style.setProperty('width',px(copyW),'important');
    el.style.setProperty('max-width',px(copyW),'important');
    el.style.setProperty('min-width','0','important');
    el.style.setProperty('margin-left','auto','important');
    el.style.setProperty('margin-right','auto','important');
  });

  /* Guarantee current version label after all older observers run. */
  document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent='v11.0.3 Production');
  const f=document.querySelector('.v10612-side-footer span:last-of-type');
  if(f)f.textContent='v11.0.3';
}

function boot(){
  applyLayout();

  const workspace=document.querySelector('.workspace');
  if(workspace && 'ResizeObserver' in g){
    new ResizeObserver(()=>requestAnimationFrame(applyLayout)).observe(workspace);
  }

  const shell=document.querySelector('.app-shell');
  if(shell){
    new MutationObserver(()=>requestAnimationFrame(applyLayout))
      .observe(shell,{attributes:true,attributeFilter:['class']});
  }

  window.addEventListener('resize',()=>requestAnimationFrame(applyLayout),{passive:true});

  /* Older visual observers may mutate DOM shortly after boot. Re-assert once
     after their first render cycle, without polling forever. */
  setTimeout(applyLayout,120);
  setTimeout(applyLayout,650);
}

document.readyState==='loading'
  ?document.addEventListener('DOMContentLoaded',boot,{once:true})
  :boot();

g.WRITE_V1103_LAYOUT={VERSION,applyLayout};
})(window);
