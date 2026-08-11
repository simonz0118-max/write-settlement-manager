const fs=require('fs');
const assert=require('assert');
const base=fs.readFileSync('src/workers/import.worker.bundle.js','utf8');
const overlay=fs.readFileSync('src/workers/import.worker.v758.js','utf8');
const runtime=fs.readFileSync('src/universal-source-v759.js','utf8');

for(const token of [
  '(?:[A-Za-z_][\\w.-]*:)?Relationship',
  '(?:[A-Za-z_][\\w.-]*:)?sheet',
  '(?:[A-Za-z_][\\w.-]*:)?row',
  '(?:[A-Za-z_][\\w.-]*:)?c',
  '(?:[A-Za-z_][\\w.-]*:)?v',
  'function nextXmlRow',
]) assert(base.includes(token),`missing namespace-safe parser token: ${token}`);

assert(overlay.includes("import.worker.bundle.js?v=9.0.0-002"),'overlay must bust the base worker cache');
assert(runtime.includes("import.worker.v758.js?v=9.0.0-002"),'runtime must bust the overlay worker cache');
console.log('V9 namespace-prefix XLSX import gate PASS');
