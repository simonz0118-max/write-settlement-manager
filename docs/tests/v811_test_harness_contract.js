const fs=require('fs'),assert=require('assert');
const deploy=fs.readFileSync(process.argv[2],'utf8');
const test=fs.readFileSync(process.argv[3],'utf8');
assert(/process\.argv\[4\]/.test(test),'nonblocking test requires production runtime argv[4]');
const line=deploy.split(/\n/).find(x=>x.includes('v800_nonblocking_contract.js')&&x.includes('生产非阻断'))||'';
assert(line.includes('src/v8/shadow-runtime.js'));
assert(line.includes('index.html'));
assert(line.includes('src/universal-source-v759.js'),'deploy must pass production runtime as third test argument');
console.log('V8.1.1 deploy test-harness argument contract PASS');
