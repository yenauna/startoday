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
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const sizes=[[320,640],[360,800],[375,812],[412,891],[414,896],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080]];
const teacherTabs=['대시보드','기록','시간표·일정','과제','루틴','경제','통계','수업도구','자리','설정'];
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const [width,height] of sizes){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  await page.goto(base);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  const state=async label=>{
   await page.waitForTimeout(60);
   const m=await page.evaluate(()=>{
    const vw=innerWidth,doc=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);
    const outside=[...document.querySelectorAll('.top button,.top .brand-home,.student-home-topbar button')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&(r.right>vw+1||r.left<-1);}).map(el=>(el.textContent||el.getAttribute('aria-label')||'button').trim().slice(0,18));
    const cards=[...document.querySelectorAll('.student[data-student-id]')].map(el=>Math.round(el.getBoundingClientRect().width)).filter(w=>w>0);
    return {vw,doc,outside,cards,topH:Math.round((document.querySelector('.top')?.getBoundingClientRect().height)||0)};
   });
   assert(m.doc<=m.vw+1,`${width}px ${label}: horizontal scroll (${m.doc}>${m.vw})`);
   assert.deepEqual(m.outside,[],`${width}px ${label}: control outside viewport ${m.outside.join(', ')}`);
   if(m.cards.length) assert(Math.min(...m.cards)>=110,`${width}px ${label}: student card too narrow (${Math.min(...m.cards)}px)`);
   if(m.topH) assert(m.topH<=140,`${width}px ${label}: top bar wrapped to ${m.topH}px`);
   return m;
  };
  for(const tab of teacherTabs){await page.evaluate(async t=>(await import('/js/app.js')).navigate(t),tab);await state(`teacher:${tab}`);}
  await page.evaluate(async()=>{document.querySelector('[data-settings-tab="칭호 관리"]')?.click();});
  await state('teacher:칭호 관리');

  // Keep the narrow routine table readable without pushing the page sideways.
  if(width<=640){
   await page.evaluate(async()=>(await import('/js/app.js')).navigate('루틴'));await page.waitForTimeout(120);
   const routine=await page.evaluate(()=>{const table=document.querySelector('.routine-table');if(!table)return null;return {tableW:Math.round(table.getBoundingClientRect().width),rowH:Math.round(table.querySelector('tbody tr').getBoundingClientRect().height),doc:document.documentElement.scrollWidth,vw:innerWidth};});
   assert(routine,`${width}px: routine table missing`);
   assert(routine.tableW>=500,`${width}px: routine table crushed to ${routine.tableW}px`);
   assert(routine.rowH<150,`${width}px: routine rows crushed into ${routine.rowH}px`);
   assert(routine.doc<=routine.vw+1,`${width}px: routine page scrolls sideways`);
  }
  const sid=await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.students[0].id);
  await page.evaluate(async id=>(await import('/js/tabs/student-view.js')).previewStudent(id),sid);
  await state('student:home');
  const section=async text=>{await page.locator('.student-home-topbar .economy-subtabs button',{hasText:text}).first().click();};
  await section('경제');await state('student:경제');
  await state('student:경제-상점');
  await section('설문');await state('student:설문');
  await section('별빛 교실');await page.locator('.student-wardrobe-open').first().click();await state('student:아바타');
  await page.evaluate(async id=>{const m=await import('/js/tabs/student-view.js');m.leaveStudentView();m.previewStudent(id);},sid);
  if(width===768||width===1024){
   await page.evaluate(async()=>{const m=await import('/js/tabs/student-view.js');m.leaveStudentView();});
   await page.evaluate(async()=>(await import('/js/app.js')).navigate('대시보드'));await page.waitForTimeout(80);
   const glass=await page.evaluate(id=>{const card=document.querySelector(`.student[data-student-id="${id}"]`);if(!card)return null;const s=getComputedStyle(card);return {unfinished:card.classList.contains('unfinished'),bg:s.backgroundColor,border:s.borderColor,img:s.backgroundImage};},sid);
   assert(glass,`${width}px: roster card missing after leaving student view`);
   if(glass.unfinished){assert.equal(glass.bg,'rgba(255, 198, 212, 0.46)');assert.equal(glass.border,'rgba(255, 226, 232, 0.85)');assert.equal(glass.img,'none');}
  }
  await page.evaluate(async()=>(await import('/js/tabs/classroom.js')).classroom());
  await state('classroom');
  assert.deepEqual(errors,[],`${width}px page errors`);
  await page.close();
 }
 console.log('PASS: 320/360/375/412/414/768(iPad portrait)/1024(iPad landscape)/1280/1440/1920 teacher tabs, settings titles, student home/economy/survey/avatar and classroom have no horizontal scroll, no controls outside the viewport, readable student cards and top bar; 768/1024 unfinished cards stay cool pink glass');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
