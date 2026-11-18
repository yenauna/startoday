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
 const seed=await page.evaluate(async()=>{const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');let d=C.initialDB();const date=C.today();d.students=[{id:'s45',no:1,name:'가온'}];d.records=Array.from({length:5},(_,i)=>({id:'r45-'+i,date:C.addDays(date,-5+i),studentIds:['s45'],kind:'칭찬',areas:[i<3?'학습':'관계'],text:i<3?'학습 근거 '+i:'관계 최신 근거 '+i,createdAt:C.now()}));d.assignments=Array.from({length:3},(_,i)=>({id:'a45-'+i,date,title:'수학 100쪽 풀이 과정을 공책에 자세히 적기 '+i,memo:'준비물과 제출 안내를 전체 폭에서 읽기 '+i,repeat:{type:'none'},target:'all'}));store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.date=date;(await import('/js/app.js')).navigate('과제');return {date};});
 let selectedColor,redColor;
 for(const width of [1280,412]){await page.setViewportSize({width,height:900});const day=page.locator(`.assignment-day[data-date="${seed.date}"]`);if(width===412){assert.equal(await day.locator('.assignment-calendar-task:visible').count(),3);assert.equal(await day.locator('.assignment-calendar-task').first().evaluate(e=>getComputedStyle(e).color),redColor);assert.equal(await day.locator('.assignment-calendar-count').count(),0);assert.equal(await page.locator('.assignment-date-detail .assignment-date-task').count(),3);assert((await page.locator('.assignment-date-detail').innerText()).includes('수학 100쪽 풀이 과정을 공책에 자세히 적기 2'));assert((await page.locator('.assignment-date-detail').innerText()).includes('준비물과 제출 안내'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.locator('.assignment-date-detail').screenshot({path:'/tmp/patch45-detail-412.png'});}else{assert.equal(await day.locator('.assignment-calendar-task:visible').count(),3);redColor=await day.locator('.assignment-calendar-task.has-incomplete').first().evaluate(e=>getComputedStyle(e).color);}
 selectedColor=await day.evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(await page.locator('.sticky-navigation .tabs button.active').evaluate(e=>getComputedStyle(e).backgroundColor),selectedColor);await page.locator('.assignment-calendar-panel').screenshot({path:`/tmp/patch45-calendar-${width}.png`});}
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('설정'));assert.equal(await page.locator('.settings-sidebar button.active').evaluate(e=>getComputedStyle(e).backgroundColor),selectedColor);assert(!/수파베이스/.test(await page.locator('body').innerText()));
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('대시보드'));assert.equal(await page.locator('.pending-tasks .task').first().evaluate(e=>getComputedStyle(e).color),redColor);await page.locator('.student-head strong').first().click();const border=await page.locator('.student.selected').evaluate(e=>getComputedStyle(e).outlineColor);assert.equal(border,await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--st-selected-border').trim()).then(c=>page.evaluate(color=>{const e=document.createElement('span');e.style.color=color;document.body.append(e);const c=getComputedStyle(e).color;e.remove();return c;},c)));
 await page.evaluate(async()=>{const ui=await import('/js/tabs/students.js');ui.behaviorConverter(['s45'],'2020-01-01','2030-01-01');});const draft=await page.locator('[data-behavior-draft]').inputValue();assert(draft.includes('학습 분야에서 3건의 칭찬'));assert(draft.includes('학습 근거 2'));assert(!draft.includes('관계 최신 근거'));assert.match(await page.locator('.behavior-result>p').innerText(),/칭찬 5건/);assert.deepEqual(errors,[]);console.log('PASS: 1280/412 full task titles in the month grid, date details, common selected/pending colors, service-neutral settings and behavior total/field counts with matching evidence');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
