const fs=require('fs'),vm=require('vm'),assert=require('assert');const s=fs.readFileSync(process.argv[2],'utf8'),c={window:null};c.window=c;vm.createContext(c);vm.runInContext(s,c);const E=c.WRITE_HISTORICAL_EXTRACTOR_V88;
const wb={SheetNames:['Orders','FACT'],Sheets:{Orders:{rows:[['Order ID','SKU','Product Name','Country'],['1','P*1','Stylo éternel','FRANCE']]},FACT:{rows:[['Description','Quantity'],['Stylo eternel',1]]}}};
const XLSX={utils:{sheet_to_json:(sheet)=>sheet.rows}};
const x=E.fromSheetJSWorkbook(wb,XLSX,'pencil.xlsx');assert.equal(x.orderRecords.length,1);assert.equal(x.factRows.length,1);
console.log('V8.8 SheetJS direct-workbook adapter PASS');