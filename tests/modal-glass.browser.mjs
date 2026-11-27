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
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const close=()=>page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 const assertGlass=async()=>{
  const style=await page.locator('#modal').evaluate(el=>{const c=getComputedStyle(el),b=getComputedStyle(el,'::backdrop');return{image:c.backgroundImage,glass:c.getPropertyValue('--nebula-glass').trim(),background:c.backgroundColor,filter:c.backdropFilter||c.webkitBackdropFilter,border:c.borderTopColor,edge:c.getPropertyValue('--nebula-edge').trim(),shadow:c.boxShadow,backdrop:b.backgroundColor,backdropFilter:b.backdropFilter||b.webkitBackdropFilter};});
  assert(style.image.includes('linear-gradient'));assert.match(style.background,/0\.44\)/);assert.equal(style.filter,'blur(24px) saturate(1.6)');assert.equal(style.backdropFilter,'blur(6px)');assert.match(style.backdrop,/0\.26\)/);assert(style.shadow.includes('inset'));assert.equal(await page.locator('#modal .dialog-body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  const bounds=await page.locator('#modal').boundingBox(),vp=page.viewportSize();assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<=vp.width+1&&bounds.y>=0&&bounds.y+bounds.height<=vp.height+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 };
 // Exercise real money and item editors, not only an artificial style fixture.
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('경제'));await page.locator('.economy-asset-actions').first().getByRole('button',{name:'돈',exact:true}).click();await assertGlass();await close();
 await page.getByRole('button',{name:'상점 관리',exact:true}).click();await page.getByRole('button',{name:'물품 등록',exact:true}).click();await assertGlass();assert.equal(await page.locator('#modal [name=name]').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(255, 255, 255, 0.42)');await close();
 // Long forms, cards, checkbox states, focus and footer reachability at all AGENTS widths.
 for(const width of [320,375,414,768,1024,1280,1440,1920]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(async()=>{const {modal,closeModal}=await import('/js/components/modal.js'),{input,select,textarea,checkbox}=await import('/js/shared/ui.js');modal('기록 수정',`<p class="muted">선택한 학생의 기록을 확인하고 저장하세요.</p>${input('내용','text','함께 배려하며 활동함.','text','placeholder="관찰한 내용을 입력하세요"')}${select('분야','area',['학습','관계'],'관계')}${textarea('추가내용','memo','관련 상담 내역, 지도 내용 등')}${checkbox('비공개','private',true)}<section class="panel"><h3>연결한 기록</h3><p>칭찬과 조언의 의미는 그대로 유지됩니다.</p></section>${Array.from({length:9},(_,i)=>textarea('추가 메모 '+(i+1),'memo'+i,'')).join('')}`,()=>closeModal(),'저장');});
  await assertGlass();
  const check=page.locator('#modal [type=checkbox]');await check.focus();assert(await check.isChecked());await page.keyboard.press('Space');assert(!await check.isChecked());await page.keyboard.press('Space');assert(await check.isChecked());
  const name=page.locator('#modal [name=text]');await name.focus();assert.equal(await name.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(255, 255, 255, 0.58)');assert.notEqual(await name.evaluate(e=>getComputedStyle(e).boxShadow),'none');await name.blur();
  await page.locator('#modal .dialog-body').evaluate(e=>e.scrollTop=e.scrollHeight);const footer=await page.locator('#modal .dialog-foot').boundingBox(),last=await page.locator('#modal [name=memo8]').boundingBox();assert(footer&&last&&last.y+last.height<=footer.y+1,`${width} footer covers final field`);await page.locator('#modal .dialog-body').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:`/workspace/work/modal-glass-${width}.png`});await close();assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
 }
 // Over a dark screen, the shared glass retains a separate translucent reading layer.
 await page.evaluate(async()=>{const {modal}=await import('/js/components/modal.js');document.querySelector('#app').style.background='#0a1026';modal('확인', '<p>학생의 기록은 선명하게 읽을 수 있어야 합니다.</p><p class="muted">아래 화면과 모달의 텍스트를 구분합니다.</p>');});await assertGlass();await page.keyboard.press('Escape');assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
 assert.deepEqual(errors,[]);console.log('PASS glass modals: actual economy editors, shared tint/blur/backdrop, all eight widths, long form/footer, keyboard checkbox/focus/close and Escape');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
