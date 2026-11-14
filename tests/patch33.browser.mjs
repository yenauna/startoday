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
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const seed=await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js'),s=store.db.students[0];
  await store.commit(C.teacherBalanceAdjustOps(store.db,s.id,500,'33차 검증'));
  await store.commit(store.db.timetables.filter(t=>t.date===C.today()&&t.period===1).map(t=>({table:'timetables',id:t.id,remove:true})));
  await store.commit([{table:'timetables',id:'slot33',data:{id:'slot33',date:C.today(),period:1,subjectCode:'국어',publicMemo:'PUBLIC33',privateMemo:'SAME33',teacherMemo:'SECRET33'}},{table:'events',id:'event33',data:{id:'event33',date:C.today(),period:1,title:'EVENT33',description:'교시 일정'}},{table:'records',id:'record33',data:{id:'record33',date:C.today(),studentIds:[s.id],kind:'관찰',areas:[],text:'33차 일시',createdAt:'2026-11-13T11:35:00Z',updatedAt:'2026-11-13T11:40:00Z'}}]);
  window.seed33={s:s.id,date:C.today()};state.recordFilters={from:'2020-01-01',to:'2030-01-01',q:'33차 일시'};(await import('/js/app.js')).navigate('기록');return {...window.seed33,balance:C.studentBalance(store.db,s.id)};
 });
 const fonts=await page.locator('[data-record-id=record33] .record-meta').evaluate(e=>['small','.record-created-time','.record-updated-time'].map(q=>{const s=getComputedStyle(e.querySelector(q));return [s.fontSize,s.color,s.fontWeight];}));assert.deepEqual(fonts[0],fonts[1]);assert.deepEqual(fonts[0],fonts[2]);
 await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');state.calendarDate=window.seed33.date;(await import('/js/app.js')).navigate('시간표·일정');});
 const teacher=page.locator(`[data-drag="${seed.date}:1"]`);assert.equal(await teacher.locator('.slot-memos').count(),1);assert((await teacher.locator('.slot-memos').innerText()).includes('📢 PUBLIC33'));assert((await teacher.locator('.slot-memos').innerText()).includes('🔒 SECRET33'));assert(!(await teacher.innerText()).includes('📌'));assert.equal(await teacher.locator('.slot-memos .slot-event-link').count(),1);
 const layout=await teacher.evaluate(el=>({subject:el.querySelector('.subject-title').getBoundingClientRect().right,memos:el.querySelector('.slot-memos').getBoundingClientRect().left}));assert(layout.memos>=layout.subject);
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('대시보드');window.scrollTo(0,700);});
 await page.evaluate(async id=>(await import('/js/tabs/student-view.js')).previewStudent(id),seed.s);assert.equal(await page.evaluate(()=>scrollY),0);
 const icon=await page.locator('.student-wardrobe-open').boundingBox(),score=await page.locator('.student-profile-score strong').boundingBox();assert(icon.y>=score.y+score.height-1);
 const studentMemo=page.locator('.student-timetable-card .slot-memos').first();assert((await studentMemo.innerText()).includes('PUBLIC33'));assert((await studentMemo.innerText()).includes('SAME33'));assert(!/[📢🔒📌]/u.test(await studentMemo.innerText()));const memoStyles=await studentMemo.evaluate(e=>[...e.children].slice(0,2).map(el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return {font:s.fontSize,color:s.color,bg:s.backgroundColor,border:s.borderTopWidth,h:b.height};}));assert.deepEqual(memoStyles[0],memoStyles[1]);assert(memoStyles[0].h<30);assert(!(await page.locator('.student-shell').innerText()).includes('SECRET33'));
 await page.evaluate(()=>window.scrollTo(0,400));await page.evaluate(async()=>(await import('/js/app.js')).render());assert.equal(await page.evaluate(()=>scrollY),400);
 await page.getByRole('button',{name:'아바타 옷장',exact:true}).click();assert.equal(await page.evaluate(()=>scrollY),0);
 for(const [category,id] of [['머리','star-hat'],['옷','star-cape'],['효과','star-aura'],['배경','star-sky']]){
  await page.getByRole('button',{name:'옷 가게',exact:true}).click();await page.getByRole('button',{name:category,exact:true}).click();
  await page.locator(`[data-avatar-id="${id}"]`).getByRole('button',{name:'구매',exact:true}).click();await page.locator(`[data-avatar-id="${id}"]`).getByRole('button',{name:'장착',exact:true}).waitFor();
  await page.locator(`[data-avatar-id="${id}"]`).getByRole('button',{name:'장착',exact:true}).click();await page.locator(`.student-character-scene [data-avatar-item="${id}"]`).waitFor();
 }
 const balance=await page.evaluate(async id=>{const {store}=await import('/js/shared/state.js');return (await import('/js/core.js')).studentBalance(store.db,id);},seed.s);assert.equal(balance,seed.balance-70);
 await page.locator('[data-avatar-id=star-hat]').getByRole('button',{name:'장착 해제',exact:true}).click();assert.equal(await page.locator('.student-character-scene [data-avatar-item=star-hat]').count(),0);
 await page.locator('[data-avatar-id=star-hat]').getByRole('button',{name:'장착',exact:true}).click();
 await page.getByRole('button',{name:'별빛 교실',exact:true}).click();assert.equal(await page.locator('.student-character-scene [data-avatar-item]').count(),4);assert.equal(await page.evaluate(()=>scrollY),0);
 for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await page.screenshot({path:'/tmp/patch33-avatar.png'});
 assert.equal(await page.locator('.student-character-scene img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
 await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();await page.evaluate(async()=>{(await import('/js/app.js')).navigate('경제');});
 const history=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'최근 학급 경제 거래',exact:true})});assert.deepEqual(await history.locator('th').allTextContents(),['일시','학생','종류','내용']);
 assert.deepEqual(errors,[]);console.log('PASS: identical date fonts, right-side memo groups and teacher/student icon boundaries, entry/section scroll top with same-section retention, all four avatar purchases/equips/layers/unequip/balance, responsive loaded assets, four-column teacher ledger');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
