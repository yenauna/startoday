// Optional: PLAYWRIGHT_MODULE / CHROMIUM_EXECUTABLE_PATH, same as layout.browser.mjs.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const {
  chromium
} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/config.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end('window.STARTODAY_CONFIG={};');
    return;
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {
    response.statusCode = 403;
    response.end();
    return;
  }
  try {
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html');
    response.end(readFileSync(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage({
      viewport: {
        width: 1280,
        height: 1000
      }
    }),
    errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', {
    name: '가상 명단으로 먼저 살펴보기',
    exact: true
  }).click();

  await page.getByRole('button',{name:'경제',exact:true}).click();
  await page.getByRole('button',{name:'상점 관리',exact:true}).click();
  assert.equal(await page.locator('.economy-item').count(),6);
  await page.getByRole('button',{name:'새 물품/쿠폰 등록',exact:true}).click();
  await page.locator('#modal [name=name]').fill('검증 쿠폰');
  await page.locator('#modal [name=price]').fill('10');
  await page.locator('#modal [name=stock]').fill('2');
  await page.locator('#modal button[type=submit]').click();
  await page.getByRole('button',{name:'자산 관리',exact:true}).click();
  await page.locator('tbody tr').first().getByRole('button',{name:'지급/차감'}).click();
  await page.locator('#modal [name=amount]').fill('100');
  await page.locator('#modal [name=memo]').fill('테스트 지급');
  await page.locator('#modal button[type=submit]').click();
  await page.locator('tbody tr').first().getByRole('button',{name:'선물하기'}).click();
  await page.locator('#modal .economy-item').filter({has:page.getByRole('heading',{name:'검증 쿠폰',exact:true})}).getByRole('button',{name:'선물하기'}).click();
  const initial=await page.evaluate(async()=>{const {store,state}=await import('/js/shared/state.js');const C=await import('/js/core.js');const s=store.db.students[0];window.econStudent=s.id;window.econItem=store.db.shop_items.find(i=>i.name==='검증 쿠폰').id;return C.studentBalance(store.db,s.id);});
  await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');state.impersonatingStudentId=window.econStudent;state.viewMode='student';(await import('/js/app.js')).render();});
  await page.getByRole('button',{name:'경제',exact:true}).click();
  assert.equal(await page.locator('.economy-item').count(),1);
  assert.equal(await page.locator('.economy-item').getByRole('button',{name:'환불',exact:true}).count(),0);
  await page.getByRole('button',{name:'상점',exact:true}).click();
  page.on('dialog',d=>d.accept());
  await page.locator('.economy-item').filter({has:page.getByRole('heading',{name:'검증 쿠폰',exact:true})}).getByRole('button',{name:'구매하기'}).click();
  await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.id===window.econItem).stock===0;});
  const current=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return (await import('/js/core.js')).studentBalance(store.db,window.econStudent);});assert.equal(current,initial-10);
  await page.getByRole('button',{name:'내 자산',exact:true}).click();
  await page.getByRole('button',{name:'환불',exact:true}).click();
  await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.economy_tx.some(t=>t.type==='환불');});
  assert.equal(await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return (await import('/js/core.js')).studentBalance(store.db,window.econStudent);}),initial);
  await page.getByRole('button',{name:'사용하기',exact:true}).click();
  await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.economy_tx.some(t=>t.type==='선물'&&t.status==='사용완료');});
  // Real local student login must use the same interactions, without teacher navigation.
  await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
  await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');const s=store.db.students[0];await store.commit([{table:'students',id:s.id,data:{...s,password:'나만암호7',passwordChanged:true}}]);});
  // Verify a second teacher window receives the committed transaction invalidation.
  const second=await page.context().newPage();await second.goto(page.url().split('#')[0]);await second.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  const balanceBefore=await second.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return (await import('/js/core.js')).studentBalance(store.db,store.db.students[0].id);});
  await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');await store.economyAction('adjust',store.db.students[0].id,null,7,'창 동기화');});
  await second.waitForFunction(async expected=>{const {store}=await import('/js/shared/state.js');return (await import('/js/core.js')).studentBalance(store.db,store.db.students[0].id)===expected;},balanceBefore+7);
  // A stale teacher editor may save unrelated records without overwriting ledger/stock.
  await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');const raw=JSON.parse(localStorage.getItem('startoday-demo-v1'));store.db.economy_tx=[];await store.commit([{table:'settings',id:'main',data:{...raw.settings[0],className:'동기화 학급'}}]);});
  assert.ok(await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.economy_tx.length>0;}));
  // Concurrent tabs cannot buy more than the last remaining finite unit.
  const race=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');const item=store.db.shop_items.find(i=>i.name==='검증 쿠폰');return {id:item.id,sid:store.db.students[0].id};});
  const results=await Promise.all([page,second].map(p=>p.evaluate(async race=>{const {store}=await import('/js/shared/state.js');try{await store.economyAction('buy',race.sid,race.id);return true;}catch{return false;}},race)));assert.equal(results.filter(Boolean).length,1);
  await second.close();
  await page.evaluate(async()=>{const {state}=await import('/js/shared/state.js');state.impersonatingStudentId=window.econStudent;state.viewMode='student';(await import('/js/app.js')).render();});
  await page.getByRole('button',{name:'경제',exact:true}).click();
  for(const width of [384,412,768]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
  await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
  await page.getByRole('button',{name:'대시보드',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'체험 자료 초기화',exact:true}).count(),1);
  // Use the actual student login form and private in-memory credential path.
  await page.evaluate(async()=>{(await import('/js/tabs/student-view.js')).leaveStudentView();});
  await page.getByRole('button',{name:'학생 로그인',exact:true}).click();
  await page.locator('#modal [name=no]').fill('1');
  await page.locator('#modal [name=password]').fill('나만암호7');
  await page.locator('#modal button[type=submit]').click();
  await page.getByRole('button',{name:'경제',exact:true}).click();
  await page.getByRole('button',{name:'상점',exact:true}).click();
  const freeCard=page.locator('.economy-item').filter({has:page.getByRole('heading',{name:'5분 자유시간권',exact:true})});
  await freeCard.getByRole('button',{name:'구매하기',exact:true}).click();
  await page.waitForFunction(async()=>{const {state}=await import('/js/shared/state.js');return state.studentSnapshot.economy.transactions.some(t=>t.itemName==='5분 자유시간권'&&t.status==='보유');});
  await page.getByRole('button',{name:'내 자산',exact:true}).click();
  await page.locator('.economy-item').filter({has:page.getByRole('heading',{name:'5분 자유시간권',exact:true})}).getByRole('button',{name:'사용하기'}).click();
  await page.waitForFunction(async()=>{const {state}=await import('/js/shared/state.js');return state.studentSnapshot.economy.transactions.some(t=>t.itemName==='5분 자유시간권'&&t.status==='사용완료');});
  assert.equal(await page.locator('.quick-composer-card').count(),0);
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();
  await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  await page.getByRole('button',{name:'체험 자료 초기화',exact:true}).click();
  await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.economy_tx.length===0&&store.db.shop_items.length===6;});
  await page.screenshot({path:'/tmp/startoday-economy-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'경제',exact:true}).click();
  await page.getByRole('button',{name:'상점 관리',exact:true}).click();
  await page.setViewportSize({width:412,height:915});
  await page.screenshot({path:'/tmp/startoday-economy-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: teacher economy CRUD/gift/adjust, student preview buy/refund/use, atomic multi-window stock, sync, mobile widths and demo reset');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
