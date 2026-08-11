const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const human = fs.readFileSync(process.argv[2], 'utf8');
const engine = fs.readFileSync(process.argv[3], 'utf8');
const observations = [];
const context = { window: null, console };
context.window = context;
context.globalThis = context;
context.WRITE_V9_LEARNING = {
  getCorrection: () => null,
  observeMany: async items => observations.push(...items),
};
context.WRITE_V8_SOURCE_BRIDGE = () => ({
  orders: [
    { orderId: 'A', trackingNumber: 'CN-1', fulfillmentOrigin: 'CN', sourceFile: 'orders.xlsx', country: 'FRANCE', lineItems: [{ productName: 'Savon', sku: 'S*2', quantity: 2 }] },
    { orderId: 'A', trackingNumber: 'CN-2', fulfillmentOrigin: 'CN', sourceFile: 'orders.xlsx', country: 'FRANCE', lineItems: [{ productName: 'Savon', sku: 'S*2', quantity: 2 }] },
    { orderId: 'B', trackingNumber: 'FR-1', fulfillmentOrigin: 'FR', sourceFile: 'orders.xlsx', country: 'FRANCE', lineItems: [{ productName: 'Savon', sku: 'S*2', quantity: 2 }] },
  ],
  sourceWorkbooks: [{ name: 'orders.xlsx' }],
});
context.v759LearnedManualRowsForWorkbook = () => ({
  rows: [{ origin: 'CN', country: 'FRANCE', description: 'Savon *2', cogs: 2, shipping: 5, unitTotal: 7 }],
});

vm.createContext(context);
vm.runInContext(human, context);
vm.runInContext(engine, context);
const result = context.WRITE_V9_FACT_ENGINE.buildWorkbookRows('orders.xlsx');
const cn = result.rows.find(row => row.origin === 'CN');
const fr = result.rows.find(row => row.origin === 'FR');

assert.equal(result.audit.sourceOrders, 3);
assert.equal(result.audit.sourceItems, 3);
assert.equal(result.audit.trackedItems, 3);
assert.equal(result.audit.lostItems.length, 0);
assert.equal(cn.quantity, 2, 'two tracking records with one order ID must both count');
assert.equal(new Set(cn.sourceOrderKeys).size, 2, 'tracking records must retain distinct trace keys');
assert.equal(new Set(cn.sourceItemKeys).size, 2, 'source items must retain distinct trace keys');
assert.equal(cn.unitTotal, 7, 'exact origin+country+configuration price should match');
assert.equal(fr.unitTotal, null, 'price from another fulfillment origin must not leak');

setImmediate(() => {
  assert.equal(new Set(observations.map(item => item.orderKey)).size, 3);
  console.log('V9 fulfillment identity and origin-safe price PASS');
});
