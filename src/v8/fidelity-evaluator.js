/* WRITE V8.3 Classification Fidelity Evaluator */
(function(g){'use strict';
const VERSION='8.3.1';
const clean=v=>String(v??'').replace(/\r/g,'\n').split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
function roleOf(row){if(row?.role)return String(row.role).toUpperCase();return /\s+UPSELL\s*$/i.test(clean(row?.description))?'UPSELL':'MAIN'}
function normLine(line){let s=String(line||'').replace(/\s+UPSELL\s*$/i,'').trim();s=s.replace(/\s*\/\s*/g,' / ').replace(/\s+-\s+/g,' - ');s=s.replace(/Triangulaire\s+(?=\d)/i,'Triangulaire / ');s=s.replace(/Triangulaire\s*\/\s*/i,'Triangulaire / ');s=s.replace(/\s+/g,' ').trim();return s}
function configuration(row){const lines=clean(row?.description).split('\n').map(normLine).filter(Boolean);return lines.sort((a,b)=>a.localeCompare(b,'fr',{numeric:true,sensitivity:'base'})).join(' + ')}
function sem(row){return{country:String(row?.country||'GLOBAL').toUpperCase(),role:roleOf(row),configuration:configuration(row),quantity:Number(row?.quantity||0)}}
function kCountryRole(x){return`${x.country}\u0001${x.role}`}
function kConfig(x){return`${x.country}\u0001${x.role}\u0001${x.configuration}`}
function kFull(x){return`${kConfig(x)}\u0001${x.quantity}`}
function overlap(actual,expected,keyfn){const A=new Map(),E=new Map();actual.forEach(x=>A.set(keyfn(x),(A.get(keyfn(x))||0)+1));expected.forEach(x=>E.set(keyfn(x),(E.get(keyfn(x))||0)+1));let m=0;for(const[k,n]of E)m+=Math.min(n,A.get(k)||0);return{matched:m,total:expected.length,rate:expected.length?m/expected.length:1}}
function compare(actualRows=[],manualRows=[]){const a=actualRows.map(sem),e=manualRows.map(sem),full=overlap(a,e,kFull),cr=overlap(a,e,kCountryRole),cfg=overlap(a,e,kConfig);const A=new Map(),E=new Map();a.forEach(x=>A.set(kFull(x),(A.get(kFull(x))||0)+1));e.forEach(x=>E.set(kFull(x),(E.get(kFull(x))||0)+1));const missing=[],unexpected=[];for(const[k,n]of E){for(let i=0;i<n-(A.get(k)||0);i++)missing.push(k)}for(const[k,n]of A){for(let i=0;i<n-(E.get(k)||0);i++)unexpected.push(k)}return{version:VERSION,actualRows:a.length,expectedRows:e.length,countryRole:cr,configuration:cfg,full,missing,unexpected,exact:missing.length===0&&unexpected.length===0}}
g.WRITE_FIDELITY_V83={VERSION,roleOf,configuration,semanticRow:sem,compare};
})(window);