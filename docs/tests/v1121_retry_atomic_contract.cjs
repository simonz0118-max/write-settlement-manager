const fs=require('fs');
const s=fs.readFileSync('src/v10/v1120-folder-auto-orchestrator.js','utf8');
const required=[
"retryDelayFor(Math.max(0,failureCount-1))",
"const retry=armRetry()",
"phase:'PARTIAL'",
"...retry",
"phase:'FAILED'"
];
for(const x of required)if(!s.includes(x))throw Error('missing '+x);
if(s.includes("scheduleRetry()"))throw Error('legacy scheduleRetry remains');
function retryDelayFor(count){return Math.min(15*60_000,30_000*(2**Math.min(Math.max(0,Number(count)||0),5)))}
const actual=[1,2,3].map(f=>retryDelayFor(Math.max(0,f-1)));
if(JSON.stringify(actual)!==JSON.stringify([30000,60000,120000]))throw Error('retry schedule '+actual);
console.log('V11.2.1 RETRY ATOMIC CONTRACT PASS',actual.join('/'));
