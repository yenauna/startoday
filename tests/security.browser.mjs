import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.webp':'image/webp','.woff2':'font/woff2'};
// 외부 CDN 스크립트 없이 자체 벤더 번들·CSP만으로 동작하는지 실제 브라우저로 검증합니다.
const index=readFileSync(path.join(root,'index.html'),'utf8');
const storeSource=readFileSync(path.join(root,'js/store.js'),'utf8');
const vendor=readFileSync(path.join(root,'vendor/supabase-js-2.49.8.min.js'));
const integrity='sha384-'+crypto.createHash('sha384').update(vendor).digest('base64');
const csp=index.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]||'';
assert(csp.includes("script-src 'self';"),'스크립트는 자체 호스팅만 허용');
assert(csp.includes("object-src 'none';")&&csp.includes("base-uri 'self'"),'객체·기준 URL 차단');
assert(!csp.includes("script-src 'self' 'unsafe-inline'"),'인라인 스크립트 허용 금지');
assert(storeSource.includes(`'${integrity}'`),'store.js의 무결성 해시가 벤더 파일과 일치');
assert(!/cdn\.jsdelivr\.net\/npm|cdn\.jsdelivr\.net\/npm\/@supabase/.test(storeSource),'런타임 CDN 스크립트 주입 없음');
assert(index.includes('vendor/pretendard-1.3.9-dynamic-subset.css'),'폰트 CSS는 저장소에서 직접 제공');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.STARTODAY_CONFIG={};');return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',types[path.extname(file)]||'text/html');res.end(readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[],externalScripts=[],fontHosts=new Set();
 await page.addInitScript(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{const u=new URL(r.url());if(r.resourceType()==='script'&&u.hostname!=='127.0.0.1')externalScripts.push(r.url());if(r.resourceType()==='font')fontHosts.add(u.hostname);});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).waitFor();
 page.setDefaultTimeout(15000);
 // 1) 벤더 SDK가 자체 번들로 로드된다(운영과 같은 태그·무결성 속성).
 const loaded=await page.evaluate(async({src,integrity})=>{const el=document.createElement('script');el.src=src;el.integrity=integrity;el.crossOrigin='anonymous';const done=new Promise(r=>{el.onload=()=>r('load');el.onerror=()=>r('error');setTimeout(()=>r('timeout'),8000);});document.head.append(el);const state=await done;return {state,client:typeof window.supabase?.createClient,scripts:performance.getEntriesByType('resource').filter(r=>r.name.includes('supabase-js')).map(r=>new URL(r.name).pathname)};},{src:'vendor/supabase-js-2.49.8.min.js',integrity});
 assert.deepEqual(loaded,{state:'load',client:'function',scripts:['/vendor/supabase-js-2.49.8.min.js']});
 // 2) CSP가 인라인 스크립트·무결성 불일치·인라인 핸들러를 실제로 막는다.
 const blocked=await page.evaluate(async()=>{const out={};const inline=document.createElement('script');inline.textContent='window.__inlineRan=1';document.head.append(inline);out.inline=window.__inlineRan===undefined;const bad=document.createElement('script');bad.src='vendor/supabase-js-2.49.8.min.js';bad.integrity='sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';bad.crossOrigin='anonymous';const failed=new Promise(r=>{bad.onerror=()=>r(true);setTimeout(()=>r(false),5000);});document.head.append(bad);out.integrity=await failed;const handler=document.createElement('button');handler.setAttribute('onclick','window.__handlerRan=1');document.body.append(handler);handler.click();out.handler=window.__handlerRan===undefined;return out;});
 assert.deepEqual(blocked,{inline:true,integrity:true,handler:true});
 const violationsAfterProbe=await page.evaluate(()=>{const v=window.__csp.slice();window.__csp=[];return v;});
 assert(violationsAfterProbe.some(v=>v.startsWith('script-src-elem'))&&violationsAfterProbe.some(v=>v.startsWith('script-src-attr')));
 // 3) 폰트·아이콘은 자체 CSS + jsDelivr 폰트 파일만 사용하고 모두 로드된다.
 await page.evaluate(()=>document.fonts.ready);
 const look=await page.evaluate(()=>({family:getComputedStyle(document.body).fontFamily,font:document.fonts.check('16px "Pretendard Variable"'),icons:[...document.images].every(img=>img.complete||img.src.startsWith('data:')),sheet:[...document.styleSheets].some(s=>(s.href||'').includes('vendor/pretendard'))}));
 assert.match(look.family,/Pretendard Variable/);assert.equal(look.font,true);assert.equal(look.icons,true);assert.equal(look.sheet,true);
 // 4) 교사 화면: 대시보드·기록·경제(인라인 스타일 다수)·설정이 CSP 위반 없이 렌더링된다.
 await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.getByRole('heading',{name:/의 하루/}).waitFor();
 for(const tab of ['기록','경제','설정','대시보드']){
  await page.evaluate(async name=>(await import('/js/app.js')).navigate(name), tab);
  await page.waitForTimeout(120);
  assert((await page.locator('#app').innerText()).trim().length>0);
 }
 assert.deepEqual(await page.evaluate(()=>window.__csp.slice()),[]);
 // 5) 학생 로그인(체험 명단)도 같은 정책에서 정상 동작한다.
 await page.evaluate(async()=>(await import('/js/tabs/student-view.js')).studentLoginDialog());
 await page.locator('#modal [name=no]').fill('1');
 await page.locator('#modal [name=password]').fill('바람123');
 await page.locator('#modal button[type=submit]').click();
 await page.locator('#modal [name=newPassword]').fill('바람별빛7');
 await page.locator('#modal [name=confirmPassword]').fill('바람별빛7');
 await page.locator('#modal button[type=submit]').click();
 await page.locator('.student-shell').waitFor();
 await page.waitForFunction(()=>{const shell=document.querySelector('.student-shell');return shell&&!shell.innerText.includes('새 비밀번호를 설정해 주세요');});
 assert.match(await page.locator('.student-shell').innerText(),/가온/);
 assert.deepEqual(await page.evaluate(()=>window.__csp.slice()),[]);
 assert.deepEqual(errors,[]);
 assert.deepEqual(externalScripts,[]);
 assert.deepEqual([...fontHosts].filter(host=>host!=='127.0.0.1'),['cdn.jsdelivr.net']);
 console.log('PASS: CSP script-src self, 인라인 스크립트·무결성 불일치·인라인 핸들러 차단, 자체 벤더 SDK 로드·해시 일치, Pretendard 자체 CSS·폰트 로드, 교사·학생 화면 무위반');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
