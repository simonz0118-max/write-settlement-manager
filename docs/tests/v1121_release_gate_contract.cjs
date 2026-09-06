const fs=require('fs');
const i=fs.readFileSync('index.html','utf8');
const s=fs.readFileSync('docs/tests/v1120_folder_static_contract.cjs','utf8');
if(!i.includes('data-release="11.2.1"'))throw Error('release html is not 11.2.1');
if(!s.includes(`release:i.includes('data-release="11.2.1"')`))throw Error('static contract stale release');
if(s.includes(`release:i.includes('data-release="11.2.0"')`))throw Error('11.2.0 stale release assertion remains');
console.log('V11.2.1 RELEASE GATE CONTRACT PASS');
