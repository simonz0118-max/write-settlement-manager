const fs=require('fs'),vm=require('vm'),assert=require('assert');const src=fs.readFileSync(process.argv[2],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(src,c);const G=c.WRITE_MULTI_DATASET_GATE_V85;
const good={};for(const id of G.REQUIRED)good[id]={pass:true};Object.assign(good,{zeroLoss:{pass:true},classification:{pass:true},trace:{pass:true},evidenceDedup:{pass:true}});
let r=G.evaluate(good);assert(r.crossDatasetRegression);assert(r.takeoverCandidate);assert.equal(r.formalFactTakeover,false);
const bad=JSON.parse(JSON.stringify(good));bad.SOAP_THIBAULT_HISTORY.pass=false;r=G.evaluate(bad);assert(!r.crossDatasetRegression);assert(!r.takeoverCandidate);
console.log('V8.5 multi-dataset gate PASS: one dataset failure blocks candidate, production remains OFF');