const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');
const ctx={console,window:null};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const T=ctx.WRITE_HISTORICAL_TRAINING_V81;
const cs=[
 {id:'a',ruleType:'ROLE',scope:'PRODUCT_FAMILY',pattern:{family:'X'},action:{role:'MAIN'},confidence:.8,sourceRef:'1'},
 {id:'b',ruleType:'ROLE',scope:'PRODUCT_FAMILY',pattern:{family:'X'},action:{role:'MAIN'},confidence:.9,sourceRef:'2'},
 {id:'c',ruleType:'ROLE',scope:'EXACT_SKU',pattern:{sku:'Y'},action:{role:'UPSELL'},confidence:.9,sourceRef:'3'}
];
let a=T.auditCandidates(cs);assert.equal(a.candidates.length,2);assert.equal(a.conflicts.length,0);
assert(a.candidates.find(x=>x.pattern.family==='X').evidenceCount===2);
const bad=cs.concat([{id:'d',ruleType:'ROLE',scope:'PRODUCT_FAMILY',pattern:{family:'X'},action:{role:'SERVICE'},confidence:.95,sourceRef:'4'}]);
a=T.auditCandidates(bad);assert.equal(a.conflicts.length,1);
const conflictCandidate=a.candidates.find(x=>x.pattern.family==='X'&&x.action.role==='MAIN');
assert.equal(T.promoteable(conflictCandidate,a.conflicts).ok,false);
console.log('V8.1 candidate merge/conflict PASS');