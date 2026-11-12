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
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html');
    response.end(readFileSync(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**', r=>r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  await page.evaluate(async()=>{
    const {store}=await import('/js/shared/state.js');
    const {previewStudent}=await import('/js/tabs/student-view.js');
    previewStudent(store.db.students[0].id);
  });
  for (const width of [390,768,1280,1920]) {
    await page.setViewportSize({width,height:800});
    const geometry=()=>page.locator('.student-home-topbar').evaluate(el=>{
      const shell=el.closest('.student-shell').getBoundingClientRect(), header=el.getBoundingClientRect(), brand=el.querySelector('.student-site-name');
      return {shellX:shell.x,shellWidth:shell.width,x:header.x,y:header.y,width:header.width,font:getComputedStyle(brand).font,fontSize:getComputedStyle(brand).fontSize,text:el.innerText};
    });
    await page.getByRole('button',{name:'별빛 교실',exact:true}).click();
    const home=await geometry();
    await page.getByRole('button',{name:'경제',exact:true}).click();
    assert.deepEqual(await geometry(),home);
    await page.getByRole('button',{name:'상점',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const bounds=await page.locator('.student-economy').boundingBox();
    assert.ok(bounds.x>=home.shellX && bounds.width<=home.shellWidth);
    await page.getByRole('button',{name:'별빛 교실',exact:true}).click();
  }
  await page.setViewportSize({width:390,height:844});
  const date=page.locator('.student-calendar-day.is-today');
  await date.scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>scrollY);
  await date.click();
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<3);
  assert.ok((await page.locator('.student-calendar-detail').innerText()).length>0);
  await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();
  await page.evaluate(async()=>{
    const {store,state}=await import('/js/shared/state.js');
    const C=await import('/js/core.js');
    const day=C.today();
    store.db.timetables.push({id:'compact-slot',date:day,period:1,subjectCode:'국어',publicMemo:'일반 메모 전체 문장 확인'});
    store.db.events.push({id:'compact-event',date:day,period:1,title:'중요 준비물 안내가 아주 길게 이어지는 문장',description:'전체 설명 확인',isImportant:true});
    state.tab='시간표·일정';state.calendarDate=day;
    (await import('/js/app.js')).render();
  });
  const important=page.locator('.calendar-lesson .slot-important-memo').filter({hasText:'중요 준비물'});
  assert.equal(await important.evaluate(el=>getComputedStyle(el).textOverflow),'ellipsis');
  await page.locator('.day.today .calendar-day-details').click();
  assert.ok((await page.locator('#modal').innerText()).includes('일반 메모 전체 문장 확인'));
  assert.ok((await page.locator('#modal').innerText()).includes('전체 설명 확인'));
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1280,height:900});
  const slot=page.locator('.day.today .calendar-lesson').first();
  const rows=await slot.evaluate(el=>{const a=el.querySelector('.slot-time').getBoundingClientRect(),b=el.querySelector('.subject-title').getBoundingClientRect(),c=el.querySelector('.slot-public-memo').getBoundingClientRect();return {a:a.y,b:b.y,c:c.y};});
  assert.ok(Math.abs(rows.a-rows.b)<8 && Math.abs(rows.b-rows.c)<8);
  await page.evaluate(async()=>{
    const {store,state}=await import('/js/shared/state.js');
    const C=await import('/js/core.js');
    for(let no=21;no<=25;no++) store.db.students.push({...store.db.students[0],id:'grid-'+no,no,name:'학생'+no});
    store.db.assignments[0].date=C.today();store.db.assignments[0].repeat={type:'none'};
    state.date=C.today();state.tab='과제';
    (await import('/js/app.js')).render();
  });
  await page.locator('[data-assignment-id][data-assignment-date]').first().click();
  assert.equal(await page.locator('.assignment-progress-item').count(),25);
  for (const [width,columns] of [[1280,5],[768,4],[390,3]]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.locator('.assignment-progress-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),columns);
    assert.equal(await page.locator('#modal').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  }
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(async()=>{
    const {store,state}=await import('/js/shared/state.js');
    const item=store.db.shop_items[0];
    for(let i=0;i<8;i++)store.db.shop_items.push({...item,id:'grid-item-'+i});
    state.tab='경제';(await import('/js/app.js')).render();
  });
  await page.getByRole('button',{name:'상점 관리',exact:true}).click();
  const grid=await page.locator('.economy-category .economy-shop-grid').first().evaluate(el=>({width:el.clientWidth,columns:getComputedStyle(el).gridTemplateColumns.split(' ').length,gap:parseFloat(getComputedStyle(el).gap)}));
  assert.equal(grid.columns,Math.floor((grid.width+grid.gap)/(220+grid.gap)));
  await page.screenshot({path:'/tmp/startoday-teacher-grid.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: stable student header/width, calendar scroll, responsive important memo and full details');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
