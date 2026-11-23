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
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const [width,height,touch] of [[1280,900,false],[412,891,true],[1920,1080,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
    await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
    await page.evaluate(async()=>{
      const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');
      const d=C.initialDB();d.students=['김가온','이나래','박다온','최라온','윤마루','오별하','정아름다운','한솔'].map((name,i)=>({id:'pill'+i,no:i+1,name}));
      d.records=[];d.attendance=[];d.assignments=[];d.routines=[];
      store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.selected=[];
      (await import('/js/app.js')).navigate('대시보드');
    });
    const selected=()=>page.evaluate(async()=>(await import('/js/shared/state.js')).state.selected);
    const add=async value=>{await page.locator('#quick-student-query').fill(value);await page.locator('#quick-student-query').press('Enter');};
    const noOverflow=async()=>{
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      assert.equal(await page.locator('.quick-wrap').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
    };
    await page.locator('#quick-text').fill('선택과 저장 모션 확인');
    const first=page.locator('.student[data-student-id="pill0"]');
    await first.focus();await first.press('Enter');
    assert.deepEqual(await selected(),['pill0']);
    assert.equal(await page.locator('.selection-flight:not(.selection-flight-exit)').count(),1);
    assert.equal(await page.locator('[data-selected-id="pill0"] .selection-pill').evaluate(e=>getComputedStyle(e).borderRadius),'999px');
    assert.equal(await page.locator('#quick-text').inputValue(),'선택과 저장 모션 확인');
    await page.waitForFunction(()=>document.querySelectorAll('.selection-flight').length===0);
    assert.equal(await page.locator('.selection-flight').count(),0);
    for(const value of ['2','3','4','5','6']) await add(value);
    assert.deepEqual(await selected(),['pill0','pill1','pill2','pill3','pill4','pill5']);
    assert.equal(await page.locator('[data-selected-id]').first().getAttribute('data-selected-id'),'pill5');
    const limit=width===412?3:5;
    assert.equal(await page.locator('[data-selected-id]:visible').count(),limit);
    assert.equal(await page.locator('#quick-selection-more').innerText(),'+'+(6-limit));
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('[data-selection-count]').innerText(),'6명 선택');
    assert.equal(await page.locator('.selection-flight').count(),0);
    assert.equal(await page.locator('[data-selected-id]').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    await noOverflow();
    if(!touch){
      const chips=page.locator('[data-selected-id]:visible');
      await chips.nth(2).hover();await page.waitForTimeout(1100);
      const offsets=await chips.evaluateAll(es=>es.map(e=>({x:parseFloat(e.style.getPropertyValue('--chip-hover-x')),y:parseFloat(e.style.getPropertyValue('--chip-hover-y'))})));
      assert(Math.abs(offsets[2].y+5)<.1);assert(Math.abs(offsets[1].x+6)<.1);assert(Math.abs(offsets[0].x+4)<.1);assert(Math.abs(offsets[3].x-6)<.1);assert(Math.abs(offsets[4].x-4)<.1);
      assert.match(await page.locator('[data-selection-hint]').innerText(),/4\. 최라온/);
      await page.screenshot({path:`/tmp/selection-pills-${width}.png`});
      await chips.first().hover();await page.waitForTimeout(1000);
      const neighbors=await chips.evaluateAll(es=>es.map(e=>parseFloat(e.style.getPropertyValue('--chip-hover-x'))));
      assert(Math.abs(neighbors[1]-6)<.1 && Math.abs(neighbors[2]-4)<.1 && Math.abs(neighbors[3]-2)<.1);
    }else await page.screenshot({path:`/tmp/selection-pills-${width}.png`});
    await page.locator('#quick-selection-more').click();
    assert.equal(await page.locator('[data-selected-id]:visible').count(),6);
    await page.locator('button[data-selected-id="pill0"]').focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await selected(),['pill1','pill2','pill3','pill4','pill5']);
    assert.equal(await page.locator('button[data-selected-id]:focus').count(),1);
    await noOverflow();
    await page.locator('#quick-cancel').click();
    assert.deepEqual(await selected(),[]);
    assert.equal(await page.locator('#quick-text').inputValue(),'');
    await page.getByRole('button',{name:'전체 선택',exact:true}).click();
    assert.equal((await selected()).length,8);
    await noOverflow();
    await page.locator('#quick-selection-more').click();
    await page.waitForTimeout(1000);
    await page.screenshot({path:`/tmp/selection-expanded-${width}.png`});
    await page.locator('#quick-cancel').click();
    await page.locator('#quick-text').fill('선택과 저장 모션 확인');
    // Saving still writes each actual selected student once, including folded ones.
    await add('1 2 3 4 5 6');
    await page.locator('.quick-areas .area-chip').first().click();
    await page.locator('.record-action.record-note').click();
    await page.waitForFunction(async()=>{
      const {store,state}=await import('/js/shared/state.js');return store.db.records.length===6 && state.selected.length===0;
    });
    const records=await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db.records.map(r=>({ids:r.studentIds,text:r.text,kind:r.kind})));
    assert.deepEqual(records.map(r=>r.ids[0]).sort(),['pill0','pill1','pill2','pill3','pill4','pill5']);
    assert(records.every(r=>r.text.includes('선택과 저장 모션 확인') && r.kind==='관찰'));
    // Reduced motion preserves the same selection and uses damping, with no arc.
    await page.emulateMedia({reducedMotion:'reduce'});
    await add('7');
    assert.equal(await page.locator('.selection-flight:not(.selection-flight-exit)').count(),0);
    await page.waitForFunction(()=>Math.abs(Number(document.querySelector('[data-selected-id="pill6"]')?.style.getPropertyValue('--chip-pop'))-1)<.001);
    const chip=page.locator('[data-selected-id="pill6"]');
    assert(Math.abs(Number(await chip.evaluate(e=>e.style.getPropertyValue('--chip-pop')))-1)<.001);
    await noOverflow();
    await page.waitForTimeout(1000);
    await page.evaluate(()=>{const raf=window.requestAnimationFrame;window.idleFrames=0;window.requestAnimationFrame=callback=>{window.idleFrames++;return raf(callback);};});
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.idleFrames),0,'spring scheduler must stop at rest');
    await page.evaluate(async()=>{
      const {state}=await import('/js/shared/state.js');state.studentPasswordPending=true;
      (await import('/js/app.js')).render();
    });
    assert.equal(await page.locator('.selection-flight').count(),0);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}x${height} touch=${touch}: newest-first chips, 650ms flight, hover/focus, fold/expand/remove/all/clear, six-student save, reduced motion, draft and no overflow`);
    await context.close();
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
