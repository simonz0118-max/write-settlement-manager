import assert from 'node:assert/strict';
import {onRequestPost,onRequestGet} from '../../functions/api/rules/sync.js';
import {makeTicket,verifyTicket,adminCookie} from '../../functions/_shared/rules-auth.js';

const token='a'.repeat(64);
let r=await onRequestPost({request:new Request('https://x.test/api/rules/sync',{method:'POST',headers:{'content-type':'application/json'},body:'{"rules":[]}'}),env:{WRITE_RULES_ADMIN_TOKEN:token}});
assert.equal(r.status,401);
r=await onRequestPost({request:new Request('https://x.test/api/rules/sync',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{"rules":[]}'}),env:{WRITE_RULES_ADMIN_TOKEN:token}});
assert.equal(r.status,503); // authenticated, then DB binding gate
r=await onRequestPost({request:new Request('https://x.test/api/rules/sync',{method:'POST',headers:{authorization:'Bearer '+token,origin:'https://evil.test','content-type':'application/json'},body:'{"rules":[]}'}),env:{WRITE_RULES_ADMIN_TOKEN:token}});
assert.equal(r.status,401);
const exp=Math.floor(Date.now()/1000)+120,t=await makeTicket(token,exp,'abcdefgh12345678');
assert.equal(await verifyTicket(token,t),true);
assert.equal(await verifyTicket(token,t,exp+1),false);
assert.match(adminCookie(token),/HttpOnly/);assert.match(adminCookie(token),/Secure/);assert.match(adminCookie(token),/SameSite=Strict/);
const health=await onRequestGet({env:{}});assert.equal(health.status,200);
console.log('V11.1.0 SECURITY AUTH CONTRACT PASS');
