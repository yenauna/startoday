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
 for(const viewport of [{width:1280,height:800},{width:412,height:891}]){
  const page=await browser.newPage({viewport}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
  await page.goto(url);
  await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  const navigate=async tab=>page.evaluate(async tab=>(await import('/js/app.js')).navigate(tab),tab);
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  for(const tab of ['대시보드','기록','시간표·일정','과제','루틴','경제','통계','수업도구','자리','설정']){await navigate(tab);await noOverflow();}
  await navigate('대시보드');
  const fields=page.locator('.quick-entry-fields');
  const search=page.locator('#quick-student-query'),text=page.locator('#quick-text');
  assert.equal(await search.evaluate(e=>getComputedStyle(e).fontSize),'16px');
  assert((await text.boundingBox()).y>(await search.boundingBox()).y);
  if(viewport.width===1280){assert((await fields.boundingBox()).width>2*(await page.locator('.quick-areas').boundingBox()).width);}
  await page.screenshot({path:`${shots}/p2-dashboard-${viewport.width}.png`,fullPage:true});
  // Search/selection still preserves the draft and keyboard focus.
  await text.fill('관찰한 내용을 이어서 기록해요.');
  await search.fill('가온');await search.press('Enter');
  assert.equal(await text.inputValue(),'관찰한 내용을 이어서 기록해요.');
  assert.equal(await page.locator('.selection-composer').count(),1);
  await page.locator('#quick-cancel').click();
  await navigate('설정');
  const sizes=await page.locator('#settings-form [name=className],#settings-form [name=academicYear],#settings-form [name=schoolName],#settings-form [name=grade],#settings-form [name=classGroup]').evaluateAll(es=>es.map(e=>({name:e.name,height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top})));
  assert(sizes.every(e=>e.height===42),JSON.stringify(sizes));
  if(viewport.width===1280)assert(Math.abs(sizes.find(e=>e.name==='grade').top-sizes.find(e=>e.name==='schoolName').top)<1,JSON.stringify(sizes));
  await page.screenshot({path:`${shots}/p2-settings-${viewport.width}.png`,fullPage:true});
  await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');store.db.surveys=[{id:'p2-round',title:'우리반 마음 지도 1차',status:'open',createdAt:C.now()}];(await import('/js/tabs/student-view.js')).previewStudent(store.db.students[0].id)});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`${shots}/p2-student-${viewport.width}.png`,fullPage:true});
  if(viewport.width===412){
   const title=await page.locator('.student-tasks-card .student-section-heading').first().boundingBox();
   assert(title.y+title.height<viewport.height,JSON.stringify(title));
   const first=await page.locator('.student-tasks-card .student-task').first().boundingBox();
   assert(first.y<viewport.height,'First task outside viewport: '+first.y);
   const scene=await page.locator('.student-profile-card .student-character-scene').boundingBox();assert(scene.height<190,JSON.stringify(scene));
  }
  await noOverflow();
  // Mobile/desktop month cells must retain actual content, not count summaries.
  assert.equal(await page.locator('.student-calendar-count').count(),0);
  assert(await page.locator('.student-calendar-pill:visible').count()>0);
  await page.getByRole('button',{name:'설문',exact:true}).click();
  const padding=await page.locator('.student-survey').evaluate(e=>{const s=getComputedStyle(e);return[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft]});
  assert.deepEqual(padding,['16px','16px','16px','16px']);
  await page.locator('.survey-peer-list button').first().click();
  await page.locator('.survey-board[data-bound=true]').waitFor();
  await page.getByRole('group',{name:/친구 위치 보드/}).press('Enter');
  await page.locator('.survey-board-chip').waitFor();
  assert.equal(await page.locator('.survey-board-chip').count(),1);
  await noOverflow();await page.screenshot({path:`${shots}/p2-survey-${viewport.width}.png`,fullPage:true});
  await page.getByRole('button',{name:'별빛 교실',exact:true}).click();
  await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');store.db.students[0].nickname='반짝이는우리교실';store.db.assignments[0].title='수학 풀이 과정과 생각을 자세히 설명하고 친구와 서로 확인하는 긴 과제 제목';(await import('/js/app.js')).render()});
  await noOverflow();
  await page.getByRole('button',{name:'아바타 옷장',exact:true}).click();await noOverflow();
  await page.getByRole('button',{name:'별빛 교실',exact:true}).click();
  await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
  await navigate('시간표·일정');assert.equal(await page.locator('.calendar-mobile-summary').count(),0);
  const arrows=await page.locator('.toolbar button').filter({hasText:/^[‹›]$/}).evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
  assert(arrows.every(h=>h<44),JSON.stringify(arrows));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: 1280x800/412x891 overflow, draft preservation, 42px aligned settings, first-viewport tasks, 16px survey padding, keyboard placement, long text/wardrobe, visible month content and compact arrows');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
