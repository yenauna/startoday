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
 const seed=await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');let d=C.initialDB();Object.assign(d.settings[0],{schoolName:'반응형초등학교',grade:5,classGroup:'1',nameDisplayMode:'real',classroomShowScores:true,academicCalendar:{}});d.students=Array.from({length:20},(_,i)=>({id:'p38-s'+i,no:i+1,name:i===0?'가온':'학생'+(i+1)}));
  const date=C.today(),title='수학 100쪽 문제를 풀고 공책에 풀이 과정을 자세히 쓰기';d.assignments=[{id:'p38-task',title,date,repeat:{type:'none'},target:'all'},{id:'p38-peer',title:'친구 확인 숙제',date,repeat:{type:'none'},target:'all',checkerStudentId:d.students[1].id}];
  d.records=[{id:'p38-old',date:C.addDays(date,-40),kind:'칭찬',studentIds:[d.students[0].id],areas:['학습'],text:'지난 칭찬',createdAt:'2026-11-14T00:09:00Z'},{id:'p38-now',date,kind:'칭찬',studentIds:[d.students[0].id],areas:['학습'],text:'오늘 칭찬',createdAt:'2026-11-14T13:00:00Z'}];
  d=C.applyOps(d,C.teacherBalanceAdjustOps(d,d.students[0].id,15));localStorage.setItem('startoday-demo-v1',JSON.stringify(d));store.db=d;state.date=date;state.compact=false;state.dashboardOrder='number';(await import('/js/app.js')).navigate('대시보드');return{date,title,id:d.students[0].id};
 });
 for(const width of [1280,1440]){
  await page.setViewportSize({width,height:900});assert.equal(await page.locator('.summary').count(),0);assert.equal(await page.locator('.constellation-summary').isVisible(),true);assert.equal(await page.locator('.constellation-summary>span').count(),2);
  const card=page.locator(`article.student[data-student-id="${seed.id}"]`);const measures=await card.evaluate(e=>({w:e.getBoundingClientRect().width,name:parseFloat(getComputedStyle(e.querySelector('.student-head>strong')).fontSize),task:parseFloat(getComputedStyle(e.querySelector('.pending-tasks .task')).fontSize),wrap:getComputedStyle(e.querySelector('.pending-tasks .task')).whiteSpace}));assert(measures.w>=220,JSON.stringify(measures));assert(measures.name>measures.task);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 }
 assert.equal(await page.locator('.today-events-empty').innerText(),'등록된 일정이 없습니다.');
 const card=page.locator(`article.student[data-student-id="${seed.id}"]`);await card.locator('.score-total').click();assert.equal(await card.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#modal[open]').count(),0);
 await card.locator('.student-head>strong').click();assert.equal(await card.getAttribute('aria-pressed'),'false');await card.locator('.pending-tasks .task').first().click();assert.equal(await page.locator('.task-quick-status button').count(),5);assert.equal(await card.getAttribute('aria-pressed'),'false');await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await card.locator('.student-detail-open').click();assert.equal(await page.locator('#modal[open]').count(),1);assert.equal(await card.getAttribute('aria-pressed'),'false');await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('기록');});
 const record=page.locator('article.record').first();assert(await record.count());
 for(const width of [1280,412]){await page.setViewportSize({width,height:900});const fonts=await record.evaluate(e=>({name:parseFloat(getComputedStyle(e.querySelector('.record-meta>strong')).fontSize),body:parseFloat(getComputedStyle(e.querySelector('.record-content-line>.body')).fontSize)}));assert(fonts.name>fonts.body,JSON.stringify(fonts));}
 await page.setViewportSize({width:1280,height:900});await page.evaluate(async()=>{(await import('/js/app.js')).navigate('대시보드');});
 const original=await page.evaluate(async id=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');return{stars:C.cumulativeScores(store.db,id).total,balance:C.studentBalance(store.db,id),titles:C.kingdomCounts(store.db,id)};},seed.id);
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('설정'));assert.equal(await page.locator('[name=pointPeriod]').count(),0);
 const changed=await page.evaluate(async id=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');return{stars:C.cumulativeScores(store.db,id).total,balance:C.studentBalance(store.db,id),titles:C.kingdomCounts(store.db,id)};},seed.id);assert.equal(changed.stars,original.stars);assert.deepEqual(changed.titles,original.titles);assert.equal(changed.balance,original.balance);
 await page.setViewportSize({width:412,height:915});const nav=await page.locator('.settings-sidebar').evaluate(e=>({rows:new Set([...e.children].map(c=>c.getBoundingClientRect().top)).size,overflow:e.scrollWidth>e.clientWidth+1}));assert(nav.rows>1);assert.equal(nav.overflow,false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await page.getByRole('button',{name:'교실화면',exact:true}).count(),2);
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('경제'));assert.equal(await page.locator('.economy-assets-table').count(),1);const first=page.locator('.economy-assets-table tbody tr').first();assert(await first.locator('button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=36)));await first.locator('.economy-student-manage').click();assert.equal(await page.locator('.economy-student-manager').count(),1);
 await page.evaluate(async id=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');await store.commit(Array.from({length:8},(_,i)=>({table:'events',id:'p38-e'+i,data:{id:'p38-e'+i,date:C.today(),title:'달력 상세 일정 '+i}})));(await import('/js/tabs/student-view.js')).previewStudent(id);},seed.id);
 const checkerText=await page.locator('.student-tasks-card .assignment-checker').allTextContents();assert.equal(checkerText.length,1);assert(checkerText[0].includes('학생2'));assert(!checkerText[0].includes('선생님'));
 const day=page.locator(`[data-calendar-date="${seed.date}"]`);assert.equal(await day.locator('.student-calendar-count').count(),0);assert.equal(await day.locator('.student-calendar-pill:visible').count(),10);await day.click();assert((await page.locator('.student-calendar-detail').innerText()).includes('달력 상세 일정 7'));assert.equal(await page.locator('.student-calendar-detail .assignment-checker').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.locator('.student-calendar-card').screenshot({path:'/tmp/patch38-calendar-412.png'});
 await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();await page.setViewportSize({width:1280,height:900});await page.evaluate(async()=>(await import('/js/tabs/classroom.js')).classroom());assert.equal(await page.locator('.classroom-student').count(),20);
 const task=page.locator('.classroom-student').nth(1).locator('.pending-tasks .task').first(),classMetrics=await task.evaluate(e=>{const s=getComputedStyle(e),n=getComputedStyle(e.closest('article').querySelector('.classroom-student-name'));return{wrap:s.whiteSpace,lines:s.webkitLineClamp,name:parseFloat(n.fontSize),text:parseFloat(s.fontSize),height:e.getBoundingClientRect().height,line:parseFloat(s.lineHeight)};});assert(classMetrics.name>classMetrics.text);assert(classMetrics.height>=classMetrics.line);assert((await task.innerText()).includes('수학'));
 assert.match(await page.locator('#class-clock').innerText(),/^(오전|오후) \d{1,2}:\d{2}:\d{2}$/);assert(!/별코인|교실 화면|무한대|추가 기록|별점|별 점수/.test(await page.locator('body').innerText()));
 await page.screenshot({path:'/tmp/patch38-classroom-1280.png'});assert.deepEqual(errors,[]);console.log('PASS: PC 1280/1440 summary and >=220px cards, body/task/detail click separation, ledger-only settings without star/title changes, 412px wrapped settings/touch rows/calendar titles, peer-only checker, 20 readable compact classroom cards and AM/PM clock seconds');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
