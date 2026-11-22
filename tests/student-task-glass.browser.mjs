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
 for(const width of [1280,412]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  const date=await page.evaluate(async()=>{const C=await import('/js/core.js'),{store}=await import('/js/shared/state.js');const d=C.initialDB(),date=C.today();d.students=[{id:'s',no:1,name:'가온'}];d.assignments=[{id:'done',date,title:'완료 과제',target:'all',repeat:{type:'none'}},{id:'pending',date,title:'미완료 과제',target:'all',repeat:{type:'none'}},{id:'overdue',date:C.addDays(date,-1),title:'기한초과 과제',target:'all',repeat:{type:'none'}}];d.assignmentStates=[{id:'done:'+date+':s',studentId:'s',assignmentId:'done',date,status:'완료'}];d.routines=[{id:'r',title:'책상 정리',target:'all',sortOrder:1}];d.timetables=[{id:'p1',date,period:1,subjectCode:'국어'},{id:'p2',date,period:2,subjectCode:'수학'}];d.events=[{id:'e',date,timeOfDay:'morning',title:'아침 준비',isImportant:true}];store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));(await import('/js/tabs/student-view.js')).previewStudent('s');return date;});
  const timeline=page.locator('.student-timetable-card > .timeline-slot,.student-timetable-card > .student-task.subject-color');assert.equal(await timeline.count(),3);const rects=await timeline.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{top:r.top,bottom:r.bottom,margin:s.marginTop};}));for(let i=0;i<rects.length;i++){assert.equal(rects[i].margin,'11px');if(i)assert(rects[i].top-rects[i-1].bottom>=10);}
  const tasks=page.locator('.student-tasks-card .student-task');assert(await tasks.count()>=4);  const done=page.locator('.student-tasks-card .student-task.is-complete'),pending=page.locator('.student-tasks-card .student-task.is-pending:not(.is-overdue)'),overdue=page.locator('.student-tasks-card .student-task.is-overdue');assert(await done.count()>0);assert(await pending.count()>0);assert(await overdue.count()>0);
  const verify=async items=>{for(const item of await items.all()){const style=await item.evaluate(e=>{const s=getComputedStyle(e),p=getComputedStyle(e,'::before');return{blur:s.backdropFilter,shadow:s.boxShadow,sheen:p.backgroundImage,bg:s.backgroundColor};});assert.match(style.blur,/blur\(16px\) saturate\(1.4\)/);assert.match(style.shadow,/255, 255, 255, 0.75/);assert.match(style.sheen,/linear-gradient/);}};await verify(tasks);const bg=async loc=>loc.first().evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(await bg(done),await bg(pending));assert.notEqual(await bg(pending),await bg(overdue));await page.locator('.student-timetable-card').screenshot({path:`/tmp/student-spacing-${width}.png`});await page.locator('.student-tasks-card').screenshot({path:`/tmp/student-task-glass-${width}.png`});
  const toggle=page.locator('[data-routine-id=r]');await toggle.click();await page.waitForFunction(()=>document.querySelector('[data-routine-id=r]')?.classList.contains('is-complete'));await page.locator(`[data-calendar-date="${date}"]`).click();const detail=page.locator('.student-calendar-detail .student-task');assert(await detail.count()>=2);await verify(detail);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: PC1280/mobile412 timetable event/lesson margins and actual gaps ≥10px; home/calendar task blur/highlight/sheen with complete/pending/overdue colors; routine toggle remains clickable');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
