/* WRITE V10 Stage C foundation — Universal Ingestion (deterministic formats first) */
(function(g){'use strict';const VERSION='10.0.0-a1';
const clean=v=>String(v??'').replace(/\r/g,' ').trim();
const UTF8=new TextDecoder('utf-8',{fatal:false});
function bytes(x){return x instanceof Uint8Array?x:new Uint8Array(x||[])}
function starts(b,arr){return arr.every((v,i)=>b[i]===v)}
function detectFormat(input,name=''){
 const b=bytes(input),n=String(name||'').toLowerCase();
 if(starts(b,[0x50,0x4b,0x03,0x04]))return'ZIP_OR_XLSX';
 if(starts(b,[0xd0,0xcf,0x11,0xe0]))return'XLS';
 if(starts(b,[0x25,0x50,0x44,0x46]))return'PDF';
 if(starts(b,[0x89,0x50,0x4e,0x47]))return'PNG';
 if(starts(b,[0xff,0xd8,0xff]))return'JPEG';
 const t=UTF8.decode(b.slice(0,4096)).trim();
 if(t.startsWith('{')||t.startsWith('[')||n.endsWith('.json'))return'JSON';
 if(t.startsWith('<?xml')||/^<[\w:-]+[\s>]/.test(t)||n.endsWith('.xml'))return'XML';
 if(n.endsWith('.tsv')||(/\t/.test(t)&&!/,/.test(t)))return'TSV';
 if(n.endsWith('.csv')||/,/.test(t))return'CSV';
 return'UNKNOWN';
}
function parseDelimited(text,sep=','){
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){const ch=text[i],nx=text[i+1];if(ch==='"'){if(q&&nx==='"'){cell+='"';i++}else q=!q}else if(ch===sep&&!q){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&nx==='\n')i++;row.push(cell);cell='';if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[]}else cell+=ch}
 row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);return rows;
}
function parseJSON(text){const x=JSON.parse(text);if(Array.isArray(x))return x;if(Array.isArray(x.orders))return x.orders;if(Array.isArray(x.data))return x.data;return[x]}
function parseXML(text){
 const out=[];const orderRe=/<(?:order|commande|record|row)\b[^>]*>([\s\S]*?)<\/(?:order|commande|record|row)>/gi;let m;
 while((m=orderRe.exec(text))){const obj={},body=m[1];body.replace(/<([\w:-]+)[^>]*>([\s\S]*?)<\/\1>/g,(_,k,v)=>{obj[k.replace(/^.*:/,'')]=v.replace(/<[^>]+>/g,'').trim();return''});out.push(obj)}
 if(!out.length)throw new Error('XML_ORDER_STRUCTURE_NOT_RECOGNIZED');return out;
}
function inferHeaders(rows=[]){
 if(!rows.length)return{headerRow:-1,headers:[]};let best={headerRow:0,score:-1,headers:rows[0]||[]};
 for(let i=0;i<Math.min(rows.length,10);i++){const r=rows[i]||[],text=r.join('|').toLowerCase(),score=['order','commande','订单','sku','product','商品','country','pays','国家','quantity','qty','数量','currency','币种'].reduce((s,k)=>s+(text.includes(k)?1:0),0);if(score>best.score)best={headerRow:i,score,headers:r}}
 return best;
}
function delimitedObjects(rows=[]){const h=inferHeaders(rows),headers=h.headers.map((x,i)=>clean(x)||`COL_${i+1}`);return rows.slice(h.headerRow+1).filter(r=>r.some(x=>clean(x))).map(r=>Object.fromEntries(headers.map((k,i)=>[k,r[i]??null])))}
function safeZipEntries(entries=[],limits={}){
 const maxEntries=limits.maxEntries||5000,maxUncompressed=limits.maxUncompressedBytes||200*1024*1024,maxRatio=limits.maxCompressionRatio||200;
 if(entries.length>maxEntries)throw new Error('ZIP_TOO_MANY_ENTRIES');let total=0;
 for(const e of entries){const n=String(e.name||'');if(/(^|\/)\.\.(\/|$)|^[\\/]|^[A-Za-z]:[\\/]/.test(n))throw new Error('ZIP_PATH_TRAVERSAL');const u=Number(e.uncompressedSize||0),c=Math.max(1,Number(e.compressedSize||1));total+=u;if(u/c>maxRatio)throw new Error('ZIP_BOMB_RATIO')}
 if(total>maxUncompressed)throw new Error('ZIP_TOO_LARGE');return true;
}
function parseDeterministic(input,name=''){
 const b=bytes(input),fmt=detectFormat(b,name),text=UTF8.decode(b);
 if(fmt==='JSON')return{format:fmt,records:parseJSON(text)};
 if(fmt==='XML')return{format:fmt,records:parseXML(text)};
 if(fmt==='CSV'||fmt==='TSV'){const rows=parseDelimited(text,fmt==='TSV'?'\t':',');return{format:fmt,rows,records:delimitedObjects(rows)}}
 return{format:fmt,records:null,requiresAdapter:true};
}

function pdfUnescape(s=''){return String(s).replace(/\\([nrtbf()\\])/g,(_,c)=>({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','(':'(',')':')','\\':'\\'}[c]||c)).replace(/\\([0-7]{1,3})/g,(_,o)=>String.fromCharCode(parseInt(o,8)))}
function extractPdfTextBasic(input){
 const raw=new TextDecoder('latin1').decode(bytes(input)),out=[];
 raw.replace(/\((?:\\.|[^\\)])*\)\s*Tj/g,m=>{out.push(pdfUnescape(m.replace(/\)\s*Tj$/,'').slice(1)));return m});
 raw.replace(/\[(.*?)\]\s*TJ/gs,(_,body)=>{let s='';body.replace(/\((?:\\.|[^\\)])*\)/g,m=>{s+=pdfUnescape(m.slice(1,-1));return m});if(s)out.push(s);return _});
 return out.join('\n').trim();
}
function textToRecords(text=''){
 const lines=String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!lines.length)return[];
 const sep=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':lines[0].includes(',')?',':null;
 if(sep){const rows=parseDelimited(lines.join('\n'),sep);return delimitedObjects(rows)}
 return lines.map((line,i)=>({row:i+1,text:line}));
}
let LOCAL_OCR_ADAPTER=null,LOCAL_XLS_ADAPTER=null;
function registerLocalOcrAdapter(fn){LOCAL_OCR_ADAPTER=typeof fn==='function'?fn:null}
function registerLocalXlsAdapter(fn){LOCAL_XLS_ADAPTER=typeof fn==='function'?fn:null}
async function ocrImageLocal(input,mime='image/png'){
 if(LOCAL_OCR_ADAPTER)return await LOCAL_OCR_ADAPTER(bytes(input),mime);
 if(typeof TextDetector!=='undefined'&&typeof createImageBitmap==='function'){
   const bmp=await createImageBitmap(new Blob([bytes(input)],{type:mime})),det=new TextDetector(),found=await det.detect(bmp);bmp.close?.();return(found||[]).map(x=>x.rawValue||'').filter(Boolean).join('\n');
 }
 throw new Error('LOCAL_OCR_ENGINE_UNAVAILABLE');
}
async function parseExtended(input,name='',mime=''){
 const b=bytes(input),fmt=detectFormat(b,name);
 if(['JSON','XML','CSV','TSV'].includes(fmt))return parseDeterministic(b,name);
 if(fmt==='PDF'){const text=extractPdfTextBasic(b);if(text)return{format:'PDF_TEXT',text,records:textToRecords(text)};throw new Error('PDF_SCANNED_REQUIRES_LOCAL_OCR')}
 if(fmt==='PNG'||fmt==='JPEG'){const text=await ocrImageLocal(b,mime||`image/${fmt.toLowerCase()}`);return{format:`${fmt}_OCR`,text,records:textToRecords(text)}}
 if(fmt==='XLS'){if(!LOCAL_XLS_ADAPTER)throw new Error('LOCAL_XLS_ENGINE_UNAVAILABLE');const records=await LOCAL_XLS_ADAPTER(b,name);return{format:'XLS',records}}
 return{format:fmt,records:null,requiresAdapter:true};
}
g.WRITE_V10_INGESTION={VERSION,detectFormat,parseDelimited,parseJSON,parseXML,inferHeaders,delimitedObjects,safeZipEntries,parseDeterministic,extractPdfTextBasic,textToRecords,registerLocalOcrAdapter,registerLocalXlsAdapter,ocrImageLocal,parseExtended};
})(typeof window!=='undefined'?window:globalThis);