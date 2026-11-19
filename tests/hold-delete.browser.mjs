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
 for(const [width,height,touch] of [[1280,900,false],[412,891,true],[1920,1080,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch});const page=await context.newPage(),errors=[],dialogs=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
  await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:30000});await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  await page.evaluate(async()=>{
   const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js'),{newRecord}=await import('/js/tabs/records.js');
   let d=C.initialDB();d.students=[{id:'hold-student',no:1,name:'가온'}];d.records=[];d.assignments=[{id:'hold-assignment',title:'확인 과제',date:C.today(),repeat:{type:'none'},target:'all',statArea:'학습'}];d.assignmentStates=[];d.attendance=[];
   d=C.applyOps(d,C.taskStateOps(d,d.assignments[0],C.today(),'hold-student','완료','보존할 메모'));
   window.autoRecordId=d.records[0].id;
   d.records.push(newRecord({id:'hold-manual',date:C.today(),studentIds:['hold-student'],kind:'관찰',text:'일반 기록 홀드'}));
   d.records.push(newRecord({id:'hold-failure',date:C.today(),studentIds:['hold-student'],kind:'관찰',text:'저장 실패 검증'}));
   store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.recordFilters.from=state.recordFilters.to=C.today();(await import('/js/app.js')).navigate('기록');
  });
  const record=id=>page.locator(`article.record[data-record-id="${id}"]`);
  const getDb=()=>page.evaluate(async()=>(await import('/js/shared/state.js')).store.db);
  const press=async(button,ms)=>{
   await button.scrollIntoViewIfNeeded();const target=await button.elementHandle();
   await page.waitForFunction(e=>e._holdDelete&&!e.disabled,target);
   const r=await button.boundingBox();
   const waitForFill=async()=>{if(ms>=1200)await page.waitForFunction(e=>!e.isConnected||parseFloat(e.querySelector('.fill').style.width)>=e.clientWidth,target,{timeout:4000});};
   if(touch){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await page.waitForTimeout(ms);await waitForFill();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
   else{await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(ms);await waitForFill();await page.mouse.up();}
  };
  const manual=record('hold-manual').getByRole('button',{name:'삭제',exact:true});
  const size=await manual.boundingBox();assert.equal(await manual.locator('.label.base').innerText(),'삭제');
  await manual.click();await page.waitForTimeout(500);assert((await getDb()).records.some(r=>r.id==='hold-manual'));
  await press(manual,400);assert((await getDb()).records.some(r=>r.id==='hold-manual'));await page.waitForTimeout(1800);
  await page.waitForFunction(e=>e.style.transform===''&&e.querySelector('.fill').style.width==='0px',await manual.elementHandle(),{timeout:4000});
  assert.equal(await manual.evaluate(e=>e.querySelector('.fill').style.width),'0px');
  const after=await manual.boundingBox();assert(Math.abs(size.width-after.width)<1&&Math.abs(size.height-after.height)<1);
  // Keyboard cancellation, including focus loss, must never delete.
  await manual.focus();await page.keyboard.down('Enter');await page.waitForTimeout(250);await page.keyboard.up('Enter');await page.waitForTimeout(1500);
  assert((await getDb()).records.some(r=>r.id==='hold-manual'));
  await manual.focus();await page.keyboard.down(' ');await page.waitForTimeout(200);await page.locator('#quick-text').focus();await page.keyboard.up(' ');await page.waitForTimeout(1500);
  assert((await getDb()).records.some(r=>r.id==='hold-manual'));
  // Actual pointer/touch hold: removal is persisted now, not after the undo timeout.
  await press(manual,1400);
  await page.waitForFunction(async()=>!(await import('/js/shared/state.js')).store.db.records.some(r=>r.id==='hold-manual'));
  await record('hold-manual').waitFor({state:'detached'});
  const undo=page.locator('.record-delete-toast[data-record-id="hold-manual"] button');await undo.waitFor();assert.match(await undo.innerText(),/실행취소/);
  await undo.click();await record('hold-manual').waitFor();assert((await getDb()).records.some(r=>r.id==='hold-manual'));
  // Keyboard hold deletes an auto record and resets its task; undo restores both.
  const autoId=await page.evaluate(()=>window.autoRecordId),auto=record(autoId).getByRole('button',{name:'삭제',exact:true});
  await auto.focus();await page.keyboard.down('Enter');await page.waitForTimeout(1400);await record(autoId).waitFor({state:'detached'});await page.keyboard.up('Enter');
  assert.equal((await getDb()).assignmentStates[0].status,'진행중');assert.equal((await getDb()).assignmentStates[0].memo,'보존할 메모');
  await page.keyboard.press('Control+z');await record(autoId).waitFor();assert.equal((await getDb()).assignmentStates[0].status,'완료');
  // A concurrent change must not be overwritten by undo.
  await press(record(autoId).getByRole('button',{name:'삭제',exact:true}),1400);await record(autoId).waitFor({state:'detached'});
  await page.evaluate(async autoId=>{const {store}=await import('/js/shared/state.js');await store.commit(latest=>[{table:'assignmentStates',id:latest.assignmentStates[0].id,data:{...latest.assignmentStates[0],memo:'다른 기기 변경'}}]);const undo=[...document.querySelectorAll('.record-delete-toast')].find(el=>el.dataset.recordId===autoId)?.querySelector('button');if(!undo)throw Error('undo missing immediately after concurrent write');undo.click();},autoId);
  await page.getByText('연결된 기록이나 과제가 변경되어 실행 취소할 수 없습니다.',{exact:true}).waitFor();assert.equal((await getDb()).assignmentStates[0].memo,'다른 기기 변경');
  // Saving failure leaves the record and a usable fresh hold button.
  await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');window.realCommit=store.commit.bind(store);store.commit=async()=>{throw Error('홀드 삭제 저장 실패');};});
  await press(record('hold-failure').getByRole('button',{name:'삭제',exact:true}),1400);
  await page.getByText('홀드 삭제 저장 실패',{exact:true}).waitFor();assert((await getDb()).records.some(r=>r.id==='hold-failure'));
  await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');store.commit=window.realCommit;});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(async()=>(await import('/js/app.js')).render());
  await press(record('hold-manual').getByRole('button',{name:'삭제',exact:true}),1400);await record('hold-manual').waitFor({state:'detached'});
  await page.screenshot({path:`/tmp/hold-delete-${width}.png`});
  await page.locator('.record-delete-toast[data-record-id="hold-manual"]').waitFor({state:'detached',timeout:7000});
  assert(!(await getDb()).records.some(r=>r.id==='hold-manual'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);
  console.log(`PASS ${width} touch=${touch}: compact hold, cancel/blur/keyboard, immediate delete, 5s undo/expiry, auto-task restore, concurrent guard, failed save, reduced motion and no confirm`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
