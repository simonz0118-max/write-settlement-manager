const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8'),manifest=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const c={window:null};c.window=c;vm.createContext(c);vm.runInContext(src,c);
let g=c.WRITE_TRACE_FIDELITY_V831.combinedGate({hardPass:true},{exact:true},{exactTracePass:true});
assert(g.formalTakeoverEligible===true);
g=c.WRITE_TRACE_FIDELITY_V831.combinedGate({hardPass:true},{exact:false},{exactTracePass:true});assert(g.formalTakeoverEligible===false);
g=c.WRITE_TRACE_FIDELITY_V831.combinedGate({hardPass:false},{exact:true},{exactTracePass:true});assert(g.formalTakeoverEligible===false);
assert(manifest.formalFactTakeover===false,'even eligible golden batch must not auto-enable production takeover');
console.log('V8.3.1 combined takeover gate PASS: production takeover remains OFF');