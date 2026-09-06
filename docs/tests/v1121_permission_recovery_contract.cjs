const fs=require('fs');
const s=fs.readFileSync('src/v10/v1120-folder-status-center.js','utf8');
for(const x of ["interactive:true","permission-recovery-confirm","requestScan?.('permission-recovery-confirm')","button.disabled=true","button.disabled=false"])if(!s.includes(x))throw Error('missing '+x);
const o=fs.readFileSync('src/v10/v1120-folder-auto-orchestrator.js','utf8');
if(!o.includes("scanStoredFolder({interactive:false,silent:true,reason})"))throw Error('background scan can prompt');
console.log('V11.2.1 PERMISSION RECOVERY CONTRACT PASS');
