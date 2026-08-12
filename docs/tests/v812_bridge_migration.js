const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),cp=require('child_process');
const patch=process.argv[2],pkg=process.argv[3],fixture=process.argv[4];
const safeBlock=/\n?\/\/ V8 SHADOW READ-ONLY SOURCE BRIDGE\.[\s\S]*?window\.WRITE_V8_SOURCE_BRIDGE\s*=\s*function\(\)\{[\s\S]*?\n\};\n?/;
const genericSafe=/window\.WRITE_V8_SOURCE_BRIDGE\s*=\s*function\(\)\{[\s\S]*?\n\};\n?/;
function runCase(mode){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'write-v812-migrate-'));
 fs.cpSync(fixture,dir,{recursive:true});
 const prod=path.join(dir,'src/universal-source-v759.js');
 let text=fs.readFileSync(prod,'utf8');
 text=text.replace(safeBlock,'\n').replace(genericSafe,'');
 text=text.replace(/^window\.WRITE_V8_SOURCE_BRIDGE=.*\n?/m,'');
 if(mode==='legacy'){
   text=text.replace('// Runtime version marker keeps the currently deployed shell honest',
     "window.WRITE_V8_SOURCE_BRIDGE=()=>({orders:(classified?.orders||[]),lineItems:(classified?.lineItems||[]),sourceWorkbooks:(sourceWorkbooks||[])});\n// Runtime version marker keeps the currently deployed shell honest");
 }else if(mode==='safe'){
   text=text.replace('// Runtime version marker keeps the currently deployed shell honest',
     "window.WRITE_V8_SOURCE_BRIDGE = function(){\n return Object.freeze({bridgeMode:'READ_ONLY_SNAPSHOT'});\n};\n// Runtime version marker keeps the currently deployed shell honest");
 }
 fs.writeFileSync(prod,text);
 for(let i=0;i<2;i++)cp.execFileSync('node',[patch,dir,pkg],{stdio:'pipe'});
 const out=fs.readFileSync(prod,'utf8');
 assert(/window\.WRITE_V8_SOURCE_BRIDGE\s*=\s*function/.test(out),mode+': bridge function missing');
 assert(/bridgeMode:'READ_ONLY_SNAPSHOT'/.test(out),mode+': safe marker missing');
 assert(!/WRITE_V8_SOURCE_BRIDGE=\(\)=>/.test(out),mode+': legacy live-reference bridge remains');
 assert.equal((out.match(/WRITE_V8_SOURCE_BRIDGE/g)||[]).length,1,mode+': bridge duplicated');
 fs.rmSync(dir,{recursive:true,force:true});
}
runCase('none');runCase('legacy');runCase('safe');
console.log('V8.1.2 source bridge migration PASS: none / legacy / safe');