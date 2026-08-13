/* WRITE V10.2.8 — package-level costing + sidebar final fix */
(function(g){'use strict';
const VERSION='10.2.8';
const clean=v=>String(v??'').replace(/\r/g,' ').replace(/\s+/g,' ').trim(),upper=v=>clean(v).toUpperCase(),round2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const SHIPPING={
FRANCE:{1:5.06,2:8.07,3:11.01,4:13.93,5:17.78,6:20.92},BELGIUM:{1:4.64,2:7.58,3:10.52,4:13.46,5:16.41,6:19.35},
CANADA:{1:5.29,2:8.37,3:11.46,4:18.06,5:21.70,6:25.34},SWITZERLAND:{1:5.49,2:9.78,3:14.00,4:18.36,5:22.66,6:26.95},
LUXEMBOURG:{1:5.49,2:10.69,3:14.79,4:18.88},GERMANY:{1:5.76,2:9.98,3:14.68}};
const FALLBACK={FRANCE:{LOT4:.76,LOT6:1.49,COLOR:.25},BELGIUM:{LOT4:.76,LOT6:1.49,COLOR:.25},CANADA:{LOT4:.76,LOT6:1.49,COLOR:.25},SWITZERLAND:{LOT4:.76,LOT6:2.55,COLOR:.25},LUXEMBOURG:{LOT4:.79,LOT6:2.73,COLOR:.25},GERMANY:{LOT4:.76,LOT6:1.79,COLOR:.25}};
function kind(v=''){const t=clean(v).toLowerCase();if(/lot de 4|4 mines rechargeables/.test(t))return'LOT4';if(/lot de 6|6 mines color/.test(t))return'LOT6';if(/mines color/.test(t))return'COLOR';return''}
function kbUnit(e,row){try{const c=g.WRITE_KB?.calculateCost?.({sku:clean(e.sku),productName:clean(e.shortDescription||e.rawProductName),country:row.country,currency:row.currency,quantity:1,orderAmount:0});if(c?.resolved&&Number.isFinite(Number(c.unitCost)))return Number(c.unitCost)}catch{}return null}
function evidenceUnit(e,row){const x=kbUnit(e,row);if(x!==null)return x;if(e.family==='PENCIL_MAIN')return .85;const v=FALLBACK[upper(row.country)]?.[kind(e.shortDescription||e.rawProductName)];return Number.isFinite(Number(v))?Number(v):null}
function packagePrice(row={}){
 if(row.role!=='PACKAGE')return null;
 const ev=Array.isArray(row.rawEvidence)?row.rawEvidence:[], orders=new Map();
 for(const e of ev){const id=clean(e.orderId)||'__';if(!orders.has(id))orders.set(id,[]);orders.get(id).push(e)}
 if(!orders.size)return null;
 const totals=[];let representativeGoods=null,representativeShip=null;
 for(const list of orders.values()){
   let goods=0,pencils=0;
   for(const e of list){const mult=Number(e.multiplicity)||1;if(e.family==='PENCIL_MAIN')pencils+=mult;const u=evidenceUnit(e,row);if(u===null)return null;goods+=u*mult}
   const ship=SHIPPING[upper(row.country)]?.[pencils||1] ?? SHIPPING[upper(row.country)]?.[1];
   if(!Number.isFinite(Number(ship)))return null;
   if(representativeGoods===null){representativeGoods=goods;representativeShip=Number(ship)}
   totals.push(round2(goods+Number(ship)));
 }
 const first=totals[0];if(totals.some(v=>Math.abs(v-first)>.001))return null;
 return{cogs:round2(representativeGoods),shipping:round2(representativeShip),unitTotal:first,source:'V1028_COMPONENT_SUM_ONE_PARCEL_SHIPPING'};
}
function apply(row){if(row.unitTotal!==null&&row.unitTotal!==undefined&&row.unitTotal!=='')return row;let p=null;
 try{const c=g.WRITE_KB?.calculateCost?.({sku:'CONFIG:'+String(row.configurationFingerprint||''),productName:row.description,country:row.country,currency:row.currency,quantity:1,orderAmount:0});if(c?.resolved&&Number.isFinite(Number(c.unitCost)))p={cogs:Number(c.unitCost),shipping:0,unitTotal:Number(c.unitCost),source:'CLOUD_CONFIG_COST_MODEL'}}catch{}
 if(!p)p=packagePrice(row);if(!p)return row;
 row.cogs=p.cogs;row.shipping=p.shipping;row.unitTotal=p.unitTotal;row.amount=round2(p.unitTotal*(Number(row.quantity)||0));row.priceBlank=false;row.needsReview=false;row.learnedFromReviewedWorkbook=true;row.priceSource=p.source;return row;
}
function patchProduction(){const X=g.WRITE_V10_PRODUCTION;if(!X?.build||X.__v1028)return;const base=X.build.bind(X);X.build=input=>{const r=base(input);(r.rows||[]).forEach(apply);r.version=VERSION;return r};X.__v1028=true}
function fixNav(){if(typeof document==='undefined')return;const n=document.querySelector('.nav-item[data-view="learning"]');if(!n)return;n.replaceChildren();const i=document.createElement('span');i.className='v1028-nav-icon';i.textContent='⌘';const l=document.createElement('span');l.className='v1028-nav-label';l.textContent='数据管理';n.append(i,l);n.title='数据管理';n.setAttribute('aria-label','数据管理');let s=document.getElementById('v1028NavStyle');if(!s){s=document.createElement('style');s.id='v1028NavStyle';document.head.appendChild(s)}s.textContent='.nav-item[data-view="learning"]{display:grid!important;grid-template-columns:18px minmax(0,1fr)!important;align-items:center!important;column-gap:10px!important;white-space:nowrap!important}.nav-item[data-view="learning"]::before,.nav-item[data-view="learning"]::after{content:none!important;display:none!important}.v1028-nav-icon{display:block!important;width:18px!important;text-align:center!important;font-size:13px!important;line-height:1!important}.v1028-nav-label{display:block!important;min-width:0!important;font-size:12px!important;line-height:1.2!important;font-weight:inherit!important;writing-mode:horizontal-tb!important;letter-spacing:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}'}
function history(){if(typeof document!=='undefined'){document.body.dataset.release=VERSION;document.querySelectorAll('.brand-copy small').forEach(x=>x.textContent='v'+VERSION+' Production')}const M=g.WRITE_RELEASE_META;if(M){const e={version:VERSION,time:'2026-08-13 12:28',title:'Package Costing + Sidebar Integrity',items:['修复数据管理侧边栏重复图标/重复文字及字号异常。','恢复完整订单配置聚合：一个订单/包裹对应一条 PACKAGE FACT。','多商品订单按各商品成本分别计算后相加。','每个包裹只计算一次运费；有 Stylo eternel 按支数档位，无 Stylo eternel 按该国家 X1 默认运费。','礼盒、笔芯不额外增加运费；组件成本未知时继续标红。']};M.current={version:VERSION,time:e.time,title:e.title,sections:[{label:'V10.2.8',items:e.items}]};M.history=[e,...(M.history||[]).filter(x=>String(x.version)!==VERSION)];g.WRITE_CLOUD_RULE_LIBRARY?.repairHistory?.()}}
function start(){patchProduction();fixNav();history();setTimeout(()=>{patchProduction();fixNav();history()},350)}
if(typeof document!=='undefined'){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start()}else patchProduction();
g.WRITE_V1028_HOTFIX={VERSION,_test:{kind,evidenceUnit,packagePrice,apply}};
})(typeof window!=='undefined'?window:globalThis);

