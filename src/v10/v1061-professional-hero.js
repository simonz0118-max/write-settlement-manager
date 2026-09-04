/* WRITE V10.6.1 — Professional Hero UI. Presentation layer only. */
(function(g){'use strict';
const VERSION='10.6.1';
function tune(){
 const shell=document.querySelector('.app-shell'),toggle=document.getElementById('v106SidebarToggle');
 if(shell)shell.classList.add('sidebar-collapsed');
 if(toggle){toggle.textContent='';toggle.setAttribute('aria-label','展开菜单');}
 const hero=document.querySelector('.landing-hero .hero-copy');
 if(hero){const eye=hero.querySelector('.eyebrow');if(eye)eye.textContent='WRITE SETTLEMENT MANAGER';const h=hero.querySelector('h1');if(h)h.innerHTML='让结算<em>更简单</em>';const p=hero.querySelector(':scope > p');if(p)p.textContent='导入订单、生成统计、审核学习。把复杂流程留给系统。';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tune);else tune();
g.WRITE_V1061_PROFESSIONAL_HERO={VERSION,tune};
})(window);
