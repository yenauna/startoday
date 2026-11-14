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
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const seed=await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');const s=store.db.students[0],days=[-1,0,1].map(n=>C.addDays(C.today(),n));
  await store.commit(store.db.timetables.filter(t=>t.period===1&&days.includes(t.date)).map(t=>({table:'timetables',id:t.id,remove:true})));
  await store.commit([{table:'students',id:s.id,data:{...s,rewardTitles:[{id:'quest:32',name:'별빛 탐험가'}]}},...days.map((date,i)=>({table:'timetables',id:`memo32-${i}`,data:{id:`memo32-${i}`,date,period:1,subjectCode:'국어',publicMemo:`PUBLIC32-${i}`,privateMemo:`TODAY32-${i}`,teacherMemo:`SECRET32-${i}`}}))]);
  (await import('/js/app.js')).navigate('대시보드');window.patch32={s:s.id,days};return window.patch32;
 });
 assert.equal(await page.locator('.kingdom-earned-open').count(),0);assert((await page.locator('article.student').first().locator('.student-kingdom').innerText()).trim());
 await page.evaluate(async date=>(await import('/js/tabs/timetable.js')).timetableEditor(date,1),seed.days[1]);
 for(const [key,label] of [['publicMemo','메모1 : 학생 달력에도 기록되어 언제든 학생들이 볼 수 있음'],['privateMemo',"메모2 : 학생들은 당일 '오늘의 일정'과 교실화면에서만 볼 수 있음"],['teacherMemo','메모3 : 교사만 볼 수 있음']]){
  assert((await page.locator(`#modal label:has([name=${key}])`).innerText()).startsWith(label));
 }
 await page.locator('#modal [name=teacherMemo]').fill('SECRET32-edited');await page.getByRole('button',{name:'메모 저장',exact:true}).click();
 await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');state.calendarDate=window.patch32.days[1];(await import('/js/app.js')).navigate('시간표·일정');});
 const teacherDay=page.locator(`[data-drag="${seed.days[1]}:1"]`);assert((await teacherDay.first().innerText()).includes('SECRET32-edited'));assert((await teacherDay.first().innerText()).includes('TODAY32-1'));
 await page.evaluate(async()=>(await import('/js/tabs/classroom.js')).classroom());
 assert((await page.locator('.classroom-schedule').innerText()).includes('PUBLIC32-1'));assert((await page.locator('.classroom-schedule').innerText()).includes('TODAY32-1'));assert(!(await page.locator('.lockscreen').innerText()).includes('SECRET32'));
 await page.locator('#lock-exit').dblclick();
 await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');state.impersonatingStudentId=window.patch32.s;state.viewMode='student';(await import('/js/app.js')).render();});
 assert((await page.locator('.student-timetable-card').innerText()).includes('PUBLIC32-1'));assert((await page.locator('.student-timetable-card').innerText()).includes('TODAY32-1'));assert(!(await page.locator('.student-shell').innerText()).includes('SECRET32'));
 for(const [i,date] of seed.days.entries()){
  await page.locator(`[data-calendar-date="${date}"]`).click();const text=await page.locator('.student-calendar-detail').innerText();assert(text.includes(`PUBLIC32-${i}`));assert(!text.includes('TODAY32'));assert(!text.includes('SECRET32'));
  assert.match(await page.locator('.student-calendar-detail h3').innerText(),/^\d{2}\.\d{2}\.\d{2}\.\([일월화수목금토]\)$/);
 }
 await page.setViewportSize({width:390,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
 // Clear all three fields and undo to prove the new teacher field participates.
 await page.evaluate(async date=>(await import('/js/tabs/timetable.js')).timetableEditor(date,1),seed.days[1]);await page.getByRole('button',{name:'메모 지우기',exact:true}).click();
 const read=()=>page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.timetables.find(t=>t.id==='memo32-1');});
 let slot=await read();assert.equal(slot.publicMemo,'');assert.equal(slot.privateMemo,'');assert.equal(slot.teacherMemo,'');
 await page.getByRole('button',{name:/실행취소/}).click();slot=await read();assert.equal(slot.publicMemo,'PUBLIC32-1');assert.equal(slot.privateMemo,'TODAY32-1');assert.equal(slot.teacherMemo,'SECRET32-edited');
 assert.deepEqual(errors,[]);console.log('PASS: badge-only dashboard, exact three memo labels, save/clear/undo all fields, teacher calendar all memos, classroom and student today memo1+2, student all-date calendar memo1 only, YY dates and mobile width');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
