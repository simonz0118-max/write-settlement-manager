const fs=require('fs'),assert=require('assert');const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),i=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
assert.equal(r.datasets.length,4);assert.equal(r.formalFactTakeover,false);
const ids=r.datasets.map(x=>x.id);for(const x of ['THOMAS_CAMOUFLAGE_1001_1162','YD_ARCHIVE_MULTI_FAMILY','PENCIL_WRITE_STORE','SOAP_THIBAULT_HISTORY'])assert(ids.includes(x));
assert.equal(i.archives.YD.xlsxFiles,5);assert.equal(i.archives.ARCHIVE.xlsxFiles,5);assert.equal(i.archives.PENCIL.xlsxFiles,21);assert.equal(i.archives.SOAP.xlsxFiles,29);assert.equal(i.uniqueEvidenceWorkbooks,55);assert.equal(i.crossArchiveDuplicateGroups,5);
console.log('V8.5 real-source registry PASS: YD=5 archive=5 pencil=21 soap=29 uniqueEvidence=55');