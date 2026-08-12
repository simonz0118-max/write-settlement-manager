const fs=require('fs'),vm=require('vm'),assert=require('assert');const s=fs.readFileSync(process.argv[2],'utf8'),r=fs.readFileSync(process.argv[3],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(s,c);vm.runInContext(r,c);const S=c.WRITE_BATCH_SCORER_V86,R=c.WRITE_TRAINING_ROUTER_V86;
const score=S.scoreBatch({batchId:'P',sourceBacked:true,sourceCoverage:1,traceability:1,priceConsistency:1,observations:9});
const out=R.route(score,{examples:[{domain:'price',id:1},{domain:'classification',id:2},{domain:'quantity',id:3}]});
assert.equal(out.price.length,1);assert.equal(out.classification.length,0);assert.equal(out.quantity.length,0);assert.equal(out.reference.length,2);
console.log('V8.6 domain-specific training router PASS');