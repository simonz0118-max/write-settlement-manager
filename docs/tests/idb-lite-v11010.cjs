function createIDBFactory(){
  const dbs=new Map();
  const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  function req(run){
    const r={result:undefined,error:null,onsuccess:null,onerror:null,onupgradeneeded:null};
    queueMicrotask(()=>{try{run(r)}catch(e){r.error=e;r.onerror&&r.onerror({target:r})}});
    return r;
  }
  function makeStore(state,tx){
    return{
      createIndex(){return{}},
      get(key){return req(r=>{r.result=clone(state.rows.get(key));r.onsuccess&&r.onsuccess({target:r});tx&&tx.done()})},
      getAll(){return req(r=>{r.result=[...state.rows.values()].map(clone);r.onsuccess&&r.onsuccess({target:r});tx&&tx.done()})},
      put(value,key){
        return req(r=>{
          const k=key!==undefined?key:value?.[state.keyPath||'id'];
          if(k===undefined)throw Error('IDB-lite missing key');
          state.rows.set(k,clone(value));r.result=k;r.onsuccess&&r.onsuccess({target:r});tx&&tx.done()
        })
      },
      delete(key){return req(r=>{state.rows.delete(key);r.result=undefined;r.onsuccess&&r.onsuccess({target:r});tx&&tx.done()})},
      clear(){return req(r=>{state.rows.clear();r.onsuccess&&r.onsuccess({target:r});tx&&tx.done()})}
    }
  }
  function makeDb(state){
    return{
      objectStoreNames:{contains:n=>state.stores.has(n)},
      createObjectStore(name,opt={}){
        if(!state.stores.has(name))state.stores.set(name,{keyPath:opt.keyPath||null,rows:new Map()});
        return makeStore(state.stores.get(name),null)
      },
      transaction(names,mode){
        const tx={oncomplete:null,onerror:null,onabort:null,pending:0,done(){this.pending--;if(this.pending<=0)queueMicrotask(()=>this.oncomplete&&this.oncomplete({target:this}))}};
        tx.objectStore=name=>{
          if(!state.stores.has(name))throw Error('IDB-lite no store '+name);
          tx.pending++;
          return makeStore(state.stores.get(name),tx)
        };
        return tx
      },
      close(){}
    }
  }
  return{
    open(name,version=1){
      const r={result:undefined,error:null,onsuccess:null,onerror:null,onupgradeneeded:null};
      queueMicrotask(()=>{
        try{
          let state=dbs.get(name),upgrade=false;
          if(!state){state={version,stores:new Map()};dbs.set(name,state);upgrade=true}
          else if(version>state.version){state.version=version;upgrade=true}
          r.result=makeDb(state);
          if(upgrade&&r.onupgradeneeded)r.onupgradeneeded({target:r});
          queueMicrotask(()=>r.onsuccess&&r.onsuccess({target:r}));
        }catch(e){r.error=e;r.onerror&&r.onerror({target:r})}
      });
      return r
    },
    _dbs:dbs
  }
}
module.exports={createIDBFactory};
