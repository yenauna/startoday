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
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>{const C=await import('/js/core.js'),{store,state}=await import('/js/shared/state.js'),d=C.initialDB(),date=C.today();d.students=[{id:'a',no:1,name:'김가온'},{id:'b',no:2,name:'이나래'}];d.assignments=Array.from({length:6},(_,i)=>({id:'t'+i,title:'긴 과제 제목 '+i,date,target:'all',repeat:{type:'none'}}));d.routines=Array.from({length:7},(_,i)=>({id:'r'+i,title:'긴 루틴 제목 '+i,target:'all'}));d.records=[];store.db=d;state.date=date;state.selected=[];localStorage.setItem('startoday-demo-v1',JSON.stringify(d));(await import('/js/app.js')).navigate('대시보드');});
 const nav=async tab=>page.evaluate(async tab=>(await import('/js/app.js')).navigate(tab),tab);
 assert.equal(await page.locator('.demo-banner .demo-reset').count(),1);assert.equal(await page.locator('#main .demo-reset').count(),0);page.once('dialog',dialog=>dialog.dismiss());await page.locator('.demo-reset').click();assert.equal(await page.locator('[data-student-id]').count(),2);
 assert.equal(await page.locator('[data-student-id=a] .routine-task').count(),3);assert.equal(await page.locator('[data-student-id=a] .pending-tasks button').count(),3);await page.locator('[data-student-id=a] .routine-more').click();assert.equal(await page.locator('#modal .routine-task').count(),0);assert.match(await page.locator('#modal').innerText(),/긴 루틴 제목 6/);await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'간단히',exact:true}).click();assert.equal(await page.locator('[data-student-id=a] .task').first().isVisible(),false);await page.getByRole('button',{name:'자세히',exact:true}).click();
 let count=0;
 for(const privateRecord of [false,true])for(const label of ['칭찬','기록','조언']){
  assert.deepEqual(await page.locator('#quick-form .record-action').allTextContents(),['칭찬','기록','조언']);assert.equal(await page.locator('#quick-private').isChecked(),false);
  await page.locator('#quick-student-query').fill('1');await page.locator('#quick-student-query').press('Enter');await page.locator('#quick-text').fill(`${privateRecord?'비공개':'공개'} ${label} 검증`);
  if(privateRecord){await page.locator('.quick-options-toggle').click();await page.locator('#quick-private').check();await page.locator('.quick-areas .area-chip').first().click();assert.equal(await page.locator('#quick-private').isChecked(),true);}
  await page.locator('#quick-form').getByRole('button',{name:label,exact:true}).click();count++;await page.waitForFunction(async count=>(await import('/js/shared/state.js')).store.db.records.length===count,count);
 }
 const saved=await page.evaluate(async()=>{const C=await import('/js/core.js'),{store}=await import('/js/shared/state.js');return {records:store.db.records,report:C.reportRecords(store.db,'a',C.today(),C.today())};});assert.equal(saved.report.length,3);assert(saved.records.slice(3).every(r=>r.printIncluded===false));assert.deepEqual(saved.records.slice(3).map(r=>r.kind),['칭찬','추가기록','지도']);assert.equal(saved.records[4].extraType,'메모');
 await page.evaluate(async()=>{const C=await import('/js/core.js');(await import('/js/tabs/records.js')).recordEditor({id:'legacy-extra',kind:'추가기록',extraType:'메모',date:C.today(),studentIds:['a'],text:'예전 메모'},true);});assert.equal(await page.locator('#modal').getByRole('checkbox',{name:'비공개',exact:true}).isChecked(),true);await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await nav('기록');assert.equal(await page.locator('.record .badge').filter({hasText:'비공개'}).count(),3);
 await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');(await import('/js/tabs/records.js')).recordEditor(store.db.records[3],true);});assert.equal(await page.locator('#modal').getByRole('checkbox',{name:'비공개',exact:true}).isChecked(),true);await page.locator('#modal [name=text]').fill('수정 후에도 비공개');await page.locator('#modal button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.records[3].printIncluded),false);
 await nav('대시보드');await page.locator('#quick-student-query').fill('2');await page.locator('#quick-student-query').press('Enter');await page.setViewportSize({width:375,height:900});await page.evaluate(async()=>(await import('/js/components/header.js')).openMobileQuickRecord());await page.locator('#mobile-quick-text').fill('모바일 비공개 메모');await page.locator('#mobile-quick-form summary').click();await page.locator('#mobile-quick-form').getByRole('checkbox',{name:'비공개',exact:true}).check();await page.locator('#mobile-quick-form').getByRole('button',{name:'기록',exact:true}).click();await page.waitForFunction(async()=>(await import('/js/shared/state.js')).store.db.records.length===7);assert.deepEqual(await page.evaluate(async()=>{const r=(await import('/js/shared/state.js')).store.db.records.at(-1);return [r.kind,r.extraType,r.printIncluded];}),['추가기록','메모',false]);
 for(const width of [320,375,414,768,1024,1280,1440,1920]){
  await page.setViewportSize({width,height:1000});await nav('대시보드');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`dashboard overflow ${width}`);const rows=await page.locator('.quick-areas .area-chip').evaluateAll(es=>new Set(es.map(e=>Math.round(e.getBoundingClientRect().y))).size);if(width>=768)assert.equal(rows,1,`area row ${width}`);
  await nav('통계');const trigger=page.locator('.student-custom-range .date-range-trigger'),period=page.getByRole('button',{name:'이번 달',exact:true});assert(Math.abs((await trigger.boundingBox()).height-(await period.boundingBox()).height)<1);await trigger.click();await page.getByRole('dialog',{name:'조회 기간 달력',exact:true}).waitFor();await page.keyboard.press('Escape');
  await nav('경제');await page.getByRole('button',{name:'☰ 엑셀 목록형',exact:true}).click();const table=page.locator('.economy-assets-table');assert((await table.locator('th').first().boundingBox()).width<=65);for(const b of await page.locator('.economy-asset-actions button').all())assert((await b.boundingBox()).height>=40);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`economy overflow ${width}`);
 }
 await page.evaluate(async()=>(await import('/js/tabs/student-view.js')).previewStudent('b'));assert.equal(await page.locator('.constellation-hero.is-zero-progress').count(),1);const dim=page.locator('.constellation-hero.is-zero-progress .constellation-cluster:not(.is-faint) .star-point').first();assert.equal(await dim.evaluate(e=>getComputedStyle(e).fill),'rgb(169, 193, 222)');
 assert.deepEqual(errors,[]);console.log('PASS: three quick actions/public-private persistence, legacy note encoding, all-kind report exclusions/badges/editor preservation, mobile private save, banner reset, bounded routines, compact area row, matching filters and touchable economy actions, zero progress visibility, eight widths');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
