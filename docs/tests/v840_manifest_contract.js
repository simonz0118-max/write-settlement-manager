const fs=require('fs'),assert=require('assert');const m=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert.deepEqual(m.learnedSources,['YD_CAMOUFLAGE','ARCHIVE_MULTI_FAMILY','PENCIL_WRITE_STORE','SOAP_HISTORY']);
assert.equal(m.formalFactTakeover,false);
assert.equal(m.trainingGate.PARTIAL_UNEXPLAINED,'ignore for learning');
assert.equal(m.trainingGate.FACT_ONLY_MANUAL,'ignore for learning');
console.log('V8.4 unified-learning manifest PASS');