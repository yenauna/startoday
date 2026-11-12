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
 const context=await browser.newContext({viewport:{width:1280,height:1000}}), page=await context.newPage(), errors=[];
 context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 const url=`http://127.0.0.1:${server.address().port}`;
 await page.goto(url);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.getByRole('button',{name:'경제',exact:true}).click();await page.getByRole('button',{name:'상점 관리',exact:true}).click();
 const group=page.locator('.group-buy-card').filter({hasText:'금요일 보드게임 파티'});
 assert.match(await group.innerText(),/현재 65 \/ 목표 100별 \(65%\)/);
 await group.locator('.group-buy-progress-text').click();
 assert.match(await page.locator('.group-buy-ranking li').first().innerText(),/1등 가온 \(30별\)/);
 assert.equal(await page.locator('#modal [name=amount]').count(),0);
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'새 물품/쿠폰 등록',exact:true}).click();
 await page.locator('#modal [name=name]').fill('학급 영화 감상');
 await page.locator('#modal [name=description]').fill('친구들과 함께 영화를 봐요.');
 await page.locator('#modal [name=isGroupBuy]').check();
 assert.equal(await page.locator('#modal [name=stock]').isDisabled(),true);
 assert.match(await page.locator('#modal .shop-price-field').innerText(),/목표 모금액/);
 await page.locator('#modal [name=price]').fill('200');await page.locator('#modal button[type=submit]').click();
 const movie=page.locator('.group-buy-card').filter({hasText:'학급 영화 감상'});
 await movie.getByRole('button',{name:'수정',exact:true}).click();
 assert.equal(await page.locator('#modal [name=isGroupBuy]').isChecked(),true);
 await page.locator('#modal [name=price]').fill('250');await page.locator('#modal button[type=submit]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.group-buy-card')].some(el=>el.textContent.includes('학급 영화 감상')&&el.textContent.includes('목표 250별')));
 assert.match(await movie.innerText(),/목표 250별/);
 // Open the same local class in two windows and keep the first student's details open.
 async function preview(p,index){await p.evaluate(async index=>{const {store,state}=await import('/js/shared/state.js');state.impersonatingStudentId=store.db.students[index].id;state.viewMode='student';(await import('/js/app.js')).render();},index);await p.getByRole('button',{name:'경제',exact:true}).click();await p.getByRole('button',{name:'상점',exact:true}).click();}
 await preview(page,0);
 const initialBalance=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return (await import('/js/core.js')).studentBalance(store.db,store.db.students[0].id);});
 await group.getByRole('button',{name:'함께 모으기(기부)',exact:true}).click();
 assert.match(await page.locator('.group-buy-ranking .is-me').innerText(),/가온 \(30별\).*나의 기여/);
 for(const width of [360,390,768,1280]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.locator('#modal').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 }
 await page.setViewportSize({width:390,height:1000});
 await page.locator('#modal [name=amount]').fill('0');await page.getByRole('button',{name:'+1별',exact:true}).click();assert.equal(await page.locator('#modal [name=amount]').inputValue(),'1');
 await page.getByRole('button',{name:'+5별',exact:true}).click();assert.equal(await page.locator('#modal [name=amount]').inputValue(),'6');
 await page.getByRole('button',{name:'+10별',exact:true}).click();assert.equal(await page.locator('#modal [name=amount]').inputValue(),'16');
 await page.getByRole('button',{name:'전액',exact:true}).click();assert.equal(await page.locator('#modal [name=amount]').inputValue(),'35');
 await page.locator('#modal [name=amount]').fill('10');await page.getByRole('button',{name:'기여하기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.group-buy-ranking .is-me')?.textContent.includes('(40별)'));
 assert.equal(await page.locator('.village-wallet').getAttribute('aria-label'),`내 지갑 ${initialBalance-10}별코인`);
 const second=await context.newPage();await second.goto(url);await second.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();await preview(second,1);
 await second.locator('.group-buy-card').filter({hasText:'금요일 보드게임 파티'}).getByRole('button',{name:'함께 모으기(기부)',exact:true}).click();
 await second.locator('#modal [name=amount]').fill('10');await second.getByRole('button',{name:'기여하기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#modal .group-buy-progress-text')?.textContent.includes('현재 85'));
 assert.match(await page.locator('.group-buy-ranking li').nth(1).innerText(),/나래 \(35별\)/);
 await page.screenshot({path:'/tmp/group-buy-390.png',fullPage:false});
 // Exceeding the remaining goal within the wallet is automatically capped to 15.
 await page.locator('#modal [name=amount]').fill('30');await page.getByRole('button',{name:'기여하기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#modal .group-buy-progress-text')?.textContent.includes('현재 100'));
 assert.equal(await page.locator('#modal [name=amount]').count(),0);
 assert.equal(await group.getByRole('button',{name:'🎉 모금 완료!',exact:true}).isDisabled(),true);
 await second.waitForFunction(()=>document.querySelector('#modal .group-buy-progress-text')?.textContent.includes('현재 100'));
 const result=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');const C=await import('/js/core.js'), item=store.db.shop_items.find(i=>i.isGroupBuy);return {collected:item.groupCollected,funded:item.isFunded,contribs:C.groupBuyContributors(store.db,item.id),holdings:C.studentHoldings(store.db,store.db.students[0].id).length,balance:C.studentBalance(store.db,store.db.students[0].id)};});
 assert.equal(result.collected,100);assert.equal(result.funded,true);assert.equal(result.holdings,0);assert.equal(result.balance,initialBalance-25);assert.equal(result.contribs[0].amount,55);
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await second.close();
 await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
 await page.setViewportSize({width:1280,height:1000});
 await group.getByRole('button',{name:'보상 사용 완료',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.group-buy-card')].some(el=>el.textContent.includes('금요일 보드게임 파티')&&el.querySelector('.group-buy-state')?.textContent==='보상 사용 완료'));
 assert.equal(await group.getByRole('button',{name:'보상 사용 완료',exact:true}).count(),0);
 await page.reload();await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const persisted=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.name==='금요일 보드게임 파티');});
 assert.equal(persisted.isUsed,true);assert.equal(persisted.groupCollected,100);
 // A student with no balance can inspect progress and ranking without donating.
 await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');const C=await import('/js/core.js'),s=store.db.students[3],balance=C.studentBalance(store.db,s.id);if(balance) await store.economyAction('adjust',s.id,null,-balance,'잔액 없는 학생 테스트');});
 await preview(page,3);await page.locator('.group-buy-card').filter({hasText:'학급 영화 감상'}).getByRole('button',{name:'함께 모으기(기부)',exact:true}).click();
 assert.equal(await page.locator('#modal [name=amount]').count(),0);
 assert.match(await page.locator('#modal').innerText(),/잔액이 없습니다/);
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
 await page.evaluate(async()=>{
  const {store}=await import('/js/shared/state.js');const student=store.db.students[0];
  await store.commit([{table:'students',id:student.id,data:{...student,password:'공동구매7',passwordChanged:true,passwordResetRequired:false}}]);
  await store.logout();(await import('/js/app.js')).render();
 });
 await page.getByRole('button',{name:'학생 로그인',exact:true}).click();
 await page.locator('#modal [name=no]').fill('1');await page.locator('#modal [name=password]').fill('공동구매7');
 await page.locator('#modal button[type=submit]').click();await page.locator('.student-shell').waitFor();
 await page.getByRole('button',{name:'경제',exact:true}).click();await page.getByRole('button',{name:'상점',exact:true}).click();
 await page.locator('.group-buy-card').filter({hasText:'학급 영화 감상'}).getByRole('button',{name:'함께 모으기(기부)',exact:true}).click();
 await page.locator('#modal [name=amount]').fill('3');await page.getByRole('button',{name:'기여하기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#modal .group-buy-ranking .is-me')?.textContent.includes('(3별)'));
 assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).state.impersonatingStudentId),null);
 assert.deepEqual(errors,[]);
 console.log('PASS: group-buy teacher registration/edit/use, full-card details, mobile layouts, quick amounts, cumulative ranks, live cross-window updates, exact wallet debit/goal cap, disabled completion and persistence');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
