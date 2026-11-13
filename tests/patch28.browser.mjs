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
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:1000},hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const before=await page.evaluate(async()=>{const {store,state}=await import('/js/shared/state.js');state.impersonatingStudentId=store.db.students[0].id;state.viewMode='student';(await import('/js/app.js')).render();return JSON.stringify(store.db);});
 const character=page.getByRole('button',{name:'캐릭터 점프',exact:true});await character.waitFor();
 // A breathing target never becomes geometrically stable; send actual touchscreen input.
 const tapCharacter=async()=>{await character.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));const box=await character.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);};
 assert.equal(await character.evaluate(el=>el.closest('[aria-hidden=true]')),null);
 let css=await character.evaluate(el=>({name:getComputedStyle(el).animationName,duration:getComputedStyle(el).animationDuration,origin:getComputedStyle(el).transformOrigin,shadow:getComputedStyle(el,'::before').animationName,cursor:getComputedStyle(el).cursor}));
 assert.equal(css.name,'st-character-breathe');assert.equal(css.duration,'3.2s');assert.equal(css.shadow,'st-character-shadow');assert.equal(css.cursor,'pointer');
 const idle=await character.evaluate(el=>{
  const animation=el.getAnimations().find(a=>a.animationName==='st-character-breathe');animation.pause();animation.currentTime=1600;
  const style=getComputedStyle(el),matrix=new DOMMatrix(style.transform);
  return{y:matrix.m42,x:matrix.m11,sy:matrix.m22};
 });
 assert.ok(Math.abs(idle.y+4)<.1);assert.ok(Math.abs(idle.x-.99)<.001);assert.ok(Math.abs(idle.sy-1.02)<.001);
 await tapCharacter();assert.equal(await character.evaluate(el=>el.classList.contains('is-bouncing')),true);
 const jumped=await character.evaluate(el=>{
  const animation=el.getAnimations().find(a=>a.animationName==='st-character-bounce');animation.pause();animation.currentTime=292.5;
  const matrix=new DOMMatrix(getComputedStyle(el).transform),image=el.querySelector('img').getBoundingClientRect(),stage=el.closest('.student-character-scene').getBoundingClientRect();
  return{y:matrix.m42,x:matrix.m11,sy:matrix.m22,headroom:image.top-stage.top,spark:getComputedStyle(el.querySelector('.student-character-sparkle')).animationName};
 });
 assert.ok(Math.abs(jumped.y+18)<.1);assert.ok(Math.abs(jumped.x-.94)<.001);assert.ok(Math.abs(jumped.sy-1.08)<.001);assert.ok(jumped.headroom>=0);assert.equal(jumped.spark,'st-character-sparkle');
 const sparkle=await character.evaluate(el=>{
  const spark=el.querySelector('.student-character-sparkle'),animation=spark.getAnimations()[0];
  animation.pause();animation.currentTime=0;
  const start=new DOMMatrix(getComputedStyle(spark).transform),style=getComputedStyle(spark);
  const top=parseFloat(style.top)/el.clientHeight,right=parseFloat(style.right)/el.clientWidth;
  animation.currentTime=650;const end=new DOMMatrix(getComputedStyle(spark).transform);
  return{top,right,startX:start.m41,startY:start.m42,startScale:Math.hypot(start.m11,start.m12),startAngle:Math.atan2(start.m12,start.m11)*180/Math.PI,endX:end.m41,endY:end.m42,endScale:Math.hypot(end.m11,end.m12),endAngle:Math.atan2(end.m12,end.m11)*180/Math.PI};
 });
 assert.ok(Math.abs(sparkle.top-.14)<.01&&Math.abs(sparkle.right-.18)<.01);
 assert.equal(sparkle.startX,0);assert.equal(sparkle.startY,0);assert.ok(Math.abs(sparkle.startScale-.6)<.001);assert.ok(Math.abs(sparkle.startAngle+10)<.01);
 assert.equal(sparkle.endX,12);assert.equal(sparkle.endY,-24);assert.ok(Math.abs(sparkle.endScale-1.1)<.001);assert.ok(Math.abs(sparkle.endAngle-15)<.01);
 await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 assert.equal(await character.evaluate(el=>getComputedStyle(el).animationName),'st-character-breathe');
 for(const key of ['Enter','Space']){
  await character.focus();await page.keyboard.press(key);assert.equal(await character.evaluate(el=>el.classList.contains('is-bouncing')),true);
  await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 }
 for(const width of [360,390,768,1280]){
  await page.setViewportSize({width,height:1000});await tapCharacter();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await character.evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await character.evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
 await tapCharacter();assert.equal(await character.evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await character.locator('.student-character-sparkle').isVisible(),false);
 await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 // Repeated pointer input must not select art, start native image drag, or show a mouse focus ring.
 const selectionStyles=await page.locator('.student-avatar-stage,.student-character-layers,.student-profile-image,.student-character-sparkle').evaluateAll(nodes=>nodes.map(el=>({select:getComputedStyle(el).userSelect,tap:getComputedStyle(el).webkitTapHighlightColor})));
 assert.ok(selectionStyles.every(style=>style.select==='none'&&style.tap==='rgba(0, 0, 0, 0)'));
 assert.equal(await character.locator('img').getAttribute('draggable'),'false');
 assert.equal(await character.locator('img').evaluate(el=>el.draggable),false);
 assert.equal(await character.locator('img').evaluate(el=>getComputedStyle(el).webkitUserDrag),'none');
 await character.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 let box=await character.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{clickCount:3});
 assert.equal(await page.evaluate(()=>getSelection().toString()),'');
 assert.equal(await character.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 await page.evaluate(()=>{window.avatarDragStarts=0;document.addEventListener('dragstart',event=>{if(event.target.matches('.student-profile-image'))window.avatarDragStarts++;});});
 const image=await character.locator('img').boundingBox();
 await page.mouse.move(image.x+image.width/2,image.y+image.height/2);await page.mouse.down();await page.mouse.move(image.x+image.width/2+70,image.y+image.height/2-35,{steps:8});await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.avatarDragStarts),0);assert.equal(await page.evaluate(()=>getSelection().toString()),'');
 await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 await page.getByRole('button',{name:'별명 설정',exact:true}).focus();await page.keyboard.press('Tab');
 assert.equal(await character.evaluate(el=>document.activeElement===el),true);
 assert.equal(await character.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
 assert.equal(await character.evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
 assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/shared/state.js')).store.db)),before);
 await page.emulateMedia({reducedMotion:'no-preference'});await tapCharacter();
 // Navigating away during a bounce must leave no timer errors or duplicate sparkles on return.
 await page.getByRole('button',{name:'경제',exact:true}).click();await page.getByRole('button',{name:'별빛 교실',exact:true}).click();
 assert.equal(await page.locator('.student-character-sparkle').count(),1);
 assert.equal(await character.evaluate(el=>el.classList.contains('is-bouncing')),false);
 await page.screenshot({path:'/tmp/patch28-profile.png',fullPage:false});
 assert.deepEqual(errors,[]);console.log('PASS: selection/tap highlight/image drag blocked, mouse ring hidden/keyboard ring retained, exact idle/bounce transforms, linked shadow, sparkle, 650ms cleanup/restart, native touch/Enter/Space, jump headroom, responsive widths, reduced motion and no data mutation/navigation timer errors');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
