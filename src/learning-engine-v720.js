/* WRITE Settlement Manager v7.2.0 — learning + conservation bridge */
(function(){
'use strict';

function norm(v=''){return String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ')}
function recordKeyOf(o={}){
  return String(o.recordKey||[o.sourceFile,o.sourceSheet,o.sourceRow,o.orderId,o.trackingNo].map(v=>String(v??'')).join('\u0001'));
}
function currentOrders(){try{return Array.isArray(classified?.orders)?classified.orders:[]}catch{return[]}}
function currentLines(){try{return Array.isArray(classified?.lineItems)?classified.lineItems:[]}catch{return[]}}
function currentSheets(){try{return Array.isArray(sheets)?sheets:[]}catch{return[]}}
function currentWorkbooks(){try{return Array.isArray(sourceWorkbooks)?sourceWorkbooks:[]}catch{return[]}}

function conservationAudit(){
  const os=currentOrders(), ls=currentLines(), ss=currentSheets();
  const imported=ss.filter(s=>s.status==='imported');
  const sourceRecords=imported.reduce((a,s)=>a+(Number(s.orderCount)||0),0);
  const orderRecords=os.length;
  const expectedQty=os.reduce((a,o)=>a+(Number(o.productCount)||0),0);
  const actualQty=ls.reduce((a,x)=>a+(Number(x.quantity)||1),0);
  const amountByCurrency=new Map();
  for(const o of os){
    const c=String(o.currency||'EUR').toUpperCase();
    amountByCurrency.set(c,(amountByCurrency.get(c)||0)+(Number(o.orderAmount)||0));
  }
  const issues=[];
  if(sourceRecords!==orderRecords)issues.push({
    type:'ORDER_RECORD_LOSS',
    message:`源订单记录 ${sourceRecords} 行，但进入结算的记录为 ${orderRecords} 行，差 ${sourceRecords-orderRecords} 行。`
  });
  if(expectedQty>0 && expectedQty!==actualQty)issues.push({
    type:'PRODUCT_QUANTITY_MISMATCH',
    message:`源订单产品总数 ${expectedQty}，解析商品数量 ${actualQty}，差 ${expectedQty-actualQty}。`
  });
  const missingRecordKey=os.filter(o=>!o.recordKey);
  if(missingRecordKey.length)issues.push({type:'MISSING_RECORD_KEY',message:`${missingRecordKey.length} 条订单记录缺少源记录身份。`});
  return {ok:issues.length===0,sourceRecords,orderRecords,expectedQty,actualQty,issues};
}

function similar(a,b){
  a=norm(a);b=norm(b);if(!a||!b)return 0;
  if(a===b)return 1;
  if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length);
  const aa=new Set(a.split(/\s+/)),bb=new Set(b.split(/\s+/));let hit=0;
  for(const x of aa)if(bb.has(x))hit++;
  return hit/Math.max(aa.size,bb.size,1);
}

async function learnFromHistoricalFact(){
  if(!window.WRITE_KB?.learnFactModel)return {factModels:0,costModels:0};
  const ss=currentSheets(), lines=currentLines();
  let factModels=0,costModels=0;
  for(const s of ss.filter(x=>x.status==='ignored_fact'&&Array.isArray(x.factRows))){
    const rows=s.factRows||[];
    if(!rows.length)continue;
    const currency=(()=>{try{return currencyForWorkbook(s.sourceFile)}catch{return'EUR'}})();
    await window.WRITE_KB.learnFactModel({
      sourceFile:s.sourceFile,sheetName:s.sheetName,currency,
      rows:rows.map(r=>({country:r.country||'',description:r.description||'',cogs:r.cogs,shipping:r.shipping,unitTotal:r.unitTotal,sourceRow:r.sourceRow}))
    },false);
    factModels++;
    const wbLines=lines.filter(x=>String(x.sourceFile||'')===String(s.sourceFile||''));
    for(const r of rows){
      const unit=Number.isFinite(Number(r.unitTotal))?Number(r.unitTotal):
        ((Number.isFinite(Number(r.cogs))?Number(r.cogs):0)+(Number.isFinite(Number(r.shipping))?Number(r.shipping):0));
      if(!Number.isFinite(unit)||unit<0||!String(r.description||'').trim())continue;
      const ranked=wbLines.map(line=>({line,score:Math.max(similar(r.description,line.productName),similar(r.description,line.sku))}))
        .filter(x=>x.score>=.82).sort((a,b)=>b.score-a.score);
      if(!ranked.length)continue;
      if(ranked.length>1 && Math.abs(ranked[0].score-ranked[1].score)<.04)continue;
      const line=ranked[0].line;
      await window.WRITE_KB.learnCostModel({
        productName:line.productName,sku:line.sku,country:r.country||line.country||'',currency,
        strategy:'UNIT_FIXED',unitCost:unit,cogs:r.cogs,shipping:r.shipping,
        sourceFactDescription:r.description,sourceFile:s.sourceFile,confidence:ranked[0].score
      },false);
      costModels++;
    }
  }
  return {factModels,costModels};
}

function unresolvedCostGroups(){
  const lines=currentLines().filter(x=>!x.isFree);
  const out=new Map();
  for(const x of lines){
    const result=window.WRITE_KB?.calculateCost?.({
      productName:x.productName,sku:x.sku,country:x.country,currency:x.currency||'EUR',
      quantity:Number(x.quantity)||1,orderAmount:Number(x.orderAmount)||0
    });
    if(result?.resolved)continue;
    const key=[norm(x.sku)||norm(x.productName),String(x.country||'').toUpperCase(),String(x.currency||'EUR').toUpperCase()].join('\u0001');
    if(!out.has(key))out.set(key,{productName:x.productName||'',sku:x.sku||'',country:x.country||'',currency:x.currency||'EUR',quantity:0,orders:new Set()});
    const g=out.get(key);g.quantity+=Number(x.quantity)||1;g.orders.add(recordKeyOf(x));
  }
  return [...out.values()];
}

function ensureCostModal(){
  let el=document.getElementById('v720CostModal');
  if(el)return el;
  el=document.createElement('div');el.id='v720CostModal';el.className='modal-backdrop';el.hidden=true;document.body.appendChild(el);return el;
}
function promptCostOne(item){
  return new Promise(resolve=>{
    const host=ensureCostModal();
    host.innerHTML=`<div class="modal-card schema-review-card" role="dialog" aria-modal="true">
      <div class="modal-icon">€</div><h3>确认新成本计算方式</h3>
      <p><b>${escapeHtml(item.productName||item.sku||'未命名商品')}</b><br>${escapeHtml(item.country||'GLOBAL')} · ${escapeHtml(item.currency||'EUR')} · 当前 ${item.quantity} 件</p>
      <div class="schema-map-grid">
        <label><span>计算方式</span><select id="v720Strategy">
          <option value="UNIT_FIXED">数量 × 单位成本</option>
          <option value="ORDER_FIXED">每条订单固定成本</option>
          <option value="PERCENT_ORDER">订单金额百分比</option>
          <option value="TIER_UNIT">数量阶梯单位成本</option>
        </select></label>
        <label><span>数值 / 阶梯</span><input id="v720Value" placeholder="如 3.25；百分比填 8.5；阶梯填 1-9:5,10-99:4.5,100+:4"/></label>
      </div>
      <div class="schema-hint">确认后永久学习并同步 D1；已有人工规则冲突时不会自动覆盖。</div>
      <div class="modal-actions"><button class="toolbar-button" id="v720Cancel">稍后处理</button><button class="toolbar-button filled" id="v720Save">确认并永久学习</button></div>
    </div>`;
    host.hidden=false;
    host.querySelector('#v720Cancel').onclick=()=>{host.hidden=true;resolve(false)};
    host.querySelector('#v720Save').onclick=async()=>{
      const strategy=host.querySelector('#v720Strategy').value;
      const raw=host.querySelector('#v720Value').value.trim();
      let spec={productName:item.productName,sku:item.sku,country:item.country,currency:item.currency,strategy};
      if(strategy==='UNIT_FIXED')spec.unitCost=Number(raw);
      else if(strategy==='ORDER_FIXED')spec.orderCost=Number(raw);
      else if(strategy==='PERCENT_ORDER')spec.percent=Number(raw);
      else {
        const tiers=[];
        for(const part of raw.split(',')){
          const m=part.trim().match(/^(\d+)(?:-(\d+)|\+)?\s*:\s*([0-9.]+)$/);
          if(m)tiers.push({min:Number(m[1]),max:m[2]?Number(m[2]):null,unitCost:Number(m[3])});
        }
        spec.tiers=tiers;
      }
      try{
        const saved=await window.WRITE_KB.learnCostModel(spec,true);
        if(saved?.conflict){alert('检测到与已确认成本规则冲突，已进入规则冲突待确认，不会覆盖原规则。');host.hidden=true;resolve(false);return}
        await window.WRITE_KB.sync?.().catch(()=>{});
        host.hidden=true;resolve(true);
      }catch(err){alert('成本规则保存失败：'+(err?.message||err))}
    };
  });
}
async function ensureCosts(){
  const groups=unresolvedCostGroups();
  for(const g of groups){
    const ok=await promptCostOne(g);
    if(!ok)return false;
  }
  return true;
}

async function beforeExport(){
  const audit=conservationAudit();
  if(!audit.ok)throw new Error('V7.2 数据守恒未通过：'+audit.issues.map(x=>x.message).join('；'));
  const costsOk=await ensureCosts();
  if(!costsOk)throw new Error('存在尚未确认的成本计算方式，已停止生成最终 FACT/发票。');
  return true;
}

window.addEventListener('write-import-complete',async()=>{
  try{
    const learned=await learnFromHistoricalFact();
    if(learned.factModels||learned.costModels){
      await window.WRITE_KB?.sync?.().catch(()=>{});
      window.dispatchEvent(new CustomEvent('write-kb-updated'));
    }
  }catch(err){console.warn('V7.2 historical FACT learning skipped',err)}
});

window.WRITE_LEARNING_V2={conservationAudit,learnFromHistoricalFact,unresolvedCostGroups,ensureCosts,beforeExport};
})();