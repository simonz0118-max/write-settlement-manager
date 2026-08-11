const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const source=fs.readFileSync('src/app.bundle.js','utf8');
const match=/function shiftTemplateRowXml\([\s\S]*?\n}\nfunction shiftTemplateMergeRef/.exec(source);
assert(match,'shiftTemplateRowXml must exist');
const sandbox={};
vm.runInNewContext(`${match[0].replace(/\nfunction shiftTemplateMergeRef[\s\S]*$/,'')}\nthis.shiftTemplateRowXml=shiftTemplateRowXml`,sandbox);

const historical='<row r="23"><c r="B23" s="67"><f t="array" ref="B23">H19</f><v>226.46</v></c></row>';
const shifted=sandbox.shiftTemplateRowXml(historical,23,27,19,23);
assert(shifted.includes('r="B27"'));
assert(shifted.includes('>H23</f>'));
assert(!shifted.includes('226.46'),'historical cached amount must not survive');
assert(!/<v>/.test(shifted),'formula cache must be removed');
console.log('V9 historical formula cache isolation PASS');
