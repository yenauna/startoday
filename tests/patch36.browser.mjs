import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.STARTODAY_CONFIG={};');return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');const s=store.db.students[0];await store.commit(C.teacherBalanceAdjustOps(store.db,s.id,50));for(const id of ['hair_1','outfit_1'])await store.commit(latest=>C.avatarOps(latest,s.id,id,'buy'));(await import('/js/tabs/student-view.js')).previewStudent(s.id);});
 await page.getByRole('button',{name:'아바타 옷장',exact:true}).click();
 async function checkThumb(id,category,scale){
  const card=page.locator(`[data-avatar-id=${id}]`);assert.equal(await card.getAttribute('data-avatar-category'),category);
  const metrics=await card.locator('.avatar-item-thumb img').evaluate(async img=>{
   await img.decode();const thumb=img.parentElement,r=thumb.getBoundingClientRect(),ir=img.getBoundingClientRect(),style=getComputedStyle(img),m=new DOMMatrix(style.transform);
   const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let top=canvas.height,bottom=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y);}
   const fit=Math.min(img.clientWidth/img.naturalWidth,img.clientHeight/img.naturalHeight),offset=(img.clientHeight-img.naturalHeight*fit)/2;
   const paintedTop=ir.top+(offset+top*fit)*m.m22,paintedBottom=ir.top+(offset+(bottom+1)*fit)*m.m22;
   return{height:r.height,overflow:getComputedStyle(thumb).overflow,scale:m.m11,origin:style.transformOrigin,paintedHeight:Math.max(0,Math.min(r.bottom,paintedBottom)-Math.max(r.top,paintedTop))/r.height,natural:[img.naturalWidth,img.naturalHeight],fit:style.objectFit};
  });
  assert.equal(metrics.height,108);assert.equal(metrics.overflow,'hidden');assert.equal(metrics.scale,scale);assert(metrics.paintedHeight>.8,JSON.stringify({id,metrics}));assert.deepEqual(metrics.natural,[939,1676]);assert.equal(metrics.fit,'contain');
 }
 for(const width of [360,390,1280]){
  await page.setViewportSize({width,height:1000});await checkThumb('hair_1','머리',2.15);await checkThumb('outfit_1','옷',1.65);
  const cards=await page.locator('.avatar-item').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,h:e.getBoundingClientRect().height})));assert.equal(cards[0].top,cards[1].top);assert(cards.every(c=>c.h<290));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(width===390)await page.locator('.avatar-catalog').screenshot({path:'/tmp/patch36-closet.png'});
 }
 await page.setViewportSize({width:390,height:1000});
 for(const [id,category,scale] of [['hair_1','머리',2.15],['outfit_1','옷',1.65]]){
  await page.getByRole('button',{name:'옷 가게',exact:true}).click();await page.getByRole('button',{name:category,exact:true}).click();await checkThumb(id,category,scale);await page.locator('.avatar-catalog').screenshot({path:`/tmp/patch36-shop-${id}.png`});
 }
 await page.getByRole('button',{name:'내 옷장',exact:true}).click();for(const id of ['hair_1','outfit_1']){await page.locator(`[data-avatar-id=${id}]`).getByRole('button',{name:'장착',exact:true}).click();await page.locator(`.student-character-scene [data-avatar-item=${id}]`).waitFor();}
 const layerTransforms=await page.locator('.student-character-equipment img').evaluateAll(es=>es.map(e=>({id:e.dataset.avatarItem,transform:getComputedStyle(e).transform,x:new DOMMatrix(getComputedStyle(e).transform).m11,y:new DOMMatrix(getComputedStyle(e).transform).m22})));
 assert.equal(layerTransforms.find(e=>e.id==='hair_1').transform,'none');const outfit=layerTransforms.find(e=>e.id==='outfit_1');
 assert.equal(outfit.x,1);assert.equal(outfit.y,1);
 const neck=await page.locator('.student-character-layers').evaluate(async el=>{
  const base=el.querySelector('.student-profile-image'),outfit=el.querySelector('[data-avatar-item=outfit_1]');await Promise.all([base.decode(),outfit.decode()]);
  const clip=getComputedStyle(base).clipPath,canvas=document.createElement('canvas');canvas.width=485;canvas.height=866;const ctx=canvas.getContext('2d');ctx.save();ctx.beginPath();ctx.rect(0,0,485,866*.53);ctx.clip();ctx.drawImage(base,0,0,485,866);ctx.restore();ctx.drawImage(outfit,0,0,485,866);
  const pixels=ctx.getImageData(242,Math.floor(866*.4),1,Math.ceil(866*.2)).data;let transparent=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]<32)transparent++;
  return{clip,transparent};
 });assert.equal(neck.clip,'inset(0px 0px 47%)');assert.equal(neck.transparent,0);
 await page.locator('.student-character-layers').screenshot({path:'/tmp/neck-outfit.png',animations:'disabled'});
 assert.deepEqual(errors,[]);console.log('PASS: original full-canvas PNGs unchanged; closet/shop cropped thumbnails fill >80% height; exact category scales, 108px clipping, two compact mobile cards and unchanged equipped layer transforms');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
