const fs=require('fs'),vm=require('vm'),assert=require('assert');const s=fs.readFileSync(process.argv[2],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(s,c);const A=c.WRITE_CLOSURE_ANALYZER_V87;
let r=A.analyze([{origin:'CN',country:'FRANCE',configuration:'Savon *2',quantity:10,sourceOrderKeys:['A']}],[{origin:'CN',country:'FRANCE',description:'Savon *2',quantity:10}]);assert.equal(r.findings[0].state,'EXACT_CLOSED');
r=A.analyze([],[{origin:'CN',country:'FRANCE',description:'Manual fee',quantity:1}]);assert.equal(r.findings[0].state,'FACT_ONLY_MANUAL');
r=A.analyze([],[{origin:'CN',country:'FRANCE',description:'Savon *9',quantity:null}]);assert.equal(r.findings[0].state,'TEMPLATE_ONLY');
r=A.analyze([{origin:'CN',country:'FRANCE',configuration:'Savon *2',quantity:8}],[{origin:'CN',country:'FRANCE',description:'Savon *2',quantity:10}]);assert.equal(r.findings[0].state,'PARTIAL_UNEXPLAINED');
r=A.analyze([{origin:'CN',country:'FRANCE',configuration:'Savon *2',quantity:5}],[]);assert.equal(r.findings[0].state,'SOURCE_ONLY');
console.log('V8.7 closure state machine PASS');