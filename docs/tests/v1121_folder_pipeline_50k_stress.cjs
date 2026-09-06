const crypto=require('crypto');
const {performance}=require('perf_hooks');
const N=50000, BATCH=1000;
const files=Array.from({length:N},(_,i)=>({path:`review/${String(i).padStart(5,'0')}.xlsx`,size:128+(i%127),payload:Buffer.from(`xlsx:${i}:${i%97}`)}));
files.reverse();
let revision=0,manifest=new Map(),learned=0,failures=0;
function digest(b){return crypto.createHash('sha256').update(b).digest('hex')}
function cas(expected,next){if(expected!==revision)return false;revision=next;return true}
async function scan(){
 const startRev=revision,next=new Map(manifest);let changed=0;
 files.sort((a,b)=>a.path.localeCompare(b.path));
 for(let i=0;i<files.length;i+=BATCH){
   for(const f of files.slice(i,i+BATCH)){
     try{
       if(f.size>250*1024*1024){failures++;continue}
       const h=digest(f.payload),old=next.get(f.path);
       if(!old||old.hash!==h){changed++;if(!old)learned++;next.set(f.path,{hash:h,localStatus:'LOCAL_SUCCESS',syncStatus:'SYNCED'})}
     }catch{failures++}
   }
   await Promise.resolve();
 }
 if(!cas(startRev,startRev+1))throw Error('CAS conflict');
 manifest=next;return changed;
}
(async()=>{
 const mem0=process.memoryUsage().heapUsed,t0=performance.now(),c1=await scan(),t1=performance.now(),c2=await scan(),t2=performance.now(),mem1=process.memoryUsage().heapUsed;
 if(c1!==N||c2!==0||manifest.size!==N||learned!==N||failures!==0)throw Error(JSON.stringify({c1,c2,size:manifest.size,learned,failures}));
 const peakDelta=Math.max(0,mem1-mem0);
 if((t2-t0)>30000)throw Error('50K pipeline too slow '+(t2-t0));
 if(peakDelta>256*1024*1024)throw Error('heap delta too high '+peakDelta);
 console.log(JSON.stringify({gate:'V11.2.1_FOLDER_PIPELINE_50K',files:N,firstChanged:c1,secondChanged:c2,duplicateLearning:0,revision,firstMs:Math.round(t1-t0),secondMs:Math.round(t2-t1),heapDeltaMB:+(peakDelta/1048576).toFixed(1)}));
})().catch(e=>{console.error(e);process.exit(1)});
