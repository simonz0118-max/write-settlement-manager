const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');

const repo=path.resolve(process.argv[2]||'.');
const base=process.argv[3]||'http://127.0.0.1:8797/';
const seed=path.resolve(repo,'docs/fixtures/stage-a-cn-unknown-orders-seed-0x1041E2E.xlsx');
const reviewed=path.resolve(repo,'docs/fixtures/2026-08-13-order-100-reviewed-cn.xlsx');
const outDir=path.resolve(process.argv[4]||path.join(repo,'.v11012-x07-output'));
const profile=path.resolve(process.argv[5]||path.join(repo,'.v11012-browser-profile'));
fs.mkdirSync(outDir,{recursive:true});fs.mkdirSync(profile,{recursive:true});

function launchOpts(){
 const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const edge='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
 const o={headless:true,acceptDownloads:true,args:['--no-first-run','--no-default-browser-check']};
 if(fs.existsSync(chrome))o.executablePath=chrome;else if(fs.existsSync(edge))o.executablePath=edge;
 return o
}
async function waitState(page,timeout=45000){
 await page.waitForFunction(()=>{const s=window.WRITE_PRODUCTION_STATE?.result||window.WRITE_V10_PRODUCTION?.lastResult||window.WRITE_PRODUCTION_STATE;return Array.isArray(s?.rows)&&s.rows.length>0},{timeout});
 return page.evaluate(()=>{const s=window.WRITE_PRODUCTION_STATE?.result||window.WRITE_V10_PRODUCTION?.lastResult||window.WRITE_PRODUCTION_STATE;const rows=s.rows||[];return{parcels:Number(s.parcelCount||rows.parcelCount||0),rows:rows.map(r=>({description:r.description,quantity:r.quantity,cogs:r.cogs,shipping:r.shipping,unitTotal:r.unitTotal,amount:r.amount,needsReview:r.needsReview,priceBlank:r.priceBlank,configurationFingerprint:r.configurationFingerprint}))}})
}
async function dismissBlockingUi(page){
 // Fresh profile can stack the first-use folder intro ABOVE release notes.
 // Close real product dialogs in topmost order; never force-click or delete DOM.
 for(let pass=0;pass<6;pass++){
   let changed=false;
   const intro=page.locator('#v106FolderIntro');
   if(await intro.count() && await intro.first().isVisible().catch(()=>false)){
     const later=intro.first().locator('[data-later]');
     const x=intro.first().locator('.v106-x');
     const close=(await later.count())?later:x;
     await close.first().waitFor({state:'visible',timeout:5000});
     await close.first().click({timeout:5000});
     await intro.first().waitFor({state:'detached',timeout:5000}).catch(async()=>{
       if(await intro.first().isVisible().catch(()=>false))throw Error('folder-intro modal did not close through product control');
     });
     changed=true;
   }
   const release=page.locator('.release-notes-backdrop.write-authoritative-release-notes');
   if(await release.count() && await release.first().isVisible().catch(()=>false)){
     const ack=release.first().locator('.release-ack');
     await ack.waitFor({state:'visible',timeout:5000});
     await ack.click({timeout:5000});
     await release.first().waitFor({state:'detached',timeout:5000}).catch(async()=>{
       if(await release.first().isVisible().catch(()=>false))throw Error('release-notes modal did not close after acknowledgement');
     });
     changed=true;
   }
   if(!changed)break;
 }
 const blockers=await page.locator('#v106FolderIntro:visible,.release-notes-backdrop.write-authoritative-release-notes:visible').count();
 if(blockers)throw Error('known startup modal still blocks business UI');
}

async function dismissIntro(page){return dismissBlockingUi(page)}
async function importSeed(page){
 await dismissBlockingUi(page);
 await page.locator('#fileInput').setInputFiles(seed);
 return waitState(page)
}
async function exportFact(page,save){
 await dismissBlockingUi(page);
 // Deterministic browser artifact capture: execute the real UI/export builder, but intercept only
 // the final anchor.click delivery in headless Chrome. This avoids a Playwright persistent-profile
 // race where the second native download can close the target before download.saveAs().
 await page.evaluate(()=>{
   window.__WRITE_E2E_DOWNLOAD_CAPTURE=null;
   if(window.__WRITE_E2E_DOWNLOAD_CAPTURE_INSTALLED)return;
   window.__WRITE_E2E_DOWNLOAD_CAPTURE_INSTALLED=true;
   const blobByUrl=new Map();
   const realCreate=URL.createObjectURL.bind(URL);
   const realClick=HTMLAnchorElement.prototype.click;
   URL.createObjectURL=function(blob){const url=realCreate(blob);blobByUrl.set(url,blob);return url};
   HTMLAnchorElement.prototype.click=function(){
     const url=String(this.href||'');
     const blob=blobByUrl.get(url);
     if(blob&&this.download){window.__WRITE_E2E_DOWNLOAD_CAPTURE={blob,fileName:String(this.download||'download.xlsx')};return}
     return realClick.call(this)
   };
 });
 const button=page.locator('#heroExportButton');await button.waitFor({state:'visible',timeout:15000});await button.click();
 const go=page.locator('#v1064ExportBackdrop [data-a="go"]');await go.waitFor({state:'visible',timeout:10000});
 await go.click();
 await page.waitForFunction(()=>window.__WRITE_E2E_DOWNLOAD_CAPTURE?.blob instanceof Blob,{timeout:30000});
 const artifact=await page.evaluate(async()=>{
   const x=window.__WRITE_E2E_DOWNLOAD_CAPTURE,b=new Uint8Array(await x.blob.arrayBuffer());
   let binary='';const chunk=0x8000;for(let i=0;i<b.length;i+=chunk)binary+=String.fromCharCode(...b.subarray(i,i+chunk));
   return{fileName:x.fileName,size:b.length,b64:btoa(binary),type:x.blob.type||''};
 });
 if(!artifact||artifact.size<1000)throw Error('export artifact too small '+JSON.stringify(artifact));
 const buf=Buffer.from(artifact.b64,'base64');
 if(buf[0]!==0x50||buf[1]!==0x4b)throw Error('export artifact is not XLSX/ZIP');
 fs.writeFileSync(save,buf);
 return save
}
(async()=>{
 if(!fs.existsSync(seed)||!fs.existsSync(reviewed))throw Error('X07 fixture missing');
 let ctx=await chromium.launchPersistentContext(profile,launchOpts());
 await ctx.route('**/api/rules/sync',route=>route.abort());
 let page=ctx.pages()[0]||await ctx.newPage();
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.WRITE_V101_REVIEW_LEARNING&&window.WRITE_KB&&window.WRITE_V10_PRODUCTION&&window.WRITE_V106_SIMPLE_WORKFLOW&&window.WRITE_V1040_LAYERING&&window.WRITE_V1050_HARDENING,{timeout:30000});
 // Real two-tab IndexedDB CAS probe: an older revision must be unable to commit after a newer tab starts an operation.
 const page2=await ctx.newPage();await page2.goto(base,{waitUntil:'domcontentloaded'});await page2.waitForFunction(()=>window.WRITE_V106_SIMPLE_WORKFLOW,{timeout:30000});
 const snap1=await page.evaluate(()=>window.WRITE_V106_SIMPLE_WORKFLOW._test.manifestBegin('__v11012_tab_probe__.xlsx','SYNC',{observedHash:'old',localStatus:'LOCAL_SUCCESS',syncStatus:'SYNC_PENDING',expectedRuleIds:['old-rule']}));
 const snap2=await page2.evaluate(()=>window.WRITE_V106_SIMPLE_WORKFLOW._test.manifestBegin('__v11012_tab_probe__.xlsx','LEARN',{observedHash:'new',localStatus:'PENDING',syncStatus:'NOT_READY'}));
 const stale=await page.evaluate(s=>window.WRITE_V106_SIMPLE_WORKFLOW._test.manifestCas('__v11012_tab_probe__.xlsx',s,{syncStatus:'SYNCED'}),snap1);
 const fresh=await page2.evaluate(s=>window.WRITE_V106_SIMPLE_WORKFLOW._test.manifestCas('__v11012_tab_probe__.xlsx',s,{observedHash:'new',learnedHash:'new',learnedParserVersion:'11.0.12',learnedSchemaVersion:'5',localStatus:'LOCAL_SUCCESS',syncStatus:'SYNC_PENDING',expectedRuleIds:['new-rule']}),snap2);
 if(!stale.stale||!fresh.ok)throw Error('cross-tab CAS failed '+JSON.stringify({stale,fresh}));
 await page2.close();
 const initial=await importSeed(page);
 if(initial.parcels!==7)throw Error('initial parcels '+initial.parcels);
 const initialExport=await exportFact(page,path.join(outDir,'x07-initial-fact.xlsx'));
 const b64=fs.readFileSync(reviewed).toString('base64');
 const learn=await page.evaluate(async({b64})=>{
   const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),f=new File([u],'2026-08-13-order-100-reviewed-cn.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
   return await window.WRITE_V101_REVIEW_LEARNING.importReviewedWorkbook(f,{skipSync:true})
 },{b64});
 if(Number(learn.unmatched||0)!==0||Number(learn.factRules||0)<6)throw Error('review learn '+JSON.stringify(learn));
 const localRules=await page.evaluate(()=>window.WRITE_KB.list().filter(r=>!r.deleted).length);
 if(localRules<10)throw Error('knowledge rules too few '+localRules);
 await ctx.close();

 // Relaunch with exactly the same browser profile: this proves real browser IndexedDB persistence across a browser process boundary.
 ctx=await chromium.launchPersistentContext(profile,launchOpts());
 await ctx.route('**/api/rules/sync',route=>route.abort());
 page=ctx.pages()[0]||await ctx.newPage();
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.WRITE_KB&&window.WRITE_V10_PRODUCTION&&window.WRITE_V1040_LAYERING&&window.WRITE_V1050_HARDENING,{timeout:30000});
 const replay=await importSeed(page);
 const reviewCount=replay.rows.filter(r=>r.needsReview).length,total=Number(replay.rows.reduce((s,r)=>s+Number(r.amount||0),0).toFixed(2));
 const pencil=replay.rows.find(r=>r.description==='Stylo eternel *1');
 if(replay.parcels!==7||reviewCount!==0||total!==53)throw Error('replay fail '+JSON.stringify({parcels:replay.parcels,reviewCount,total,rows:replay.rows}));
 if(!pencil||Number(pencil.quantity)!==2||Number(pencil.cogs)!==3.2||Number(pencil.shipping)!==2.1||Number(pencil.unitTotal)!==5.3||Number(pencil.amount)!==10.6)throw Error('pencil mismatch '+JSON.stringify(pencil));

 const unknown=await page.evaluate(()=>{const r=window.WRITE_V10_PRODUCTION.build([{orderId:'X-UNKNOWN',trackingNumber:'X-TRACK',destinationCountry:'FRANCE',fulfillmentOrigin:'CN',currency:'EUR',lineItems:[{sku:'NEVER-LEARNED-11012',productName:'Never Learned Mystery Product',quantity:1}]}]);return r.rows?.[0]||null});
 if(!unknown||unknown.priceBlank!==true||unknown.needsReview!==true||unknown.amount!==null)throw Error('unknown combination not fail-closed '+JSON.stringify(unknown));
 const save=path.join(outDir,'x07-production-export.xlsx');await exportFact(page,save);
 const runtime={crossTabCas:true,release:await page.evaluate(()=>document.body.dataset.release),initial,initialExport,learn,replay,reviewCount,total,pencil,unknown,exportPath:save};
 fs.writeFileSync(path.join(outDir,'runtime.json'),JSON.stringify(runtime,null,2));
 await ctx.close();
 console.log('V11.0.12 BROWSER X07 REPLAY/DOWNLOAD PASS',JSON.stringify({parcels:replay.parcels,reviewCount,total,pencil,exportPath:save}));
})().catch(async e=>{console.error(e);process.exit(1)});
