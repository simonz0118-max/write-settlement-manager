const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');const c={window:null};c.window=c;vm.createContext(c);vm.runInContext(src,c);const H=c.WRITE_HUMAN_WORKFLOW_V84;
const a=H.fulfillmentRecordKey({orderId:'O1',trackingNumber:'T1'},0);
const b=H.fulfillmentRecordKey({orderId:'O1',trackingNumber:'T2'},1);
const c1=H.fulfillmentRecordKey({orderId:'O1',sourceSheet:'S',sourceRow:8},2);
assert.notEqual(a,b);assert.notEqual(a,c1);assert.notEqual(b,c1);
console.log('V8.4 fulfillment identity PASS: order-id-only dedupe forbidden');