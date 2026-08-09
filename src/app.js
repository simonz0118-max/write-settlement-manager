import { classifyOrders, LINE_CATEGORIES } from './lib/accounting.js';
import { buildXlsx, downloadBlob } from './lib/xlsxWriter.js';

const $ = (id) => document.getElementById(id);
const els = {
  dropzone:$('dropzone'), fileInput:$('fileInput'), chooseButton:$('chooseButton'), idleState:$('idleState'), busyState:$('busyState'),
  currentFile:$('currentFile'), progressFill:$('progressFill'), progressText:$('progressText'), errorCard:$('errorCard'), errorText:$('errorText'), dismissError:$('dismissError'),
  importLanding:$('importLanding'), appViews:$('appViews'), topActions:$('topActions'), metricOrders:$('metricOrders'), metricAmount:$('metricAmount'), metricSheets:$('metricSheets'), metricFacts:$('metricFacts'), metricDuplicates:$('metricDuplicates'), metricReview:$('metricReview'), metricGift:$('metricGift'),
  accountingSummary:$('accountingSummary'), lineSummary:$('lineSummary'), importSummary:$('importSummary'), sheetList:$('sheetList'), recentOrdersBody:$('recentOrdersBody'), unknownList:$('unknownList'), emptyReview:$('emptyReview'),
  searchInput:$('searchInput'), countrySelect:$('countrySelect'), categorySelect:$('categorySelect'), ordersBody:$('ordersBody'), resultCount:$('resultCount'), tableNote:$('tableNote'),
  navReviewCount:$('navReviewCount'), quickReviewCount:$('quickReviewCount'), systemStatus:$('systemStatus'), lastImportText:$('lastImportText'), sidebarResetButton:$('sidebarResetButton'),
  reimportButton:$('reimportButton'), clearButton:$('clearButton'), topExportButton:$('topExportButton'), quickExportButton:$('quickExportButton'), exportButton:$('exportButton'), heroExportButton:$('heroExportButton'), heroImportButton:$('heroImportButton'), inlineImportButton:$('inlineImportButton'), navImportButton:$('navImportButton'),
  confirmModal:null, modalTitle:null, modalText:null, modalCancel:null, modalConfirm:null
};

const numberFormat = new Intl.NumberFormat('fr-FR');
const moneyFormat = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const decimalFormat = new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
const durationFormat = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const percentDisplayFormat = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
let worker=null, orders=[], sheets=[], classified=null, busy=false, duplicateCount=0, importStartedAt=0, importDuration=0, importedFileNames=[];
let modalAction=null;

function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatBytes(n){const v=Number(n)||0;if(v<1024)return `${v} B`;if(v<1024**2)return `${decimalFormat.format(v/1024)} KB`;if(v<1024**3)return `${decimalFormat.format(v/1024**2)} MB`;return `${decimalFormat.format(v/1024**3)} GB`}
function nowText(){return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}

function setBusy(v){busy=v;els.idleState.hidden=v;els.busyState.hidden=!v;els.dropzone.classList.toggle('busy',v)}
function showError(m){els.errorText.textContent=m;els.errorCard.hidden=false}
function hideError(){els.errorCard.hidden=true;els.errorText.textContent=''}

function setView(view){
  document.querySelectorAll('.nav-item[data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  document.querySelectorAll('.view[data-view-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.viewPanel===view));
}
function resetState({showLanding=true}={}){
  worker?.terminate(); worker=null; orders=[]; sheets=[]; classified=null; busy=false; duplicateCount=0; importDuration=0; importedFileNames=[];
  setBusy(false); hideError(); els.progressFill.style.width='0%'; els.fileInput.value=''; els.searchInput.value='';
  els.countrySelect.innerHTML='<option value="ALL">全部国家</option>'; els.categorySelect.innerHTML='<option value="ALL">全部会计分类</option>';
  els.appViews.hidden=true; els.topActions.hidden=true; els.importLanding.hidden=!showLanding; els.sidebarResetButton.disabled=true;
  els.systemStatus.textContent='等待导入'; els.lastImportText.textContent='本地处理 · 数据不上传'; document.querySelector('.system-card')?.classList.remove('ready');
  els.navReviewCount.hidden=true; els.quickReviewCount.textContent='0'; setView('dashboard');
}

function ensureConfirmModal(){
  let modal=document.getElementById('confirmModal');
  if(modal) return modal;
  modal=document.createElement('div');
  modal.id='confirmModal';
  modal.className='modal-backdrop';
  modal.hidden=true;
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <div class="modal-icon">⌫</div>
    <h3 id="modalTitle">确认操作</h3>
    <p id="modalText"></p>
    <div class="modal-actions"><button id="modalCancel" class="toolbar-button" type="button">取消</button><button id="modalConfirm" class="toolbar-button danger filled" type="button">确认</button></div>
  </div>`;
  document.body.appendChild(modal);
  els.confirmModal=modal;
  els.modalTitle=modal.querySelector('#modalTitle');
  els.modalText=modal.querySelector('#modalText');
  els.modalCancel=modal.querySelector('#modalCancel');
  els.modalConfirm=modal.querySelector('#modalConfirm');
  els.modalCancel.addEventListener('click',closeConfirm);
  els.modalConfirm.addEventListener('click',()=>{const action=modalAction; closeConfirm(); if(typeof action==='function') action();});
  modal.addEventListener('click',e=>{if(e.target===modal)closeConfirm()});
  return modal;
}
function openConfirm({title,text,confirmText='确认',action}){
  const modal=ensureConfirmModal();
  els.modalTitle.textContent=title; els.modalText.textContent=text; els.modalConfirm.textContent=confirmText; modalAction=action;
  modal.hidden=false; modal.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>els.modalConfirm?.focus());
}
function closeConfirm(){
  const modal=document.getElementById('confirmModal');
  if(modal){modal.hidden=true;modal.setAttribute('aria-hidden','true')}
  modalAction=null;
}

function startImport(fileList){
  const files=[...fileList].filter(f=>/\.(xlsx|zip)$/i.test(f.name)); if(!files.length||busy)return;
  worker?.terminate(); worker=new Worker('./src/workers/import.worker.js',{type:'module'}); importStartedAt=performance.now(); importedFileNames=files.map(f=>f.name);
  setBusy(true); hideError(); els.importLanding.hidden=false; els.appViews.hidden=true; els.topActions.hidden=true;
  els.currentFile.textContent='准备读取…'; els.progressFill.style.width='0%'; els.progressText.textContent='0% · 大文件在独立线程运行';
  worker.onmessage=({data})=>{
    if(data.type==='file-start') els.currentFile.textContent=data.fileName;
    if(data.type==='progress'){
      const pct=Math.max(0,Math.min(100,Math.round((data.progress||0)*100)));
      els.progressFill.style.width=`${pct}%`; els.progressText.textContent=`${pct}% · ${data.phase==='extract'?'正在从 ZIP 提取工作簿':'正在流式读取工作表'}`;
      if(data.detail) els.currentFile.textContent=data.detail;
    }
    if(data.type==='complete'){
      orders=data.orders||[]; sheets=data.sheets||[]; duplicateCount=data.duplicates||0; classified=classifyOrders(orders); importDuration=(performance.now()-importStartedAt)/1000;
      els.progressFill.style.width='100%'; els.progressText.textContent='100% · 导入并分类完成'; els.currentFile.textContent='解析完成'; hideError(); setBusy(false); renderResults();
      worker?.terminate(); worker=null;
    }
    if(data.type==='error'){
      setBusy(false); showError(data.message||'未知导入错误'); worker?.terminate(); worker=null;
    }
  };
  worker.onerror=e=>{setBusy(false);showError(e.message||'导入线程异常');worker?.terminate();worker=null};
  worker.postMessage({files});
}

function renderResults(){
  if(!classified)return;
  const imported=sheets.filter(s=>s.status==='imported'), facts=sheets.filter(s=>s.status==='ignored_fact');
  const amount=orders.reduce((a,o)=>a+(Number(o.orderAmount)||0),0), review=classified.orders.filter(o=>o.classificationStatus==='需复核').length;
  const itemQty=classified.lineItems.reduce((a,b)=>a+(Number(b.quantity)||1),0), giftQty=classified.lineItems.filter(x=>x.isFree).reduce((a,b)=>a+(Number(b.quantity)||1),0);
  const rawRows=imported.reduce((a,s)=>a+(Number(s.orderCount)||0),0), uniqueBooks=new Set(sheets.map(s=>s.sourceFile)).size, inflated=sheets.reduce((a,s)=>a+(Number(s.inflatedBytes)||0),0);

  els.metricOrders.textContent=numberFormat.format(orders.length); els.metricAmount.textContent=moneyFormat.format(amount); els.metricSheets.textContent=numberFormat.format(imported.length);
  els.metricFacts.textContent=numberFormat.format(facts.length); els.metricDuplicates.textContent=`${numberFormat.format(duplicateCount)} 个重复订单已去重`; els.metricReview.textContent=numberFormat.format(review); els.metricGift.textContent=numberFormat.format(itemQty);
  els.navReviewCount.textContent=numberFormat.format(review); els.navReviewCount.hidden=review===0; els.quickReviewCount.textContent=numberFormat.format(review);
  els.systemStatus.textContent='就绪'; els.lastImportText.textContent=`上次导入 · ${nowText()}`; document.querySelector('.system-card')?.classList.add('ready'); els.sidebarResetButton.disabled=false;

  renderAccounting(amount); renderProductSummary(giftQty); renderUnknown(); renderSheets(); renderOrders(); renderRecent();
  const countries=[...new Set(classified.orders.map(o=>o.country).filter(Boolean))].sort();
  els.countrySelect.innerHTML='<option value="ALL">全部国家</option>'+countries.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
  const cats=[...new Set(classified.orders.map(o=>o.accountingCategory))];
  els.categorySelect.innerHTML='<option value="ALL">全部会计分类</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');

  const fileLabel=importedFileNames.length===1?importedFileNames[0]:`${importedFileNames.length} 个上传文件`;
  const summaryData=[['文件',fileLabel],['Excel 工作簿',`${uniqueBooks} 个`],['订单 Sheet',`${imported.length} 个`],['FACT 成本 Sheet',`${facts.length} 个`],['原始订单行',`${numberFormat.format(rawRows)} 行`],['重复订单',`${numberFormat.format(duplicateCount)} 个`],['解析数据量',formatBytes(inflated)],['处理耗时',`${durationFormat.format(importDuration)} 秒`]];
  els.importSummary.innerHTML=summaryData.map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');

  els.importLanding.hidden=true; els.appViews.hidden=false; els.topActions.hidden=false; hideError(); setView('dashboard');
}

function renderAccounting(totalAmount){
  const rows=classified.orderSummary;
  els.accountingSummary.innerHTML=rows.map(r=>{
    const share=totalAmount>0?(r.amount/totalAmount*100):0;
    return `<div class="summary-row"><strong>${escapeHtml(r.category)}</strong><span>${numberFormat.format(r.orders)}</span><b>${escapeHtml(moneyFormat.format(r.amount))}</b><small>${percentDisplayFormat.format(share)} %</small><i class="share-track" style="width:${Math.min(100,share)}%"></i></div>`;
  }).join('')+`<div class="summary-row total"><strong>合计</strong><span>${numberFormat.format(classified.orders.length)}</span><b>${escapeHtml(moneyFormat.format(totalAmount))}</b><small>100%</small></div>`;
}

function renderProductSummary(giftQty){
  els.lineSummary.innerHTML=classified.lineSummary.map(r=>`<div class="product-row"><strong>${escapeHtml(r.category)}</strong><span>${numberFormat.format(r.quantity)} 件</span><small>${numberFormat.format(r.orders)} 个订单涉及</small><small>${r.freeQuantity?`赠品 ${numberFormat.format(r.freeQuantity)} 件`:'—'}</small></div>`).join('')+
    `<div class="product-row"><strong>赠品合计</strong><span>${numberFormat.format(giftQty)} 件</span><small>🎁 / 100% off 自动识别</small><small>单独标记</small></div>`;
}

function reviewCategoryOptions(selected='AUTO'){
  const options=[['AUTO','自动识别'],...LINE_CATEGORIES.filter(x=>x.code!=='OTHER').map(x=>[x.code,x.label])];
  return options.map(([code,label])=>`<option value="${code}" ${selected===code?'selected':''}>${escapeHtml(label)}</option>`).join('');
}
function renderUnknown(){
  const unknown=classified.unknown||[]; els.emptyReview.hidden=unknown.length>0;
  els.unknownList.innerHTML=unknown.map(x=>{
    const order=orders.find(o=>String(o.orderId)===String(x.orderId))||{};
    const forced=order.manualLineCategories?.[x.lineNo]||'AUTO';
    return `<div class="review-editor" data-order-id="${escapeHtml(x.orderId)}" data-line-no="${x.lineNo||1}">
      <div class="review-id"><strong>${escapeHtml(x.orderId)}</strong><small>第 ${x.lineNo||1} 个商品 · ${escapeHtml(order.country||x.country||'—')}</small></div>
      <label><span>产品名称</span><input class="review-name" value="${escapeHtml(x.productName||'')}" placeholder="补充或修改产品名称" /></label>
      <label><span>SKU</span><input class="review-sku" value="${escapeHtml(x.sku||'')}" placeholder="补充或修改 SKU" /></label>
      <label><span>分类</span><select class="review-category">${reviewCategoryOptions(forced)}</select></label>
      <button class="review-save" type="button">保存并重新分类</button>
    </div>`;
  }).join('');
}
function setLineValue(order,key,lineNo,value){
  const arr=String(order[key]||'').split(/\n/); while(arr.length<lineNo)arr.push(''); arr[lineNo-1]=String(value||'').trim(); order[key]=arr.join('\n');
}
function saveReviewRow(editor){
  const orderId=editor.dataset.orderId, lineNo=Number(editor.dataset.lineNo)||1;
  const order=orders.find(o=>String(o.orderId)===String(orderId)); if(!order)return;
  setLineValue(order,'productNames',lineNo,editor.querySelector('.review-name').value);
  setLineValue(order,'skuLines',lineNo,editor.querySelector('.review-sku').value);
  const chosen=editor.querySelector('.review-category').value;
  order.manualLineCategories={...(order.manualLineCategories||{})};
  if(chosen==='AUTO') delete order.manualLineCategories[lineNo]; else order.manualLineCategories[lineNo]=chosen;
  classified=classifyOrders(orders); renderResults(); setView('review');
}

function renderSheets(){
  els.sheetList.innerHTML=sheets.map(s=>{
    const status=s.status==='imported'?'imported':s.status==='ignored_fact'?'ignored_fact':'ignored_non_order';
    const icon=s.status==='imported'?'✓':s.status==='ignored_fact'?'F':'–';
    const badge=s.status==='imported'?`${numberFormat.format(s.orderCount)} 单`:s.status==='ignored_fact'?'FACT · 已解析':'非订单 · 忽略';
    return `<div class="sheet-row"><div class="sheet-icon ${status}">${icon}</div><div class="sheet-main"><strong>${escapeHtml(s.sheetName)}</strong><span>${escapeHtml(s.sourceFile)}</span></div><div class="sheet-reason">${escapeHtml(s.reason)}</div><div class="badge ${status}">${escapeHtml(badge)}</div></div>`;
  }).join('');
}

function renderRecent(){
  els.recentOrdersBody.innerHTML=classified.orders.slice(-5).reverse().map(o=>`<tr><td class="mono">${escapeHtml(o.orderId)}</td><td>${escapeHtml(o.buyerName||'—')}</td><td>${escapeHtml(o.country||'—')}</td><td>${o.orderAmount==null?'—':escapeHtml(moneyFormat.format(o.orderAmount))}</td><td><span class="tag">${escapeHtml(o.accountingCategory)}</span></td></tr>`).join('');
}

function renderOrders(){
  if(!classified)return; const q=els.searchInput.value.trim().toLowerCase(), country=els.countrySelect.value, cat=els.categorySelect.value;
  const filtered=classified.orders.filter(o=>{if(country!=='ALL'&&o.country!==country)return false;if(cat!=='ALL'&&o.accountingCategory!==cat)return false;if(!q)return true;return[o.orderId,o.buyerName,o.trackingNo,o.productNames,o.country,o.accountingCategory].some(v=>String(v||'').toLowerCase().includes(q))});
  els.resultCount.textContent=`${numberFormat.format(filtered.length)} 条结果`;
  els.ordersBody.innerHTML=filtered.slice(0,700).map(o=>{const product=String(o.productNames||'—').split('\n')[0];return `<tr><td class="mono">${escapeHtml(o.orderId)}</td><td>${o.orderAmount==null?'—':escapeHtml(moneyFormat.format(o.orderAmount))}</td><td>${escapeHtml(o.productCount??'—')}</td><td><span class="accounting-pill ${o.classificationStatus==='需复核'?'review':''}">${escapeHtml(o.accountingCategory)}</span></td><td>${escapeHtml(o.country||'—')}</td><td>${escapeHtml(o.buyerName||'—')}</td><td class="product-cell" title="${escapeHtml(o.productNames||'')}">${escapeHtml(product)}</td><td>${o.hasGift?'是':'—'}</td><td class="mono muted">${escapeHtml(o.trackingNo||'—')}</td></tr>`}).join('');
  els.tableNote.hidden=filtered.length<=700; els.tableNote.textContent=filtered.length>700?`为保持页面流畅，当前预览前 700 条；全部 ${numberFormat.format(filtered.length)} 条已完成分类。`:'';
}

function buildFactExportData(){
  const factRows=sheets.flatMap(s=>(s.factRows||[]).map(r=>({...r,sourceFile:r.sourceFile||s.sourceFile,sourceSheet:r.sourceSheet||s.sheetName})));
  const active=factRows.filter(r=>(Number(r.quantity)||0)>0 || (Number(r.amount)||0)!==0);

  const normalizeDesc=(v)=>String(v||'未命名分类').replace(/\s+/g,' ').replace(/eternel\s*X/ig,'eternelX').trim();
  const naturalRank=(desc)=>{
    const d=normalizeDesc(desc);
    const m=d.match(/eternelX\s*(\d+)/i);
    if(m)return [0,Number(m[1]),d.toLowerCase()];
    if(/4 mines rechargeables|Lot de 4 mines rechargeables/i.test(d))return [1,0,d.toLowerCase()];
    if(/6 Mines colorées|Mines colorées/i.test(d))return [2,0,d.toLowerCase()];
    if(/Gravure/i.test(d))return [3,0,d.toLowerCase()];
    if(/Coffret/i.test(d))return [4,0,d.toLowerCase()];
    return [9,0,d.toLowerCase()];
  };
  const compareDesc=(a,b)=>{
    const aa=naturalRank(a.description),bb=naturalRank(b.description);
    return aa[0]-bb[0] || aa[1]-bb[1] || aa[2].localeCompare(bb[2],'fr');
  };

  const totalAmount=active.reduce((a,r)=>a+(Number(r.amount)||0),0);
  const totalQty=active.reduce((a,r)=>a+(Number(r.quantity)||0),0);
  const cogsTotal=active.reduce((a,r)=>a+((Number(r.quantity)||0)*(Number(r.cogs)||0)),0);
  const shippingTotal=active.reduce((a,r)=>a+((Number(r.quantity)||0)*(Number(r.shipping)||0)),0);
  const unallocated=totalAmount-cogsTotal-shippingTotal;

  const byDesc=new Map();
  for(const r of factRows){
    const display=normalizeDesc(r.description);
    const key=display.toLowerCase();
    const qty=Number(r.quantity)||0, amount=Number(r.amount)||0;
    const cur=byDesc.get(key)||{
      description:display,quantity:0,cogsAmount:0,shippingAmount:0,unitAmountWeighted:0,amount:0,
      countries:new Set(),files:new Set(),rows:0,rateRows:0,cogsRateSum:0,shippingRateSum:0,unitRateSum:0
    };
    cur.quantity+=qty;
    cur.cogsAmount+=qty*(Number(r.cogs)||0);
    cur.shippingAmount+=qty*(Number(r.shipping)||0);
    cur.unitAmountWeighted+=qty*(Number(r.unitTotal)||0);
    cur.amount+=amount;
    cur.rows+=1;
    if(Number.isFinite(Number(r.cogs))||Number.isFinite(Number(r.shipping))||Number.isFinite(Number(r.unitTotal))){
      cur.rateRows+=1;
      cur.cogsRateSum+=Number(r.cogs)||0;
      cur.shippingRateSum+=Number(r.shipping)||0;
      cur.unitRateSum+=Number(r.unitTotal)||0;
    }
    if(r.country)cur.countries.add(r.country);
    if(r.sourceFile)cur.files.add(r.sourceFile);
    byDesc.set(key,cur);
  }

  const summary=[...byDesc.values()].map(x=>{
    const qty=x.quantity;
    const avgCogs=qty?x.cogsAmount/qty:(x.rateRows?x.cogsRateSum/x.rateRows:0);
    const avgShipping=qty?x.shippingAmount/qty:(x.rateRows?x.shippingRateSum/x.rateRows:0);
    const avgUnit=qty?x.unitAmountWeighted/qty:(x.rateRows?x.unitRateSum/x.rateRows:(avgCogs+avgShipping));
    return {...x,avgCogs,avgShipping,avgUnit};
  }).filter(x=>x.quantity>0 || x.amount!==0).sort(compareDesc);

  const countries=new Map();
  for(const r of factRows){
    const country=String(r.country||'GLOBAL / 附加项目').trim()||'GLOBAL / 附加项目';
    if(!countries.has(country))countries.set(country,[]);
    countries.get(country).push(r);
  }
  const countryOrder=[...countries.keys()].sort((a,b)=>{
    const preferred=['FRANCE','BELGIUM','CANADA','SWITZERLAND','LUXEMBOURG','GERMANY','SPAIN','ITALY','NETHERLANDS','AUSTRIA','PORTUGAL','GLOBAL / 附加项目'];
    const ai=preferred.indexOf(a.toUpperCase()),bi=preferred.indexOf(b.toUpperCase());
    return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'en');
  });

  return {factRows,active,totalAmount,totalQty,cogsTotal,shippingTotal,unallocated,summary,countries,countryOrder};
}

function exportAccounting(){
  if(!classified)return;
  const totalAmount=classified.orders.reduce((a,o)=>a+(Number(o.orderAmount)||0),0);
  const reviewOrders=classified.orders.filter(o=>o.classificationStatus==='需复核');
  const reportDate=new Date().toLocaleString('zh-CN',{hour12:false});
  const sourceNames=[...new Set(sheets.map(x=>x.sourceFile).filter(Boolean))];
  const factSheets=sheets.filter(s=>s.status==='ignored_fact');
  const totalItemQty=classified.lineItems.reduce((a,x)=>a+(Number(x.quantity)||1),0);
  const giftQty=classified.lineItems.filter(x=>x.isFree).reduce((a,x)=>a+(Number(x.quantity)||1),0);
  const factData=buildFactExportData();
  const grossProfit=totalAmount-factData.totalAmount;
  const grossMargin=totalAmount?grossProfit/totalAmount:0;

  const summary=[
    ['WRITE Settlement Manager — 结算摘要','','','','','',''],
    [`生成时间：${reportDate}｜数据源：${sourceNames.length===1?sourceNames[0]:`${sourceNames.length} 个文件`}｜先看本页，明细与审计位于后续工作表。`,'','','','','',''],
    [],
    ['一、结算核心指标','','','','','',''],
    ['指标','数值','口径 / 说明','','','',''],
    ['销售订单总额',totalAmount,'去重后订单金额合计','','','',''],
    ['FACT 成本总额',factData.totalAmount,'来自 FACT 页 Amount (€) 合计','','','',''],
    ['估算毛利',grossProfit,'销售订单总额 - FACT 成本总额','','','',''],
    ['估算毛利率',grossMargin,'估算毛利 ÷ 销售订单总额','','','',''],
    ['去重后订单数',classified.orders.length,'最终纳入结算的唯一订单','','','',''],
    ['商品件数',totalItemQty,'所有商品行数量合计','','','',''],
    ['赠品件数',giftQty,'🎁 / 100% off 自动识别','','','',''],
    ['待复核订单',reviewOrders.length,'建议归零后再正式交会计','','','',''],
    [],
    ['二、FACT 分类汇总（与 FACT 页面相同口径）','','','','','',''],
    ['No','Description','Quantity','COGs (€)','Shipping (€)','COGs + Shipping (€)','Amount (€)']
  ];
  const factStart=summary.length+1; let no=1;
  for(const r of factData.summary) summary.push([no++,r.description,r.quantity,r.avgCogs,r.avgShipping,r.avgUnit,r.amount]);
  const factTotalRow=summary.length+1;
  summary.push(['','TOTAL / 合计',factData.totalQty,factData.totalQty?factData.cogsTotal/factData.totalQty:0,factData.totalQty?factData.shippingTotal/factData.totalQty:0,factData.totalQty?(factData.cogsTotal+factData.shippingTotal)/factData.totalQty:0,factData.totalAmount]);
  summary.push([]);
  const orderTitleRow=summary.length+1; summary.push(['三、订单会计分类汇总','','','','','','']);
  const orderHeaderRow=summary.length+1; summary.push(['会计分类','订单数','订单金额','金额占比','待复核','','']);
  const orderStart=summary.length+1;
  for(const r of classified.orderSummary) summary.push([r.category,r.orders,r.amount,totalAmount?r.amount/totalAmount:0,r.review||0,'','']);
  const orderTotalRow=summary.length+1; summary.push(['合计',classified.orders.length,totalAmount,1,reviewOrders.length,'','']);

  const factSummaryRows=[['No','Description','Quantity','COGs (€)','Shipping (€)','COGs + Shipping (€)','Amount (€)']]; no=1;
  for(const r of factData.summary) factSummaryRows.push([no++,r.description,r.quantity,r.avgCogs,r.avgShipping,r.avgUnit,r.amount]);
  factSummaryRows.push(['','TOTAL / 合计',factData.totalQty,factData.totalQty?factData.cogsTotal/factData.totalQty:0,factData.totalQty?factData.shippingTotal/factData.totalQty:0,factData.totalQty?(factData.cogsTotal+factData.shippingTotal)/factData.totalQty:0,factData.totalAmount]);

  const factDetailRows=[['国家/地区','No','Description','Quantity','COGs (€)','Shipping (€)','COGs + Shipping (€)','Amount (€)']];
  for(const country of factData.countryOrder){ for(const r of factData.countries.get(country)||[]) factDetailRows.push([country,r.no||'',r.description||'',r.quantity??'',r.cogs??'',r.shipping??'',r.unitTotal??'',r.amount??'']); }

  const orderRows=[['订单号','日期','客户','国家/地区','订单金额','会计分类','状态','商品件数','含赠品','运单号']];
  for(const o of classified.orders) orderRows.push([o.orderId,o.orderTime||'',o.buyerName||'',o.country||'',Number(o.orderAmount)||0,o.accountingCategory,o.classificationStatus,Number(o.productCount)||0,o.hasGift?'是':'否',o.trackingNo||'']);

  const productMap=new Map();
  for(const x of classified.lineItems){const key=[x.categoryLabel||'待确认',x.productName||'',x.sku||''].join('\u0001');const cur=productMap.get(key)||{category:x.categoryLabel||'待确认',product:x.productName||'',sku:x.sku||'',qty:0,free:0,orders:new Set()};const qty=Number(x.quantity)||1;cur.qty+=qty;if(x.isFree)cur.free+=qty;cur.orders.add(x.orderId);productMap.set(key,cur)}
  const productRows=[['商品分类','产品名称','SKU','总件数','付费件数','赠品件数','涉及订单数']];
  [...productMap.values()].sort((a,b)=>b.qty-a.qty||a.category.localeCompare(b.category)).forEach(x=>productRows.push([x.category,x.product,x.sku,x.qty,Math.max(0,x.qty-x.free),x.free,x.orders.size]));

  const byId=new Map(classified.orders.map(o=>[o.orderId,o]));
  const reviewRows=[['订单号','订单金额','客户','国家/地区','待确认产品','SKU','建议处理']];
  for(const x of classified.unknown){const o=byId.get(x.orderId)||{};reviewRows.push([x.orderId,Number(o.orderAmount)||0,o.buyerName||'',o.country||x.country||'',x.productName||'',x.sku||'','请在 WebApp「待复核」页修改并保存'])}
  if(reviewRows.length===1)reviewRows.push(['—',0,'','','无待复核商品','','全部已完成分类']);

  const auditRows=[['订单号','订单金额','会计分类','分类状态','人工修正','来源文件','来源 Sheet','源行号','店铺账号','付款时间','发货时间']];
  for(const o of classified.orders) auditRows.push([o.orderId,Number(o.orderAmount)||0,o.accountingCategory,o.classificationStatus,Object.keys(o.manualLineCategories||{}).length?'是':'否',o.sourceFile||'',o.sourceSheet||'',o.sourceRow||'',o.storeAccount||'',o.paidTime||'',o.shippedTime||'']);
  const logRows=[['来源文件','Sheet','处理状态','订单行数','处理说明','解压读取字节']]; for(const x of sheets)logRows.push([x.sourceFile,x.sheetName,x.status,x.orderCount,x.reason,x.inflatedBytes||0]);

  const blob=buildXlsx([
    {name:'00_结算摘要',rows:summary,widths:[30,18,20,17,17,20,20],titleRow:1,subtitleRow:2,sectionRows:[4,15,orderTitleRow],headerRows:[5,16,orderHeaderRow],totalRows:[factTotalRow,orderTotalRow],freezeRow:16,freezeCol:2,merges:['A1:G1','A2:G2','A4:G4','A15:G15',`A${orderTitleRow}:G${orderTitleRow}`],formatRules:[
      {r1:6,r2:8,c1:2,c2:2,kind:'currency'},{r1:9,r2:9,c1:2,c2:2,kind:'percent'},{r1:10,r2:13,c1:2,c2:2,kind:'int'},
      {r1:factStart,r2:factTotalRow,c1:1,c2:1,kind:'int'},{r1:factStart,r2:factTotalRow,c1:3,c2:3,kind:'int'},{r1:factStart,r2:factTotalRow,c1:4,c2:7,kind:'currency'},
      {r1:orderStart,r2:orderTotalRow,c1:2,c2:2,kind:'int'},{r1:orderStart,r2:orderTotalRow,c1:3,c2:3,kind:'currency'},{r1:orderStart,r2:orderTotalRow,c1:4,c2:4,kind:'percent'},{r1:orderStart,r2:orderTotalRow,c1:5,c2:5,kind:'int'}
    ],wrapColumns:[1,2,3]},
    {name:'01_FACT分类汇总',rows:factSummaryRows,widths:[9,42,13,15,17,21,19],headerRows:[1],totalRows:[factSummaryRows.length],freezeRow:1,freezeCol:2,autoFilterRow:1,integerColumns:[1,3],currencyColumns:[4,5,6,7],wrapColumns:[2],bandedRows:true},
    {name:'02_FACT国家明细',rows:factDetailRows,widths:[18,9,42,13,15,17,21,19],headerRows:[1],freezeRow:1,freezeCol:3,autoFilterRow:1,integerColumns:[2,4],currencyColumns:[5,6,7,8],wrapColumns:[3],bandedRows:true},
    {name:'03_订单明细',rows:orderRows,widths:[20,20,22,13,15,20,12,11,10,24],headerRows:[1],freezeRow:1,freezeCol:2,autoFilterRow:1,currencyColumns:[5],integerColumns:[8],centerColumns:[4,7,9],bandedRows:true},
    {name:'04_商品汇总',rows:productRows,widths:[18,46,30,12,12,12,14],headerRows:[1],freezeRow:1,freezeCol:1,autoFilterRow:1,integerColumns:[4,5,6,7],wrapColumns:[2,3],bandedRows:true},
    {name:'05_待复核',rows:reviewRows,widths:[20,15,22,14,46,30,38],headerRows:[1],freezeRow:1,freezeCol:2,autoFilterRow:1,currencyColumns:[2],wrapColumns:[5,6,7],reviewMode:true,bandedRows:true},
    {name:'90_订单审计',rows:auditRows,widths:[20,15,20,12,12,42,20,10,26,20,20],headerRows:[1],freezeRow:1,freezeCol:1,autoFilterRow:1,currencyColumns:[2],integerColumns:[8],bandedRows:true},
    {name:'99_导入日志',rows:logRows,widths:[44,22,18,12,48,20],headerRows:[1],freezeRow:1,autoFilterRow:1,integerColumns:[4,6],wrapColumns:[5],bandedRows:true}
  ]);
  downloadBlob(blob,`WRITE_会计结算_${currentOrderRangeLabel()}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
function reimportFlow(){
  if(!classified){els.fileInput.click();return}
  openConfirm({title:'重新导入数据？',text:'当前统计结果会被清空，然后打开文件选择器重新导入。原始文件不会被修改。',confirmText:'清空并重新导入',action:()=>{
// v7.0.11 release notes controller — show once per release per browser
const WRITE_RELEASE = {
  version: document.body.dataset.release || '6.5.8',
  date: '2026-08-09 00:14',
  title: 'WRITE Settlement Manager v7.0.11',
  sections: [
    {label:'修复', items:[
      '修复 FACT / Commercial Invoice 中部分小数实际为文本、导致 Excel 公式无法计算的问题。',
      '回填时 COGs、Shipping 等运算字段统一写为真正的数值单元格，同时保持法国/欧洲小数逗号显示。'
    ]},
    {label:'优化', items:[
      '导出交付包、会计报表和回填 FACT 文件名自动标注本批订单号范围。'
    ]}
  ]
};
function showReleaseNotesIfNeeded(){
  const version=WRITE_RELEASE.version;
  const key='write-release-seen';
  let seen='';
  try{seen=localStorage.getItem(key)||''}catch(e){}
  if(seen===version)return;
  const backdrop=document.createElement('div');
  backdrop.className='release-notes-backdrop';
  backdrop.setAttribute('role','dialog');
  backdrop.setAttribute('aria-modal','true');
  backdrop.setAttribute('aria-labelledby','releaseNotesTitle');
  const sections=WRITE_RELEASE.sections.map(section=>`<section class="release-notes-section"><h3>${escapeHtml(section.label)}</h3><ul>${section.items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`).join('');
  backdrop.innerHTML=`<div class="release-notes-card"><div class="release-notes-head"><div><span>本次更新</span><h2 id="releaseNotesTitle">${escapeHtml(WRITE_RELEASE.title)}</h2><p>${escapeHtml(WRITE_RELEASE.date)} · Designed by NEOVORA</p></div><div class="release-version">v${escapeHtml(version)}</div></div><div class="release-notes-body">${sections}</div><div class="release-notes-foot"><small>关闭后，本浏览器在 v${escapeHtml(version)} 版本中不会再次自动弹出。</small><button type="button" class="release-ack">我知道了</button></div></div>`;
  document.body.appendChild(backdrop);
  document.body.classList.add('release-notes-open');
  const close=()=>{
    try{localStorage.setItem(key,version)}catch(e){}
    backdrop.classList.add('closing');
    document.body.classList.remove('release-notes-open');
    setTimeout(()=>backdrop.remove(),160);
  };
  backdrop.querySelector('.release-ack')?.addEventListener('click',close);
  setTimeout(()=>backdrop.querySelector('.release-ack')?.focus(),80);
}

resetState();
showReleaseNotesIfNeeded();
window.__WRITE_APP_READY__=true; document.documentElement.dataset.writeReady='true';setTimeout(()=>els.fileInput.click(),80)}});
}
function clearFlow(){
  if(!classified)return;
  openConfirm({title:'清空当前数据？',text:'订单、分类、导入记录和统计结果将从本页面清除。此操作不会删除你的原始 Excel / ZIP 文件。',confirmText:'确认清空',action:()=>resetState()});
}

els.chooseButton.addEventListener('click',e=>{e.stopPropagation();if(!busy)els.fileInput.click()});
els.dropzone.addEventListener('click',()=>{if(!busy)els.fileInput.click()});
els.fileInput.addEventListener('change',e=>startImport(e.target.files));
els.dropzone.addEventListener('dragover',e=>{e.preventDefault();if(!busy)els.dropzone.classList.add('dragging')});
els.dropzone.addEventListener('dragleave',()=>els.dropzone.classList.remove('dragging'));
els.dropzone.addEventListener('drop',e=>{e.preventDefault();els.dropzone.classList.remove('dragging');startImport(e.dataTransfer.files)});
els.dismissError.addEventListener('click',hideError); els.searchInput.addEventListener('input',renderOrders); els.countrySelect.addEventListener('change',renderOrders); els.categorySelect.addEventListener('change',renderOrders);
[els.exportButton,els.topExportButton,els.quickExportButton,els.heroExportButton].forEach(btn=>btn?.addEventListener('click',exportAccounting));
[els.heroImportButton,els.inlineImportButton,els.navImportButton].forEach(btn=>btn?.addEventListener('click',reimportFlow));
els.reimportButton.addEventListener('click',reimportFlow); els.sidebarResetButton.addEventListener('click',reimportFlow); els.clearButton.addEventListener('click',clearFlow);
document.addEventListener('keydown',e=>{const m=document.getElementById('confirmModal');if(e.key==='Escape'&&m&&!m.hidden)closeConfirm()});
document.getElementById('sideNav').addEventListener('click',e=>{const btn=e.target.closest('[data-view]');if(!btn)return;const view=btn.dataset.view;if(view==='history'){els.importLanding.hidden=true;els.appViews.hidden=false;setView('history');return}if(classified){setView(view);return}if(view==='dashboard'){els.appViews.hidden=true;els.importLanding.hidden=false;document.querySelectorAll('.nav-item[data-view]').forEach(item=>item.classList.toggle('active',item.dataset.view==='dashboard'))}});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-go-view]');if(btn&&classified)setView(btn.dataset.goView)});
document.addEventListener('click',e=>{const btn=e.target.closest('.review-save');if(btn){const editor=btn.closest('.review-editor');if(editor)saveReviewRow(editor)}});


// v7.0.11 theme controller: auto / light / dark
const themeButton=document.getElementById('themeToggleButton');
const themeLabel=document.getElementById('themeLabel');
const themeMedia=window.matchMedia('(prefers-color-scheme: dark)');
function getThemePreference(){
  const value=localStorage.getItem('write-theme')||'auto';
  return /^(auto|light|dark)$/.test(value)?value:'auto';
}
function resolvedTheme(pref){return pref==='auto'?(themeMedia.matches?'dark':'light'):pref}
function applyTheme(pref,{persist=true}={}){
  const safe=/^(auto|light|dark)$/.test(pref)?pref:'auto';
  if(persist)localStorage.setItem('write-theme',safe);
  const resolved=resolvedTheme(safe);
  document.documentElement.dataset.theme=resolved;
  document.documentElement.dataset.themePreference=safe;
  document.documentElement.style.colorScheme=resolved;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',resolved==='dark'?'#1c1c1f':'#ffffff');
  if(themeButton){
    themeButton.dataset.themePref=safe;
    themeButton.setAttribute('aria-label',`当前主题：${safe==='auto'?'自动':safe==='light'?'浅色':'深色'}；点击切换`);
    themeButton.title=`主题：${safe==='auto'?'自动跟随系统':safe==='light'?'浅色':'深色'}（点击切换）`;
  }
  if(themeLabel)themeLabel.textContent=`主题：${safe==='auto'?'自动':safe==='light'?'浅色':'深色'}`;
}
function cycleTheme(){
  const current=getThemePreference();
  const next=current==='auto'?'light':current==='light'?'dark':'auto';
  applyTheme(next);
}
themeButton?.addEventListener('click',cycleTheme);
const onSystemThemeChange=()=>{if(getThemePreference()==='auto')applyTheme('auto',{persist:false})};
if(themeMedia.addEventListener)themeMedia.addEventListener('change',onSystemThemeChange);else themeMedia.addListener(onSystemThemeChange);
applyTheme(getThemePreference(),{persist:false});

resetState();


// v7.0.11 — built-in version history (mirrors GitHub CHANGELOG)
const WRITE_HISTORY = [
  {version:'6.5.8',time:'2026-08-09 00:14',title:'发票数值类型与订单范围',items:['修复 FACT / Commercial Invoice 中部分小数被保存为文本导致 Excel 计算失败的问题。','COGs、Shipping 等运算字段回填为真正数值，显示继续采用法国/欧洲小数逗号。','导出 ZIP、会计报表与回填 FACT 文件名自动包含订单号范围。']},
  {version:'6.5.7',time:'2026-08-09 00:10',title:'历史更新中心',items:['左侧菜单新增「历史更新」，无需导入订单即可查看。','按时间倒序展示所有可追溯正式版本的更新时间与更新摘要。','从本版本开始，发布时间固定精确记录到分钟，并与 GitHub CHANGELOG 同步。']},
  {version:'6.5.6',time:'2026-08-09 00:05',title:'欧洲数字格式统一',items:['所有用户可见小数统一使用逗号作为小数分隔符。','WebApp、会计 Excel 与金额/百分比显示统一采用法国/欧洲数字格式。']},
  {version:'6.5.5',time:'2026-08-08 23:32',title:'FACT 原格式回填',items:['无论 FACT 原有统计是否为空，导出前均清空旧统计并按 WebApp 当前分析重新计算。','只修改 FACT 统计值，保留原工作表样式、列宽、行高、边框、合并单元格和工作簿其他内容。','导出升级为专业会计报表 + 已回填 FACT 的结算交付包。']},
  {version:'6.5.4',time:'2026-08-08 · 时间未记录',title:'版本发布机制',items:['每个新版本首次打开自动显示更新日志；阅读后同浏览器不重复弹出。','新增 CHANGELOG.md，并要求 README、版本号与部署脚本同步更新。']},
  {version:'6.5.2',time:'2026-08-08 22:37',title:'三态主题',items:['新增自动 / 浅色 / 深色三态主题切换。','自动模式实时跟随 macOS、iPadOS、iOS 系统主题；手动选择写入本地记忆。']},
  {version:'6.5.1',time:'2026-08-08 21:45',title:'品牌与文案修正',items:['左上角使用选定的 Version C 简笔熊猫头像。','顶部品牌署名改为 Designed by NEOVORA，并精简英雄页说明。']},
  {version:'6.5',time:'2026-08-08 21:32',title:'英雄页重构',items:['英雄页移除熊猫照片/熊猫头，改为黑白灰会计报表抽象视觉。','继续沿用克制的灰阶工作台设计语言。']},
  {version:'6.1',time:'2026-08-08 21:20',title:'灰阶工作台视觉',items:['界面重构为严格黑 / 白 / 灰视觉体系。','导航、卡片、按钮、徽标和弹窗移除彩色强调色。']},
  {version:'6.0',time:'2026-08-08 · 时间未记录',title:'全设备响应式',items:['适配桌面、iPad 横竖屏与 iPhone Safari。','修复 KPI、金额、文件名、商品名及表格文本溢出，移动端表格支持触控横向滚动。']},
  {version:'5.3.3',time:'2026-08-08 · 时间未记录',title:'专业会计工作簿',items:['导出结构改为一个 Sheet 只承担一个用途。','统一居中、列宽、冻结表头、筛选与金额格式，减少文字遮挡。']},
  {version:'5.3.2',time:'2026-08-08 · 时间未记录',title:'前端启动稳定化',items:['移除脆弱的 ES Module 启动依赖，主程序与 Worker 改为稳定 bundle。']},
  {version:'5.3.1',time:'2026-08-08 · 时间未记录',title:'全按钮失效 Hotfix',items:['修复 JavaScript 解析错误导致整个 UI 事件层未启动的问题。']},
  {version:'5.3.0',time:'2026-08-08 · 时间未记录',title:'待复核可编辑',items:['待复核订单可直接修改商品名、SKU 和分类并保存后重新统计。','重写清空数据确认流程，并重构结算摘要。']},
  {version:'5.2.2',time:'2026-08-08 · 时间未记录',title:'页面层重建',items:['恢复正确英雄页结构，修复弹窗锁死、熊猫资源丢失和旧 UI 混用问题。','引入资源版本指纹与更可靠的页面启动机制。']},
  {version:'5.2.1',time:'2026-08-08 · 时间未记录',title:'弹窗 Hotfix',items:['修复 CSS 覆盖 hidden 状态导致清空确认弹窗始终显示的问题。']},
  {version:'5.2',time:'2026-08-08 · 时间未记录',title:'FACT 风格分类汇总',items:['新增 Quantity、COGs、Shipping、COGs + Shipping、Amount 的 FACT 风格汇总。','增加国家级 FACT 明细结构。']},
  {version:'5.1',time:'2026-08-08 · 时间未记录',title:'FACT 解析修复',items:['修复带样式空单元格导致的 FACT 列错位。','在不把 FACT 当订单的前提下可靠读取成本结构。']},
  {version:'5.0',time:'2026-08-08 · 时间未记录',title:'首次正式英雄页',items:['加入明显的英雄页导出操作，并进行首次大规模 UI 重构。','会计导出拆分为摘要、明细、复核、审计和导入日志层。']},
  {version:'4.1',time:'2026-08-08 · 时间未记录',title:'首个可追溯正式版本',items:['建立真实 WRITE 订单工作簿的稳定本地浏览器导入流程。','加入 GitHub 发布与 Cloudflare Pages 部署脚本。']}
];
function renderReleaseHistory(){
  const host=document.getElementById('releaseHistory');
  if(!host)return;
  document.getElementById('historyCount').textContent=`${WRITE_HISTORY.length} 个版本`;
  host.innerHTML=WRITE_HISTORY.map((entry,index)=>`<article class="history-item ${index===0?'current':''}"><div class="history-meta"><span class="history-version">v${escapeHtml(entry.version)}</span><time class="history-time">${escapeHtml(entry.time)}</time></div><div class="history-body"><h3>${escapeHtml(entry.title)}</h3><ul>${entry.items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></div></article>`).join('');
}
renderReleaseHistory();
