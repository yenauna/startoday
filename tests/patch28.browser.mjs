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
 const before=await page.evaluate(async()=>{const {store,state}=await import('/js/shared/state.js');store.db.students[0].avatarOwned=['star-hat'];store.db.students[0].avatarEquipped={'머리':'star-hat'};state.impersonatingStudentId=store.db.students[0].id;state.viewMode='student';(await import('/js/app.js')).render();return JSON.stringify(store.db);});
 const character=page.getByRole('button',{name:'캐릭터 인사',exact:true});await character.waitFor();
 // A breathing target never becomes geometrically stable; send actual touchscreen input.
 const tapCharacter=async()=>{await character.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));const box=await character.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);};
 assert.equal(await character.evaluate(el=>el.closest('[aria-hidden=true]')),null);
 let css=await character.evaluate(el=>({name:getComputedStyle(el).animationName,duration:getComputedStyle(el).animationDuration,origin:getComputedStyle(el).transformOrigin,shadow:getComputedStyle(el,'::before').animationName,cursor:getComputedStyle(el).cursor}));
 assert.equal(css.name,'st-character-breathe');assert.equal(css.duration,'3.2s');assert.equal(css.shadow,'st-character-shadow');assert.equal(css.cursor,'pointer');
 const idle=await character.evaluate(el=>{
  const animation=el.getAnimations().find(a=>a.animationName==='st-character-breathe');animation.pause();
  const sample=time=>{animation.currentTime=time;const m=new DOMMatrix(getComputedStyle(el).transform);return{y:m.m42,x:Math.hypot(m.m11,m.m12),sy:Math.hypot(m.m21,m.m22),angle:Math.atan2(m.m12,m.m11)*180/Math.PI};};
  return{peak:sample(1600),left:sample(800),right:sample(2400)};
 });
 assert.ok(Math.abs(idle.peak.y+5)<.1);assert.ok(Math.abs(idle.peak.x-.985)<.001);assert.ok(Math.abs(idle.peak.sy-1.025)<.001);assert.ok(Math.abs(idle.left.angle+1.2)<.01);assert.ok(Math.abs(idle.right.angle-1.2)<.01);
 await tapCharacter();assert.equal(await character.evaluate(el=>el.classList.contains('is-bouncing')),true);
 const greeting=character.locator('.student-character-greeting');assert.ok(['👋 안녕!','✨ 반가워!','🌟 오늘도 화이팅!','😊 좋은 하루!'].includes(await greeting.innerText()));
 const jumped=await character.evaluate(el=>{
  const animation=el.getAnimations().find(a=>a.animationName==='st-character-bounce');animation.pause();
  const sample=time=>{animation.currentTime=time;const m=new DOMMatrix(getComputedStyle(el).transform);return{y:m.m42,angle:Math.atan2(m.m12,m.m11)*180/Math.PI};};
  const first=sample(315),image=el.querySelector('img').getBoundingClientRect(),stage=el.closest('.student-character-scene').getBoundingClientRect(),second=sample(675);
  const bubble=el.querySelector('.student-character-greeting'),a=bubble.getAnimations()[0];a.pause();a.currentTime=300;
  const shadow=el.getAnimations({subtree:true}).find(a=>a.animationName==='st-character-greeting-shadow');shadow.pause();shadow.currentTime=315;const shadowStyle=getComputedStyle(el,'::before'),shadowScale=new DOMMatrix(shadowStyle.transform).m11,shadowOpacity=Number(shadowStyle.opacity);
  return{first,second,shadowScale,shadowOpacity,headroom:image.top-stage.top,bubble:getComputedStyle(bubble).animationName,duration:getComputedStyle(el).animationDuration,gear:el.querySelector('.student-character-equipment img').closest('.student-character-layers')===el};
 });
 assert.ok(Math.abs(jumped.first.y+16)<.1);assert.ok(Math.abs(jumped.first.angle+6)<.01);assert.ok(Math.abs(jumped.second.y+8)<.1);assert.ok(Math.abs(jumped.second.angle-5)<.01);assert.ok(jumped.headroom>=0);assert.equal(jumped.bubble,'st-character-greeting');assert.equal(jumped.duration,'0.9s');assert.equal(jumped.gear,true);assert.ok(Math.abs(jumped.shadowScale-.85)<.001);assert.ok(Math.abs(jumped.shadowOpacity-.26)<.001);
 // Clicking during the running animation creates a new animation and resets its clock.
 const restart=await character.evaluate(el=>{
  const previous=el.getAnimations().find(a=>a.animationName==='st-character-bounce');el.click();
  const next=el.getAnimations().find(a=>a.animationName==='st-character-bounce');return {changed:previous!==next,time:next.currentTime};
 });assert.equal(restart.changed,true);assert.ok(restart.time<100);
 await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 assert.equal(await character.evaluate(el=>getComputedStyle(el).animationName),'st-character-breathe');
 for(const key of ['Enter','Space']){
  await character.focus();await page.keyboard.press(key);assert.equal(await character.evaluate(el=>el.classList.contains('is-bouncing')),true);
  await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 }
 for(const width of [360,390,768,1280]){
  await page.setViewportSize({width,height:1000});await tapCharacter();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const bounds=await character.evaluate(el=>{
    const a=el.getAnimations().find(a=>a.animationName==='st-character-bounce');a.pause();a.currentTime=675;
    const bubble=el.querySelector('.student-character-greeting');bubble.textContent='🌟 오늘도 화이팅!';const animation=bubble.getAnimations()[0];animation.pause();animation.currentTime=300;
    const stage=el.closest('.student-character-scene').getBoundingClientRect(),b=bubble.getBoundingClientRect(),im=el.querySelector('.student-profile-image').getBoundingClientRect();
    return {left:b.left-stage.left,right:stage.right-b.right,top:b.top-stage.top,headroom:im.top-stage.top};
  });assert.ok(bounds.left>=0&&bounds.right>=0&&bounds.top>=0&&bounds.headroom>=0,JSON.stringify({width,bounds}));
  if(width===390)await page.screenshot({path:'/tmp/student-greeting.png'});
  await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await character.evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await character.evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
 await tapCharacter();assert.equal(await character.evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await character.locator('.student-character-greeting').isVisible(),false);
 await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 // Repeated pointer input must not select art, start native image drag, or show a mouse focus ring.
 const selectionStyles=await page.locator('.student-avatar-stage,.student-character-layers,.student-profile-image,.student-character-greeting').evaluateAll(nodes=>nodes.map(el=>({select:getComputedStyle(el).userSelect,tap:getComputedStyle(el).webkitTapHighlightColor})));
 assert.ok(selectionStyles.every(style=>style.select==='none'&&style.tap==='rgba(0, 0, 0, 0)'));
 assert.equal(await character.locator('.student-profile-image').getAttribute('draggable'),'false');
 assert.equal(await character.locator('.student-profile-image').evaluate(el=>el.draggable),false);
 assert.equal(await character.locator('.student-profile-image').evaluate(el=>getComputedStyle(el).webkitUserDrag),'none');
 await character.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 let box=await character.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{clickCount:3});
 assert.equal(await page.evaluate(()=>getSelection().toString()),'');
 assert.equal(await character.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 await page.evaluate(()=>{window.avatarDragStarts=0;document.addEventListener('dragstart',event=>{if(event.target.matches('.student-profile-image'))window.avatarDragStarts++;});});
 const image=await character.locator('.student-profile-image').boundingBox();
 await page.mouse.move(image.x+image.width/2,image.y+image.height/2);await page.mouse.down();await page.mouse.move(image.x+image.width/2+70,image.y+image.height/2-35,{steps:8});await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.avatarDragStarts),0);assert.equal(await page.evaluate(()=>getSelection().toString()),'');
 await page.waitForFunction(()=>!document.querySelector('.student-character-layers').classList.contains('is-bouncing'));
 await page.getByRole('button',{name:'아바타 옷장',exact:true}).focus();await page.keyboard.press('Tab');
 assert.equal(await character.evaluate(el=>document.activeElement===el),true);
 assert.equal(await character.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
 assert.equal(await character.evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
 assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/shared/state.js')).store.db)),before);
 await page.emulateMedia({reducedMotion:'no-preference'});await tapCharacter();
 // Navigating away during a bounce must leave no timer errors or duplicate greeting bubbles on return.
 await page.getByRole('button',{name:'경제',exact:true}).click();await page.getByRole('button',{name:'별빛 교실',exact:true}).click();
 assert.equal(await page.locator('.student-character-greeting').count(),1);
 assert.equal(await character.evaluate(el=>el.classList.contains('is-bouncing')),false);
 await page.screenshot({path:'/tmp/patch28-profile.png',fullPage:false});
 assert.deepEqual(errors,[]);console.log('PASS: selection/tap highlight/image drag blocked, mouse ring hidden/keyboard ring retained, exact sway/breath/two-hop greeting transforms, linked shadow, random greeting, 900ms cleanup/restart, native touch/Enter/Space, jump headroom, responsive widths, reduced motion and no data mutation/navigation timer errors');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
