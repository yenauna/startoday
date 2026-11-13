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
 const context=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true}),page=await context.newPage(),errors=[],confirmations=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{confirmations.push(d.message());d.accept();});
 await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const seed=await page.evaluate(async()=>{
  const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');const day=C.today(),s=store.db.students[0];window.p27s=s.id;
  const item={id:C.uid(),name:'안전 선물 쿠폰',price:0,stock:2,category:'검증'};window.p27item=item.id;
  const ops=[{table:'shop_items',id:item.id,data:item},{table:'timetables',id:'p27-slot',data:{id:'p27-slot',date:day,period:1,subjectCode:'국어',publicMemo:'준비물 안내',privateMemo:'오늘만 공개 안내'}},{table:'events',id:'p27-event',data:{id:'p27-event',date:day,period:1,timeOfDay:'lesson',title:'교시 일정 원본',description:'수정할 안내',isImportant:true}}];
  for(const id of ['card','modal','editor','compact','deadline']){const a={id:'p27-'+id,title:'과제 '+id,isQuest:true,date:day,repeat:{type:'none'},target:'all',questGoal:2,questTitle:'보존 칭호 '+id,questSubtasks:['첫 항목','둘째 항목'],...(id==='deadline'?{endDate:C.addDays(day,7),checkerStudentId:store.db.students[1].id}:{})};ops.push({table:'assignments',id:a.id,data:a});}
  await store.commit(ops);
  for(const id of ['card','modal','editor']){const a=store.db.assignments.find(a=>a.id==='p27-'+id);await store.commit(C.questStampOps(store.db,a,day,s.id,2));}
  (await import('/js/app.js')).navigate('과제');return{day,itemId:item.id};
 });
 const card=id=>page.locator('.long-assignment-card').filter({hasText:'과제 '+id});
 await card('card').getByRole('button',{name:'삭제',exact:true}).tap();await card('card').waitFor({state:'detached'});
 await card('modal').getByRole('button',{name:'진행도/도장판 열기',exact:true}).click();await page.locator('#modal').getByRole('button',{name:'삭제',exact:true}).click();await card('modal').waitFor({state:'detached'});
 await card('editor').getByRole('button',{name:'수정',exact:true}).click();await page.locator('#modal .dialog-foot').getByRole('button',{name:'삭제',exact:true}).click();await card('editor').waitFor({state:'detached'});
 assert.equal(confirmations.filter(s=>s==='이 장기과제를 삭제할까요? 학생들의 스탬프 기록도 함께 삭제됩니다.').length,3);
 const cleaned=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return{states:store.db.assignmentStates.filter(s=>['p27-card','p27-modal','p27-editor'].includes(s.assignmentId)).length,rewards:store.db.students[0].rewardTitles.filter(t=>t.name.startsWith('보존 칭호')).length};});assert.equal(cleaned.states,0);assert.equal(cleaned.rewards,3);
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('대시보드');});
 assert.ok(!(await page.locator('article.student').first().locator('.pending-tasks').innerText()).includes('과제 compact'));
 // Linked lesson events edit independently; memo-only save/clear needs no subject reselect.
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('시간표·일정');});
 await page.locator('.day.today .slot-event-link').filter({hasText:'교시 일정 원본'}).click();
 await page.locator('#modal [name=title]').fill('교시 일정 수정');await page.locator('#modal button[type=submit]').click();
 await page.evaluate(async()=>{(await import('/js/tabs/timetable.js')).timetableEditor((await import('/js/core.js')).today(),1);});
 assert.match(await page.locator('#modal').innerText(),/당일 공개 메모/);assert.equal(await page.locator('.slot-linked-event').count(),1);
 await page.locator('#modal [name=publicMemo]').fill('메모만 수정');await page.locator('#modal [name=privateMemo]').fill('당일 수정 안내');await page.getByRole('button',{name:'메모 저장',exact:true}).click();
 await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.timetables.find(t=>t.id==='p27-slot').privateMemo==='당일 수정 안내';});
 await page.evaluate(async()=>{(await import('/js/tabs/timetable.js')).timetableEditor((await import('/js/core.js')).today(),1);});
 await page.getByRole('button',{name:'메모 지우기',exact:true}).click();
 await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.timetables.find(t=>t.id==='p27-slot').privateMemo==='';});
 await page.evaluate(async()=>{(await import('/js/tabs/timetable.js')).timetableEditor((await import('/js/core.js')).today(),1);});
 await page.getByRole('button',{name:'교시 일정 수정 수정',exact:true}).click();await page.getByRole('button',{name:'이 일정 삭제',exact:true}).click();
 await page.evaluate(async()=>{(await import('/js/tabs/timetable.js')).timetableEditor((await import('/js/core.js')).today(),1);});
 assert.equal(await page.locator('.slot-linked-event').count(),0);await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 // Student cards start closed and hide unneeded teacher/unlimited metadata.
 await page.evaluate(async()=>{const {store,state}=await import('/js/shared/state.js');state.impersonatingStudentId=window.p27s;state.viewMode='student';(await import('/js/app.js')).render();});
 const compact=page.locator('.student-long-card').filter({hasText:'과제 compact'});assert.equal(await compact.locator('small').count(),0);assert.equal(await compact.getAttribute('open'),null);assert.equal(await compact.locator('.quest-stamp-board').isVisible(),false);
 await compact.locator('summary').tap();assert.equal(await compact.locator('.quest-stamp-board').isVisible(),true);await compact.locator('summary').tap();assert.equal(await compact.locator('.student-quest-subtasks').isVisible(),false);
 const deadline=page.locator('.student-long-card').filter({hasText:'과제 deadline'});assert.match(await deadline.locator('summary').innerText(),/마감일 .*년 .*월 .*일/);assert.match(await deadline.locator('summary').innerText(),/확인 : .* 학생/);
 await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();await page.evaluate(async()=>{(await import('/js/app.js')).navigate('경제');});await page.getByRole('button',{name:'상점 관리',exact:true}).click();
 const item=page.locator('.economy-item').filter({has:page.getByRole('heading',{name:'안전 선물 쿠폰',exact:true})});await item.getByRole('button',{name:'🎁 선물하기',exact:true}).tap();
 const choose=item.getByRole('button',{name:'1. 가온 선택',exact:true});await choose.tap();assert.equal(await choose.getAttribute('aria-pressed'),'true');
 let stock=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.id===window.p27item).stock;});assert.equal(stock,2);
 const cols=await item.locator('.economy-student-gift-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.ok(cols>=4&&cols<=6);
 await item.getByRole('button',{name:'선택한 학생(1. 가온)에게 선물하기',exact:true}).tap();
 await page.getByRole('button',{name:/↩ 선물 취소/}).click();
 await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.id===window.p27item).stock===2;});
 const cancel=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.economy_tx.filter(t=>t.itemId===window.p27item).map(t=>[t.type,t.status]);});assert.ok(cancel.some(t=>t[0]==='선물'&&t[1]==='취소됨'));
 await item.getByRole('button',{name:'1. 가온 선택',exact:true}).tap();await item.locator('.economy-gift-confirm').tap();await page.getByRole('button',{name:/↩ 선물 취소/}).waitFor();await page.getByRole('button',{name:/↩ 선물 취소/}).waitFor({state:'detached',timeout:7000});
 stock=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.id===window.p27item).stock;});assert.equal(stock,1);
 await page.setViewportSize({width:390,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.deepEqual(errors,[]);console.log('PASS: three project deletion paths, independent lesson event edits/deletion, memo save/clear, compact student accordion, dashboard filtering, selected-student confirmation, exact gift undo and five-second expiry');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
