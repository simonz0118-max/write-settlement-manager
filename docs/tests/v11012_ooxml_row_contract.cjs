const fs=require('fs'),vm=require('vm');
const c={console,window:null,TextDecoder,TextEncoder,Blob,Response,DecompressionStream};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync('src/v10/review-learning-v101.js','utf8'),c,{filename:'review-learning-v101.js'});
const m=c.WRITE_V101_REVIEW_LEARNING._test.matrix;
const cases=[
 [`<worksheet><sheetData><row r="1"/><row r="2"><c r="B2"><v>7</v></c></row></sheetData></worksheet>`,r=>r[0]?.[1]===undefined&&r[1]?.[1]===7],
 [`<worksheet><sheetData><row r="1"/><row r="2"/><row r="3"><c r="C3"><v>9</v></c></row></sheetData></worksheet>`,r=>r[2]?.[2]===9],
 [`<x:worksheet xmlns:x="u"><x:sheetData><x:row r='4' s='3'/><x:row r='5'><x:c r='AA5'><x:v>11</x:v></x:c></x:row></x:sheetData></x:worksheet>`,r=>r[4]?.[26]===11],
 [`<worksheet><sheetData><row r="6"><c r="B7"><v>99</v></c><c r="C6"><v>12</v></c></row></sheetData></worksheet>`,r=>r[5]?.[1]===undefined&&r[5]?.[2]===12]
];
for(const[x,ok]of cases){const r=m(x,[]);if(!ok(r)){console.error(r);process.exit(1)}}
console.log('V11.0.12 OOXML ROW CONTRACT PASS');
