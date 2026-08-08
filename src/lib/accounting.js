const norm = (v='') => String(v ?? '').trim();
const low = (v='') => norm(v).toLowerCase();

export const LINE_CATEGORIES = [
  ['PENCIL','铅笔','Le Crayon Intemporel / 铅笔本体'],
  ['ENGRAVING','雕刻服务','Gravure Personnalisée / 雕刻'],
  ['REFILL','普通笔芯','可替换普通笔芯'],
  ['COLOR_REFILL','彩色笔芯','彩色笔芯 / Mines colorées'],
  ['GIFT_BOX','礼盒','Coffret Cadeau / 礼盒'],
  ['GIFT_CARD','礼品卡','Carte-cadeau'],
  ['B2B','B2B / 专业订单','Commande Professionnelle'],
  ['OTHER','待确认','未命中已知规则'],
].map(([code,label,description])=>({code,label,description}));

const LABEL = Object.fromEntries(LINE_CATEGORIES.map(x=>[x.code,x.label]));

function quantityFromSku(sku='') {
  const m = norm(sku).match(/\*(\d+(?:\.\d+)?)\s*$/);
  return m ? Number(m[1]) : 1;
}

export function classifyLine(productName='', sku='') {
  const name = norm(productName), n = low(name), s = low(sku);
  const isFree = /^🎁/.test(name) || /100%\s*off|gratuit|cadeau offert/.test(n);
  let category = 'OTHER';
  if (/commande professionnelle|professional order|cmd pro/.test(n)) category = 'B2B';
  else if (/carte[- ]cadeau|gift\s*card/.test(n)) category = 'GIFT_CARD';
  else if (/gravure|雕刻/.test(n) || /(^|\D)50505594077448/.test(s) || /雕刻/.test(s)) category = 'ENGRAVING';
  else if (/coffret cadeau|礼盒|盒子/.test(n) || /(^|\D)52838739738888/.test(s) || /盒子/.test(s)) category = 'GIFT_BOX';
  else if (/mines? color[ée]es?|彩色.*笔芯|pack.*mines/.test(n) || /qb-csbt/.test(s) || /(^|\D)(49624586256648|52725633384712)(\D|$)/.test(s) || /qb-6/.test(s)) category = 'COLOR_REFILL';
  else if (/mines? rechargeables?|\b4\s*mines\b|笔芯/.test(n) || /qb-4/.test(s) || /(^|\D)(45407586615560|45157341331720)(\D|$)/.test(s)) category = 'REFILL';
  else if (/le crayon intemporel|铅笔|crayon/.test(n) || /qb-(obsidienne|aluminium|carmin|nuit|jade|saturne)/.test(s) || /(^|\D)(45242109231368|45242109329672)(\D|$)/.test(s) || /铅笔/.test(s)) category = 'PENCIL';
  return { category, categoryLabel: LABEL[category], isFree, quantity: quantityFromSku(sku) };
}

export function parseLineItems(order) {
  const names = norm(order.productNames).split(/\n+/).map(x=>x.trim());
  const skus = norm(order.skuLines).split(/\n+/).map(x=>x.trim());
  const count = Math.max(names.filter(Boolean).length ? names.length : 0, skus.filter(Boolean).length ? skus.length : 0, 1);
  const items=[];
  for(let i=0;i<count;i++) {
    const productName=names[i]||''; const sku=skus[i]||'';
    if(!productName && !sku && count>1) continue;
    items.push({ ...classifyLine(productName,sku), productName, sku, lineNo:i+1 });
  }
  return items;
}

export function classifyOrder(order) {
  const items=parseLineItems(order);
  const paidItems=items.filter(x=>!x.isFree);
  const categories=new Set(items.map(x=>x.category));
  const paidCategories=new Set(paidItems.map(x=>x.category));
  const amount=Number(order.orderAmount)||0;
  let code='OTHER'; let label='待确认';
  if ([...categories].includes('B2B')) [code,label]=['B2B','B2B / 专业订单'];
  else if ([...categories].includes('GIFT_CARD')) [code,label]=['GIFT_CARD','礼品卡订单'];
  else if (amount===0 && (paidItems.length===0 || items.every(x=>x.isFree || x.category==='OTHER'))) [code,label]=['ZERO_FREE','赠品 / 0€订单'];
  else if (paidCategories.has('PENCIL')) [code,label]=['PENCIL_ORDER','铅笔订单'];
  else if (paidCategories.has('REFILL') || paidCategories.has('COLOR_REFILL')) [code,label]=['REFILL_ORDER','笔芯订单'];
  else if (paidCategories.has('GIFT_BOX')) [code,label]=['ACCESSORY_ORDER','礼盒 / 配件订单'];
  else if (paidCategories.has('ENGRAVING')) [code,label]=['SERVICE_ORDER','雕刻服务订单'];
  else if (amount===0) [code,label]=['ZERO_OTHER','0€待确认订单'];
  const unknownItems=items.filter(x=>x.category==='OTHER');
  return {...order, accountingCode:code, accountingCategory:label, lineItems:items, unknownItemCount:unknownItems.length,
    hasGift:items.some(x=>x.isFree), classificationStatus:unknownItems.length?'需复核':'已分类'};
}

export function classifyOrders(orders=[]) {
  const classified=orders.map(classifyOrder);
  const lineItems=[];
  for(const o of classified) for(const item of o.lineItems) lineItems.push({...item, orderId:o.orderId, orderAmount:o.orderAmount, country:o.country, sourceFile:o.sourceFile, sourceSheet:o.sourceSheet});
  const orderMap=new Map();
  for(const o of classified){
    const k=o.accountingCategory; const r=orderMap.get(k)||{category:k,orders:0,amount:0,review:0}; r.orders++; r.amount+=Number(o.orderAmount)||0; if(o.classificationStatus==='需复核')r.review++; orderMap.set(k,r);
  }
  const lineMap=new Map();
  for(const item of lineItems){
    const k=item.categoryLabel; const r=lineMap.get(k)||{category:k,lines:0,quantity:0,freeQuantity:0,orders:new Set(),touchedAmountOrders:new Map()};
    r.lines++; r.quantity+=Number(item.quantity)||1; if(item.isFree)r.freeQuantity+=Number(item.quantity)||1; r.orders.add(item.orderId); r.touchedAmountOrders.set(item.orderId,Number(item.orderAmount)||0); lineMap.set(k,r);
  }
  const orderSummary=[...orderMap.values()].sort((a,b)=>b.amount-a.amount);
  const lineSummary=[...lineMap.values()].map(r=>({category:r.category,lines:r.lines,quantity:r.quantity,freeQuantity:r.freeQuantity,orders:r.orders.size,touchedAmount:[...r.touchedAmountOrders.values()].reduce((a,b)=>a+b,0)})).sort((a,b)=>b.quantity-a.quantity);
  const unknown=lineItems.filter(x=>x.category==='OTHER');
  return {orders:classified,lineItems,orderSummary,lineSummary,unknown};
}
