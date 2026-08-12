const fs=require('fs'),vm=require('vm'),assert=require('assert');const a=fs.readFileSync(process.argv[2],'utf8'),e=fs.readFileSync(process.argv[3],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(a,c);vm.runInContext(e,c);const A=c.WRITE_CLOSURE_ANALYZER_V87,R=c.WRITE_EXPLANATION_RESOLVER_V87;
const registry=[{key:'CN\u0001FRANCE\u0001savon *2',sourceQuantity:22,factQuantity:21,verified:true,explainsFullDifference:true,code:'VERIFIED_NOT_YET_FULFILLED_EXCLUSION'}];
const resolver=R.resolverFromRegistry(registry);
const report=A.analyze([{origin:'CN',country:'FRANCE',configuration:'Savon *2',quantity:22}],[{origin:'CN',country:'FRANCE',description:'Savon *2',quantity:21}],{explanationResolver:resolver});
assert.equal(report.findings[0].state,'EXPLAINED_CLOSED');
const bad=A.analyze([{origin:'CN',country:'FRANCE',configuration:'Savon *2',quantity:8}],[{origin:'CN',country:'FRANCE',description:'Savon *2',quantity:10}],{explanationResolver:resolver});
assert.equal(bad.findings[0].state,'PARTIAL_UNEXPLAINED');
console.log('V8.7 verified explanation requires exact historical evidence PASS');