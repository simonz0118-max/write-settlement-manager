/* WRITE V10 — Canary Router */
(function(g){'use strict';const VERSION='10.0.0-rc1',KEY='write-v10-canary-percent';
function getPercent(){const n=Number(localStorage.getItem(KEY)||0);return[0,5,25,50,100].includes(n)?n:0}
function setPercent(n){n=Number(n);if(![0,5,25,50,100].includes(n))throw new Error('INVALID_CANARY_PERCENT');localStorage.setItem(KEY,String(n));return n}
function stableHash(s=''){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0)}
function selected(key,percent=getPercent()){return stableHash(key)%100<percent}
function shouldUseV10(audit,key,percent=getPercent()){
 if(!audit?.hardPass)return{useV10:false,reason:'FIVEFOLD_FAILED'};
 if(!selected(key,percent))return{useV10:false,reason:'NOT_IN_CANARY'};
 return{useV10:true,reason:`CANARY_${percent}`};
}
function rollback(){setPercent(0);return 0}
g.WRITE_V10_CANARY={VERSION,getPercent,setPercent,selected,shouldUseV10,rollback};
})(window);