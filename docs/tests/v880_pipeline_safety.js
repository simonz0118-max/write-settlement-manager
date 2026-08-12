const fs=require('fs'),vm=require('vm'),assert=require('assert');
const files=process.argv.slice(2).map(p=>fs.readFileSync(p,'utf8')),c={window:null,console};c.window=c;vm.createContext(c);for(const s of files)vm.runInContext(s,c);
const P=c.WRITE_HISTORICAL_PIPELINE_V88;
const d={fileName:'soap.xlsx',sheets:[
{name:'Orders CN',rows:[['Order ID','SKU','Product Name','Country','Tracking'],['1','S*2','Savon','FRANCE','T1']]},
{name:'FACT CN',rows:[['Description','Quantity'],['FRANCE',null],['Savon *2',1],['Manual Truck Fee',1],['Savon *9',null]]}
]};
const x=P.analyzeDescriptor(d,{humanConsistency:1});
assert(x.closure.findings.some(f=>f.state==='EXACT_CLOSED'));
assert(x.closure.findings.some(f=>f.state==='FACT_ONLY_MANUAL'));
assert(x.closure.findings.some(f=>f.state==='TEMPLATE_ONLY'));
assert(!x.trainingEligible.classification,'manual-only evidence must block whole-batch auto promotion');
console.log('V8.8 raw-workbook pipeline safety PASS');