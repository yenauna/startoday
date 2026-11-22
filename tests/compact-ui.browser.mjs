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
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [1280,412]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  const menu=async name=>{await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.locator('#navigation-drawer').getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('#navigation-drawer').evaluate(e=>e.open),false);};
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#navigation-drawer').evaluate(e=>e.open),false);
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.mouse.click(width-8,450);assert.equal(await page.locator('#navigation-drawer').evaluate(e=>e.open),false);
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#navigation-drawer')).transform==='matrix(1, 0, 0, 1, 0, 0)');await page.screenshot({path:`/tmp/compact-drawer-${width}.png`});await page.keyboard.press('Escape');await menu('기록');
  await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');state.recordFilters={from:'2026-11-01',to:'2026-11-22',student:'',kind:'',area:'',q:''};(await import('/js/app.js')).render();});
  assert.equal(await page.locator('#record-filter label').count(),0);assert.equal(await page.locator('#record-filter input[type=date]').count(),0);assert.equal(await page.getByRole('combobox',{name:'학생',exact:true}).inputValue(),'');await page.getByPlaceholder('내용 검색',{exact:true}).fill('보존할 검색어');
  await page.locator('#record-filter .date-range-trigger').click();await page.locator('[data-range-day="2026-11-12"]').click();await page.getByRole('button',{name:'닫기',exact:true}).click();
  assert.equal(await page.locator('#record-filter [name=from]').inputValue(),'2026-11-12');assert.equal(await page.locator('#record-filter [name=to]').inputValue(),'2026-11-12');assert.equal(await page.getByPlaceholder('내용 검색',{exact:true}).inputValue(),'보존할 검색어');
  await page.locator('#record-filter .date-range-trigger').click();await page.locator('[data-range-day="2026-11-20"]').click();await page.locator('[data-range-day="2026-11-04"]').click();assert.equal(await page.locator('#record-filter [name=from]').inputValue(),'2026-11-04');assert.equal(await page.locator('#record-filter [name=to]').inputValue(),'2026-11-20');
  await page.locator('#record-filter .date-range-trigger').click();await page.locator('[data-range-day="2026-11-14"]').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#record-filter [name=to]').inputValue(),'2026-11-14');
  await page.locator('#record-filter .date-range-trigger').click();await page.getByRole('button',{name:'다음 달',exact:true}).click();assert.equal(await page.locator('[data-range-day="2026-12-31"]').count(),1);await page.getByRole('button',{name:'초기화',exact:true}).click();await page.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await page.locator('#record-filter [name=from]').inputValue(),'2026-11-14');
  await page.locator('#record-filter .date-range-trigger').click();await page.getByRole('button',{name:'오늘',exact:true}).last().click();const today=await page.evaluate(async()=>(await import('/js/core.js')).today());assert.equal(await page.locator('#record-filter [name=from]').inputValue(),today);assert.equal(await page.locator('#record-filter [name=to]').inputValue(),today);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`/tmp/compact-records-${width}.png`});
  await menu('통계');assert.equal(await page.locator('#student-sort').count(),1);await page.locator('#student-sort').selectOption('stars');assert.equal(await page.locator('#student-sort').inputValue(),'stars');assert.equal(await page.locator('.statistics-sort button').count(),0);const exportButton=page.getByRole('button',{name:'학생 선택 / 전체 내보내기',exact:true});assert.equal(await exportButton.locator('svg').count(),1);assert.equal(await exportButton.getAttribute('title'),'학생 선택 / 전체 내보내기');assert.equal(await page.locator('.student-custom-range input[type=date]').count(),0);await page.screenshot({path:`/tmp/compact-statistics-${width}.png`});
  await page.evaluate(async()=>{(await import('/js/tabs/student-view.js')).studentLoginDialog();});
  const config=await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.settings[0]);await page.locator('#modal [name=schoolName]').fill(config.schoolName);await page.locator('#modal [name=grade]').fill(String(config.grade));await page.locator('#modal [name=classGroup]').fill(String(config.classGroup));await page.locator('#modal [name=no]').fill('1');await page.locator('#modal [name=password]').fill('틀린암호999');await page.locator('#modal [type=submit]').click();await page.locator('#student-login-error:not([hidden])').waitFor();assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);assert.equal(await page.locator('#modal [name=password]').getAttribute('aria-invalid'),'true');await page.screenshot({path:`/tmp/compact-login-${width}.png`});
  await page.locator('#modal [name=password]').fill(config.defaultStudentPassword||'바람123');assert.equal(await page.locator('#student-login-error').isHidden(),true);await page.locator('#modal [type=submit]').click();await page.locator('[name=newPassword]').waitFor();
  for(const [password,level] of [['가가가가가','weak'],['별빛123','medium'],['고운마음123','strong']]){await page.locator('[name=newPassword]').fill(password);assert.equal(await page.locator('#student-password-strength').getAttribute('data-level'),level);}
  assert.equal(await page.getByRole('button',{name:'닫기',exact:true}).locator('svg').count(),1);await page.screenshot({path:`/tmp/compact-strength-${width}.png`});await page.locator('[name=confirmPassword]').fill('고운마음123');await page.locator('#modal [type=submit]').click();await page.locator('.student-shell').waitFor();assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: PC1280/mobile412 drawer select/outside/Esc, inline filters, single/reversed/month/reset date ranges with draft preservation, compact sort/export SVG, inline auth error/retry and Korean strength/change flow');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
