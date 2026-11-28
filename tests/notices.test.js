import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import {Store} from '../js/store.js';
const day='2026-03-04';
function noticeFixture(){const d=C.initialDB();d.students=Array.from({length:7},(_,i)=>({id:'s'+i,no:i+1,name:'학생'+i}));d.students[6].deletedAt=C.now();d.assignments=[{id:'task',title:'독서록',date:day,repeat:{type:'none'},target:'all'},{id:'quest',title:'장기과제',date:day,isQuest:true}];d.assignmentStates=['진행중','안함','완료','면제','늦게완료','진행중'].map((status,i)=>({id:C.stateId('task',day,'s'+i),assignmentId:'task',date:day,studentId:'s'+i,status}));d.attendance=[{id:'absent',studentId:'s5',date:day,excluded:true}];d.events=[{id:'e',date:day,title:'학급 사진'},{id:'later',date:'2026-03-06',title:'수학 단원평가'}];d.timetables=[{id:'t',date:day,period:1,subjectCode:'국어',publicMemo:'책 준비',privateMemo:'발표'},{id:'private',date:day,period:2,subjectCode:'체육',privateMemo:'운동화'},{id:'hidden',date:day,period:3,subjectCode:'음악',teacherMemo:'교사만'}];return d;}
test('생활 문구 200개와 제공 기본 문구·계절 문구를 보존하고 날짜별 추천은 결정적이다',()=>{
 assert.equal(Object.values(C.NOTICE_PHRASES).flat().length,200);assert.equal(new Set(Object.values(C.NOTICE_PHRASES).flat()).size,200);assert(C.NOTICE_PHRASES.general.includes('난 참 괜찮은 사람이야.'));assert(C.NOTICE_PHRASES.general.includes('미세먼지 수치를 확인하고 운동장으로 나갑니다.'));assert.equal(C.NOTICE_PHRASES.summer.length,10);assert.equal(C.NOTICE_PHRASES.winter.length,9);
 for(const month of ['02','04','07','12']){const a=`2026-${month}-12`,b=C.addDays(a,1);assert.equal(C.noticePhrase(a),C.noticePhrase(a));assert.notEqual(C.noticePhrase(a),C.noticePhrase(b));const pool=[...C.NOTICE_PHRASES.general,...(['02','12'].includes(month)?C.NOTICE_PHRASES.winter:month==='07'?C.NOTICE_PHRASES.summer:[])];for(let i=0;i<pool.length;i++)assert(pool.includes(C.noticePhrase(a,i)));}
 assert.throws(()=>C.noticePhrase('2026-02-30'));assert.throws(()=>C.noticePhrase(day,-1));
});
test('기념일 당일과 바로 앞 평일 1~2일을 우선 추천하고 다른 문구로 바꿀 수 있다',()=>{
 const text='8월 15일 광복절. 우리나라 국권 회복을 기념하는 날.';assert.equal(C.noticePhrase('2026-08-15'),text);assert.equal(C.noticePhrase('2026-08-14'),text);assert.notEqual(C.noticePhrase('2026-08-13'),text);assert.notEqual(C.noticePhrase('2026-08-14',1),text);assert(C.noticePhrase('2026-10-23').includes('독도의 날'));assert(C.noticePhrase('2026-10-25').includes('독도의 날'));
 assert.equal(C.noticeFuturePrefix('2027-03-04'),'[3.4.목]');assert.throws(()=>C.noticeFuturePrefix('bad'));
});
test('일정·일반 과제·메모1/2만 담고 미제출은 진행중+안함, 제외·완료·면제·늦게완료·삭제 학생을 뺀다',()=>{
 const d=noticeFixture(),items=C.noticeDayItems(d,day);assert.equal(items.length,4);assert(!items.some(i=>['quest','hidden'].includes(i.sourceId)));assert(items.find(i=>i.sourceId==='t').text.includes('책 준비 / 발표'));const task=items.find(i=>i.kind==='task');assert.deepEqual(C.noticeMissingStudents(d,task),['학생0','학생1']);task.includeMissing=true;assert.equal(C.noticeItemText(d,task),'독서록 (미제출: 학생0, 학생1)');d.assignments[0].target={studentIds:['s1']};assert.deepEqual(C.noticeMissingStudents(d,task),['학생1']);
});
test('알림장 CRUD와 저장·복구는 날짜당 한 개를 유지하고 미래 일정은 날짜순으로 렌더링한다',()=>{
 let d=noticeFixture(),draft=C.noticeDraft(d,day);draft.todayItems=C.noticeDayItems(d,day).filter(i=>i.kind==='task');draft.todayItems[0].includeMissing=true;draft.futureItems=[{key:'b',sourceId:'later',kind:'event',date:'2026-03-06',text:'평가'},{key:'a',sourceId:'earlier',kind:'event',date:'2026-03-05',text:'준비'}];draft.extraMemo='<img src=x> 준비물을 확인해요.';
 const ops=C.noticeSaveOps(d,draft);d=C.applyOps(d,ops);assert.equal(d.notices.length,1);assert(d.notices[0].renderedText.includes('미제출: 학생0, 학생1'));assert(d.notices[0].renderedText.indexOf('[3.5.목]')<d.notices[0].renderedText.indexOf('[3.6.금]'));const loaded=C.noticeDraft(d,day);loaded.lifeText='바꾼 생활 문구';d=C.applyOps(d,C.noticeSaveOps(d,loaded));assert.equal(d.notices.length,1);assert.equal(C.noticeDraft(d,day).lifeText,'바꾼 생활 문구');d.notices[0].deletedAt=C.now();assert.notEqual(C.noticeDraft(d,day).lifeText,'바꾼 생활 문구');
 const backup={app:'startoday',version:1,data:C.initialDB()};backup.data.notices=d.notices;assert.doesNotThrow(()=>C.validateBackup(backup));delete backup.data.notices;assert.doesNotThrow(()=>C.validateBackup(backup));assert.deepEqual(backup.data.notices,[]);
});
test('알림장 저장은 잘못된 날짜·중복 항목·다른 날짜 오늘 항목·과거 미래 항목을 거부한다',()=>{
 const d=noticeFixture(),n=C.noticeSaveOps(d,C.noticeDraft(d,day))[0].data;assert.throws(()=>C.applyOps(d,[{table:'notices',id:n.id,data:{...n,id:n.id,date:'2026-02-30'}}]));const item={key:'a',sourceId:'e',kind:'event',date:day,text:'일정'};
 for(const invalid of [{...n,todayItems:[item,item]},{...n,todayItems:[{...item,date:'2026-03-05'}]},{...n,futureItems:[item]},{...n,lifeText:3}])assert.throws(()=>C.validateNotice(invalid));
});

test('로컬·체험 저장은 기존 동기화 저장소에서 알림장을 보존하고 다시 불러온다',async()=>{
 const previous=globalThis.localStorage,values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 try{for(const mode of ['local','demo']){values.clear();const store=new Store();store.mode=mode;store.db=C.initialDB();const draft=C.noticeDraft(store.db,day);draft.lifeText=mode+' 생활';await store.commit(C.noticeSaveOps(store.db,draft));assert.equal(JSON.parse(values.get('startoday-demo-v1')).notices[0].lifeText,draft.lifeText);const reload=new Store();reload.mode=mode;reload.db=C.normalizeDB(JSON.parse(values.get('startoday-demo-v1')));assert.equal(C.noticeDraft(reload.db,day).lifeText,draft.lifeText);}}
 finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
test('문구 카탈로그는 기존 상시·계절·기념일 참조와 순서·문구를 보존하며 모든 영역에 분류한다',()=>{
 assert.equal(C.NOTICE_PHRASE_CATALOG.length,212);assert.equal(new Set(C.NOTICE_PHRASE_CATALOG.map(i=>i.id)).size,212);assert.equal(C.NOTICE_PHRASE_CATEGORIES.length,13);for(const category of C.NOTICE_PHRASE_CATEGORIES)assert(C.NOTICE_PHRASE_CATALOG.some(i=>i.category===category));
 for(const season of ['general','summer','winter'])assert.deepEqual(C.NOTICE_PHRASE_CATALOG.filter(i=>i.season===season).map(i=>i.text),C.NOTICE_PHRASES[season]);assert.deepEqual(C.NOTICE_PHRASE_CATALOG.filter(i=>i.season==='occasion').map(i=>[i.monthDay,i.text]),C.NOTICE_ANNIVERSARIES);
});
test('문구 사용 이력은 작성일에서 365일 전 경계를 포함하고 미래·삭제·잘못된 날짜는 제외한다',()=>{
 const date='2027-03-01',a=C.NOTICE_PHRASES.general[0],b=C.NOTICE_PHRASES.general[1],c=C.NOTICE_PHRASES.general[2],d=C.NOTICE_PHRASES.general[3],database={notices:[{date:C.addDays(date,-365),lifeText:a},{date:C.addDays(date,-20),lifeText:'  '+a+'\n '},{date:C.addDays(date,-366),lifeText:b},{date:C.addDays(date,1),lifeText:c},{date,lifeText:d,deletedAt:C.now()},{date:'bad',lifeText:c}]};
 const usage=C.noticePhraseUsage(database,date);assert.equal(usage.get(a),C.addDays(date,-20));assert(!usage.has(b));assert(!usage.has(c));assert(!usage.has(d));database.notices.shift();assert.equal(C.noticePhraseUsage(database,date).get(a),C.addDays(date,-20));database.notices=[{date:C.addDays(date,-365),lifeText:a}];assert(C.noticePhraseUsage(database,date).has(a));assert.throws(()=>C.noticePhraseUsage(database,'2027-02-30'));
});
test('영역·키워드·미사용 필터는 함께 적용되고 사용 배지는 가장 최근 저장 날짜를 사용한다',()=>{
 const text=C.NOTICE_PHRASES.general.find(t=>t.includes('그네')),database={notices:[{date:day,lifeText:text}]};const school=C.noticePhraseChoices(database,day,{category:'학교',query:'그네'});assert.equal(school.length,1);assert.equal(school[0].usedOn,day);assert.equal(C.noticePhraseChoices(database,day,{category:'학교',query:'그네',unusedOnly:true}).length,0);assert.equal(C.noticePhraseChoices(database,day,{category:'교통',query:'그네'}).length,0);assert.equal(C.noticePhraseChoices(database,day,{category:'공휴일·기념일',query:'광복절'}).length,1);assert(C.noticePhraseChoices(database,day,{category:'여름'}).every(i=>i.season==='summer'));assert.equal(C.noticePhraseChoices(database,day,{query:'없는 문구 검색 결과'}).length,0);
});
test('랜덤은 해당 계절·계기 후보 중 미사용을 우선하며 현재 문구와 다른 문구를 실제 무작위 위치로 고른다',()=>{
 const date='2026-07-12',pool=C.noticeRandomPool(date),current=pool[0].text,remaining=pool.at(-1).text,database={notices:pool.slice(0,-1).map(i=>({date,lifeText:i.text}))};
 assert(pool.some(i=>i.season==='summer'));assert(!pool.some(i=>i.season==='winter'||i.season==='occasion'));assert.deepEqual(C.noticeRandomPhrase(database,date,current,()=>0),{text:remaining,exhausted:false});assert.deepEqual(C.noticeRandomPhrase(database,date,current,()=>.99),{text:remaining,exhausted:false});assert.notEqual(C.noticeRandomPhrase({},date,current,()=>0).text,C.noticeRandomPhrase({},date,current,()=>.9999).text);
 assert(C.noticeRandomPool('2026-01-12').some(i=>i.season==='winter'));assert(!C.noticeRandomPool('2026-04-12').some(i=>['summer','winter'].includes(i.season)));assert(C.noticeRandomPool('2026-08-14').some(i=>i.monthDay==='08-15'));assert(!C.noticeRandomPool('2026-08-13').some(i=>i.season==='occasion'));
});
test('모든 후보를 사용하면 전체 후보로 되돌리되 현재 문구를 제외하고 만료·미래·삭제 사용은 후보를 막지 않는다',()=>{
 const date='2026-02-12',pool=C.noticeRandomPool(date),current=pool[0].text,database={notices:pool.map(i=>({date,lifeText:i.text}))};const result=C.noticeRandomPhrase(database,date,current,()=>0);assert.equal(result.exhausted,true);assert.notEqual(result.text,current);assert.equal(result.text,pool[1].text);
 for(const patch of [{date:C.addDays(date,-366)},{date:C.addDays(date,1)},{deletedAt:C.now()}]){const source={notices:database.notices.map(n=>({...n,...patch}))};assert.equal(C.noticeRandomPhrase(source,date,' '+current+' ',()=>0).exhausted,false);assert.notEqual(C.noticeRandomPhrase(source,date,current,()=>0).text,current);}
});
