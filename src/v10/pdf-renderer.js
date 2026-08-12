/* WRITE V10 print-faithful Unicode PDF renderer. Text is rasterized to keep Chinese/French intact. */
(function(g){'use strict';const VERSION='10.0.0';
const esc=s=>String(s??'').replace(/\s+/g,' ').trim();
function bytes(s){return new TextEncoder().encode(s)}
function concat(parts){const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out}
function canvasBlob(canvas,type='image/jpeg',quality=.94){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PDF 页面渲染失败')),type,quality))}
async function logoImage(){return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='./assets/panda-logo-c-image2.png'})}
function line(ctx,x1,y1,x2,y2,w=1,color='#111'){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function text(ctx,s,x,y,size=16,weight=400,align='left',color='#111'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans CJK SC",Arial,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(esc(s),x,y)}
function fittedText(ctx,s,x,y,maxWidth,size=14,color='#111'){
 let value=esc(s),font=size;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=color;
 while(font>9){ctx.font=`400 ${font}px -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans CJK SC",Arial,sans-serif`;if(ctx.measureText(value).width<=maxWidth)break;font--}
 if(ctx.measureText(value).width<=maxWidth){ctx.fillText(value,x,y);return}
 const words=value.split(' '),lines=[''];for(const word of words){const tryLine=(lines[lines.length-1]+' '+word).trim();if(ctx.measureText(tryLine).width<=maxWidth||!lines[lines.length-1])lines[lines.length-1]=tryLine;else if(lines.length<2)lines.push(word);else{lines[1]+=' '+word}}
 if(ctx.measureText(lines[1]||'').width>maxWidth){while(lines[1].length&&ctx.measureText(lines[1]+'…').width>maxWidth)lines[1]=lines[1].slice(0,-1);lines[1]+='…'}
 lines.forEach((lineText,i)=>ctx.fillText(lineText,x,y+(i-(lines.length-1)/2)*15));
}
function renderPage(rows,meta,page,pageCount,logo){
 const c=document.createElement('canvas');c.width=1240;c.height=1754;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
 if(logo)x.drawImage(logo,90,70,155,105);text(x,'WRITE HERE',1110,92,18,700,'right');text(x,'FACTURE / FACT',1110,132,30,700,'right');
 text(x,esc(meta.company||'WRITE'),90,220,22,700);text(x,esc(meta.address||''),90,254,15);text(x,`FACT - AUTO    ${new Date().toLocaleDateString('fr-FR')}`,1110,228,17,600,'right');
 const cols=[90,160,300,745,855,955,1055,1150],top=330,head=52,rowH=52;const headers=['No','Description','Quantity','COGs','Shipping','COGs + Shipping','Amount'];
 x.fillStyle='#ececec';x.fillRect(cols[0],top,cols[7]-cols[0],head);for(let i=0;i<headers.length;i++)text(x,headers[i],(cols[i]+cols[i+1])/2,top+head/2,14,700,'center');
 let y=top+head,lastCountry='';for(const r of rows){if(r.country!==lastCountry){x.fillStyle='#f5f5f5';x.fillRect(cols[0],y,cols[7]-cols[0],36);text(x,r.country,cols[0]+12,y+18,16,700);y+=36;lastCountry=r.country}
  const red=!!r.needsReview;x.fillStyle=red?'#ffc7ce':'#fff';x.fillRect(cols[1],y,cols[2]-cols[1],rowH);x.fillStyle='#ffc7ce';x.fillRect(cols[4],y,cols[7]-cols[4],rowH);
  text(x,r.no,(cols[1]+cols[2])/2,y+rowH/2,14,400,'center');fittedText(x,r.description,cols[2]+10,y+rowH/2,cols[3]-cols[2]-20,14,red?'#9c0006':'#111');text(x,r.quantity,(cols[3]+cols[4])/2,y+rowH/2,14,400,'center');y+=rowH}
 x.fillStyle=meta.parcelNeedsReview?'#ffc7ce':'#eee';x.fillRect(cols[0],y,cols[4]-cols[0],rowH);x.fillStyle='#ffc7ce';x.fillRect(cols[4],y,cols[7]-cols[4],rowH);text(x,'Total colis',cols[1]+10,y+rowH/2,16,700);text(x,meta.parcelCount,(cols[3]+cols[4])/2,y+rowH/2,16,700,'center',meta.parcelNeedsReview?'#9c0006':'#111');
 const bottom=y+rowH;for(const cx of cols)line(x,cx,top,cx,bottom,1,'#333');for(let yy=top;yy<=bottom;yy+=rowH)line(x,cols[0],yy,cols[7],yy,1,'#333');line(x,cols[0],bottom,cols[7],bottom,1,'#333');
 const footer=['ATTENTION : Notre compte bancaire est un Compte Business','Pour le règlement, merci de faire un virement en EUROS','Voici les Coordonnées de notre compte bancaire :','IBAN: LU534080000098001475','SWIFT : BCIRLULL','Account Name: JINRIYANGTIAN DIANZISHANGWU SHENZHEN YOUXIANGONGSI','Bank Name: Banking Circle S.A.','Bank Address: 2, Boulevard de la Foire L-1528','Country : LUXEMBOURG','Type of Account: Business account'];
 footer.forEach((value,i)=>text(x,value,90,1430+i*21,i===0?13:12,i===0?700:400));text(x,`${page}/${pageCount}`,1110,1680,13,400,'right');return c
}
function pdfFromJpegs(images){
 const count=images.length,objects=[],pageIds=[];let next=3;for(let i=0;i<count;i++){pageIds.push(next);next+=3}const catalog=1,pages=2;
 objects[catalog]=bytes('<< /Type /Catalog /Pages 2 0 R >>');objects[pages]=bytes(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${count} >>`);
 for(let i=0;i<count;i++){const pageId=pageIds[i],imageId=pageId+1,contentId=pageId+2,img=images[i],content=bytes('q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n');objects[pageId]=bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);objects[imageId]=concat([bytes(`<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`),img,bytes('\nendstream')]);objects[contentId]=concat([bytes(`<< /Length ${content.length} >>\nstream\n`),content,bytes('endstream')])}
 const parts=[bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=[0];let offset=parts[0].length;for(let id=1;id<objects.length;id++){offsets[id]=offset;const part=concat([bytes(`${id} 0 obj\n`),objects[id],bytes('\nendobj\n')]);parts.push(part);offset+=part.length}const xref=offset;let table=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)table+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;parts.push(bytes(table+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));return new Blob(parts,{type:'application/pdf'})
}
async function buildPdfBlob(rows=[],meta={}){const logo=await logoImage(),perPage=18,pages=[];for(let i=0;i<Math.max(1,Math.ceil(rows.length/perPage));i++){const chunk=rows.slice(i*perPage,(i+1)*perPage),canvas=renderPage(chunk,{...meta,parcelCount:meta.parcelCount??rows.parcelCount??0,parcelNeedsReview:meta.parcelNeedsReview??rows.parcelNeedsReview??false},i+1,Math.max(1,Math.ceil(rows.length/perPage)),logo),blob=await canvasBlob(canvas);pages.push(new Uint8Array(await blob.arrayBuffer()))}return pdfFromJpegs(pages)}
g.WRITE_V10_PDF={VERSION,buildPdfBlob};
})(window);
