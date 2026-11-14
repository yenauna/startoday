import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=readFileSync(new URL('../startoday-demo.html',import.meta.url));
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();await page.locator('article.student').first().locator('.student-head button').click();await page.getByRole('button',{name:'👁️ 학생 화면으로 보기',exact:true}).click();await page.getByRole('button',{name:'아바타 옷장',exact:true}).click();
 for(const [id,category] of [['hair_1','머리'],['outfit_1','옷']]){
  await page.getByRole('button',{name:'옷 가게',exact:true}).click();await page.getByRole('button',{name:category,exact:true}).click();const item=page.locator(`[data-avatar-id=${id}]`);await item.getByRole('button',{name:'구매',exact:true}).click();await item.getByRole('button',{name:'장착',exact:true}).click();const layer=page.locator(`.student-character-scene [data-avatar-item=${id}]`);await layer.waitFor();assert((await layer.getAttribute('src')).startsWith('data:image/png;base64,'));assert(await layer.evaluate(img=>img.complete&&img.naturalWidth>0));
 }
 assert.deepEqual(errors,[]);console.log('PASS: standalone HTML embeds both transparent PNGs and completes purchase/equip with no external avatar asset dependency');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
