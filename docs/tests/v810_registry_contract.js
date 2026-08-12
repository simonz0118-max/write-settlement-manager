const fs=require('fs'),assert=require('assert');
const reg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert.equal(reg.version,'8.1.0');
assert(reg.policy.trainableStatuses.length===1&&reg.policy.trainableStatuses[0]==='COMPLETE');
assert(reg.documents.some(x=>x.id==='archive-ludovic-10404-v1'&&x.status==='PARTIAL'));
assert(reg.documents.some(x=>x.id==='pencil-10262'&&x.status==='PARTIAL'));
assert(reg.documents.some(x=>x.id==='pencil-10312-sample'&&x.status==='PARTIAL'));
assert(reg.documents.some(x=>x.id==='manual-10451-1001-1162'&&x.status==='COMPLETE'));
console.log('V8.1 historical registry contract PASS');