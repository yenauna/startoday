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
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const seed=await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');
  await store.commit(store.db.assignments.map(a=>({table:'assignments',id:a.id,remove:true})));
  const s=store.db.students[0],q={id:C.uid(),title:'31차 리코더',date:'2026-01-01',endDate:'2026-11-20',repeat:{type:'none'},target:{studentIds:[s.id]},isQuest:true,questSubtasks:['나비야','작은별'],questGoal:2,questTitle:'연주가'},unlimited={id:C.uid(),title:'31차 무기한',date:C.today(),repeat:{type:'none'},target:'all',isQuest:true,questGoal:2},a={id:C.uid(),title:'31차 원터치',date:C.today(),repeat:{type:'none'},target:{studentIds:[s.id]},statArea:'과제'};
  await store.commit([q,unlimited,a].map(data=>({table:'assignments',id:data.id,data})));
  await store.commit(C.taskStateOps(store.db,a,C.today(),s.id,'진행중','기존 메모'));
  state.date=C.today();(await import('/js/app.js')).navigate('과제');
  window.patch31={s:s.id,q:q.id,a:a.id};return {...window.patch31,date:C.today()};
 });
 assert.equal(await page.locator('.assignment-matrix').count(),0);
 const card=page.locator('.long-assignment-card').filter({hasText:'31차 리코더'}),unlimited=page.locator('.long-assignment-card').filter({hasText:'31차 무기한'});
 assert.match(await card.innerText(),/보상 : 연주가/);assert.match(await card.innerText(),/마감 : 26.11.20.\(금\)/);assert.equal(await card.locator('.long-assignment-count').innerText(),'0/1');
 assert.equal(await unlimited.locator('.long-assignment-deadline').count(),0);assert.equal(await unlimited.locator('.long-assignment-period').count(),0);
 const size=await card.locator('.record-edit').evaluate(e=>({h:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize}));assert.equal(size.font,'12px');assert(size.h<=29);
 await card.getByRole('button',{name:'진행도/도장판',exact:true}).click();assert.match(await page.locator('.assignment-checker').innerText(),/확인 : 선생님/);
 await page.locator('.quest-progress-card').getByRole('button',{name:'항목 도장판',exact:true}).click();
 await page.locator('.quest-subtask-toggle').filter({hasText:'나비야'}).click();
 await page.waitForFunction(()=>document.querySelector('.quest-subtask-toggle.is-complete small'));
 const expected=await page.evaluate(async date=>(await import('/js/core.js')).formatShortDate(date,false),seed.date);
 assert((await page.locator('.quest-subtask-toggle.is-complete').innerText()).includes(expected));
 await page.locator('.quest-subtask-toggle').filter({hasText:'작은별'}).click();await page.getByRole('button',{name:'진행도로 돌아가기',exact:true}).click();
 assert.equal(await page.locator('.quest-progress-card.is-complete').count(),1);
 const color=await page.locator('.quest-progress-card.is-complete').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,blue:getComputedStyle(document.documentElement).getPropertyValue('--st-blue-bg').trim()}));assert.notEqual(color.bg,'rgb(255, 255, 255)');
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await card.locator('.long-assignment-count').innerText(),'1/1');
 await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');state.impersonatingStudentId=window.patch31.s;state.viewMode='student';(await import('/js/app.js')).render();});
 const studentCard=page.locator('.student-long-card').filter({hasText:'31차 리코더'});await studentCard.locator('summary').click();assert.equal(await studentCard.locator('.student-quest-subtasks .is-complete small').count(),2);assert((await studentCard.innerText()).includes(expected));
 await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
 for(const status of ['진행중','완료','늦게완료','안함','면제']){
  await page.evaluate(async()=>{const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');const a=store.db.assignments.find(a=>a.id===window.patch31.a);await store.commit(C.taskStateOps(store.db,a,C.today(),window.patch31.s,'진행중','기존 메모'));(await import('/js/app.js')).navigate('대시보드');});
  await page.locator('.pending-tasks').getByRole('button',{name:'31차 원터치',exact:true}).click();
  assert.equal(await page.locator('#modal select').count(),0);assert.deepEqual(await page.locator('.task-quick-status button').allTextContents(),['진행중','완료','늦게완료','안함','면제']);
  await page.setViewportSize({width:360,height:900});
  const boxes=await page.locator('.task-quick-status button').evaluateAll(es=>es.map(e=>({y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,scroll:e.scrollWidth,client:e.clientWidth,cls:e.className})));
  assert(boxes.every(b=>b.y===boxes[0].y&&b.scroll<=b.client+1));assert(boxes[2].cls.includes('pending'));assert(boxes[4].cls.includes('pending'));
  await page.locator('.task-quick-status').getByRole('button',{name:status,exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#modal[open]'));
  const saved=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.assignmentStates.find(s=>s.assignmentId===window.patch31.a&&s.studentId===window.patch31.s);});
  assert.equal(saved.status,status);assert.equal(saved.memo,'기존 메모');await page.setViewportSize({width:1440,height:1000});
 }
 assert.deepEqual(errors,[]);console.log('PASS: compact two-row long tasks, optional deadline, no daily matrix, dated teacher/student stamps, completed blue cards and all five dashboard one-tap statuses with memo preservation at 360px');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
