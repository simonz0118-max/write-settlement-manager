import fs from 'node:fs';
const s=fs.readFileSync('functions/api/rules/sync.js','utf8');
const req=["function safePrefix(v)","/^SECURITY-CANARY-","rule_id LIKE ?","LIMIT 1000","body.ruleIdPrefix","INVALID_RULE_ID_PREFIX","serverVersion:'11.1.1'"];
for(const x of req){if(!s.includes(x)){console.error('missing',x);process.exit(1)}}
console.log('V11.1.1 CANARY PREFIX CONTRACT PASS');
