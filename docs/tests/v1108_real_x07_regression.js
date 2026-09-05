const fs=require('fs'),vm=require('vm');
global.window=global;
global.CustomEvent=class CustomEvent{constructor(type,opts={}){this.type=type;this.detail=opts.detail}};
global.dispatchEvent=()=>{};
const facts=[],products=[];
global.WRITE_KB={init:async()=>{},sync:async()=>({}),
 learnReviewedFact:async spec=>{facts.push(spec);return{ruleId:'F'+facts.length}},
 learnReviewedProduct:async spec=>{products.push(spec);return{ruleId:'P'+products.length}}};
function load(p){vm.runInThisContext(fs.readFileSync(p,'utf8'),{filename:p})}
load('src/v10/unified-settlement-v101.js');load('src/v10/review-learning-v101.js');
(async()=>{
 const b=fs.readFileSync('docs/fixtures/x07-reviewed-53-sanitized.xlsx');
 const blob=new Blob([b],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});blob.name='x07-reviewed-53-sanitized.xlsx';
 const r=await WRITE_V101_REVIEW_LEARNING.importReviewedWorkbook(blob,{skipSync:true});
 const amount=Math.round(facts.reduce((s,x)=>s+Number(x.amount||0),0)*100)/100;
 const learned=new Map(facts.map(x=>[x.configurationFingerprint,x]));
 const seed=[1,2,3,4,5,6].map(n=>'CFG-X07-'+n);
 const pending=seed.filter(k=>!learned.has(k)).length;
 const replay=Math.round(seed.reduce((s,k)=>s+Number(learned.get(k)?.amount||0),0)*100)/100;
 const ok=r.mode==='NEW_CN'&&r.factRows===6&&r.cnGroups===6&&r.unmatched===0&&r.factRules===6&&r.productRules===11&&facts.length===6&&products.length===11&&amount===53&&pending===0&&replay===53;
 if(!ok){console.error('REAL X07 FAIL',{r,amount,pending,replay,facts:facts.length,products:products.length});process.exit(1)}
 console.log('REAL X07 PASS',JSON.stringify({factRows:r.factRows,groups:r.cnGroups,unmatched:r.unmatched,factRules:r.factRules,productRules:r.productRules,amount,pending,replay}));
})().catch(e=>{console.error(e);process.exit(1)});
