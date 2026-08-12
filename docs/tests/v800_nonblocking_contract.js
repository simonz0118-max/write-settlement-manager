const fs=require('fs'),assert=require('assert');
if(process.argv.length<5){console.error('usage: node v800_nonblocking_contract.js <shadow> <index> <production>');process.exit(2)}
const shadow=fs.readFileSync(process.argv[2],'utf8'),idx=fs.readFileSync(process.argv[3],'utf8'),prod=fs.readFileSync(process.argv[4],'utf8');
assert(!/generatedGenericFactRowsForWorkbook\s*=/.test(shadow),'shadow must not replace production FACT generator');
assert(/universal-source-v759\.js/.test(idx),'V7.5.9 production runtime must remain loaded');
assert(/semantic-core\.js/.test(idx)&&/shadow-runtime\.js/.test(idx),'V8 scripts must remain loaded');
assert(/window\.WRITE_V8_SOURCE_BRIDGE\s*=\s*function/.test(prod),'source bridge missing');
assert(/bridgeMode:'READ_ONLY_SNAPSHOT'/.test(prod),'bridge must be read-only snapshot');
assert(/Object\.freeze\(\{/.test(prod),'bridge result must be frozen');
const at=prod.indexOf('window.WRITE_V8_SOURCE_BRIDGE');assert(at>=0);
const tail=prod.slice(at);
assert(!/window\.generatedGenericFactRowsForWorkbook\s*=/.test(tail),'FACT generator replacement after bridge is forbidden');
assert(!/window\.buildFactExportData\s*=/.test(tail),'FACT export replacement after bridge is forbidden');
console.log('V8.1.2 non-blocking production contract PASS');