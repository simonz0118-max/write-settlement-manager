const fs=require('fs'),assert=require('assert');
const doc=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert.equal(doc.version,'8.1.0');assert(doc.rules.length>=5);
for(const r of doc.rules){
 assert(r.humanConfirmed===true);
 assert(['VERIFIED_MANUAL_FACT','VERIFIED_HISTORICAL_RULE'].includes(r.sourceType));
 assert(Number(r.confidence)>=.9);
}
console.log('V8.1 verified seed safety PASS');