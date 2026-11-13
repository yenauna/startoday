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
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 const url=`http://127.0.0.1:${server.address().port}`;
 await page.goto(url);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>{
  const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');
  const ops=Array.from({length:5},(_,i)=>{const id=C.uid();return{table:'students',id,data:{id,no:i+21,name:'학생'+(i+21)}};});
  const long={id:C.uid(),title:'25차 독서 도전',date:C.today(),repeat:{type:'none'},target:'all',isQuest:true,questGoal:3,questTitle:'꾸준한 탐험가'};
  window.patchLong=long.id;
  ops.push({table:'assignments',id:long.id,data:long});
  await store.commit(ops);
  await store.commit(C.questStampOps(store.db,long,C.today(),store.db.students[0].id,1));
  (await import('/js/app.js')).navigate('경제');
 });
 assert.equal(await page.locator('.economy-assets-table tbody tr').count(),25);
 const bottom=await page.locator('.economy-assets-table tbody tr').last().evaluate(el=>el.getBoundingClientRect().bottom);

 assert.ok(bottom<=1080,'25 rows must fit the desktop viewport: '+bottom);
 assert.equal(await page.locator('.economy-assets-table th').allTextContents().then(x=>x.includes('별명')),false);
 await page.getByRole('button',{name:'⊞ 카드형',exact:true}).click();
 assert.equal(await page.locator('.economy-student-card').count(),25);
 assert.match(await page.locator('.economy-student-card').first().innerText(),/별코인/);
 await page.reload();await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('경제');});
 assert.equal(await page.locator('.economy-student-card').count(),25);
 assert.equal(await page.evaluate(()=>localStorage.getItem('startoday_economy_view_mode')),'cards');
 await page.getByRole('button',{name:'☰ 엑셀 목록형',exact:true}).click();
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('과제');});
 const longCard=page.locator('.long-assignment-card').filter({hasText:'25차 독서 도전'});
 assert.equal(await longCard.count(),1);assert.match(await longCard.innerText(),/꾸준한 탐험가/);
 assert.equal(await page.locator('.assignment-calendar [data-assignment-id]').filter({hasText:'25차 독서 도전'}).count(),0);
 assert.equal(await page.locator('.assignment-matrix').filter({hasText:'25차 독서 도전'}).count(),0);
 await longCard.getByRole('button',{name:'진행도/도장판 열기',exact:true}).click();
 await page.locator('#modal .quest-progress-card').first().getByRole('button',{name:'+ 도장',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#modal .quest-progress-card strong + .quest-controls strong')?.textContent.includes('2/3'));
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('설정');});
 await page.getByRole('button',{name:'학생 명단',exact:true}).click();
 const first=page.locator('[data-roster-student]').first();
 const studentId=await first.getAttribute('data-roster-student');
 assert.equal(await page.locator('[data-settings-category="학생 명단"] th').nth(2).innerText(),'별명');
 const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));
 await second.goto(url);await second.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await second.evaluate(async id=>{const {state}=await import('/js/shared/state.js');state.impersonatingStudentId=id;state.viewMode='student';(await import('/js/app.js')).render();},studentId);
 assert.equal(await second.locator('.student-profile-controls button').count(),1);
 assert.equal(await second.locator('.student-profile-controls .compact-codex').count(),0);
 assert.match(await second.locator('.student-long-assignments').innerText(),/25차 독서 도전/);
 assert.match(await second.locator('.student-long-assignments').innerText(),/2\/3/);
 assert.ok(!(await second.locator('.student-tasks-card').innerText()).includes('25차 독서 도전'));
 await second.getByRole('button',{name:'칭호도감 열기',exact:true}).click();
 assert.equal(await second.locator('#modal .dialog-head h2').innerText(),'칭호도감');
 await second.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await second.getByRole('button',{name:'별명 설정',exact:true}).click();
 await second.locator('#modal [name=nickname]').fill('반짝별');await second.locator('#modal button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('.roster-nickname')?.textContent==='반짝별');
 await second.getByRole('button',{name:'경제',exact:true}).click();await second.getByRole('button',{name:'상점',exact:true}).click();
 const item=second.locator('.individual-shop-card').first();
 await item.locator('.village-product-meta').click();
 assert.equal(await second.locator('.shop-item-detail').count(),1);
 assert.match(await second.locator('.shop-item-detail').innerText(),/가격.*별코인/s);
 assert.match(await second.locator('.shop-item-detail').innerText(),/내 잔액/);
 await second.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 for(const width of [360,390]){await second.setViewportSize({width,height:1000});assert.equal(await second.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await second.close();
 await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');const r={id:C.uid(),studentIds:[store.db.students[0].id],date:C.today(),kind:'칭찬',areas:['학습'],text:'시각 확인',createdAt:C.today()+'T05:32:00.000Z'};window.timeRecord=r.id;await store.commit([{table:'records',id:r.id,data:r}]);(await import('/js/app.js')).navigate('기록');});
 assert.equal(await page.locator('.record-created-time').filter({hasText:'14:32'}).count()>0,true);
 await page.evaluate(async()=>{(await import('/js/app.js')).navigate('수업도구');});
 await page.getByRole('button',{name:'🎲 랜덤뽑기',exact:true}).click();
 const tool=page.locator('[data-tool-type=random]');
 await tool.getByLabel('뽑기 대상').selectOption('custom');
 await tool.getByLabel('뽑기 후보',{exact:true}).fill('가온,아주아주아주아주아주아주긴학생이름,나래');
 await tool.getByLabel('뽑기 연출').selectOption('cards');
 const drawn=[];
 for(let i=0;i<3;i++){
  await tool.getByRole('button',{name:'다음 카드 뽑기',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.tool-draw-card')?.classList.contains('is-drawn'));
  drawn.push(await tool.locator('.tool-draw-card').innerText());
 }
 assert.equal(new Set(drawn).size,3);
 assert.match(await tool.locator('.tool-remaining').innerText(),/남은 0/);
 await tool.getByRole('button',{name:'목록 리셋',exact:true}).click();
 assert.match(await tool.locator('.tool-remaining').innerText(),/남은 3/);
 await tool.getByLabel('뽑기 연출').selectOption('boxes');
 await tool.getByRole('button',{name:'전체 열기',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.tool-mystery-box')].every(el=>el.classList.contains('is-revealed')));
 const css=await tool.locator('.tool-mystery-box').first().evaluate(el=>({overflow:getComputedStyle(el).overflow,whiteSpace:getComputedStyle(el).whiteSpace,textOverflow:getComputedStyle(el).textOverflow}));
 assert.deepEqual(css,{overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'});
 await page.screenshot({path:'/tmp/patch25-tools.png',fullPage:false});
 assert.deepEqual(errors,[]);
 console.log('PASS: 25-row compact roster, persisted cards/list, long-task panels/calendar separation, nickname cross-window sync, title cleanup, item details, record time, unique card draws and reset');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
