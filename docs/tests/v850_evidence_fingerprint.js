const fs=require('fs'),vm=require('vm'),assert=require('assert');const src=fs.readFileSync(process.argv[2],'utf8'),inv=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(src,c);
const d=c.WRITE_EVIDENCE_FINGERPRINT_V85.dedupe(inv.files);
assert.equal(d.input,60);assert.equal(d.unique,55);assert.equal(d.duplicates,5);
const yd=inv.files.filter(x=>x.group==='YD'),ar=inv.files.filter(x=>x.group==='ARCHIVE');
assert.equal(new Set(yd.map(x=>x.sha256)).size,5);assert.equal(new Set(ar.map(x=>x.sha256)).size,5);
for(const y of yd)assert(ar.some(a=>a.sha256===y.sha256),'YD/Archive copies must be byte-identical');
console.log('V8.5 evidence fingerprint PASS: 60 copies -> 55 unique, YD/Archive duplicate evidence counts once');