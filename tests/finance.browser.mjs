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
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.clock.setFixedTime(new Date('2026-11-27T01:00:00Z'));
 await page.addInitScript(()=>{const interval=window.setInterval;window.setInterval=(fn,ms,...args)=>interval(fn,ms===30000?50:ms,...args);});
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');const d=C.initialDB();d.students=[{id:'s',no:1,name:'가온'}];d.attendance=[];d.records=[];d.economy_tx=[{id:C.uid(),studentId:'s',type:'지급',amount:1000,createdAt:C.now()}];store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));(await import('/js/app.js')).navigate('경제');});
 const close=()=>page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'은행·주식',exact:true}).click();await page.locator('.teacher-finance').waitFor();
 await page.getByRole('button',{name:'이율표 설정',exact:true}).click();await page.locator('#modal [name=tiers]').fill('0:2\n10:3\n30:4');await page.locator('#modal [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 await page.getByRole('button',{name:'주식 설정',exact:true}).click();await page.locator('#modal [name=settlementMinutes]').fill('80');await page.locator('#modal [name=extras]').fill('207940.KS | 테스트 바이오');await page.locator('#modal [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 const samsung=page.locator('.finance-quote').filter({hasText:'005930.KS'});await samsung.getByRole('button',{name:'가격 갱신',exact:true}).click();await page.locator('#modal [name=priceKrw]').fill('70000');await page.locator('#modal [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert((await samsung.innerText()).includes('70,000원'));
 for(const width of [320,375,414,768,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} teacher overflow`);await page.screenshot({path:`/workspace/work/finance-teacher-${width}.png`,fullPage:false});}
 // Teacher preview follows the same finance operations and displays only this student's projection.
 await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');state.impersonatingStudentId='s';state.viewMode='student';(await import('/js/app.js')).render();});
 await page.getByRole('button',{name:'경제',exact:true}).click();await page.getByRole('button',{name:'은행(정기예금)',exact:true}).click();await page.getByRole('button',{name:'예금 가입',exact:true}).click();await page.locator('#modal [name=principal]').fill('100');await page.locator('#modal [name=weeks]').selectOption('4');assert((await page.locator('#deposit-estimate').innerText()).includes('104'));await page.locator('#modal [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 let deposits=await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.bank_deposits);assert.equal(deposits.length,1);assert.equal(deposits[0].principal,100);
 // Persist a due maturity; the next view entry settles it exactly once.
 await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');store.db.bank_deposits[0].maturesAt='2026-11-27T00:59:00Z';localStorage.setItem('startoday-demo-v1',JSON.stringify(store.db));(await import('/js/app.js')).render();});
 await page.waitForFunction(async()=>(await import('/js/shared/state.js')).store.db.bank_deposits[0].status==='matured');assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.economy_tx.filter(t=>t.type==='예금만기').length),1);
 await page.getByRole('button',{name:'주식',exact:true}).click();await page.locator('.student-finance').waitFor();const stock=page.locator('.finance-quote').filter({hasText:'005930.KS'});await stock.getByRole('button',{name:'매수',exact:true}).click();await page.locator('#modal [name=amountPoints]').fill('100');assert((await page.locator('#stock-estimate').innerText()).includes('0.1428'));await page.locator('#modal [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 assert((await page.locator('.student-finance').innerText()).includes('정산 대기 중'));assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.stock_holdings.length),0);
 await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');store.db.stock_orders[0].settleAt='2026-11-27T00:59:00Z';localStorage.setItem('startoday-demo-v1',JSON.stringify(store.db));(await import('/js/app.js')).render();});await page.waitForFunction(async()=>(await import('/js/shared/state.js')).store.db.stock_holdings[0]?.shares===.1428);
 await stock.getByRole('button',{name:'매도',exact:true}).click();await page.locator('#modal [name=shares]').fill('0.1');assert((await page.locator('#stock-estimate').innerText()).includes('70포인트'));await page.locator('#modal [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.stock_holdings[0].shares),.0428);
 for(const width of [320,375,414,768,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} student overflow`);await page.screenshot({path:`/workspace/work/finance-student-${width}.png`,fullPage:false});}
 await page.clock.setFixedTime(new Date('2026-11-27T06:00:00Z'));await page.waitForFunction(()=>document.querySelector('.finance-market-hours')?.textContent.includes('지금은 조회만'));assert(await stock.getByRole('button',{name:'매수',exact:true}).isDisabled());assert((await page.locator('.finance-market-hours').innerText()).includes('지금은 조회만'));
 const standalone=await browser.newPage();await standalone.route('https://cdn.jsdelivr.net/**',r=>r.abort());standalone.on('pageerror',e=>errors.push(e.message));await standalone.goto(url+'/startoday-demo.html',{waitUntil:'domcontentloaded'});await standalone.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();await standalone.locator('#navigation-toggle').click();await standalone.locator('#navigation-drawer').getByRole('button',{name:'경제',exact:true}).click();await standalone.getByRole('button',{name:'은행·주식',exact:true}).click();await standalone.locator('.teacher-finance').waitFor();await standalone.close();
 assert.deepEqual(errors,[]);console.log('PASS finance teacher/student: tier/config/manual quote, deposits and automatic maturity, fractional market buy/sell and pending settlement, closed hours, eight responsive widths');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
