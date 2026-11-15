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
 const date=await page.evaluate(async()=>{const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');const date=C.today();Object.assign(store.db.settings[0],{className:'별빛초등학교 5학년 1반',academicCalendar:{}});store.db.events=[];store.db.assignments=[];store.db.timetables=[{id:'p40-1',date,period:1,subjectCode:'국어',publicMemo:'PUBLIC40 긴 안내사항 '.repeat(10),privateMemo:'TODAY40 당일 안내 '.repeat(10),teacherMemo:'SECRET40 교사 안내 '.repeat(10)},{id:'p40-2',date,period:2,subjectCode:'수학'},{id:'p40-3',date,period:3,subjectCode:'체육',teacherMemo:'PRIVATE40 교사만 메모'}];state.calendarDate=date;state.calendarMode='month';state.calendarFilters={events:true,time:true,tasks:true,detail:true};return date;});
 for(const width of [1280,1101,1100,890,412]){
  await page.setViewportSize({width,height:width===890?412:800});await page.evaluate(async()=>(await import('/js/tabs/classroom.js')).classroom());
  const rows=await page.evaluate(()=>['.classroom-brand','#class-clock','#class-tools','#lock-exit'].map(sel=>{const e=document.querySelector(sel),r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,inHeading:!!e.closest('.classroom-heading'),position:getComputedStyle(e).position};}));
  assert(rows.every(r=>r.inHeading&&r.position!=='fixed'));assert(Math.max(...rows.map(r=>r.top))<Math.min(...rows.map(r=>r.bottom)),JSON.stringify(rows));for(let i=1;i<rows.length;i++)assert(rows[i-1].right<=rows[i].left,JSON.stringify(rows));assert(rows.every(r=>r.left>=0&&r.right<=width),JSON.stringify(rows));assert.match(await page.locator('#class-clock').innerText(),/^(오전|오후) \d{1,2}:\d{2}:\d{2}$/);
  await page.screenshot({path:`/tmp/patch41-classroom-${width}.png`});await page.locator('#class-tools').click();assert.equal(await page.locator('.tools-overlay').count(),1);await page.locator('.tools-overlay-close').click();await page.locator('#lock-exit').dblclick();
  await page.evaluate(async()=>(await import('/js/app.js')).navigate('시간표·일정'));
  const first=page.locator(`[data-drag="${date}:1"]`).first(),second=page.locator(`[data-drag="${date}:2"]`).first(),third=page.locator(`[data-drag="${date}:3"]`).first();
  assert.equal(await first.locator('sup.slot-memo-indicator').count(),1);assert.equal(await second.locator('sup.slot-memo-indicator').count(),0);assert.equal(await third.locator('sup.slot-memo-indicator').count(),1);
  if(width<=1100){
   assert.equal(await first.locator('.slot-memos').isVisible(),false);assert.equal(await first.locator('sup').isVisible(),true);assert.equal(await first.locator('.subject-title').innerText(),'국어*');
   const geometry=await first.evaluate(e=>{const period=e.querySelector('.slot-period-row').getBoundingClientRect(),subject=e.querySelector('.subject-title').getBoundingClientRect();return{periodBottom:period.bottom,subjectTop:subject.top,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width};});assert(geometry.subjectTop>=geometry.periodBottom,JSON.stringify(geometry));assert(geometry.height<90,JSON.stringify(geometry));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await first.locator('.slot-main').click();assert.equal(await page.locator('#modal[open]').count(),1);await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
   await first.locator('..').getByRole('button',{name:'메모 상세',exact:true}).click();const text=await page.locator('#modal').innerText();for(const memo of ['PUBLIC40','TODAY40','SECRET40'])assert(text.includes(memo));assert.equal(await page.locator('#modal .slot-memos').first().isVisible(),true);await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
  }else{assert.equal(await first.locator('.slot-memos').isVisible(),true);assert.equal(await first.locator('sup').isVisible(),false);
   const wide=await first.evaluate(e=>{const title=e.querySelector('.slot-main').getBoundingClientRect(),m=e.querySelector('.slot-memos'),r=m.getBoundingClientRect();return{titleBottom:title.bottom,top:r.top,width:r.width,parent:e.querySelector('.slot-subject-row').getBoundingClientRect().width,height:r.height,lines:getComputedStyle(m.firstElementChild).webkitLineClamp};});assert(wide.top>=wide.titleBottom,JSON.stringify(wide));assert(Math.abs(wide.width-wide.parent)<2,JSON.stringify(wide));assert(wide.height<=120);assert.equal(wide.lines,'2');
   await first.locator('..').getByRole('button',{name:'메모 상세',exact:true}).click();for(const memo of ['PUBLIC40','TODAY40','SECRET40'])assert((await page.locator('#modal').innerText()).includes(memo));assert.equal(await page.locator('#modal .slot-memos').first().evaluate(e=>getComputedStyle(e).maxHeight),'none');await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
  }
  await page.screenshot({path:`/tmp/patch41-calendar-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS: 412/890/1100 compact month previews, 1101/1280 full-width bounded notes, period/subject separation, memo indicators and unabridged details at every width');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
