const fs=require('fs'),assert=require('assert');
const adapter=fs.readFileSync('src/v10/production-adapter.js','utf8');const safe=fs.readFileSync('src/v10/v1033-safe-export.js','utf8');const index=fs.readFileSync('index.html','utf8');const history=JSON.parse(fs.readFileSync('assets/release-history.json','utf8'));
assert(adapter.includes("'WRITE-CN'"));assert(adapter.includes('o.storeAccount'));assert(adapter.includes("o.sourceRawFields?.['店铺账号']"));assert(adapter.includes("raw==='UNKNOWN'"));
assert(safe.includes("const MODULE_VERSION='10.3.3'"));assert(!safe.includes('document.body.dataset.release='));assert(!safe.includes('stamp()'));
assert(index.includes('data-release="10.5.3"'));assert(index.includes('v10.5.3 Production'));assert.strictEqual(history.current?.version,'10.5.3');assert.strictEqual(history.currentVersion,'10.5.3');
console.log('V10.5.3 export parity + release authority source contract PASS');
