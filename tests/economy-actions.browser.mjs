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
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(10000);
  await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:30000});await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  await page.evaluate(async()=>{
   const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js'),{newRecord}=await import('/js/tabs/records.js');
   let d=C.initialDB();d.students=[{id:'action-one',no:1,name:'가온'},{id:'action-two',no:2,name:'나래'}];d.attendance=[];
   const item={id:C.uid(),category:'특별혜택',name:'보드게임',price:1,stock:3};d.shop_items=[item,{id:C.uid(),category:'기타',name:'품절쿠폰',price:1,stock:0}];
   d=C.applyOps(d,C.teacherGiftOps(d,'action-one',item.id));d.records=[newRecord({id:'action-record',studentIds:['action-one'],text:'단일 알림 검증',date:C.today(),kind:'관찰'})];
   window.actionItem=item.id;store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.recordFilters.from=state.recordFilters.to=C.today();(await import('/js/app.js')).navigate('대시보드');
  });
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const state=()=>page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return{stock:store.db.shop_items.find(i=>i.id===window.actionItem).stock,holdings:store.db.economy_tx.filter(t=>t.studentId==='action-one'&&t.status==='보유').length};});
  await page.locator('#quick-text').fill('작성 중인 내용');await page.locator('#quick-student-query').fill('1');await page.locator('#quick-student-query').press('Enter');
  assert.equal(await page.locator('.selection-dismiss,.selection-composer-head').count(),0);assert.equal(await page.getByRole('button',{name:'입력 취소',exact:true}).count(),1);
  await page.waitForTimeout(800);await noOverflow();await page.screenshot({path:`/tmp/actions-header-${width}.png`});
  await page.locator('#quick-cancel').click();assert.equal(await page.locator('#quick-text').inputValue(),'');assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).state.selected.length),0);
  await page.evaluate(async()=>{(await import('/js/app.js')).navigate('기록');(await import('/js/shared/ui.js')).toast('이전에 표시된 알림');});
  const hold=page.locator('[data-record-id="action-record"] .hold-delete');await hold.focus();
  assert.equal(await hold.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(249, 234, 240)');assert.equal(await hold.locator('.fill').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(244, 63, 94)');
  assert.equal(await hold.evaluate(e=>getComputedStyle(e).color),'rgb(135, 84, 108)');assert.equal(await hold.locator('.hold-glyph.invert').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  await page.keyboard.down('Enter');await page.locator('article.record[data-record-id="action-record"]').waitFor({state:'detached'});await page.keyboard.up('Enter');
  await page.locator('.record-delete-toast').waitFor();assert.equal(await page.locator('.record-delete-toast').count(),1);assert.equal(await page.locator('#toast').isVisible(),false);
  await page.locator('.record-delete-toast button').click();await page.locator('article.record[data-record-id="action-record"]').waitFor();
  await page.evaluate(async()=>(await import('/js/app.js')).navigate('경제'));await page.locator('.economy-asset-actions').first().getByRole('button',{name:'물건',exact:true}).click();
  const manager=page.locator('.economy-student-manager');
  const gift=manager.getByRole('button',{name:'보드게임 선물',exact:true}),reclaim=manager.getByRole('button',{name:'보드게임 회수',exact:true});
  for(const button of [gift,reclaim]){
   const b=await button.boundingBox();assert.equal(b.width,38);assert.equal(b.height,38);assert.equal(await button.locator('svg').count(),1);assert.equal(await button.evaluate(e=>getComputedStyle(e).borderRadius),'50%');
  }
  if(!touch){
   await reclaim.hover();await page.waitForFunction(el=>getComputedStyle(el.querySelector('.tooltip')).top==='-38px',await reclaim.elementHandle());assert.equal(await reclaim.locator('.tooltip').evaluate(e=>getComputedStyle(e).top),'-38px');assert.equal(await reclaim.locator('.tooltip').evaluate(e=>getComputedStyle(e).opacity),'1');
   assert.equal(await reclaim.evaluate(e=>getComputedStyle(e).backgroundColor),await reclaim.locator('.tooltip').evaluate(e=>getComputedStyle(e).backgroundColor));
   assert.equal(await reclaim.locator('.tooltip').evaluate(e=>getComputedStyle(e,'::before').width),'8px');
  }else{
   assert.equal(await reclaim.locator('.tooltip').evaluate(e=>getComputedStyle(e).display),'none');assert.equal(await reclaim.locator('..').locator('.economy-action-label').evaluate(e=>getComputedStyle(e).fontSize),'11px');assert.equal(await reclaim.locator('..').locator('.economy-action-label').isVisible(),true);
  }
  await page.screenshot({path:`/tmp/actions-manager-${width}.png`});
  if(touch)await gift.locator('.economy-action-label').tap();else await gift.click();await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.id===window.actionItem).stock===1;});assert.deepEqual(await state(),{stock:1,holdings:2});
  const reclaimAction=manager.getByRole('button',{name:'보드게임 회수',exact:true});if(touch)await reclaimAction.locator('.economy-action-label').tap();else await reclaimAction.click();await page.getByRole('heading',{name:'물건 회수 확인',exact:true}).waitFor();await page.locator('#modal button[type=submit]').click();await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.id===window.actionItem).stock===2;});assert.deepEqual(await state(),{stock:2,holdings:1});
  await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'상점 관리',exact:true}).click();
  const card=page.locator('.economy-item').filter({has:page.getByRole('heading',{name:'보드게임',exact:true})});
  const edit=card.getByRole('button',{name:'수정',exact:true});
  assert.equal(await edit.locator('svg').count(),1);assert.equal((await edit.boundingBox()).width,38);assert.equal((await edit.boundingBox()).height,38);
  if(!touch){await edit.hover();await page.waitForFunction(el=>getComputedStyle(el.querySelector('.tooltip')).top==='-38px',await edit.elementHandle());assert.equal(await edit.locator('.tooltip').innerText(),'수정');assert.equal(await edit.locator('.tooltip').evaluate(e=>getComputedStyle(e).top),'-38px');assert.equal(await edit.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(51, 65, 85)');}
  else{assert.equal(await edit.locator('.economy-action-label').innerText(),'수정');assert.equal(await edit.locator('.economy-action-label').isVisible(),true);}
  await page.screenshot({path:`/tmp/edit-action-${width}.png`});
  if(touch)await edit.locator('.economy-action-label').tap();else await edit.click();
  await page.locator('#modal [name=description]').fill('연필 아이콘으로 수정 저장');await page.locator('#modal button[type=submit]').click();
  await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.id===window.actionItem).description==='연필 아이콘으로 수정 저장';});
  const shopGift=card.getByRole('button',{name:'선물',exact:true});
  if(!touch){await page.keyboard.press('Tab');await shopGift.focus();await page.waitForTimeout(350);assert.equal(await shopGift.evaluate(e=>e.matches(':focus-visible')),true);assert.equal(await shopGift.locator('.tooltip').evaluate(e=>getComputedStyle(e).opacity),'1');}
  await noOverflow();await page.screenshot({path:`/tmp/actions-shop-${width}.png`});
  if(touch)await shopGift.locator('.economy-action-label').tap();else await shopGift.click();await card.locator('.economy-student-gift-grid button').first().click();await card.locator('.economy-gift-confirm').click();await page.waitForFunction(async()=>{const {store}=await import('/js/shared/state.js');return store.db.shop_items.find(i=>i.id===window.actionItem).stock===1;});
  const sold=page.locator('.economy-item').filter({has:page.getByRole('heading',{name:'품절쿠폰',exact:true})});assert.equal(await sold.getByRole('button',{name:'선물',exact:true}).isDisabled(),false); // Recipient drawer remains available; its confirm is disabled.
  await sold.getByRole('button',{name:'삭제',exact:true}).click();await sold.waitFor({state:'detached'});
  await noOverflow();assert.deepEqual(errors,[]);console.log(`PASS ${width} touch=${touch}: one cancel, one delete notification/undo, clear rose hold, round edit/SVG actions/tooltips/touch labels, gift/reclaim/delete and no overflow`);await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
