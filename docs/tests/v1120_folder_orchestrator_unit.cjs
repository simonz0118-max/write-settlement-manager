const fs=require('fs'),vm=require('vm');const src=fs.readFileSync('src/v10/v1120-folder-auto-orchestrator.js','utf8');
const listeners={};class CE{constructor(t,o={}){this.type=t;this.detail=o.detail}}
const document={readyState:'loading',visibilityState:'visible',addEventListener:(n,f)=>{listeners[n]=f}};
const window={document,CustomEvent:CE,addEventListener:()=>{},dispatchEvent:()=>{},navigator:{},setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask};
const ctx={window,document,CustomEvent:CE,navigator:window.navigator,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,indexedDB:{}};vm.createContext(ctx);vm.runInContext(src,ctx);
const t=window.WRITE_V112_FOLDER_AUTOMATION._test;
if(t.retryDelayFor(0)!==30000||t.retryDelayFor(1)!==60000||t.retryDelayFor(20)!==900000)throw Error('backoff');
let x=t.classifyOutcomes([{localStatus:'LOCAL_SUCCESS',syncStatus:'SYNCED'},{localStatus:'CONFLICT',syncStatus:'NOT_READY'},{localStatus:'LOCAL_SUCCESS',syncStatus:'SYNC_PENDING',retryReason:'HTTP 401 UNAUTHORIZED'}]);
if(x.retryCount!==1||x.attentionCount!==1||!x.authRequired)throw Error('classification '+JSON.stringify(x));
x=t.classifyOutcomes([{localStatus:'NO_APPLICABLE_DATA',syncStatus:'NOT_REQUIRED'}]);if(x.retryCount||x.attentionCount)throw Error('no-applicable');
console.log('V11.2.0 ORCHESTRATOR UNIT PASS');
