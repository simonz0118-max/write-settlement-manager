const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');const c={window:null};c.window=c;vm.createContext(c);vm.runInContext(src,c);const G=c.WRITE_EVIDENCE_GATE_V84;
let x=G.classify({sourceMatched:true,sourceQuantity:10,factQuantity:10,configurationClosed:true});assert.equal(x.status,'EXACT_CLOSED');assert(x.trainable);
x=G.classify({sourceMatched:false,factQuantity:10});assert.equal(x.status,'FACT_ONLY_MANUAL');assert(!x.trainable);
x=G.classify({sourceMatched:true,sourceQuantity:8,factQuantity:10,configurationClosed:true});assert.equal(x.status,'PARTIAL_UNEXPLAINED');assert(!x.trainable);
x=G.classify({sourceMatched:true,sourceQuantity:22,factQuantity:21,configurationClosed:true,explanation:{verified:true,explainsFullDifference:true,code:'VERIFIED_NOT_YET_FULFILLED_EXCLUSION'}});assert.equal(x.status,'EXPLAINED_CLOSED');assert(x.trainable);
x=G.classify({sourceMatched:false,templateOnly:true});assert(!x.trainable);
console.log('V8.4 evidence-first training gate PASS');