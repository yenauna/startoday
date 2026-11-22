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
 page.setDefaultTimeout(10000);
 await page.evaluate(async()=>{const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');const d=C.initialDB();d.students=[{id:'s0',no:1,name:'가온'},{id:'s1',no:2,name:'나래'},{id:'s2',no:3,name:'다온'}];store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));(await import('/js/app.js')).navigate('통계');});
 await page.getByRole('button',{name:'우리반 마음 지도',exact:true}).click();
 for(const width of [1280,412]){
  await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'새 설문 시작',exact:true}).click();await page.locator('#modal [name=title]').fill('마음 지도 '+width);if(width===412){await page.locator('.survey-tag-editor summary').click();await page.locator('[name=comfortableTags]').fill((await page.locator('[name=comfortableTags]').inputValue())+'\n맞춤 태그');}await page.locator('#modal button[type=submit]').click();await page.getByText(/제출 0\/3명/).waitFor();assert.match(await page.locator('.survey-teacher').innerText(),/제출 0\/3명/);
  await page.evaluate(async()=>(await import('/js/tabs/student-view.js')).previewStudent('s0'));await page.getByRole('button',{name:'설문',exact:true}).click();assert.equal(await page.locator('.survey-peer-list button').count(),2);assert.equal(await page.getByRole('button',{name:'제출하기',exact:true}).isDisabled(),true);
  await page.waitForFunction(()=>document.querySelector('.survey-board')?.dataset.bound==='true');
  let board=await page.locator('.survey-board').boundingBox();
  if(width===1280){const chip=await page.locator('.survey-peer-list [data-survey-peer=s1]').boundingBox();await page.mouse.move(chip.x+chip.width/2,chip.y+chip.height/2);await page.mouse.down();await page.mouse.move(board.x+board.width*.8,board.y+board.height*.2,{steps:8});await page.mouse.up();}
  else{await page.locator('.survey-peer-list [data-survey-peer=s1]').click();await page.locator('.survey-board').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.survey-board')?.dataset.bound==='true');board=await page.locator('.survey-board').boundingBox();await page.mouse.click(board.x+board.width*.8,board.y+board.height*.2);}
  assert.equal(await page.locator('[data-reason-group]').first().getAttribute('data-reason-group'),'comfortable');
  const tag=page.getByRole('button',{name:'같이 놀면 재밌다',exact:true});await tag.click();assert.equal(await tag.getAttribute('aria-pressed'),'true');await tag.click();assert.equal(await tag.getAttribute('aria-pressed'),'false');
  await page.locator('[data-survey-reason]').fill('함께 놀아서 편안해요');await tag.click();await page.getByRole('button',{name:'같이 있으면 어색하다',exact:true}).click();assert.equal(await page.locator('[data-survey-reason]').inputValue(),'함께 놀아서 편안해요');await page.locator('.survey-reason-tag-picker').screenshot({path:`/tmp/survey-reason-tags-${width}.png`});if(width===412){assert((await tag.boundingBox()).height>=44);assert.equal(await page.getByRole('button',{name:'맞춤 태그',exact:true}).count(),1);}await page.locator('.survey-peer-list [data-survey-peer=s2]').click();await page.locator('.survey-board').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.survey-board')?.dataset.bound==='true');board=await page.locator('.survey-board').boundingBox();await page.mouse.click(board.x+board.width*.2,board.y+board.height*.8);assert.equal(await page.locator('[data-reason-group]').first().getAttribute('data-reason-group'),'uncomfortable');assert.equal(await page.getByRole('button',{name:'제출하기',exact:true}).isEnabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`/tmp/patch44-student-${width}.png`});await page.getByRole('button',{name:'제출하기',exact:true}).click();await page.getByText('제출을 완료했습니다. 다음 설문을 기다려 주세요.',{exact:true}).waitFor();assert.equal(await page.locator('.survey-board').count(),0);
  const saved=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.survey_responses.at(-1);});assert(Math.abs(saved.placements[0].x-80)<.5);assert(Math.abs(saved.placements[0].y-80)<.5);assert.equal(saved.placements[0].reason,'함께 놀아서 편안해요');assert.equal(saved.placements[1].reason,'');assert.deepEqual(saved.placements[0].tags,['같이 놀면 재밌다','같이 있으면 어색하다']);assert.deepEqual(saved.placements[1].tags,[]);
  await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();await page.getByRole('button',{name:'통계',exact:true}).click();assert.match(await page.locator('.survey-teacher').innerText(),/제출 1\/3명/);assert(await page.locator('.survey-response-tag').count()>0);
  await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');const id=store.db.surveys.find(s=>s.status==='open').id;for(const sid of ['s1','s2'])await store.commit(C.surveySubmitOps(store.db,sid,id,store.db.students.filter(s=>s.id!==sid).map(s=>({targetId:s.id,x:80,y:80,reason:'친구 이유'}))));(await import('/js/app.js')).render();});
  assert.match(await page.locator('.survey-teacher').innerText(),/제출 3\/3명/);assert((await page.locator('.survey-analysis-card').allTextContents()).some(t=>t.includes('상호 친밀')));assert((await page.locator('.survey-teacher').innerText()).includes('함께 놀아서 편안해요'));if(!await page.locator('.survey-response-details').evaluate(e=>e.open))await page.locator('.survey-response-details summary').click();await page.getByRole('button',{name:'학생별 받은 응답',exact:true}).click();assert(await page.locator('.survey-response-details .survey-response-tag').count()>=2);await page.screenshot({path:`/tmp/patch44-teacher-${width}.png`,fullPage:true});page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'설문 마감',exact:true}).click();await page.getByRole('button',{name:'설문 마감',exact:true}).waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'설문 마감',exact:true}).count(),0);
 }
 assert.equal(await page.locator('.survey-rounds button').count(),2);assert.deepEqual(errors,[]);console.log('PASS: teacher start/close/history/missing roster, PC drag and 412px select/place/reason, all-peer gating, exact positions, one submission/completion, teacher-only relationship reports');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
