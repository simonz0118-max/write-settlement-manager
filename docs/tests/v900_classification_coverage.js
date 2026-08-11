const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync(process.argv[2], 'utf8');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);
const workflow = context.WRITE_HUMAN_WORKFLOW_V84;

const record = workflow.buildRecord({
  orderId: 'COVERAGE',
  country: 'FRANCE',
  lineItems: [
    { productName: 'YD 伪装网 3x4', quantity: 1 },
    { productName: 'YD Kit', quantity: 2 },
    { productName: 'Colliers de serrage x100', quantity: 3 },
    { productName: 'Cordes à cliquets', quantity: 4 },
    { productName: 'Stylo éternel', quantity: 1 },
    { productName: 'Mines', quantity: 6 },
    { productName: 'Soap gift pouch', quantity: 1 },
  ],
});
const byFamily = new Map(record.items.map(item => [item.family, item]));

assert.equal(byFamily.get('CAMOUFLAGE_NET').componentRole, 'PACKAGE_COMPONENT');
assert.equal(byFamily.get('FIXATION_KIT').componentRole, 'SEPARATE_UPSELL');
assert.equal(byFamily.get('CABLE_TIE').componentRole, 'SEPARATE_UPSELL');
assert.equal(byFamily.get('RATCHET_CORD').componentRole, 'SEPARATE_UPSELL');
assert.equal(byFamily.get('PENCIL_REFILL').componentRole, 'SEPARATE_UPSELL');
assert.equal(byFamily.get('SOAP_GIFT_POUCH').componentRole, 'FREE_GIFT');

console.log('V9 required classification coverage PASS');
