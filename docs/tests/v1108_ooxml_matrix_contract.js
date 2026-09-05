const fs=require('fs'),vm=require('vm');
global.window=global;
vm.runInThisContext(fs.readFileSync('src/v10/review-learning-v101.js','utf8'),{filename:'review-learning-v101.js'});
const m=WRITE_V101_REVIEW_LEARNING._test.matrix;
const xml="<x:worksheet xmlns:x='urn:x'><x:sheetData><x:row r='1'><x:c r='A1'/><x:c r='b1' t='inlineStr'><x:is><x:t>Hello</x:t></x:is></x:c><x:c r='AA1'><x:v>7</x:v></x:c><x:c r='ZZ1' t='b'><x:v>1</x:v></x:c></x:row></x:sheetData></x:worksheet>";
const rows=m(xml,[]);
if(rows[0][0]!==''||rows[0][1]!=='Hello'||rows[0][26]!==7||rows[0][701]!==true){console.error('OOXML FAIL',rows[0]);process.exit(1)}
console.log('OOXML MATRIX PASS');
