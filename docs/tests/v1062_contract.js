const fs=require('fs');
const req=(p,s)=>{const x=fs.readFileSync(p,'utf8');if(!x.includes(s))throw Error(`${p} missing ${s}`)};
req('index.html','data-release="10.6.2"');req('index.html','v1062-workflow-ui-fix.css');req('index.html','v1062-workflow-ui-fix.js');
req('src/v10/v1062-workflow-ui-fix.js','downloadProductionPackage({mode:');req('src/v10/v1062-workflow-ui-fix.js','handleReviewedImportClick');req('src/v10/v1062-workflow-ui-fix.js','cloneClean');
req('src/v10/export-runtime.js','async function buildFactOnly');req('src/v10/unified-settlement-v101.js','async function addLearningSource');
req('src/v10/v1062-workflow-ui-fix.css','grid-template-columns:24px minmax(0,1fr) auto');req('CHANGELOG.md','## V10.6.2 — Workflow & UI Closure');
console.log('PASS V10.6.2 workflow/ui contract');
