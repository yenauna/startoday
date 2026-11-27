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
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text());});
 page.on('dialog',d=>d.accept());
 await page.goto(url);
 await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const seed=await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');
  const d=store.db,date='2026-11-23',tomorrow=C.addDays(date,1);
  Object.assign(d.settings[0],{grade:5,className:'행복한 우리 반 5학년 1반'});
  d.timetables=[1,2,3].map(p=>({id:`${date}-${p}`,date,period:p,subjectCode:['국어','수학','과학'][p-1],publicMemo:p===2?'분수 나눗셈 준비물':'',teacherMemo:p===1?'받아쓰기 채점':''}));
  d.events=[{id:'e1',date,timeOfDay:'morning',title:'아침 독서',isImportant:true}];
  d.assignments=[{id:'a1',title:'수학 100쪽',date,repeat:{type:'none'},target:'all'},{id:'q1',title:'리코더 장기과제',isQuest:true,questGoal:3,date,endDate:C.addDays(date,20),questTitle:'리코더 별',target:'all',repeat:{type:'none'}}];
  d.routines=[{id:'r1',title:'우유 마시기',target:'all',sortOrder:0},{id:'r2',title:'점심 양치',target:'all',sortOrder:1,exceptions:{[tomorrow]:{exempt:true,memo:'체험학습'}}}];
  d.assignmentStates=[];d.routineStates=[];
  store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.date=date;state.calendarDate=date;
  (await import('/js/app.js')).navigate('일정');
  return {date,tomorrow};
 });
 // 주 메뉴: 일정 하나로 통합, 과제·루틴은 없다.
 await page.locator('#navigation-toggle').click();
 const menu=await page.locator('#navigation-drawer .drawer-tabs button span').allInnerTexts();
 assert(!menu.includes('과제')&&!menu.includes('루틴'),menu.join(','));
 assert(menu.includes('일정')&&menu.includes('디자인'),menu.join(','));
 await page.locator('#navigation-drawer').getByRole('button',{name:'닫기',exact:true}).click();
 // 2컬럼: 왼쪽 통합 달력, 오른쪽 일정·과제·루틴 카드 3개
 assert.equal(await page.locator('.schedule-unified .schedule-calendar-panel').count(),1);
 assert.equal(await page.locator('.schedule-side > .schedule-card').count(),3);
 assert.equal(await page.locator('.schedule-card-events').count(),1);
 assert.equal(await page.locator('.schedule-card-assignments').count(),1);
 assert.equal(await page.locator('.schedule-card-routines').count(),1);
 // 날짜를 누르면 state.date와 오른쪽 카드가 함께 바뀐다.
 await page.locator(`[data-schedule-date="${seed.tomorrow}"] .day-head`).click();
 await page.waitForTimeout(200);
 assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).state.date),seed.tomorrow);
 assert((await page.locator('.schedule-card-events h3').innerText()).includes(await page.evaluate(async d=>(await import('/js/core.js')).formatDate(d),seed.tomorrow)));
 assert.equal(await page.locator('.schedule-routine.is-exempt').count(),1,'루틴 쉬는 날 표시');
 await page.locator(`[data-schedule-date="${seed.date}"] .day-head`).click();
 await page.waitForTimeout(200);
 // 과제 카드에서 학생 상태를 바로 체크하면 카운트가 갱신된다.
 await page.locator('.schedule-task').first().getByRole('button',{name:'학생 체크',exact:true}).click();
 await page.waitForTimeout(200);
 await page.locator('.schedule-task .assignment-progress-item').first().click();
 await page.waitForTimeout(600);
 assert((await page.locator('.schedule-task').first().locator('.schedule-task-count').innerText()).includes('1/20'));
 assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.assignmentStates[0].status),'완료');
 // 루틴 카드의 일괄 완료·리셋
 await page.locator('.schedule-routine').first().getByRole('button',{name:'전체 완료',exact:true}).click();
 await page.waitForTimeout(400);
 assert((await page.locator('.schedule-routine').first().locator('.schedule-routine-count').innerText()).includes('20/20'));
 await page.locator('.schedule-routine').first().getByRole('button',{name:'리셋',exact:true}).click();
 await page.waitForTimeout(400);
 assert((await page.locator('.schedule-routine').first().locator('.schedule-routine-count').innerText()).includes('0/20'));
 // 시간표 드래그 교환
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('startoday-demo-v1')).timetables.map(t=>`${t.period}:${t.subjectCode}`).join(','));
 await page.locator('.schedule-period[data-drag]').first().dragTo(page.locator('.schedule-period[data-drop]').nth(3));
 await page.waitForTimeout(500);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('startoday-demo-v1')).timetables.map(t=>`${t.period}:${t.subjectCode}`).join(','));
 assert.notEqual(before,after,'드래그로 교시가 바뀐다');
 assert(after.includes('4:국어'),after);
 // 전체 관리 패널과 옛 주소
 await page.locator('.schedule-card-assignments').getByRole('button',{name:'전체 관리',exact:true}).click();
 await page.waitForTimeout(300);
 assert.equal(await page.locator('#schedule-manage .assignment-calendar-panel').count(),1);
 await page.locator('#schedule-manage').getByRole('button',{name:'닫기',exact:true}).click();
 for(const [hash,manage] of [['과제','과제'],['루틴','루틴'],['시간표·일정','']]){
  await page.evaluate(h=>{location.hash=encodeURIComponent(h);},hash);
  await page.waitForTimeout(300);
  const now=await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');return{tab:state.tab,manage:state.scheduleManage};});
  assert.equal(now.tab,'일정',hash);assert.equal(now.manage,manage,hash);
  assert.equal(await page.locator('.schedule-unified').count(),1,hash);
 }
 await page.evaluate(()=>{location.hash=encodeURIComponent('일정');});
 await page.waitForTimeout(250);
 // 모바일: 위 달력 → 아래 카드 순서, 가로 넘침 없음
 for(const width of [320,375,412,768,1024,1280,1440,1920]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(async()=>(await import('/js/app.js')).navigate('일정'));
  await page.waitForTimeout(250);
  const order=await page.evaluate(()=>{const cal=document.querySelector('.schedule-calendar-panel').getBoundingClientRect();const cards=[...document.querySelectorAll('.schedule-side > .schedule-card')].map(c=>c.getBoundingClientRect().top);return{cal:cal.top,first:cards[0],last:cards[cards.length-1],doc:document.documentElement.scrollWidth,vw:innerWidth};});
  assert(order.cal<=order.first&&order.first<=order.last,width+': 달력이 카드보다 먼저');
  assert(order.doc<=order.vw+1,width+': 가로 넘침 '+JSON.stringify(order));
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: 통합 일정 탭 — 메뉴 통합, 달력→카드 연동, 과제·루틴 카드 체크, 드래그 교환, 전체 관리, 옛 주소 이어짐, 8개 폭 세로 배치');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
