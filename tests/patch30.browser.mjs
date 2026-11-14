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
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 const expected=await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');
  const examples=[['same','2026-11-13','2026-11-13T11:35:00Z'],['backdate','2026-11-10','2026-11-13T11:35:00Z'],['midnight','2026-11-13','2026-11-12T15:05:00Z'],['year','2026-12-31','2026-12-31T15:05:00Z']];
  await store.commit(examples.map(([id,date,createdAt])=>({table:'records',id:'patch30-'+id,data:{id:'patch30-'+id,date,createdAt,studentIds:[store.db.students[0].id],updatedAt:'2026-11-13T11:40:00Z',kind:'관찰',areas:[],text:'30차 '+id}})));
  state.recordFilters={from:'2025-01-01',to:'2027-12-31',student:'',kind:'',area:'',q:'30차'};
  (await import('/js/app.js')).navigate('기록');
  return Object.fromEntries(examples.map(([id,date,createdAt])=>[id,{tooltip:'최초 작성 '+C.formatTimestamp(createdAt),createdAt}]));
 });
 for(const [id,label] of [['same','작성 26.11.13.(금) 20:35'],['backdate','작성 26.11.13.(금) 20:35'],['midnight','작성 26.11.13.(금) 00:05'],['year','작성 27.01.01.(금) 00:05']]){
  const time=page.locator(`[data-record-id="patch30-${id}"] .record-created-time`);
  assert.equal(await time.innerText(),label);assert.equal(await time.getAttribute('title'),expected[id].tooltip);assert.equal(await time.getAttribute('datetime'),expected[id].createdAt);
 }
 assert.equal(await page.locator('[data-record-id="patch30-same"] .record-updated-time').innerText(),'수정 26.11.13.(금) 20:40');
 assert.equal(await page.locator('[data-record-id="patch30-year"] .record-updated-time').count(),0);
 await page.setViewportSize({width:390,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:'/tmp/patch30-records.png',fullPage:false});assert.deepEqual(errors,[]);
 console.log('PASS: actual record cards distinguish same-day/backdated/UTC-midnight/year-boundary creation dates with full tooltips, original timestamps and mobile width');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
