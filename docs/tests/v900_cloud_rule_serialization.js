const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const semantic = fs.readFileSync(process.argv[2], 'utf8');
const store = fs.readFileSync(process.argv[3], 'utf8');
const context = { window: null };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(semantic, context);
vm.runInContext(store, context);

const local = {
  id: 'v9:test',
  sourceType: 'HUMAN_CORRECTION',
  scope: 'EXACT_PRODUCT',
  confidence: 1,
  humanConfirmed: true,
  updatedAt: Date.now(),
  pattern: { product: 'Mystery', sku: 'NEW-999*3', family: 'NEW:Mystery', country: 'FRANCE', origin: 'FR' },
  action: { description: 'Mystery XXL', role: 'PACKAGE_COMPONENT', configuration: 'Mystery XXL *3' },
};
const cloud = context.WRITE_RULE_STORE_V8.toCloud(local);

assert.equal(cloud.ruleId, local.id);
assert.equal(cloud.lookupKey, local.id);
assert.equal(cloud.type, 'SEMANTIC_V8');
assert.equal(cloud.confirmed, true);
assert.equal(cloud.payload.pattern.origin, 'FR');
assert.equal(cloud.payload.action.description, 'Mystery XXL');
assert.deepEqual(context.WRITE_RULE_STORE_V8.fromCloud(cloud), cloud.payload);

console.log('V9 cloud learning serialization PASS');
