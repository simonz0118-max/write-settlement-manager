const fs=require('fs'),vm=require('vm');
const {createIDBFactory}=require('./idb-lite-v11012.cjs');
const indexedDB=createIDBFactory();
function storage(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
const localStorage=storage(),crypto=require('crypto').webcrypto;
const doc={readyState:'complete',querySelector:()=>null,getElementById:()=>null,createElement:()=>({classList:{toggle(){}},hidden:true}),body:{appendChild(){}},addEventListener(){}};
const c={console,window:null,document:doc,localStorage,indexedDB,crypto,navigator:{},setTimeout:()=>0,clearTimeout:()=>{},queueMicrotask,CustomEvent:class{}};
c.window=c;c.showDirectoryPicker=()=>{};vm.createContext(c);
vm.runInContext(fs.readFileSync('src/v10/v1060-simple-workflow.js','utf8'),c,{filename:'v1060-simple-workflow.js'});
const T=c.WRITE_V106_SIMPLE_WORKFLOW._test;
const tick=()=>new Promise(r=>setImmediate(r));
function good(ids){return{rows:[{name:'x.xlsx',ok:true,result:{ruleIds:ids}}],totals:{failed:0,unmatched:0,conflicts:0,factRules:1,productRules:1,newRules:2,ruleIds:ids},cloud:{ok:true,receipt:{cloud:true,pending:0},detail:{acceptedRuleIds:ids,cloudRuleIds:[]}}}}
(async()=>{
 // P2-03: Array/Set/iterable normalization.
 const a=T.toRuleIds({totals:{ruleIds:[' r1 ','r2','r1','']},rows:[]});
 if(JSON.stringify(a)!==JSON.stringify(['r1','r2']))throw Error('array IDs '+JSON.stringify(a));
 const s=T.toRuleIds({totals:{ruleIds:new Set(['r2','r1'])},rows:[]});
 if(JSON.stringify(s)!==JSON.stringify(['r1','r2']))throw Error('set IDs '+JSON.stringify(s));
 const iter={*[Symbol.iterator](){yield 'r3';yield ' r3 ';yield null}};
 const it=T.toRuleIds({totals:{ruleIds:iter},rows:[]});
 if(JSON.stringify(it)!==JSON.stringify(['r3']))throw Error('iter IDs '+JSON.stringify(it));

 // P2-04: invalid batch structures must never advance.
 for(const x of [{},{rows:[],totals:{}},{rows:[{}],totals:{}},{rows:[{ok:true}],totals:{}}]){
  const q=T.classifyBatchResult(x);if(q.localStatus!=='INVALID_RESULT'||q.syncStatus!=='NOT_READY')throw Error('invalid contract accepted '+JSON.stringify(q))
 }
 const ignored=T.classifyBatchResult({rows:[{name:'fr.xlsx',ok:true,result:{ruleIds:[]}}],totals:{failed:0,unmatched:0,conflicts:0,ignoredFRSheets:1,ruleIds:[]}});
 if(ignored.localStatus!=='NO_APPLICABLE_DATA'||ignored.syncStatus!=='NOT_REQUIRED')throw Error('ignored classification '+JSON.stringify(ignored));

 // Seed an old local-success record.
 let snap=await T.manifestBegin('a.xlsx','LEARN',{observedHash:'oldhash',localStatus:'PENDING',syncStatus:'NOT_READY'});
 let done=await T.manifestCas('a.xlsx',snap,{observedHash:'oldhash',learnedHash:'oldhash',learnedParserVersion:'11.0.12',learnedSchemaVersion:'5',localStatus:'LOCAL_SUCCESS',syncStatus:'SYNC_PENDING',expectedRuleIds:['old-rule']});
 if(!done.ok)throw Error('seed CAS failed');

 // P1-02 old sync response arriving after new learn must be stale.
 let releaseSync;const syncGate=new Promise(r=>releaseSync=r);
 c.WRITE_KB={sync:async()=>{await syncGate;return{ok:true,acceptedRuleIds:['old-rule'],cloudRuleIds:[]}},cloudReceiptStatus:()=>({cloud:true,pending:0})};
 const oldSync=T.strictSyncRecord('a.xlsx','oldhash');
 for(let i=0;i<8;i++)await tick();
 const newer=await T.manifestBegin('a.xlsx','LEARN',{observedHash:'newhash',localStatus:'PENDING',syncStatus:'NOT_READY'});
 const newDone=await T.manifestCas('a.xlsx',newer,{observedHash:'newhash',learnedHash:'newhash',learnedParserVersion:'11.0.12',learnedSchemaVersion:'5',localStatus:'LOCAL_SUCCESS',syncStatus:'SYNC_PENDING',expectedRuleIds:['new-rule']});
 if(!newDone.ok)throw Error('new learn CAS failed');
 releaseSync();const oldResult=await oldSync;const cur=await T.manifestGet('a.xlsx');
 if(cur.learnedHash!=='newhash'||cur.syncStatus!=='SYNC_PENDING'||JSON.stringify(cur.expectedRuleIds)!==JSON.stringify(['new-rule']))throw Error('old sync contaminated new record '+JSON.stringify(cur));
 if(!oldResult.staleResponseIgnored)throw Error('old sync was not marked stale');

 // Old learn response arriving after a newer operation must also be discarded.
 let releaseLearn;const learnGate=new Promise(r=>releaseLearn=r);
 const api={run:async()=>{await learnGate;return good(['old-learn-rule'])}};
 const x={path:'b.xlsx',observedHash:'h1',file:{name:'b.xlsx',size:1,lastModified:1}};
 const oldLearn=T.processOneLearn(x,api);
 for(let i=0;i<8;i++)await tick();
 const n2=await T.manifestBegin('b.xlsx','LEARN',{observedHash:'h2',localStatus:'PENDING',syncStatus:'NOT_READY'});
 await T.manifestCas('b.xlsx',n2,{observedHash:'h2',learnedHash:'h2',learnedParserVersion:'11.0.12',learnedSchemaVersion:'5',localStatus:'LOCAL_SUCCESS',syncStatus:'SYNC_PENDING',expectedRuleIds:['newer-rule']});
 releaseLearn();const lr=await oldLearn,bc=await T.manifestGet('b.xlsx');
 if(bc.learnedHash!=='h2'||JSON.stringify(bc.expectedRuleIds)!==JSON.stringify(['newer-rule']))throw Error('old learn contaminated newer record '+JSON.stringify(bc));
 if(!lr.staleResponseIgnored)throw Error('old learn not marked stale');

 // Old successful records without expected IDs must re-learn instead of looping sync forever.
 snap=await T.manifestBegin('legacy.xlsx','MIGRATE',{observedHash:'z'});
 await T.manifestCas('legacy.xlsx',snap,{observedHash:'z',learnedHash:'z',learnedParserVersion:'11.0.12',learnedSchemaVersion:'5',localStatus:'LOCAL_SUCCESS',syncStatus:'SYNC_PENDING',expectedRuleIds:[]});
 const legacy=await T.manifestGet('legacy.xlsx');
 if(T.manifestAction(legacy,'z')!=='LEARN')throw Error('legacy missing IDs should relearn');

 console.log('V11.0.12 MANIFEST CAS + RESULT CONTRACT PASS');
})().catch(e=>{console.error(e);process.exit(1)});
