export const ORDER_HEADERS = [
  '订单号', '订单金额', '产品总数', '多品名', '产品名称', '收货人国家', '买家姓名', '运单号',
  '订单备注', '拣货备注', '客服备注', '地址1+地址2', '下单时间', '付款时间', '店铺账号', '发货时间',
];

export const HEADER_TO_KEY = {
  '订单号': 'orderId',
  '订单金额': 'orderAmount',
  '产品总数': 'productCount',
  '多品名': 'skuLines',
  '产品名称': 'productNames',
  '收货人国家': 'country',
  '买家姓名': 'buyerName',
  '运单号': 'trackingNo',
  '订单备注': 'orderNote',
  '拣货备注': 'pickingNote',
  '客服备注': 'customerServiceNote',
  '地址1+地址2': 'address',
  '下单时间': 'orderTime',
  '付款时间': 'paidTime',
  '店铺账号': 'storeAccount',
  '发货时间': 'shippedTime',
};

export const REQUIRED_HEADERS = ['订单号', '订单金额', '产品总数', '产品名称', '收货人国家'];

export function isFactSheet(name = '') {
  return String(name).trim().toUpperCase() === 'FACT';
}

export function scoreOrderHeader(row = []) {
  const normalized = new Set(row.map((v) => String(v ?? '').trim()).filter(Boolean));
  return ORDER_HEADERS.reduce((score, header) => score + (normalized.has(header) ? 1 : 0), 0);
}

export function isOrderHeader(row = []) {
  const normalized = new Set(row.map((v) => String(v ?? '').trim()).filter(Boolean));
  return REQUIRED_HEADERS.every((header) => normalized.has(header)) && scoreOrderHeader(row) >= 8;
}

export function normalizeNumber(value) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
