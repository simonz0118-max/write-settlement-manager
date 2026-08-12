const fs=require('fs'),assert=require('assert');
const rt=fs.readFileSync(process.argv[2],'utf8'),src=fs.readFileSync(process.argv[3],'utf8');
assert(/v===null\|\|v===undefined\|\|v==='/.test(rt));
assert(/PRICE_BLANK/.test(src));
assert(fs.existsSync(process.argv[4]));
console.log('V7.5.8 blank price + clean template PASS');