const fs=require('fs'),vm=require('vm');
const {createIDBFactory}=require('./idb-lite-v11010.cjs');
const indexedDB=createIDBFactory();
function storage(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
const localStorage=storage();
function ctx(){
 const c={console,indexedDB,localStorage,TextDecoder,TextEncoder,Blob,Response,DecompressionStream,crypto:global.crypto,
   navigator:{onLine:false},fetch:async()=>{throw Error('offline')},
   CustomEvent:class{constructor(type,o={}){this.type=type;this.detail=o.detail}},
   document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],visibilityState:'visible',readyState:'complete',addEventListener:()=>{}},
   setTimeout:(fn)=>0,setInterval:()=>0,clearTimeout:()=>{},clearInterval:()=>{},queueMicrotask};
 c.window=c;c.globalThis=c;c.addEventListener=()=>{};c.dispatchEvent=()=>{};
 vm.createContext(c);return c
}
function load(c,p){vm.runInContext(fs.readFileSync(p,'utf8'),c,{filename:p})}
(async()=>{
 let c=ctx();load(c,'src/knowledge-base.js');load(c,'src/v10/unified-settlement-v101.js');load(c,'src/v10/review-learning-v101.js');
 await c.WRITE_KB.init();
 const b=fs.readFileSync('docs/fixtures/x07-reviewed-53-sanitized.xlsx');
 const blob=new Blob([b],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});blob.name='x07-reviewed-53-sanitized.xlsx';
 const first=await c.WRITE_V101_REVIEW_LEARNING.importReviewedWorkbook(blob,{skipSync:true});
 const expected={factRules:6,productRules:3,alreadyLearned:8,unmatched:0,newRules:9,componentEquations:6,componentCostRules:1};
 for(const[k,v]of Object.entries(expected))if(Number(first[k])!==v)throw Error(`first ${k}=${first[k]} expected ${v}`);
 const rules1=c.WRITE_KB.list(),facts1=rules1.filter(r=>r.type==='REVIEWED_FACT'),products1=rules1.filter(r=>r.type==='REVIEWED_PRODUCT'),conf1=rules1.filter(r=>r.type==='RULE_CONFLICT');
 if(facts1.length!==6)throw Error('reviewed facts '+facts1.length);
 if(products1.length!==3)throw Error('reviewed products '+products1.length);
 const skus=new Set(products1.map(r=>String(r.payload?.sku||'').toUpperCase()));
 for(const sku of['STYLO','GIFT-BOX','REFILL4'])if(!skus.has(sku))throw Error('missing reviewed product '+sku);
 const amount1=Math.round(facts1.reduce((s,r)=>s+Number(r.payload?.amount||0),0)*100)/100;
 if(amount1!==53)throw Error('amount1 '+amount1);
 const size1=rules1.length;
 const second=await c.WRITE_V101_REVIEW_LEARNING.importReviewedWorkbook(blob,{skipSync:true});
 const rules2=c.WRITE_KB.list();
 if(rules2.length!==size1)throw Error(`duplicate import grew KB ${size1}->${rules2.length}`);
 if(rules2.filter(r=>r.type==='RULE_CONFLICT').length!==conf1.length)throw Error('duplicate import created conflict');
 c=null;
 const c2=ctx();load(c2,'src/knowledge-base.js');await c2.WRITE_KB.init();
 const facts2=c2.WRITE_KB.list().filter(r=>r.type==='REVIEWED_FACT');
 const amount2=Math.round(facts2.reduce((s,r)=>s+Number(r.payload?.amount||0),0)*100)/100;
 const pending=[1,2,3,4,5,6].filter(n=>!c2.WRITE_KB.reviewedFact({invoiceEntity:'DEFAULT',origin:'CN',country:'FRANCE',currency:'EUR',taxRegime:'UNSPECIFIED',role:'PACKAGE',configurationFingerprint:'CFG-X07-'+n})).length;
 if(facts2.length!==6||amount2!==53||pending!==0)throw Error(JSON.stringify({facts:facts2.length,amount2,pending}));
 console.log('V11.0.10 KB DEDUPE/PERSISTENCE PASS',JSON.stringify({first,second:{factRules:second.factRules,productRules:second.productRules,alreadyLearned:second.alreadyLearned},rules:size1,amount:amount2,pending}));
})().catch(e=>{console.error(e);process.exit(1)});
