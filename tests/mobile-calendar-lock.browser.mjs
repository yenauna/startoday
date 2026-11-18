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
const url=`http://127.0.0.1:${server.address().port}`;
const shots=process.env.SHOT_DIR||'/tmp';
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:412,height:891}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text());});
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 page.setDefaultTimeout(10000);
 const enter=async()=>{
   await page.goto(url);
   await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 };
 await enter();
 const seed=await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');
  let d=C.initialDB();Object.assign(d.settings[0],{grade:5,classGroup:'6',nameDisplayMode:'real',classroomShowScores:true,academicCalendar:{}});
  d.students=[{id:'s48',no:1,name:'가온'},{id:'s49',no:2,name:'나래'}];
  const date=C.today();
  d.assignments=[{id:'a48',title:'수학 100쪽 풀이 과정 쓰기',date,repeat:{type:'none'},target:'all'}];
  d.timetables=[{id:'t48',date,period:2,subjectCode:'수학',publicMemo:'분수 나눗셈'}];
  d.events=[{id:'e48',date,title:'현장학습'}];
  d=C.applyOps(d,C.assignmentPolicyOps(d));
  store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.date=date;
  (await import('/js/app.js')).navigate('시간표·일정');return{date};
 });
 await page.setViewportSize({width:412,height:891});
 // 1) 교사 월간 달력: 실제 일정·시간표·과제가 그대로 보이고 요약 버튼이 없다.
 const teacherDay=page.locator('.calendar .day').filter({has:page.locator(`.day-head:has-text("${Number(seed.date.slice(-2))}")`)}).first();
 assert.equal(await page.locator('.calendar.week').count(),0);
 assert.equal(await page.locator('.calendar-mobile-summary').count(),0);
 assert.equal(await page.locator('.calendar .day .event:visible').count(),1);
 assert.equal(await page.locator('.calendar .day .slot.calendar-lesson .subject-title:visible').count(),1);
 assert.equal(await page.locator('.calendar .day .taskline:visible').count(),1);
 assert((await page.locator('.calendar .day .event:visible').first().innerText()).includes('현장학습'));
 assert((await page.locator('.calendar .day .taskline:visible').first().innerText()).includes('수학 100쪽'));
 const head=await page.locator('.calendar .day .day-head').first().evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{height:r.height,minWidth:s.minWidth,minHeight:s.minHeight};});
 assert(head.height<44&&head.minWidth!=='44px'&&head.minHeight!=='44px',JSON.stringify(head));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:`${shots}/calendar-412.png`});
 await page.locator('.calendar .day').filter({has:page.locator('.taskline')}).first().screenshot({path:`${shots}/calendar-today-412.png`});
 // PC 화면에서도 같은 내용이 그대로 보인다.
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('시간표·일정'));
 assert.equal(await page.locator('.calendar .day .event:visible').count(),1);
 assert.equal(await page.locator('.calendar .day .taskline:visible').count(),1);
 assert.equal(await page.locator('.calendar-mobile-summary').count(),0);
 await page.setViewportSize({width:412,height:891});
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('시간표·일정'));
 // 2) 과제 월간 달력: 칸마다 과제 제목이 보이고 'N건' 요약이 없다.
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('과제'));
 const nav=await page.locator('.assignment-calendar-panel .toolbar .row button').first().evaluate(e=>e.getBoundingClientRect().height);
 assert(nav<44,'월 이동 버튼 높이 '+nav);
 const taskCell=page.locator(`.assignment-day[data-date="${seed.date}"]`);
 assert.equal(await taskCell.locator('.assignment-calendar-task:visible').count(),1);
 assert.equal(await page.locator('.assignment-calendar-count').count(),0);
 assert((await taskCell.locator('.assignment-calendar-task').innerText()).includes('수학 100쪽'));
 const addBox=await taskCell.locator('.assignment-calendar-add').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{height:r.height,minWidth:s.minWidth,minHeight:s.minHeight};});
 assert(addBox.height<44&&addBox.minWidth!=='44px'&&addBox.minHeight!=='44px',JSON.stringify(addBox));
 // 3) 학생 월간 달력: 과제 제목이 칸에 보이고 요약이 없다.
 await page.evaluate(async id=>(await import('/js/tabs/student-view.js')).previewStudent(id),'s48');
 assert.equal(await page.locator('.student-calendar-grid.month').count(),1);
 assert.equal(await page.locator('.student-calendar-count').count(),0);
 assert.equal(await page.locator('.student-calendar-pill:visible').count()>0,true);
 assert((await page.locator('.student-calendar-card').innerText()).includes('수학 100쪽'));
 await page.locator('.student-calendar-card').screenshot({path:`${shots}/student-calendar-412.png`});
 await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
 // 4) 교실화면 잠금: 새로고침해도 PIN 전에는 교사 화면으로 돌아가지 않는다.
 await page.evaluate(async()=>{
  const {store}=await import('/js/shared/state.js'),{hashPin}=await import('/js/shared/ui.js');
  store.db.settings[0].classroomPinHash=await hashPin('2468');
  localStorage.setItem('startoday-demo-v1',JSON.stringify(store.db));
 });
 await page.getByRole('button',{name:'교실화면',exact:true}).click();
 assert.equal(await page.locator('.lockscreen').count(),1);
 assert((await page.evaluate(()=>localStorage.getItem('startoday-classroom-lock-v1')))?.includes('"locked":true'));
 await page.reload();
 assert.equal(await page.locator('.lockscreen').count(),0, '아직 체험 자료를 다시 열기 전');
 await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 assert.equal(await page.locator('.lockscreen').count(),1,'새로고침 뒤에도 잠금 화면이 남아야 한다');
 assert.equal(await page.locator('.tabs').count(),0,'교사 화면 메뉴가 보이면 안 된다');
 assert.equal(await page.locator('.record').count(),0);
 await page.evaluate(async()=>{location.hash=encodeURIComponent('기록');});
 await page.waitForTimeout(150);
 assert.equal(await page.locator('.lockscreen').count(),1,'주소 이동으로도 잠금을 벗어나면 안 된다');
 assert.equal(await page.locator('.tabs').count(),0);
 await page.screenshot({path:`${shots}/classroom-lock-412.png`});
 // 틀린 비밀번호는 잠금을 풀지 않는다.
 let pin='1111';
 page.on('dialog',d=>d.type()==='prompt'?d.accept(pin):d.accept());
 await page.locator('#lock-exit').dblclick();
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.lockscreen').count(),1,'틀린 비밀번호로는 잠금이 풀리지 않는다');
 assert((await page.evaluate(()=>localStorage.getItem('startoday-classroom-lock-v1')))?.includes('"locked":true'));
 // 맞는 비밀번호는 잠금과 저장된 상태를 함께 푼다.
 pin='2468';
 await page.locator('#lock-exit').dblclick();
 await page.locator('.tabs').first().waitFor();
 assert.equal(await page.locator('.lockscreen').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('startoday-classroom-lock-v1')),null);
 await page.reload();
 await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 assert.equal(await page.locator('.tabs').count(),1,'해제한 뒤에는 새로고침해도 교사 화면');
 assert.equal(await page.locator('.lockscreen').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: 412px month calendars show events/timetable/tasks without count summaries, buttons keep compact sizes, reload keeps the classroom lock until the PIN is entered');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
