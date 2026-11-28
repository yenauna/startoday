import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
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
const widths=(process.env.WIDTHS||'320,360,375,412,414,768,1024,1280,1440,1920').split(',').map(Number),issues=[],results=[];
// 화면 캡처는 RESPONSIVE_SHOTS 경로를 줄 때만 남긴다(검사 자체는 캡처 없이 훨씬 빠르게 돈다).
const shots=process.env.RESPONSIVE_SHOTS||'';if(shots)mkdirSync(shots,{recursive:true});let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of widths){
  const height=width===768?1024:width===1024?768:900,page=await browser.newPage({viewport:{width,height},isMobile:width<=1024,hasTouch:width<=1024,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
  await page.evaluate(async()=>{const C=await import('/js/core.js'),{store,state}=await import('/js/shared/state.js');let d=C.initialDB();const date=C.today();Object.assign(d.settings[0],{grade:5,className:'행복한 우리 반 5학년 1반',classroomShowScores:true,nameDisplayMode:'real'});d.students=Array.from({length:20},(_,i)=>({id:'s'+i,no:i+1,name:i%2?'이나래':'김가온',nickname:'우리반반짝이는별'+i}));d.records=Array.from({length:45},(_,i)=>({id:'r'+i,date,kind:'칭찬',studentIds:['s0'],areas:['학습'],text:'친구와 함께 책을 읽고 내용을 발표함',createdAt:C.now()}));d.assignments=[{id:'task',date,title:'수학 100쪽 문제를 풀고 풀이 과정을 자세히 쓰기',repeat:{type:'none'},target:'all'},{id:'quest',date,title:'리코더 세 곡 연주 장기과제',isQuest:true,questGoal:3,questSubtasks:['학교종','나비야','작은별'],target:'all',repeat:{type:'none'}}];d.routines=[{id:'routine',title:'책상과 사물함 정리하기',target:'all'}];d.timetables=[{id:'slot',date,period:1,subjectCode:'국어',publicMemo:'교과서와 필기도구를 준비하세요'},{id:'slot2',date,period:2,subjectCode:'수학',publicMemo:'짝과 풀이를 이야기하기'}];d.events=[{id:'event',date,timeOfDay:'morning',title:'아침 독서 활동',isImportant:true}];d.shop_items=[{id:'coupon',name:'친구와 함께 쓰는 특별한 숙제 면제권',category:'숙제',price:10,stock:20,description:'사용하기 전 선생님과 이야기해요.'},{id:'snack',name:'교실 간식 선택권',category:'특별 혜택',price:20,stock:null},{id:'fund',name:'금요일 보드게임 파티',category:'특별 혜택',price:100,isGroupBuy:true,groupGoal:100,groupCollected:65,isFunded:false,isUsed:false,stock:null}];d=C.applyOps(d,C.teacherGiftOps(d,'s0','coupon'));d.surveys=[];d.survey_responses=[];d=C.applyOps(d,C.surveyStartOps(d,'우리반 마음 지도'));const sid=d.surveys[0].id;d.survey_responses=d.students.slice(1,6).map((s,i)=>({id:'response'+i,surveyId:sid,studentId:s.id,placements:d.students.filter(t=>t.id!==s.id).map((t,j)=>({targetId:t.id,x:j%3?80:25,y:j%4?75:20,reason:'함께 활동하면서 느낀 마음',tags:[]}))}));store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));state.selected=[];state.date=date;(await import('/js/app.js')).navigate('대시보드');});
  const capture=async name=>{await page.evaluate(()=>document.fonts.ready);const defects=await page.evaluate(()=>{
   const problems=[],visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1;},label=e=>e.tagName.toLowerCase()+'.'+[...e.classList].slice(0,3).join('.');
   for(const card of document.querySelectorAll('.student[data-student-id]')){if(visible(card)&&card.getBoundingClientRect().width<110)problems.push({type:'narrow-student-card',width:card.getBoundingClientRect().width});}
   if(document.documentElement.scrollWidth>innerWidth+1)problems.push({type:'page-overflow',width:document.documentElement.scrollWidth,viewport:innerWidth});
   const selectors='.student-header,.student-header-actions,.student-profile-topline,.student-notification-entry,.student-home-topbar,.student-card,.student-profile-header,.student-profile-areas,.student-avatar-manager,.avatar-item,.village-wallet,.village-product,.survey-board,.classroom-heading,.classroom-controls,.settings-content,.settings-sidebar,.title-domain-grid,.constellation-hero,.survey-visualizations';
   for(const e of document.querySelectorAll(selectors)){if(!visible(e))continue;const r=e.getBoundingClientRect();if((r.left< -1||r.right>innerWidth+1)&&!e.closest('.table-wrap'))problems.push({type:'offscreen',element:label(e),left:r.left,right:r.right});if(e.scrollWidth>e.clientWidth+3&&!e.matches('.settings-sidebar'))problems.push({type:'internal-overflow',element:label(e),width:e.clientWidth,scroll:e.scrollWidth});}
   for(const group of document.querySelectorAll('.student-header,.student-header-actions,.student-profile-topline,.student-profile-header,.classroom-heading,.classroom-controls,.economy-subtabs,.toolbar')){if(!visible(group))continue;const children=[...group.children].filter(e=>visible(e)&&!(e.getAttribute('aria-hidden')==='true'&&getComputedStyle(e).pointerEvents==='none'));for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){const a=children[i].getBoundingClientRect(),b=children[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3)problems.push({type:'overlap',element:label(group),a:label(children[i]),b:label(children[j])});}}
   // A) 버튼·탭·배지·표 머리·날짜 라벨: 마지막 줄에 한두 글자만 남는 줄바꿈이 없어야 한다.
   const compactLabels='button, th, .badge, .pill, .weekday, .notice-calendar-weekday, .economy-subtabs button, .village-economy-tabs button, .settings-tabs button, .date-display, .student-card-title, .schedule-period-title';
   for(const e of document.querySelectorAll(compactLabels)){
    if(!visible(e)||e.querySelector('br')||e.children.length)continue;
    const text=(e.textContent||'').trim();if(text.length<6)continue;
    const s=getComputedStyle(e);if(s.whiteSpace==='nowrap')continue;
    const lh=parseFloat(s.lineHeight)||16;if(e.getBoundingClientRect().height>lh*2.8)continue;
    const range=document.createRange();range.selectNodeContents(e);
    const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0),lines=[];
    for(const r of rects){const l=lines.find(x=>Math.abs(x.top-r.top)<4);if(l){l.left=Math.min(l.left,r.left);l.right=Math.max(l.right,r.right);}else lines.push({top:r.top,left:r.left,right:r.right});}
    if(lines.length<2)continue;
    // 마지막 줄에 남은 글자를 세어, 낱말 중간에서 1~2글자만 떨어진 경우만 문제로 본다(어절 단위 줄바꿈은 정상).
    const node=e.firstChild,raw=node.textContent,lastTop=lines[lines.length-1].top;let firstIdx=-1;
    for(let i=0;i<raw.length;i++){const rg=document.createRange();rg.setStart(node,i);rg.setEnd(node,i+1);const rr=rg.getBoundingClientRect();if(rr.width&&Math.abs(rr.top-lastTop)<4){firstIdx=i;break;}}
    if(firstIdx>0&&raw.slice(firstIdx).trim().length<=2&&!/[\s\u00a0]/.test(raw[firstIdx-1]))problems.push({type:'orphan-line',element:label(e),text:text.slice(0,24),lastLine:text.slice(firstIdx,firstIdx+4)});
   }
   // B) 같은 줄에 놓인 입력·선택·버튼은 높이가 같아야 한다(헤더 브랜드는 두 줄 이름이라 제외).
   const controls='button, input:not([type=hidden]), select, .date-range-trigger, .date-control',controlGroups=new Map();
   for(const e of document.querySelectorAll(controls)){
    if(!visible(e))continue;
    const p=e.parentElement;if(!p||p.closest('.header-leading'))continue;
    const ps=getComputedStyle(p);if(ps.display!=='flex'&&ps.display!=='grid')continue;
    if(!controlGroups.has(p))controlGroups.set(p,[]);controlGroups.get(p).push(e);
   }
   for(const [p,els] of controlGroups){
    if(els.length<2)continue;
    const lines=[];
    for(const e of els){const r=e.getBoundingClientRect();if(r.width<10||r.height<10)continue;
     const line=lines.find(x=>Math.min(x.bottom,r.bottom)-Math.max(x.top,r.top)>Math.min(x.height,r.height)*0.5);
     if(line)line.items.push({el:e,h:r.height});else lines.push({top:r.top,bottom:r.bottom,items:[{el:e,h:r.height}]});}
    for(const line of lines){
     if(line.items.length<2)continue;
     const hs=line.items.map(i=>i.h),diff=Math.max(...hs)-Math.min(...hs);
     if(diff>6)problems.push({type:'control-height',parent:label(p),items:line.items.map(i=>label(i.el)+':'+Math.round(i.h)),diff:Math.round(diff)});
    }
   }
   return problems;
  });issues.push(...defects.map(d=>({width,screen:name,...d})));results.push({width,screen:name,issues:defects.length});if(shots)await page.screenshot({path:`${shots}/${width}-${name}.png`});};
  const nav=async tab=>page.evaluate(async tab=>(await import('/js/app.js')).navigate(tab),tab);
  await capture('teacher-dashboard');await page.getByRole('button',{name:'+ 일정',exact:true}).click();await capture('teacher-event-modal');await page.getByRole('button',{name:'수업',exact:true}).click();await page.getByRole('button',{name:'2교시',exact:true}).click();await capture('teacher-lesson-modal');await page.evaluate(async()=>(await import('/js/components/modal.js')).closeModal());
  await nav('일정');await capture('teacher-schedule');await page.evaluate(async()=>(await import('/js/app.js')).setScheduleManage('과제'));await capture('teacher-schedule-assignments');await page.evaluate(async()=>(await import('/js/app.js')).setScheduleManage('루틴'));await capture('teacher-schedule-routines');await page.evaluate(async()=>(await import('/js/app.js')).setScheduleManage(''));await nav('수업도구');await capture('teacher-tools');
  await nav('설정');await capture('teacher-settings-basic');await page.locator('[data-settings-tab="학생 명단"]').click();await capture('teacher-settings-roster');await page.locator('[data-settings-tab="교실화면"]').click();await capture('teacher-settings-classroom');await page.locator('[data-settings-tab="학사일정"]').click();await capture('teacher-settings-calendar');await page.locator('[data-settings-tab="과목·전담"]').click();await capture('teacher-settings-subjects');await page.locator('[data-settings-tab="분야 종류"]').click();await capture('teacher-settings-areas');await page.locator('[data-settings-tab="데이터 백업"]').click();await capture('teacher-settings-backup');await page.locator('[data-settings-tab="칭호 관리"]').click();await page.locator('.title-icon-picker summary').first().click();await capture('teacher-title-picker');
  await nav('경제');await page.getByRole('button',{name:'알바',exact:true}).click();await capture('teacher-jobs');await page.getByRole('button',{name:'은행·주식',exact:true}).click();await capture('teacher-finance');await page.getByRole('button',{name:'자산 관리',exact:true}).click();await page.locator('.economy-salary-open').click();await capture('teacher-salary');await page.evaluate(async()=>(await import('/js/components/modal.js')).closeModal());await nav('알림장');await capture('teacher-notices');await page.getByRole('button',{name:'크게 보기',exact:true}).click();await capture('teacher-notice-board');await page.evaluate(async()=>(await import('/js/components/modal.js')).closeModal());await nav('학급회의');await capture('teacher-meetings');await nav('사건');await capture('teacher-incidents');await nav('자리');await capture('teacher-seating');await nav('통계');await capture('teacher-statistics');await page.getByRole('button',{name:'학생 선택 / 전체 내보내기',exact:true}).click();await capture('teacher-report-dialog');await page.evaluate(async()=>(await import('/js/components/modal.js')).closeModal());await page.locator('.student-score-table tbody button').first().click();await capture('teacher-student-detail');await page.evaluate(async()=>(await import('/js/components/modal.js')).closeModal());await page.getByRole('button',{name:'학생 종합 분석',exact:true}).click();await capture('teacher-student-analysis');await page.evaluate(async()=>(await import('/js/components/modal.js')).closeModal());await page.getByRole('button',{name:'우리반 마음 지도',exact:true}).click();await capture('teacher-survey-graphs');await page.locator('[data-graph-student="s1"]').click();await capture('teacher-survey-personal');await page.locator('[data-map-peer]').first().focus();await page.keyboard.press('Enter');await capture('teacher-survey-point');
  await nav('경제');await page.getByRole('button',{name:'자산 관리',exact:true}).click();await capture('teacher-assets');await page.getByRole('button',{name:'☰ 엑셀 목록형',exact:true}).click();await capture('teacher-assets-table');
  await page.evaluate(async()=>(await import('/js/tabs/student-view.js')).previewStudent('s0'));await capture('student-home');await page.getByRole('button',{name:'알림',exact:true}).click();await capture('student-notifications');await page.evaluate(async()=>(await import('/js/components/modal.js')).closeModal());await page.getByRole('button',{name:'칭호도감 열기',exact:true}).click();await capture('student-titles');await page.evaluate(async()=>(await import('/js/components/modal.js')).closeModal());await page.locator('[data-calendar-date]').filter({has:page.locator(':scope.is-today')}).count().then(async count=>{if(count)await page.locator('[data-calendar-date].is-today').click();else await page.locator('[data-calendar-date]').nth(15).click();});await capture('student-calendar');
  await page.getByRole('button',{name:'학급회의',exact:true}).click();await capture('student-meetings');await page.getByRole('button',{name:'설문',exact:true}).click();await page.locator('.survey-peer-list button').first().click();await page.locator('.survey-board').scrollIntoViewIfNeeded();let r=await page.locator('.survey-board').boundingBox();await page.mouse.click(r.x+r.width*.7,r.y+r.height*.3);await capture('student-survey');await page.getByRole('button',{name:'경제',exact:true}).click();await capture('student-assets');await page.getByRole('button',{name:'상점',exact:true}).click();await capture('student-shop');await page.getByRole('button',{name:'은행(정기예금)',exact:true}).click();await capture('student-bank');await page.getByRole('button',{name:'주식',exact:true}).click();await capture('student-stocks');await page.getByRole('button',{name:'알바',exact:true}).click();await capture('student-jobs');
  await page.getByRole('button',{name:'별빛 교실',exact:true}).click();await page.getByRole('button',{name:'아바타 옷장',exact:true}).click();await capture('student-closet');await page.getByRole('button',{name:'옷 가게',exact:true}).click();await capture('student-avatar-shop');for(const category of ['옷','효과','배경']){await page.getByRole('button',{name:category,exact:true}).click();await capture('student-avatar-'+category);}
  await page.getByRole('button',{name:'교사 화면으로 돌아가기',exact:true}).click();await page.evaluate(async()=>(await import('/js/tabs/classroom.js')).classroom());await capture('classroom');await page.locator('#class-notices').click();await capture('classroom-notice-board');
  issues.push(...errors.map(message=>({width,screen:'runtime',type:'pageerror',message})));console.log(`${width}px: ${results.filter(r=>r.width===width).length} screens, ${issues.filter(i=>i.width===width).length} issues`);await page.close();
 }
 if(shots)writeFileSync(`${shots}/report.json`,JSON.stringify({results,issues},null,2));if(issues.length)console.log(JSON.stringify(issues,null,2));assert.equal(issues.length,0,'Responsive defects: '+JSON.stringify(issues));console.log(`PASS: ${widths.join(',')}px · ${results.length} screen states · overflow, sibling overlap, orphan label line and control height checks`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
