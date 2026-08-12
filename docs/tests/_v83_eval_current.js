const fs=require('fs'),vm=require('vm');
const core=fs.readFileSync(process.argv[2],'utf8'),g=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const c={console,window:null,globalThis:null};c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(core,c);
const q=s=>{const m=String(s||'').match(/\*(\d+(?:\.\d+)?)\s*$/);return m?Number(m[1]):1};
const O=g.orders.map(o=>{const n=String(o.productNames||'').split(/\n/),s=String(o.skuLines||'').split(/\n/),L=Math.max(n.length,s.length),lineItems=[];while(n.length<L)n.push('');while(s.length<L)s.push('');for(let i=0;i<L;i++)if(String(n[i]||'').trim())lineItems.push({productName:n[i],sku:s[i],quantity:q(s[i])});return{recordKey:o.orderKey,country:o.country,lineItems}});
const S=O.map(o=>c.WRITE_SEMANTIC_V8.semanticizeOrder(o,[]));
const R=c.WRITE_SEMANTIC_V8.aggregateSemanticOrders(S);
process.stdout.write(JSON.stringify({rows:R,semantic:S}));
