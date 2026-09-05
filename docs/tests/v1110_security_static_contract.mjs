import fs from 'node:fs';
const sync=fs.readFileSync('functions/api/rules/sync.js','utf8');
const cat=fs.readFileSync('functions/api/rules/catalog.js','utf8');
const auth=fs.readFileSync('functions/_shared/rules-auth.js','utf8');
const checks=[
 sync.includes('requireAdmin(request,env)'),sync.includes("source:deleted?'AUTHENTICATED_DELETE'"),sync.includes("priority:reviewed?600:300"),
 sync.includes('updatedAt:now'),sync.includes('write_rules_audit_v1110'),sync.includes('rules.length>500'),
 cat.includes('requireAdmin(request,env)'),!cat.includes("'access-control-allow-origin':'*'"),
 auth.includes('HttpOnly'),auth.includes('SameSite=Strict'),auth.includes('sameOrigin(request)')
];
if(checks.some(x=>!x)){console.error(checks);process.exit(1)}
console.log('V11.1.0 SECURITY STATIC CONTRACT PASS');
