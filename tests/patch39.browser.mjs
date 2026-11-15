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
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.setViewportSize({width:1280,height:800});
 const seed=await page.evaluate(async()=>{
 const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');let d=C.initialDB();const date=C.today();d.students=Array.from({length:20},(_,i)=>({id:'s'+i,no:i+1,name:'학생'+(i+1)}));Object.assign(d.settings[0],{nameDisplayMode:'real',classroomShowScores:true,academicCalendar:{}});
 const title='수학 문제를 풀고 공책에 풀이 과정을 자세히 쓰기';d.assignments=[{id:'task39',title,date,repeat:{type:'none'},target:'all',memo:'풀이 과정을 빠짐없이 적어 주세요.'},{id:'next39',title:'내일 독서 감상문 작성',date:C.addDays(date,1),repeat:{type:'none'},target:'all',memo:'독서 노트를 준비하세요.'}];d.timetables=[{id:'slot39',date,period:1,subjectCode:'국어',publicMemo:'교과서 준비'}];store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.date=date;state.compact=false;(await import('/js/app.js')).navigate('대시보드');return{date,next:C.addDays(date,1)};
 });
 for(const width of [1280,412]){await page.setViewportSize({width,height:800});const r=await page.locator('.registered-schedule .slot-clock').first().evaluate(e=>({height:e.getBoundingClientRect().height,wrap:getComputedStyle(e).whiteSpace,right:e.getBoundingClientRect().right,parent:e.closest('.slot').getBoundingClientRect().right}));assert.equal(r.wrap,'nowrap');assert(r.height<24,JSON.stringify(r));assert(r.right<=r.parent,JSON.stringify(r));}
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('과제'));
 const task=page.locator(`.assignment-calendar [data-date="${seed.date}"] .assignment-calendar-task`);assert.equal(await task.count(),1);assert(await task.evaluate(e=>e.getBoundingClientRect().height<=26));assert.equal(await task.evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
 await page.locator(`.assignment-calendar [data-date="${seed.next}"] .day-head`).click();const detail=page.locator('.assignment-date-detail');assert.equal(await detail.getAttribute('data-date'),seed.next);assert.match(await detail.innerText(),/내일 독서 감상문 작성/);assert.match(await detail.innerText(),/독서 노트를 준비하세요/);assert.match(await detail.innerText(),/미완료 20\/20명/);assert(await detail.evaluate(e=>e.getBoundingClientRect().width>330));
 await detail.getByRole('button',{name:'관리',exact:true}).click();assert.equal(await page.locator('#modal[open]').count(),1);await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();await detail.getByRole('button',{name:'+ 과제 추가',exact:true}).click();assert.equal(await page.locator('#modal [name=date]').inputValue(),seed.next);await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();await page.screenshot({path:'/tmp/patch39-calendar-412.png',fullPage:true});
 await page.setViewportSize({width:1280,height:800});await page.evaluate(async()=>(await import('/js/tabs/classroom.js')).classroom());
 assert.equal(await page.locator('#class-tools').innerText(),'수업\n도구');assert.match(await page.locator('#lock-exit').innerText(),/🔓/);await page.waitForTimeout(300);
 const clipped=await page.locator('.classroom-student').evaluateAll(cards=>cards.map(c=>{const t=c.querySelector('.pending-tasks .task');return t&&{card:c.getBoundingClientRect().bottom,task:t.getBoundingClientRect().bottom,height:t.getBoundingClientRect().height,line:parseFloat(getComputedStyle(t).lineHeight),parent:t.parentElement.getBoundingClientRect().bottom};}).filter(x=>x&&(x.task>x.card-2||x.height<x.line*2+6||x.task>x.parent+1)));assert.deepEqual(clipped,[]);await page.screenshot({path:'/tmp/patch39-classroom-1280.png'});
 await page.locator('#lock-exit').click();assert.equal(await page.locator('.lockscreen').count(),1);await page.locator('#lock-exit').hover();await page.mouse.down();await page.waitForTimeout(1500);assert.equal(await page.locator('.lockscreen').count(),1);await page.mouse.up();await page.locator('#lock-exit').press('Control+Enter');assert.equal(await page.locator('.lockscreen').count(),1);await page.locator('#lock-exit').dblclick();assert.equal(await page.locator('.lockscreen').count(),0);
 await page.setViewportSize({width:412,height:915});await page.evaluate(async()=>(await import('/js/tabs/classroom.js')).classroom());
 const boxes=await page.evaluate(()=>['#class-clock','#lock-exit','#class-tools'].map(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;assert(!overlap(boxes[0],boxes[1]));assert(!overlap(boxes[0],boxes[2]));assert(boxes[2].right<=boxes[1].left);assert(boxes.every(b=>b.right<=412));await page.screenshot({path:'/tmp/patch39-classroom-412.png'});
 await page.locator('#class-tools').click();assert.equal(await page.locator('.tools-overlay').count(),1);await page.locator('.tools-overlay-close').click();assert.equal(await page.locator('.lockscreen').count(),1);
 const touch=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true}),mobile=await touch.newPage();await mobile.route('https://cdn.jsdelivr.net/**',r=>r.abort());await mobile.goto(`http://127.0.0.1:${server.address().port}`);await mobile.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();await mobile.evaluate(async()=>(await import('/js/tabs/classroom.js')).classroom());await mobile.locator('#lock-exit').tap();assert.equal(await mobile.locator('.lockscreen').count(),1);await mobile.locator('#lock-exit').tap();assert.equal(await mobile.locator('.lockscreen').count(),0);assert(await mobile.locator('article.student').count());await touch.close();assert.deepEqual(errors,[]);
 console.log('PASS: one-line schedule times, mobile selected-date assignment details/actions, double-click/two-tap-only unlock, control/clock separation and full two-line tasks at 1280×800');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
