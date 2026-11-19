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
const shots = process.env.REVEAL_SCREENSHOTS || '/tmp';
try {
  browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for (const [width,height,touch] of [[1280,900,false],[412,891,true],[1920,1080,true]]) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:touch});
    const page = await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
    await page.evaluate(async()=>{
      const {store}=await import('/js/shared/state.js');
      store.db.students=store.db.students.slice(0,4);
      (await import('/js/app.js')).navigate('수업도구');
      window.audioStarts=0;
      window.AudioContext=class {constructor(){window.audioStarts++;}};
    });
    await page.getByRole('button',{name:'🎲 랜덤뽑기',exact:true}).click();
    const widget=page.locator('[data-tool-type=random]');
    if(width===1920) await page.locator('.tools-board-fullscreen').click();
    await page.locator('.tools-drawer-toggle').click();
    await widget.getByLabel('캔버스 꽉 채우기/복원').click();
    await widget.getByLabel('뽑기 연출').selectOption('cards');
    const card=widget.locator('.tool-draw-card');
    // Capture the real CSS timeline without wall-clock screenshot races.
    await card.evaluate(e=>{
      window.revealStart=performance.now();
      const observer=new MutationObserver(()=>{if(!e.hasAttribute('aria-busy')){window.revealEnd=performance.now();observer.disconnect();}});
      observer.observe(e,{attributes:true,attributeFilter:['aria-busy']});
      e.click();e.click();
      window.revealAnimations=e.getAnimations({subtree:true}).map(a=>a.effect.getTiming()).map(t=>Number(t.delay)+Number(t.duration));
    });
    await page.waitForFunction(()=>document.querySelector('.tool-draw-card')?.getAttribute('aria-busy')===null);
    const measured=await page.evaluate(()=>window.revealEnd-window.revealStart);
    assert(measured>=700 && measured<850,`animation duration ${measured}`);
    assert((await page.evaluate(()=>window.revealAnimations)).every(ms=>ms<=780));
    assert.match(await widget.locator('.tool-remaining').innerText(),/남은 3 \/ 4개/);
    assert.equal(await card.locator('.card-reveal-light').count(),0);
    await card.click();
    await page.waitForTimeout(510);
    await page.screenshot({path:`${shots}/reveal-random-${width}.png`});
    await page.waitForFunction(()=>!document.querySelector('.card-reveal-fast'));
    assert.match(await widget.locator('.tool-remaining').innerText(),/남은 2 \/ 4개/);
    // Mid-reveal source reset cancels both timers; no stale winner consumes a draw.
    await card.evaluate(e=>e.click());
    await widget.getByRole('button',{name:'목록 리셋',exact:true}).click();
    await page.waitForTimeout(820);
    assert.match(await widget.locator('.tool-remaining').innerText(),/남은 4 \/ 4개/);
    assert.equal(await widget.locator('.tool-random-result').innerText(),'');
    await widget.getByLabel('뽑기 연출').selectOption('boxes');
    const first=widget.locator('.tool-mystery-box').first();
    if(touch) await first.tap();else await first.click();
    await page.waitForFunction(()=>!document.querySelector('.card-reveal-fast'));
    assert.equal(await widget.locator('.is-revealed').count(),1);
    await widget.getByRole('button',{name:'전체 열기',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.card-reveal-fast'));
    assert.equal(await widget.locator('.is-revealed').count(),4);
    assert.match(await widget.locator('.tool-remaining').innerText(),/남은 0 \/ 4개/);
    await widget.getByRole('button',{name:'목록 리셋',exact:true}).click();
    await widget.getByRole('button',{name:'뽑힌 사람 제외',exact:true}).click();
    await widget.locator('.tool-mystery-box').first().evaluate(e=>e.click());
    await page.waitForFunction(()=>!document.querySelector('.card-reveal-fast'));
    assert.equal(await widget.locator('.tool-mystery-box:disabled').count(),0);
    assert.match(await widget.locator('.tool-remaining').innerText(),/남은 4 \/ 4개/);
    assert.equal(await page.evaluate(()=>window.audioStarts),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    // Integrate with the student render path, not a synthetic notification alone.
    await page.evaluate(async()=>{
      const {store,state}=await import('/js/shared/state.js');
      const {studentSnapshot}=await import('/js/tabs/student-view.js');
      const student=store.db.students[0];
      store.db.records=[];
      state.studentSnapshot=studentSnapshot(store.db,student);
      state.studentUser=student;state.viewMode='student';
      (await import('/js/app.js')).render();
    });
    assert.equal(await page.locator('.title-unlock-card').count(),0);
    await page.evaluate(async()=>{
      const {state}=await import('/js/shared/state.js');
      state.studentSnapshot.titleCounts.learning=15;
      (await import('/js/app.js')).render();
    });
    const reward=page.locator('.title-unlock-card');
    await reward.waitFor();
    assert.equal(await reward.locator('.title-unlock-name').innerText(),'✦');
    await page.waitForTimeout(1840);
    await page.screenshot({path:`${shots}/reveal-title-${width}.png`});
    await page.waitForFunction(()=>!document.querySelector('.card-reveal-reward'));
    assert.equal(await reward.locator('.title-unlock-name').innerText(),'지식의 탐색자');
    const rect=await reward.boundingBox();
    assert(rect.x>=0 && rect.x+rect.width<=width && rect.y>=0 && rect.y+rect.height<=height);
    await reward.getByRole('button',{name:'칭호 해금 알림 닫기',exact:true}).click();
    await page.evaluate(async()=>(await import('/js/app.js')).render());
    assert.equal(await reward.count(),0); // same snapshot never repeats
    await page.evaluate(async()=>{
      const {state}=await import('/js/shared/state.js');
      state.studentSnapshot.student.rewardTitles=[{id:'quest:test',name:'<img src=x onerror=alert(1)>'}];
      (await import('/js/app.js')).render();
    });
    await page.waitForTimeout(1640);
    assert.equal(await reward.locator('img').count(),0);
    assert.match(await reward.innerText(),/<img src=x/);
    // Leaving the student session clears the notification and pending work.
    await page.evaluate(async()=>{
      const {state}=await import('/js/shared/state.js');
      state.studentUser=null;state.studentSnapshot=null;state.viewMode='teacher';
      (await import('/js/app.js')).render();
    });
    assert.equal(await reward.count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(async()=>{
      const {syncTitleUnlock}=await import('/js/components/title-unlock.js');
      syncTitleUnlock({titleCounts:{},student:{}},'reduced');
      syncTitleUnlock({titleCounts:{learning:15},student:{}},'reduced');
    });
    await page.waitForTimeout(120);
    assert.equal(await reward.getAttribute('aria-busy'),null);
    assert.equal(await reward.evaluate(e=>getComputedStyle(e).transform),'none');
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}x${height} touch=${touch}: ${Math.round(measured)}ms, repeated/excluded/replacement/all/reset, reward detection/dismiss/safe text/logout/reduced motion, no overflow/audio`);
    await context.close();
  }
} finally {await browser?.close();await new Promise(r=>server.close(r));}
