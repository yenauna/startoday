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
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const [width,height,touch] of [[1280,900,false],[412,891,true],[1920,1080,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch}),page=await context.newPage(),errors=[],dialogs=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
  await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  await page.evaluate(async()=>{
   const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js'),{newRecord}=await import('/js/tabs/records.js');
   let d=C.initialDB();d.students=[{id:'ra-one',no:1,name:'김가온'},{id:'ra-two',no:2,name:'이나래'}];d.attendance=[];
   d.incidents=[{id:'ra-incident',title:'놀이 시간 다툼',date:C.today(),studentIds:['ra-one'],status:'진행중',description:'',linkedIds:[],createdAt:C.now(),updatedAt:C.now()}];
   d.records=[newRecord({id:'ra-plain',date:C.today(),studentIds:['ra-one'],kind:'관찰',text:'쉬는 시간에 친구와 함께 놀았다.'}),newRecord({id:'ra-incident-record',date:C.today(),studentIds:['ra-two'],kind:'추가기록',extraType:'사건',incidentId:'ra-incident',text:'다툰 뒤 화해했다.'})];
   store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.recordFilters.from=state.recordFilters.to=C.today();(await import('/js/app.js')).navigate('기록');
  });
  const record=id=>page.locator(`article.record[data-record-id="${id}"]`);
  const editButton=record('ra-plain').locator('.record-edit');
  const holdButton=record('ra-plain').locator('.hold-delete');
  const box=await editButton.boundingBox(),holdBox=await holdButton.boundingBox();
  // The pencil and the bin are the same control at rest: one 38px circle each.
  for(const b of [box,holdBox]){assert.equal(b.width,38);assert.equal(b.height,38);}
  assert.equal(box.y,holdBox.y);
  assert.equal(await editButton.evaluate(e=>getComputedStyle(e).borderRadius),'50%');
  assert.equal(await holdButton.evaluate(e=>getComputedStyle(e).borderRadius),'50%');
  assert.equal(await holdButton.evaluate(e=>getComputedStyle(e).borderWidth),'0px');
  assert.equal(await editButton.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(241, 245, 249)');
  assert.equal(await holdButton.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(249, 234, 240)');
  const glyph=button=>button.locator('svg').first().evaluate(e=>e.firstElementChild.getAttribute('d'));
  assert.equal(await glyph(editButton),'M16 3a2.8 2.8 0 0 1 4 4L7 20l-4 1 1-4L16 3z M14 5l4 4');
  assert.equal(await glyph(holdButton),'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7');
  assert.equal(await holdButton.locator('.hold-glyph.invert svg').evaluate(e=>e.firstElementChild.getAttribute('d')),await glyph(holdButton));
  assert.equal(await editButton.getAttribute('aria-label'),'수정');assert.equal(await holdButton.getAttribute('aria-label'),'삭제');
  assert.match(await holdButton.getAttribute('aria-description'),/1\.2초/);
  // The three record actions (pencil, bin, open incident) share one row without overflow.
  assert.deepEqual(await record('ra-incident-record').locator('.record-controls button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')||e.innerText.trim())),['수정','삭제','사건 보기']);
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await noOverflow();
  if(!touch){
   await holdButton.hover();await page.waitForTimeout(350);
   assert.equal(await holdButton.locator('.tooltip').evaluate(e=>getComputedStyle(e).opacity),'1');
   assert.equal(await holdButton.locator('.tooltip').evaluate(e=>getComputedStyle(e).top),'-38px');
   await editButton.hover();await page.waitForTimeout(350);
   assert.equal(await editButton.locator('.tooltip').evaluate(e=>getComputedStyle(e).top),'-38px');
   assert.equal(await editButton.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(51, 65, 85)');
   assert.equal(await holdButton.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(249, 234, 240)');
  }else{
   for(const [button,label] of [[editButton,'수정'],[holdButton,'삭제']]){
    assert.equal(await button.locator('.tooltip').evaluate(e=>getComputedStyle(e).display),'none');
    assert.equal(await button.locator('.economy-action-label').evaluate(e=>getComputedStyle(e).display),'block');
    assert.equal(await button.locator('.economy-action-label').innerText(),label);
   }
  }
  const cdp=touch?await context.newCDPSession(page):null;
  const press=async(button,ms)=>{
   await button.scrollIntoViewIfNeeded();const target=await button.elementHandle();
   await page.waitForFunction(e=>e._holdDelete&&!e.disabled,target);
   const r=await button.boundingBox();
   if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await page.waitForTimeout(ms);}
   else{await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(ms);}
  };
  const release=async()=>{
   if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   else await page.mouse.up();
  };
  // Only the press grows the bin; the pencil beside it keeps its exact size.
  await press(holdButton,600);
  const grown=await holdButton.evaluate(e=>{const m=new DOMMatrix(getComputedStyle(e).transform);return{scale:m.a,y:m.f};});
  assert(Math.abs(grown.scale-1.4)<.02,JSON.stringify(grown));assert(grown.y<-6,JSON.stringify(grown));
  const restEdit=await editButton.boundingBox();assert.equal(restEdit.width,38);assert.equal(restEdit.height,38);
  assert.equal(await editButton.evaluate(e=>getComputedStyle(e).transform),'none');
  const inside=await holdButton.evaluate(e=>{
   const fill=e.querySelector('.fill'),clip=e.querySelector('.hold-glyph.invert'),wrap=e.querySelector('.hold-fill');
   return{w:e.clientWidth,fill:parseFloat(fill.style.width),clip:Number(clip.style.clipPath.match(/inset\(0(?:px)? ([0-9.]+)px/)[1]),radius:getComputedStyle(wrap).borderRadius,overflow:getComputedStyle(wrap).overflow};
  });
  assert(inside.fill>6&&inside.fill<38,JSON.stringify(inside));assert(Math.abs(inside.fill+inside.clip-38)<.01,JSON.stringify(inside));
  assert.equal(inside.radius,'50%');assert.equal(inside.overflow,'hidden');
  await page.screenshot({path:`/tmp/record-actions-hold-${width}.png`});
  await release();await page.waitForTimeout(1400);
  assert.equal(await holdButton.evaluate(e=>e.style.transform),'');
  assert.equal(await record('ra-plain').count(),1);
  const settled=await holdButton.boundingBox();assert.equal(settled.width,38);assert.equal(settled.height,38);
  // A completed hold deletes and the five-second undo puts the record back.
  await press(holdButton,1400);
  await record('ra-plain').waitFor({state:'detached'});await release();
  const undo=page.locator('.record-delete-toast[data-record-id="ra-plain"] button');await undo.waitFor();
  await undo.click();await record('ra-plain').waitFor();
  // The pencil opens the record editor for that record; touch taps the caption under the circle.
  const pencil=record('ra-plain').locator('.record-edit');
  if(touch)await pencil.locator('.economy-action-label').tap();else await pencil.click();
  await page.locator('#modal[open]').waitFor();
  assert.equal(await page.locator('#modal .dialog-head h2').innerText(),'기록 수정');
  assert.equal(await page.locator('#modal textarea[name=text]').inputValue(),'쉬는 시간에 친구와 함께 놀았다.');
  await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
  await noOverflow();assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);
  console.log(`PASS ${width} touch=${touch}: equal 38px pencil/bin circles with shop tints, tooltips/touch captions, hold-only 1.4x growth, circular fill/clip alignment, undo and editor open`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
