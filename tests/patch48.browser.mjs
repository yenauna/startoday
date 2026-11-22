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
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 page.setDefaultTimeout(10000);
 const today=await page.evaluate(async()=>(await import('/js/core.js')).today());
 const month=today.slice(0,7),day=n=>`${month}-${String(n).padStart(2,'0')}`,dotted=n=>`${month.replaceAll('-','.')}.${String(n).padStart(2,'0')}`,year=month.slice(0,4),monthNo=Number(month.slice(5,7));
 await page.evaluate(async days=>{const {store,state}=await import('/js/shared/state.js'),C=await import('/js/core.js');const d=C.initialDB();d.students=[{id:'s48-a',no:1,name:'김가온'},{id:'s48-b',no:2,name:'이나래'}];d.records=[{id:'r48-existing',studentIds:['s48-a'],date:days.five,kind:'칭찬',areas:['관계'],text:'급우와 협력함',createdAt:C.now(),updatedAt:C.now()}];d.assignments=[];d.routines=[];store.db=d;localStorage.setItem('startoday-demo-v1',JSON.stringify(d));localStorage.removeItem('startoday-behavior-drafts-v1');state.date=C.today();(await import('/js/app.js')).navigate('통계');},{five:day(5)});

 // 1) 초안 자동 저장과 모달 재오픈 복원
 await page.getByRole('button',{name:'행발 문장 변환기',exact:true}).click();
 const draftA=page.locator('[data-behavior-draft="s48-a"]');
 const custom='교사가 직접 고친 초안입니다, 쉼표 포함';
 await draftA.fill(custom);
 assert.match(await page.locator('[data-behavior-status="s48-a"]').innerText(),/저장된 초안/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('startoday-behavior-drafts-v1'))['demo:demo']['s48-a'].text),custom);
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'행발 문장 변환기',exact:true}).click();
 assert.equal(await page.locator('[data-behavior-draft="s48-a"]').inputValue(),custom);
 assert.match(await page.locator('[data-behavior-status="s48-a"]').innerText(),/저장된 초안/);
 // 이미 저장한 초안은 선택 학생 초안 생성으로 덮어쓰지 않음
 await page.getByRole('button',{name:'선택 학생 초안 생성',exact:true}).click();
 assert.equal(await page.locator('[data-behavior-draft="s48-a"]').inputValue(),custom);

 // 2) 전체 초안 CSV / 텍스트 내려받기 (UTF-8 BOM, 따옴표 처리)
 const [csvDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'CSV로 내려받기',exact:true}).click()]);
 assert.equal(csvDownload.suggestedFilename(),`행발_초안_${today.replaceAll('-','')}.csv`);
 const csvText=readFileSync(await csvDownload.path(),'utf8');
 assert.equal(csvText.charCodeAt(0),0xFEFF);
 assert(csvText.includes('번호,학생,기간,기록 수,초안'));
 assert(csvText.includes(`"교사가 직접 고친 초안입니다, 쉼표 포함"`));
 assert(csvText.split('\r\n').length>=3);
 const [txtDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'텍스트로 내려받기',exact:true}).click()]);
 assert.equal(txtDownload.suggestedFilename(),`행발_초안_${today.replaceAll('-','')}.txt`);
 const txtText=readFileSync(await txtDownload.path(),'utf8');
 assert(txtText.includes(custom));
 assert(txtText.includes('1. 김가온'));
 // 수식으로 해석될 수 있는 접두사는 CSV에서만 이스케이프한다.
 const csvButton=page.getByRole('button',{name:'CSV로 내려받기',exact:true});
 for(const prefix of ['=', '+', '-', '@', '\t']){
  await draftA.fill(prefix+'한글 "초안", 쉼표');
  const [download]=await Promise.all([page.waitForEvent('download'),csvButton.click()]);
  assert(readFileSync(await download.path(),'utf8').includes(`"'${prefix}한글 ""초안"", 쉼표"`));
 }
 await draftA.fill(custom);
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();

 // 3) 새로고침 뒤에도 저장된 초안이 남고, 덮어쓰기·지우기는 확인 후에만 동작
 await page.reload();
 if(await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).isVisible())await page.getByRole('button',{name:'가상 명단으로 먼저 살펴보기',exact:true}).click();
 await page.evaluate(async()=>(await import('/js/app.js')).navigate('통계'));
 await page.getByRole('button',{name:'행발 문장 변환기',exact:true}).click();
 assert.equal(await page.locator('[data-behavior-draft="s48-a"]').inputValue(),custom);
 const accept=d=>d.accept();page.on('dialog',accept);
 await page.locator('.behavior-result[data-behavior-id="s48-a"]').getByRole('button',{name:'초안 새로 생성(덮어쓰기)',exact:true}).click();
 const rewritten=await page.locator('[data-behavior-draft="s48-a"]').inputValue();
 assert.notEqual(rewritten,custom);
 assert(rewritten.includes('협력'));
 assert.match(await page.locator('[data-behavior-status="s48-a"]').innerText(),/저장된 초안/);
 await page.locator('.behavior-result[data-behavior-id="s48-a"]').getByRole('button',{name:'저장된 초안 지우기',exact:true}).click();
 assert.equal(await page.locator('[data-behavior-draft="s48-a"]').inputValue(),'');
 assert.match(await page.locator('[data-behavior-status="s48-a"]').innerText(),/저장 안 됨/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('startoday-behavior-drafts-v1'))['demo:demo']['s48-a']??null),null);
 page.off('dialog',accept);
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();

 // 4) CSV 가져오기: 열 자동 인식·매칭·중복 건너뛰기·미매칭 안내
 const csvRows=[
  ['이름','날짜','분야','유형','내용'],
  ['김가온',dotted(5),'관계','칭찬','급우와 협력함'],
  ['김가온',day(6),'학습/생활','조언','수업 준비물을 챙기지 않음'],
  ['이나래',`${year}년 ${monthNo}월 7일`,'학습','기록','수업 중 발표를 잘 들음'],
  ['박없는',day(8),'관계','칭찬','명단에 없는 학생'],
  ['이나래',day(8),'학습','알수없음','유형을 모르는 행'],
  ['이나래',day(9),'관계, 학습','칭찬','쉼표, 따옴표 "포함" 기록'],
  ['김가온','','관계','칭찬','날짜가 없는 행']
 ];
 const csvBuffer=Buffer.from('\uFEFF'+csvRows.map(row=>row.map(cell=>`"${String(cell).replaceAll('"','""')}"`).join(',')).join('\r\n'),'utf8');
 await page.getByRole('button',{name:'CSV 가져오기',exact:true}).click();
 await page.locator('#csv-file').setInputFiles({name:'기록.csv',mimeType:'text/csv',buffer:csvBuffer});
 await page.getByText('가져올 기록 5건',{exact:true}).waitFor();
 const importText=await page.locator('#csv-import-body').innerText();
 assert(importText.includes('중복 건너뜀 1건'),importText);
 assert(importText.includes('이름 미매칭 1명'),importText);
 assert(importText.includes('박없는'),importText);
 assert(importText.includes('유형을 알아보지 못해 기록으로 저장할 행 1개'),importText);
 assert(importText.includes('날짜를 읽지 못해'),importText);
 assert.equal(await page.locator('#csv-map-name').inputValue(),'0');
 assert.equal(await page.locator('#csv-map-date').inputValue(),'1');
 assert.equal(await page.locator('#csv-map-area').inputValue(),'2');
 assert.equal(await page.locator('#csv-map-type').inputValue(),'3');
 assert.equal(await page.locator('#csv-map-content').inputValue(),'4');
 assert.equal(await page.locator('.csv-preview-table tbody tr').count(),5);
 assert.equal(await page.locator('.dialog-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await page.locator('#csv-import-save').click();
 await page.getByText('5건의 기록을 가져왔습니다.',{exact:true}).waitFor();
 const imported=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js');return store.db.records.map(r=>({student:r.studentIds[0],date:r.date,kind:r.kind,areas:r.areas,text:r.text}));});
 assert.equal(imported.length,6);
 const byText=text=>imported.find(r=>r.text===text);
 assert.equal(imported.filter(r=>r.text==='급우와 협력함').length,1);
 assert.equal(byText('수업 준비물을 챙기지 않음').kind,'지도');
 assert.equal(byText('수업 중 발표를 잘 들음').date,day(7));
 assert.equal(byText('유형을 모르는 행').kind,'관찰');
 assert.deepEqual(byText('쉼표, 따옴표 "포함" 기록').areas,['관계','학습']);
 assert.equal(byText('쉼표, 따옴표 "포함" 기록').kind,'칭찬');
 assert.equal(byText('날짜가 없는 행').date,today);
 assert.equal(byText('명단에 없는 학생'),undefined);
 // 점수 계산: 조언 -1, 기록 0이 유지되는지 통계 요약으로 확인
 const scores=await page.evaluate(async()=>{const {store}=await import('/js/shared/state.js'),C=await import('/js/core.js');return {a:C.studentScoreSummary(store.db,'s48-a',C.today()),b:C.studentScoreSummary(store.db,'s48-b',C.today())};});
 assert.equal(scores.a.total,1);
 assert.equal(scores.a.areas['관계'],2);
 assert.equal(scores.a.areas['학습'],-1);
 assert.equal(scores.a.areas['생활'],-1);
 assert.equal(scores.b.total,1);
 assert.equal(scores.b.areas['학습'],1);

 // 5) 학생 상세 기록 키워드 검색
 await page.locator('.student-score-table tbody button',{hasText:'이나래'}).first().click();
 assert.equal(await page.locator('#student-record-list article.record').count(),3);
 const search=page.locator('#student-record-search');
 await search.fill('따옴표');
 assert.equal(await page.locator('#student-record-list article.record:visible').count(),1);
 assert.match(await page.locator('#student-record-search-summary').innerText(),/기록 3건 중 1건 표시/);
 assert.equal(await page.locator('#student-record-search-clear').isVisible(),true);
 await page.locator('#student-record-search-clear').click();
 assert.equal(await page.locator('#student-record-list article.record:visible').count(),3);
 assert.equal(await page.locator('#student-record-search-clear').isVisible(),false);
 await search.fill('없는단어');
 assert.equal(await page.locator('#student-record-list article.record:visible').count(),0);
 assert.equal(await page.locator('#student-record-search-empty').isVisible(),true);
 await search.fill('학습');
 assert.equal(await page.locator('#student-record-list article.record:visible').count(),3);
 await page.screenshot({path:'/tmp/patch48-detail-1280.png'});
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();

 // 6) 모바일 412px: 넘침 없이 같은 기능이 보임
 await page.setViewportSize({width:412,height:891});
 await page.waitForTimeout(150);
 assert.equal(await page.locator('.toolbar').first().evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await page.getByRole('button',{name:'CSV 가져오기',exact:true}).click();
 assert.equal(await page.locator('#modal').isVisible(),true);
 assert.equal(await page.locator('.dialog-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await page.locator('#csv-file').setInputFiles({name:'기록.csv',mimeType:'text/csv',buffer:Buffer.from(`이름,날짜,분야,유형,내용\r\n김가온,${day(10)},관계,칭찬,모바일 화면 확인용 기록\r\n`,'utf8')});
 await page.locator('.csv-preview-counts').waitFor();
 assert.match(await page.locator('.csv-preview-counts').innerText(),/가져올 기록 1건/);
 assert.equal(await page.locator('#csv-import-save').isEnabled(),true);
 assert.equal(await page.locator('.dialog-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 assert.equal(await page.locator('.csv-preview-table').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await page.screenshot({path:'/tmp/patch48-import-412.png'});
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'행발 문장 변환기',exact:true}).click();
 assert.equal(await page.locator('.dialog-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 assert.equal(await page.locator('[data-behavior-status]').first().isVisible(),true);
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 await page.locator('.student-score-table tbody button',{hasText:'이나래'}).first().click();
 assert.equal(await page.locator('.dialog-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await page.locator('#student-record-search').fill('따옴표');
 assert.equal(await page.locator('#student-record-list article.record:visible').count(),1);
 await page.screenshot({path:'/tmp/patch48-detail-412.png'});
 await page.locator('#modal .dialog-head').getByRole('button',{name:'닫기',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('PASS: 1280/412 행발 초안 자동 저장·재오픈/새로고침 복원·덮어쓰기 방지·새로 생성/지우기, CSV(BOM)/TXT 내려받기, 학생 상세 키워드 검색, CSV 열 인식·매칭·중복 건너뛰기·가져오기와 점수 유지, 모달 가로 넘침 없음');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
