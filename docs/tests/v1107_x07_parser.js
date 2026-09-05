function parse(xml,re){
 const out=[]; for(const cm of xml.matchAll(re)){const attrs=cm[1]||'',m=/\br="([A-Z]+)(\d+)"/.exec(attrs);if(!m)continue;let c=0;for(const ch of m[1])c=c*26+ch.charCodeAt(0)-64;out[c-1]=/<v>([\s\S]*?)<\/v>/.exec(cm[0])?.[1]??'';} return out;
}
const row='<c r="A12" s="43"/><c r="B12"><v>1</v></c><c r="C12"><v>2</v></c>';
const now=parse(row,/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g);
if(now[0]!==''||now[1]!=='1'||now[2]!=='2')throw Error(JSON.stringify(now));
console.log('X07 XML CELL FIX PASS',JSON.stringify(now));