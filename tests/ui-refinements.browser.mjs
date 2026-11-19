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
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const [width,height,touch] of [[1280,900,false],[412,891,true],[1920,1080,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  await page.evaluate(async()=>{
   const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');
   const d=C.initialDB();d.students=[{id:'ui-short',no:1,name:'김가온',nickname:'우주고래별빛'},{id:'ui-second',no:2,name:'이나래',nickname:'반짝별'}];
   d.records=[{id:'ui-record',date:C.today(),createdAt:C.now(),kind:'관찰',text:'홀드 정렬 확인',studentIds:['ui-short'],areas:[]}];d.attendance=[];store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.selected=[];(await import('/js/app.js')).navigate('대시보드');
  });
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const composer=page.locator('.quick-composer-card');const before=await composer.boundingBox();
  await page.locator('#quick-text').fill('이름만 표시하고 기록은 유지');await page.locator('#quick-student-query').fill('1');await page.locator('#quick-student-query').press('Enter');
  const after=await composer.boundingBox();assert(Math.abs(before.width-after.width)<1);assert(Math.abs(before.x-after.x)<1);assert(Math.abs(before.y-after.y)<1);
  assert.notEqual(await composer.evaluate(e=>getComputedStyle(e).position),'fixed');
  assert.equal(await page.locator('.selection-chip-name').innerText(),'1. 김가온');assert(!(await page.locator('#quick-students').innerText()).includes('우주고래'));
  assert.equal(await page.locator('#quick-text').inputValue(),'이름만 표시하고 기록은 유지');
  assert.equal(await page.locator('.tabs button').first().evaluate(e=>getComputedStyle(e).borderRadius),'10px');
  await noOverflow();await page.waitForTimeout(850);await page.screenshot({path:`/tmp/ui-refinements-selection-${width}.png`});
  await page.getByRole('button',{name:'✕ 선택 취소',exact:true}).click();
  await page.evaluate(async()=>(await import('/js/app.js')).navigate('기록'));
  const hold=page.locator('[data-record-id="ui-record"] .hold-delete');await hold.waitFor();await hold.scrollIntoViewIfNeeded();
  assert.equal(await hold.evaluate(e=>getComputedStyle(e).borderRadius),'999px');assert.equal(await hold.evaluate(e=>getComputedStyle(e).borderWidth),'0px');
  assert.equal(await hold.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(241, 245, 249)');
  const dims=await hold.boundingBox();assert(dims.width>=58&&dims.height>=30);
  const labels=await hold.locator('.label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));assert.deepEqual(labels[0],labels[1]);
  await hold.hover();assert.equal(await hold.evaluate(e=>getComputedStyle(e).transform),'none');
  await hold.dispatchEvent('pointerdown',{button:0,pointerId:7,isPrimary:true,pointerType:touch?'touch':'mouse'});await page.waitForTimeout(650);
  const matrix=await hold.evaluate(e=>{const m=new DOMMatrix(getComputedStyle(e).transform);return{scale:m.a,y:m.f,z:e.style.zIndex};});
  assert(Math.abs(matrix.scale-1.3)<.02,JSON.stringify(matrix));assert(Math.abs(matrix.y+4)<.3,JSON.stringify(matrix));assert.equal(matrix.z,'20');
  await page.screenshot({path:`/tmp/ui-refinements-hold-${width}.png`});
  await hold.dispatchEvent('pointerup',{pointerId:7});await page.waitForTimeout(2400);
  assert.equal(await hold.evaluate(e=>e.style.transform),'');assert.equal(await hold.evaluate(e=>e.style.zIndex),'');
  assert.equal(await hold.locator('.fill').evaluate(e=>e.style.width),'0px');
  await page.evaluate(async()=>(await import('/js/app.js')).navigate('설정'));
  await page.locator('[data-settings-tab="교실화면"]').click();
  const checkbox=page.locator('input[name=classroomShowScores]');
  const style=await checkbox.evaluate(e=>{const s=getComputedStyle(e);return{appearance:s.appearance,width:s.width,height:s.height,radius:s.borderRadius};});
  assert.deepEqual(style,{appearance:'none',width:'18px',height:'18px',radius:'5px'});
  const initial=await checkbox.isChecked();await checkbox.focus();await page.keyboard.press(' ');await page.waitForTimeout(350);assert.equal(await checkbox.isChecked(),!initial);
  const checked=await checkbox.evaluate(e=>({checked:e.checked,transform:getComputedStyle(e,'::before').transform}));assert(checked.transform.includes(checked.checked?'matrix(1,':'matrix(0,'));
  // Custom switch and hidden chip inputs are exempt from the generic treatment.
  const custom=await page.evaluate(()=>{
   const label=document.createElement('label');label.className='student-choice-chip';label.innerHTML='<input type="checkbox"><span>별도 선택 칩</span>';
   document.body.append(label);const input=label.querySelector('input'),s=getComputedStyle(input);const result={width:s.width,opacity:s.opacity};label.remove();return result;
  });assert.deepEqual(custom,{width:'1px',opacity:'0'});
  await noOverflow();await page.screenshot({path:`/tmp/ui-refinements-checkbox-${width}.png`});
  await page.evaluate(async()=>(await import('/js/app.js')).navigate('수업도구'));await page.getByRole('button',{name:'🎲 랜덤뽑기',exact:true}).click();await page.locator('.tools-drawer-toggle').click();const widget=page.locator('[data-tool-type=random]');await widget.getByLabel('캔버스 꽉 채우기/복원').click();await widget.getByLabel('뽑기 연출').selectOption('cards');
  const card=widget.locator('.tool-draw-card');assert.equal(await card.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 253, 247)');
  assert.equal(await card.evaluate(e=>getComputedStyle(e,'::before').backgroundImage),'none');
  await card.click();await page.waitForFunction(()=>!document.querySelector('.card-reveal-fast'));assert.equal(await card.locator('.tool-card-face').innerText().then(Boolean),true);
  await noOverflow();await page.screenshot({path:`/tmp/ui-refinements-card-${width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{const input=document.createElement('input');input.type='checkbox';input.id='reduced-checkbox';document.body.append(input);});
  assert.equal(await page.locator('#reduced-checkbox').evaluate(e=>getComputedStyle(e,'::before').transitionDuration),'0s');
  assert.deepEqual(errors,[]);console.log(`PASS ${width} touch=${touch}: stable composer/name-only pills, squared tabs, aligned 1.3x lifted hold, custom checkboxes/exemptions, cream card and no overflow`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
