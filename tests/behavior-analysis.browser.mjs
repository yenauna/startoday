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
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>{const C=await import('/js/core.js'),{store}=await import('/js/shared/state.js'),d=C.initialDB();d.students=['김가온','이나래','박다온','최라온'].map((name,i)=>({id:'behavior-student-'+i,no:i+1,name,nickname:i===0?'별고래':''}));d.settings[0].schoolName='별빛초등학교';d.records=[...d.students.map((s,i)=>({id:'bulk'+i,studentIds:[s.id],date:'2026-03-02',kind:'칭찬',areas:['학습'],text:'일괄 원문 제외',createdAt:C.now()})),{id:'one',studentIds:[d.students[0].id],date:'2026-03-02',kind:'칭찬',areas:['관계'],text:'김가온이 2번 이나래와 정리함',action:'별빛초등학교 별고래 010-1234-5678',createdAt:C.now()},{id:'two',studentIds:[d.students[0].id],date:'2026-03-03',kind:'관찰',areas:['학습'],text:'=1+1, "개별 기록"',createdAt:C.now()}];d.assignments=[];d.routines=[];store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.behaviorCopied=text}});window.originalBehaviorRecords=JSON.stringify(d.records);(await import('/js/app.js')).navigate('통계');});
 await page.getByRole('button',{name:'행발 문장 변환기',exact:true}).click();await page.locator('#behavior-from').fill('2026-03-02');await page.locator('#behavior-to').fill('2026-03-03');await page.getByRole('button',{name:'선택 학생 초안 생성',exact:true}).click();assert.equal(await page.locator('.behavior-result').count(),4);assert.match(await page.locator('.behavior-result').first().innerText(),/일괄 기록 제외 1건/);assert(!(await page.locator('.behavior-result').first().innerText()).includes('일괄 원문 제외'));
 await page.locator('.behavior-toolbar').getByRole('button',{name:'AI용 프롬프트 복사',exact:true}).click();const prompt=await page.evaluate(()=>window.behaviorCopied);assert(prompt.includes('9) 최종 행발 추천문'));const data=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));assert.equal(data.length,4);assert.equal(data[0].classDistribution.kinds.praise.mean,.25);assert.equal(data[0].relative.kinds.praise.onlyStudent,true);assert(!prompt.includes('김가온'));
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'AI용 기록 CSV 내려받기',exact:true}).click();const download=await pending;assert.match(download.suggestedFilename(),/^행발_AI분석용_기록_\d{8}\.csv$/);const bytes=readFileSync(await download.path()),csv=bytes.toString('utf8');assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');for(const secret of ['김가온','이나래','별고래','별빛초등학교','010-1234-5678','일괄 원문 제외'])assert(!csv.includes(secret),secret);assert(csv.includes('학생 A'));assert(csv.includes('반 내 상대 위치'));assert(csv.includes("'=1+1"));
 const legacy=page.waitForEvent('download');await page.getByRole('button',{name:'CSV로 내려받기',exact:true}).click();assert.match((await legacy).suggestedFilename(),/^행발_초안_/);
 for(const width of [320,375,414,768,1024,1280,1440,1920]){await page.setViewportSize({width,height:900});assert.equal(await page.locator('#modal').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,`modal overflow ${width}`);const button=await page.getByRole('button',{name:'AI용 기록 CSV 내려받기',exact:true}).boundingBox();assert(button.width<width);}
 assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/shared/state.js')).store.db.records)===window.originalBehaviorRecords),true);assert.deepEqual(errors,[]);console.log('PASS: converter batch exclusion, anonymous class-relative prompt, real BOM/formula-safe CSV download, existing draft CSV retained, unchanged source records, eight widths');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
