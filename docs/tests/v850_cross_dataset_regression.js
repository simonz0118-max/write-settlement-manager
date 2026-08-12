const fs=require('fs'),vm=require('vm'),assert=require('assert');const h=fs.readFileSync(process.argv[2],'utf8'),e=fs.readFileSync(process.argv[3],'utf8'),c={window:null,console};c.window=c;vm.createContext(c);vm.runInContext(h,c);vm.runInContext(e,c);const H=c.WRITE_HUMAN_WORKFLOW_V84,G=c.WRITE_EVIDENCE_GATE_V84;
function roles(items){return H.buildRecord({orderId:'T',country:'FRANCE',lineItems:items},{}).items.map(x=>[x.family,x.componentRole,x.alias]);}
let r=roles([{productName:'Le Filet de camouflage / 3x4',quantity:1},{productName:'Kit de fixation complet - Suspendu',quantity:2}]);assert.equal(r[1][1],'SEPARATE_UPSELL');
r=roles([{productName:'Stylo éternel',quantity:3},{productName:'Lot de 6 Mines colorées',quantity:4}]);assert.equal(r[1][1],'SEPARATE_UPSELL');
r=roles([{productName:'Savon Citron',quantity:2},{productName:'Baume pieds',quantity:1},{productName:'Sachet moussant exfoliant',quantity:1}]);assert.equal(r[0][1],'PACKAGE_COMPONENT');assert.equal(r[1][1],'PACKAGE_COMPONENT');assert.equal(r[2][1],'FREE_GIFT');
r=roles([{productName:'Gelée au collagène - Fraise',quantity:2},{productName:'Chemise Homme Bleu XL',quantity:1},{productName:'Gilet Kryonify Noir',quantity:1}]);assert.equal(r[0][0],'COLLAGEN_JELLY');assert.equal(r[1][0],'CHEMISE');assert.equal(r[2][0],'GILET');
assert(!G.classify({sourceMatched:false,factQuantity:5}).trainable);
assert(!G.classify({sourceMatched:true,sourceQuantity:8,factQuantity:10,configurationClosed:true}).trainable);
console.log('V8.5 cross-dataset regression firewall PASS');