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
 await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');store.db=C.initialDB();store.db.students=[{id:'s0',no:1,name:'가온'},{id:'s1',no:2,name:'나래'},{id:'s2',no:3,name:'다온'}];});
 for(const width of [1280,412]){
  await page.setViewportSize({width,height:900});await page.evaluate(async width=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');store.db.surveys=[];store.db.survey_responses=[];store.db=C.applyOps(store.db,C.surveyStartOps(store.db,'46차 '+width));localStorage.setItem('startoday-demo-v1',JSON.stringify(store.db));(await import('/js/tabs/student-view.js')).previewStudent('s0');},width);await page.getByRole('button',{name:'설문',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.survey-board')?.dataset.bound==='true');
  const chip=page.locator('.survey-peer-list [data-survey-peer=s1]'),initial=await chip.boundingBox();assert.equal(await chip.innerText(),'나래');assert.equal(await chip.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');await chip.click();await page.locator('.survey-board').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.survey-board')?.dataset.bound==='true');let b=await page.locator('.survey-board').boundingBox();await page.mouse.click(b.x+b.width*.7,b.y+b.height*.3);assert.equal(await chip.innerText(),'나래');assert.equal(await chip.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(229, 231, 235)');const after=await chip.boundingBox();assert.equal(after.width,initial.width);assert.equal(after.height,initial.height);
  await page.waitForFunction(()=>document.querySelector('.survey-board')?.dataset.bound==='true');const placed=page.locator('.survey-board-chip[data-survey-peer=s1]'),r=await placed.boundingBox(),old=await placed.evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)}));b=await page.locator('.survey-board').boundingBox();await page.mouse.move(r.x+r.width*.8,r.y+r.height*.3);await page.mouse.down();await page.mouse.move(r.x+r.width*.8+18,r.y+r.height*.3+12,{steps:5});await page.mouse.up();const next=await placed.evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)}));assert(Math.abs(next.x-old.x-18/b.width*100)<.2,JSON.stringify({old,next,b,r,width}));assert(Math.abs(next.y-old.y-12/b.height*100)<.2);
  await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');const surveyId=store.db.surveys[0].id;store.db.survey_responses=[{id:'r46',surveyId,studentId:'s1',placements:[{targetId:'s0',x:88,y:90,reason:'받은 이유 검증'},{targetId:'s2',x:10,y:15,reason:'불편 이유 검증'}]}];localStorage.setItem('startoday-demo-v1',JSON.stringify(store.db));(await import('/js/app.js')).navigate('통계');});await page.getByRole('button',{name:'우리반 마음 지도',exact:true}).click();assert.match(await page.locator('.survey-preferred').innerText(),/긍정 1회/);assert.match(await page.locator('.survey-nonpreferred').innerText(),/불편 1회/);if(!await page.locator('.survey-response-details').evaluate(e=>e.open))await page.locator('.survey-response-details summary').click();await page.getByRole('button',{name:'학생별 받은 응답',exact:true}).click();assert.match(await page.locator('[data-survey-recipient=s0]').innerText(),/나래.*88\.0, 90\.0.*받은 이유 검증/s);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`/tmp/patch46-survey-${width}.png`});
 }
 assert.deepEqual(errors,[]);console.log('PASS: 1280/412 stable survey chips/off-center drag and teacher rankings/legacy received reasons');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
