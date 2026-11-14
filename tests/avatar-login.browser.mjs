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
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:1000}}),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(async()=>{
  const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js'),ui=await import('/js/tabs/student-view.js');
  let d=C.initialDB();Object.assign(d.settings[0],{schoolName:'아바타초등학교',grade:5,classGroup:'1'});d.students=[{id:'remote',no:1,name:'가온'}];d=C.applyOps(d,C.teacherBalanceAdjustOps(d,'remote',50));
  localStorage.removeItem('startoday-demo-v1');store.mode='none';store.db=null;store.signalChange=()=>{};window.avatarRequests=[];window.failNextAvatar=true;
  store.client={rpc:async(method,args)=>{
   window.avatarRequests.push({method,args});if(args.p_password!=='나만암호7')return {data:null};
   if(method==='startoday_student_login')return {data:{...ui.studentSnapshot(d,d.students[0]),avatar:{owned:null,equipped:null},mustChangePassword:false}};
   if(window.failNextAvatar){window.failNextAvatar=false;return {error:{code:'PGRST202',message:'function missing'}};}
   if(!['startoday_avatar_buy','startoday_avatar_equip'].includes(method))throw Error('Unexpected RPC '+method);
   d=C.applyOps(d,C.avatarOps(d,'remote',args.p_item_id,method.endsWith('_buy')?'buy':'equip'));
   return {data:{classId:'c',revision:1,snapshot:ui.studentSnapshot(d,d.students[0])}};
  }};
  (await import('/js/app.js')).render();ui.studentLoginDialog();
 });
 await page.locator('#modal [name=schoolName]').fill('아바타초등학교');await page.locator('#modal [name=grade]').fill('5');await page.locator('#modal [name=classGroup]').fill('1');await page.locator('#modal [name=no]').fill('1');await page.locator('#modal [name=password]').fill('나만암호7');await page.locator('#modal button[type=submit]').click();await page.locator('.student-shell').waitFor();
 await page.getByRole('button',{name:'아바타 옷장',exact:true}).click();await page.getByRole('button',{name:'옷 가게',exact:true}).click();
 for(const category of ['옷','효과','배경','머리'])await page.getByRole('button',{name:category,exact:true}).click();
 const hair=page.locator('[data-avatar-id=hair_1]');await hair.getByRole('button',{name:'구매',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('최신 schema.sql'));assert.equal(await hair.getByRole('button',{name:'구매',exact:true}).isEnabled(),true);
 await hair.getByRole('button',{name:'구매',exact:true}).click();await hair.getByRole('button',{name:'장착',exact:true}).click();await page.locator('.student-character-scene [data-avatar-item=hair_1]').waitFor();
 await page.getByRole('button',{name:'옷 가게',exact:true}).click();await page.getByRole('button',{name:'옷',exact:true}).click();const outfit=page.locator('[data-avatar-id=outfit_1]');await outfit.getByRole('button',{name:'구매',exact:true}).click();await outfit.getByRole('button',{name:'장착',exact:true}).click();await page.locator('.student-character-scene [data-avatar-item=outfit_1]').waitFor();
 assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db),null);
 assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).state.studentSnapshot.economy.balance),30);
 assert.equal(await page.evaluate(()=>window.avatarRequests.filter(x=>x.method==='startoday_avatar_equip').length),2);assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 console.log('PASS: actual student login RPC routing, null legacy response, all categories, friendly missing-SQL recovery, retry purchase/equip both PNG items, balance, private teacher DB absent and no error dialogs');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
