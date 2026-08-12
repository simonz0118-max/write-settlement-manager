const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');const c={window:null,console};c.window=c;vm.createContext(c);vm.runInContext(src,c);const H=c.WRITE_HUMAN_WORKFLOW_V84;
function rec(items){return H.buildRecord({orderId:'1',country:'FRANCE',lineItems:items},{})}
// YD: accessory is separate upsell.
let r=rec([{productName:'Le Filet de camouflage / 3x4',quantity:1},{productName:'Kit de fixation complet - Suspendu',quantity:2}]);
assert.equal(r.items[0].componentRole,'PACKAGE_COMPONENT');assert.equal(r.items[1].componentRole,'SEPARATE_UPSELL');
// Pencil: refill is separate upsell.
r=rec([{productName:'Stylo éternel',quantity:3},{productName:'Lot de 6 Mines colorées',quantity:2}]);
assert.equal(r.items[0].componentRole,'PACKAGE_COMPONENT');assert.equal(r.items[1].componentRole,'SEPARATE_UPSELL');
// Soap: balm/nail/towel stay inside package configuration.
r=rec([{productName:'Savon Citron',quantity:2},{productName:'Baume Pieds',quantity:1},{productName:'Ongles soin',quantity:1},{productName:'Serviette',quantity:1}]);
assert(r.items.every(x=>x.componentRole==='PACKAGE_COMPONENT'));
const cfg=H.configuration(r);assert(/Savon \*2/.test(cfg.description)&&/Baume/.test(cfg.description)&&/Ongles/.test(cfg.description)&&/Serviette/.test(cfg.description));
// Archived jelly: flavor text collapses to accounting family/alias.
r=rec([{productName:'Gelée au collagène - Fraise',quantity:4}]);assert.equal(r.items[0].family,'COLLAGEN_JELLY');assert.equal(r.items[0].alias,'Gelée au collagène');
console.log('V8.4 cross-dataset role learning PASS');