function createIDBFactory(){
 const dbs=new Map(),clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 function makeReq(tx,run){const r={result:undefined,error:null,onsuccess:null,onerror:null};tx&&tx.add();queueMicrotask(()=>{try{run(r)}catch(e){r.error=e;r.onerror&&r.onerror({target:r})}finally{tx&&tx.done()}});return r}
 function makeStore(state,tx){return{
  createIndex(){return{}},
  get:k=>makeReq(tx,r=>{r.result=clone(state.rows.get(k));r.onsuccess&&r.onsuccess({target:r})}),
  getAll:()=>makeReq(tx,r=>{r.result=[...state.rows.values()].map(clone);r.onsuccess&&r.onsuccess({target:r})}),
  put:(v,k)=>makeReq(tx,r=>{const key=k!==undefined?k:v?.[state.keyPath||'id'];if(key===undefined)throw Error('IDB-lite missing key');state.rows.set(key,clone(v));r.result=key;r.onsuccess&&r.onsuccess({target:r})}),
  delete:k=>makeReq(tx,r=>{state.rows.delete(k);r.onsuccess&&r.onsuccess({target:r})}),
  clear:()=>makeReq(tx,r=>{state.rows.clear();r.onsuccess&&r.onsuccess({target:r})})
 }}
 function makeDb(state){return{
  objectStoreNames:{contains:n=>state.stores.has(n)},
  createObjectStore(name,opt={}){if(!state.stores.has(name))state.stores.set(name,{keyPath:opt.keyPath||null,rows:new Map()});return makeStore(state.stores.get(name),null)},
  transaction(names,mode){
   const tx={pending:0,scheduled:false,oncomplete:null,onerror:null,onabort:null,
    add(){this.pending++},
    done(){this.pending--;this.maybe()},
    maybe(){if(this.pending!==0||this.scheduled)return;this.scheduled=true;queueMicrotask(()=>{this.scheduled=false;if(this.pending===0)this.oncomplete&&this.oncomplete({target:this})})},
    objectStore:name=>{if(!state.stores.has(name))throw Error('IDB-lite no store '+name);return makeStore(state.stores.get(name),tx)}};
   queueMicrotask(()=>tx.maybe());return tx
  },close(){}
 }}
 return{open(name,version=1){const r={result:undefined,error:null,onsuccess:null,onerror:null,onupgradeneeded:null};queueMicrotask(()=>{try{let st=dbs.get(name),up=false;if(!st){st={version,stores:new Map()};dbs.set(name,st);up=true}else if(version>st.version){st.version=version;up=true}r.result=makeDb(st);if(up&&r.onupgradeneeded)r.onupgradeneeded({target:r});queueMicrotask(()=>r.onsuccess&&r.onsuccess({target:r}))}catch(e){r.error=e;r.onerror&&r.onerror({target:r})}});return r},_dbs:dbs}
}
module.exports={createIDBFactory};
