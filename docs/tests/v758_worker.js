const fs=require('fs'),assert=require('assert');
const s=fs.readFileSync(process.argv[2],'utf8');
assert(/sourceProductCountValue=normalizeNumber\(order\.productCount\)/.test(s));
assert(/sourceProductCountWasExplicit/.test(s));
assert(/sourceFidelityVersion:'7\.5\.8'/.test(s));
assert(/16384/.test(s)&&/rawCells/.test(s));
console.log('V7.5.8 worker source quantity PASS');