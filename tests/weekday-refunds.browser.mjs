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
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');let d=C.initialDB();d.settings[0].grade=5;d.settings[0].allowRefund=false;
  d.students=[{id:'s',no:1,name:'가온'}];d.attendance=[];d.records=[];d.routines=[];
  d.timetables=[{id:'source-id',date:'2026-11-23',period:2,subjectCode:'국어',publicMemo:'준비물'},{id:'target-id',date:'2026-11-24',period:2,subjectCode:'수학',teacherMemo:'비공개'}];
  d.events=[{id:'event',date:'2026-11-23',title:'이동 행사',isImportant:false},{id:'sat',date:'2026-11-28',title:'토요일 일정'},{id:'sun',date:'2026-11-29',title:'일요일 일정'}];
  d.assignments=[{id:'normal',date:'2026-11-24',title:'일반 과제',target:'all',repeat:{type:'none'}},{id:'quest',date:'2026-11-23',endDate:'2026-11-24',title:'숨길 장기과제',isQuest:true,questGoal:3,target:'all',repeat:{type:'none'}}];
  d.shop_items=[{id:C.uid(),name:'같은 물건',category:'기타',price:7,stock:0}];const item=d.shop_items[0];
  d.economy_tx=[{id:C.uid(),studentId:'s',type:'구매',amount:-7,status:'보유',itemId:item.id,itemName:item.name,itemCategory:'기타',createdAt:C.now()},{id:C.uid(),studentId:'s',type:'선물',amount:0,status:'보유',itemId:item.id,itemName:item.name,itemCategory:'기타',createdAt:C.now()}];
  store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.date=state.calendarDate='2026-11-23';state.calendarMode='month';state.calendarFilters={time:true,events:true,tasks:true,routines:true,detail:false};(await import('/js/app.js')).navigate('일정');
 });
 const cell=d=>page.locator(`[data-schedule-date="${d}"]`),close=()=>page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 const selected=()=>page.evaluate(async()=>(await import('/js/shared/state.js')).state.date);
 const slots=()=>page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.timetables);
 assert.equal(await page.locator('.schedule-calendar-panel .weekday').count(),5);assert.equal(await page.locator('[data-schedule-date]').count(),30);assert.equal(await page.locator('.calendar-quest').count(),0);
 assert.equal(await page.locator('[data-schedule-date]').evaluateAll(es=>es.every(e=>![0,6].includes(new Date(e.dataset.scheduleDate+'T12:00Z').getUTCDay()))),true);
 await cell('2026-11-24').click({position:{x:5,y:70}});assert.equal(await selected(),'2026-11-24');
 await cell('2026-11-23').locator('.slot-main').click();assert.equal(await selected(),'2026-11-23');await page.getByRole('heading',{name:/2교시 시간표/}).waitFor();await close();
 // Real HTML5 mouse drag starts on the inner lesson button and drops on whole empty dates.
 await cell('2026-11-23').locator('.slot-main').dragTo(cell('2026-11-25'),{targetPosition:{x:8,y:70}});
 await page.waitForFunction(async()=>(await import('/js/shared/state.js')).store.db.timetables.find(t=>t.id==='source-id').date==='2026-11-25');await page.waitForFunction(async()=>(await import('/js/shared/state.js')).state.date==='2026-11-25');
 await cell('2026-11-25').locator('.slot-main').dragTo(cell('2026-11-24'),{targetPosition:{x:8,y:75}});
 await page.waitForFunction(async()=>(await import('/js/shared/state.js')).store.db.timetables.find(t=>t.id==='source-id').date==='2026-11-24');
 assert.equal((await slots()).find(t=>t.id==='target-id').date,'2026-11-25');assert.equal((await slots()).length,2);
 await cell('2026-11-23').getByRole('button',{name:'이동 행사',exact:true}).dragTo(cell('2026-11-26'),{targetPosition:{x:8,y:70}});
 await page.waitForFunction(async()=>(await import('/js/shared/state.js')).store.db.events.find(t=>t.id==='event').date==='2026-11-26');
 await cell('2026-11-26').getByRole('button',{name:'이동 행사',exact:true}).click();assert.equal(await selected(),'2026-11-26');await close();
 await cell('2026-11-24').locator('.calendar-task').click();assert.equal(await selected(),'2026-11-24');await close();
 await page.getByRole('button',{name:'주간 보기',exact:true}).click();assert.equal(await page.locator('[data-schedule-date]').count(),5);await page.getByRole('button',{name:'월간 보기',exact:true}).click();
 await page.getByRole('button',{name:'주말 일정 정리',exact:true}).click();assert((await page.locator('#modal').innerText()).includes('2개'));await close();
 assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.events.length),3);
 await page.getByRole('button',{name:'주말 일정 정리',exact:true}).click();await page.locator('#modal [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 assert.deepEqual(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.events.map(e=>e.id)),['event']);assert.equal((await slots()).length,2);
 // Dashboard shows all six periods. Subject selection does not save until the nearby button is used.
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('대시보드');});
 assert.equal(await page.locator('.registered-schedule .slot').count(),6);
 await page.locator('.registered-schedule').getByRole('button',{name:'1교시 수업 없음',exact:true}).click();
 await page.locator('#modal .subject-choice[data-subject-code="과학"]').click();assert.equal((await slots()).some(t=>t.period===1),false);
 const floating=page.getByRole('button',{name:'저장 및 닫기',exact:true});assert(await floating.isVisible());await floating.click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert((await slots()).some(t=>t.period===1&&t.subjectCode==='과학'));
 await page.locator('.registered-schedule').getByRole('button',{name:'3교시 수업 없음',exact:true}).click();await page.locator('#modal .subject-choice[data-subject-code="체육"]').click();await page.locator('#modal [name=publicMemo]').fill('체육복');await page.locator('#modal [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert((await slots()).some(t=>t.period===3&&t.subjectCode==='체육'&&t.publicMemo==='체육복'));
 // Same item: purchase and gift stay separate, only purchase has teacher refund despite allowRefund=false.
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('경제'));await page.locator('.economy-asset-actions').first().getByRole('button',{name:'물건',exact:true}).click();
 assert.equal(await page.locator('[data-holding-type="구매"] .economy-managed-item').count(),1);assert.equal(await page.locator('[data-holding-type="선물"] .economy-managed-item').count(),1);assert.equal(await page.locator('[data-holding-type="선물"]').getByRole('button',{name:/환불/}).count(),0);
 await page.locator('[data-holding-type="구매"]').getByRole('button',{name:'같은 물건 환불',exact:true}).click();await page.getByRole('heading',{name:'구매 물건 환불 확인',exact:true}).waitFor();await page.locator('#modal [type=submit]').click();await page.locator('.economy-student-manager').waitFor();
 const result=await page.evaluate(async()=>{const d=(await import('/js/shared/state.js')).store.db;return{stock:d.shop_items[0].stock,refunds:d.economy_tx.filter(t=>t.type==='환불').map(t=>t.amount),holding:d.economy_tx.filter(t=>t.status==='보유').map(t=>t.type)};});assert.deepEqual(result,{stock:1,refunds:[7],holding:['선물']});await close();
 for(const width of [320,375,414,768,1024,1280,1440,1920]){
  await page.setViewportSize({width,height:1000});await page.evaluate(async()=>(await import('/js/app.js')).navigate('일정'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} page overflow`);assert.equal(await page.locator('.schedule-calendar-panel .calendar').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),5);
  await page.screenshot({path:`/workspace/work/weekday-calendar-${width}.png`,fullPage:false});
  await page.evaluate(async()=>(await import('/js/tabs/timetable.js')).timetableEditor('2026-11-24',4));await page.locator('#modal .subject-choice[data-subject-code=국어]').click();const box=await page.getByRole('button',{name:'저장 및 닫기',exact:true}).boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=1000,`${width} floating save bounds`);await close();
 }
 assert.deepEqual(errors,[]);console.log('PASS weekday calendar, real button drag/drop, date selection, weekend cleanup, dashboard six periods, nearby save, purchase-only teacher refund, eight widths');
} finally{await browser?.close();await new Promise(r=>server.close(r));}
