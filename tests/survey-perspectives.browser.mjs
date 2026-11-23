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
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>{
  const C=await import('/js/core.js'),{store}=await import('/js/shared/state.js'),d=C.initialDB();d.students=Array.from({length:20},(_,i)=>({id:'s'+i,no:i+1,name:i===19?'아주긴이름친구':'친구'+String(i+1)}));
  d.surveys=[{id:'map',title:'시선 지도',status:'closed',createdAt:C.now()}];
  const rs=new Map(d.students.map(s=>[s.id,{id:'r'+s.id,surveyId:'map',studentId:s.id,placements:[]} ]));
  const add=(a,b,x,y,extra={})=>rs.get('s'+a).placements.push({targetId:'s'+b,x,y,...extra});
  for(const ids of [[0,1,2],[3,4,5]])for(const a of ids)for(const b of ids)if(a!==b)add(a,b,85,85);
  add(0,6,49.9,50.1,{reason:'자리에서 편안함',tags:['말이 잘 통한다']});add(6,0,50.1,49.9,{reason:'함께 지내고 싶음',tags:['같이 놀면 재밌다']});
  add(0,7,85,85,{reason:'같은 모둠',tags:['친절하고 잘 도와준다']});add(7,0,10,20,{reason:'아직 어색함',tags:['아직 이야기를 많이 못 해 봤다']});
  add(0,8,90,80);add(9,0,15,80);for(let i=10;i<20;i++)add(0,i,85,85);
  d.survey_responses=[...rs.values()].filter(r=>r.placements.length);store.db=d;window.surveyBefore=JSON.stringify(d.survey_responses);(await import('/js/app.js')).navigate('통계');
 });
 await page.getByRole('button',{name:'우리반 마음 지도',exact:true}).click();
 assert.equal(await page.locator('.survey-network-node').count(),20);assert.equal(await page.locator('.survey-network-group').count(),2);assert.equal(await page.locator('.survey-sparse-zone').count(),1);
 assert.equal(await page.locator('.survey-network-node.is-sparse').count(),14);assert.equal(await page.locator('.survey-grid-guide').count(),6);assert.equal(await page.locator('.survey-grid-axis').count(),1);
 for(const kind of ['positive','asymmetric','warning']){const line=page.locator('.survey-network-edge.'+kind).first();assert(await line.count());const style=await line.evaluate(e=>({stroke:getComputedStyle(e).stroke,dash:getComputedStyle(e).strokeDasharray,width:getComputedStyle(e).strokeWidth}));assert.equal(style.stroke,{positive:'rgb(47, 125, 74)',asymmetric:'rgb(167, 122, 8)',warning:'rgb(180, 56, 75)'}[kind]);if(kind==='positive')assert.equal(style.dash,'none');else assert.notEqual(style.dash,'none');if(kind==='warning')assert.equal(style.width,'3px');}
 assert.equal(await page.locator('[data-map-peer=s6]').getAttribute('data-view-split'),'false');assert.equal(await page.locator('[data-map-peer=s6] .survey-reverse-dot').count(),0);
 assert.equal(await page.locator('[data-map-peer=s7] .survey-reverse-dot').count(),1);assert.equal(await page.locator('[data-view-link=s7]').count(),1);
 const primary=page.locator('[data-map-peer=s7] .survey-primary-dot'),reverse=page.locator('[data-map-peer=s7] .survey-reverse-dot');assert.equal(Number(await primary.getAttribute('cx')),52+85*3.16);assert.equal(Number(await reverse.getAttribute('cy')),368-20*3.16);assert.equal(await reverse.evaluate(e=>getComputedStyle(e).fill),'rgb(255, 255, 255)');
 await page.locator('[data-map-peer=s7]').focus();await page.keyboard.press('Enter');const detail=await page.locator('.survey-map-detail').innerText();for(const text of ['나 → 친구8','친구8 → 나','가까움 85 · 편안함 85','가까움 10 · 편안함 20','같은 모둠','아직 어색함','친절하고 잘 도와준다','아직 이야기를 많이 못 해 봤다','갈등·불편 주의'])assert(detail.includes(text),text);
 await page.locator('[data-map-peer=s8]').focus();await page.keyboard.press('Space');assert.match(await page.locator('.survey-map-detail').innerText(),/상대방 미응답/);
 assert.equal(await page.locator('[data-map-peer=s9] .survey-incoming-dot').count(),1);await reverse.click();assert.equal(await page.locator('.survey-map-detail').getAttribute('data-peer'),'s7');
 const boxes=await page.locator('.survey-map-point rect').evaluateAll(es=>es.map(e=>({x:+e.getAttribute('x'),y:+e.getAttribute('y'),w:+e.getAttribute('width'),h:+e.getAttribute('height')})));for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++){const a=boxes[i],b=boxes[j];assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'name labels overlap');}
 for(const width of [320,360,375,412,414,768,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`page overflow ${width}`);for(const selector of ['.survey-graph-viewport','.survey-personal-viewport'])assert((await page.locator(selector).boundingBox()).width<=width);if([375,768,1280].includes(width))await page.locator('.survey-visualizations').screenshot({path:`/tmp/survey-perspectives-${width}.png`});}
 await page.locator('[data-graph-student=s4]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.matches('.survey-personal-section h3'));assert.equal(await page.getByLabel('개인 지도 학생',{exact:true}).inputValue(),'s4');assert(await page.locator('.survey-personal-section').evaluate(e=>e.getBoundingClientRect().y>=0&&e.getBoundingClientRect().y<150));
 assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/js/shared/state.js')).store.db.survey_responses)===window.surveyBefore),true);assert.deepEqual(errors,[]);
 console.log('PASS: 36-cell grid, exact bilateral dots/distance merge, red divergence, both reasons/tags, missing responses, disjoint labels, grouped colored network, keyboard handoff, unchanged survey data, ten viewport widths');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
