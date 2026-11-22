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
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:412,height:900},isMobile:true,hasTouch:true}),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);
 page.setDefaultTimeout(10000);
 await page.evaluate(async()=>{
  const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js'),ui=await import('/js/tabs/student-view.js');let d=C.initialDB();Object.assign(d.settings[0],{schoolName:'마음초등학교',grade:5,classGroup:'1'});d.students=[{id:'remote',no:1,name:'가온'},{id:'peer',no:2,name:'나래'}];d=C.applyOps(d,C.surveyStartOps(d,'로그인 설문'));localStorage.removeItem('startoday-demo-v1');store.mode='none';store.db=null;store.signalChange=()=>{};window.surveyRequests=[];
  store.client={rpc:async(method,args)=>{window.surveyRequests.push({method,args});if(args.p_password!=='나만암호7')return {data:null};if(method==='startoday_student_login')return{data:{...ui.studentSnapshot(d,d.students[0]),mustChangePassword:false}};if(method!=='startoday_student_survey_submit')throw Error('Unexpected RPC');d=C.applyOps(d,C.surveySubmitOps(d,'remote',args.p_survey,args.p_placements));return{data:{snapshot:ui.studentSnapshot(d,d.students[0])}};}};(await import('/js/app.js')).render();ui.studentLoginDialog();
 });
 await page.locator('#modal [name=schoolName]').fill('마음초등학교');await page.locator('#modal [name=grade]').fill('5');await page.locator('#modal [name=classGroup]').fill('1');await page.locator('#modal [name=no]').fill('1');await page.locator('#modal [name=password]').fill('나만암호7');await page.locator('#modal button[type=submit]').click();await page.locator('.student-shell').waitFor();await page.getByRole('button',{name:'설문',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('.survey-board')?.dataset.bound==='true');
 // Real touchscreen tap placement with exact fractional position.
 await page.locator('.survey-peer-list button').tap();await page.locator('.survey-board').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.survey-board')?.dataset.bound==='true');let r=await page.locator('.survey-board').boundingBox();await page.touchscreen.tap(r.x+r.width*.78,r.y+r.height*.24);await page.getByRole('button',{name:'말이 잘 통한다',exact:true}).tap();await page.getByRole('button',{name:'같이 있으면 어색하다',exact:true}).tap();await page.getByRole('button',{name:'제출하기',exact:true}).tap();await page.getByText('제출을 완료했습니다. 다음 설문을 기다려 주세요.',{exact:true}).waitFor();
 const request=await page.evaluate(()=>window.surveyRequests.find(r=>r.method==='startoday_student_survey_submit'));assert.equal(request.args.p_no,1);assert.equal(request.args.p_school,'마음초등학교');assert.equal(request.args.p_placements.length,1);assert(Math.abs(request.args.p_placements[0].x-78)<1);assert(Math.abs(request.args.p_placements[0].y-76)<1);assert.equal(request.args.p_placements[0].reason,'');assert.deepEqual(request.args.p_placements[0].tags,['말이 잘 통한다','같이 있으면 어색하다']);assert.equal(await page.evaluate(async()=>(await import('/js/shared/state.js')).store.db),null);assert(!await page.evaluate(()=>JSON.stringify(localStorage).includes('나만암호7')));assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);console.log('PASS: actual student login identity/credential RPC route, real mobile touchscreen select/place/submit, exact coordinates/optional reason, completed state and teacher DB absent');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
