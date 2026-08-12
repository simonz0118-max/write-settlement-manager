const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');
const ctx={console,window:null};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const T=ctx.WRITE_HISTORICAL_TRAINING_V81;
assert.equal(T.canTrain({status:'COMPLETE',coverage:1,factRows:[1]}).ok,true);
assert.equal(T.canTrain({status:'PARTIAL',coverage:1,factRows:[1]}).ok,false);
assert.equal(T.canTrain({status:'COMPLETE',coverage:.99,factRows:[1]}).ok,false);
assert.equal(T.canTrain({status:'REFERENCE_ONLY',factRows:[1]}).ok,false);
const p=T.trainingPlan([
 {id:'a',status:'COMPLETE',coverage:1,factRows:[1],contentHash:'x'},
 {id:'b',status:'COMPLETE',coverage:1,factRows:[1],contentHash:'x'},
 {id:'c',status:'PARTIAL',factRows:[1],contentHash:'y'}
]);
assert.equal(p.accepted.length,1);assert.equal(p.duplicates.length,1);assert.equal(p.excluded.length,1);
console.log('V8.1 training safety gate PASS');