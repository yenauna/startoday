// 선택 개발 의존성 @electric-sql/pglite를 이용해 실제 PostgreSQL 엔진으로 SQL 검증
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const pg=new PGlite();
await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
// Start with the pre-areas schema, then migrate a populated class in place.
await pg.exec(schema.replaceAll(",'areas'",''));
// Legacy table-level checks must not keep rejecting the new avatar purchase type.
await pg.exec("alter table public.startoday_economy_tx add constraint startoday_economy_tx_check check(data->>'type' in ('구매','환불','선물','지급','차감'))");
await pg.exec(schema.replaceAll(",'areas'",''));
assert.equal((await pg.query("select count(*)::int as n from pg_constraint where conrelid='public.startoday_economy_tx'::regclass and conname='startoday_economy_tx_check'")).rows[0].n,0);
assert.equal((await pg.query("select count(*)::int as n from pg_constraint where conrelid='public.startoday_economy_tx'::regclass and conname='startoday_economy_tx_data_check'")).rows[0].n,1);

const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
await pg.query('insert into auth.users(id) values($1),($2)',[owner,other]);
await pg.exec('set role authenticated');
async function asUser(id){await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
async function snapshot(){return (await pg.query('select public.startoday_snapshot() as data')).rows[0].data}
await asUser(owner);let snap=await snapshot();const classId=snap.class_id;
const db=C.initialDB();db.students=[{id:'s1',no:1,name:'가상학생'}];db.assignments=[{id:'a1',title:'연산',date:'2026-11-05',repeat:{type:'daily'},target:'all',statArea:'과제'}];
let revision=0;
async function commit(ops,rev=revision){const r=await pg.query('select public.startoday_commit($1,$2,$3::jsonb) as rev',[classId,rev,JSON.stringify(ops)]);revision=Number(r.rows[0].rev);return revision}
await commit(C.TABLES.filter(t=>t!=='areas').flatMap(t=>db[t].map(data=>({table:t,id:data.id,data}))));
await pg.exec('reset role');
await pg.exec("create table public.startoday_tags(id text primary key,data jsonb);insert into public.startoday_tags values('legacy','{}');alter table public.startoday_tags enable row level security;grant select on public.startoday_tags to authenticated;");
await pg.exec(schema);await pg.exec(schema);
assert.equal((await pg.query('select count(*)::int as count from public.startoday_tags')).rows[0].count,1);
await pg.exec('set role authenticated');await asUser(owner);
await assert.rejects(pg.query('select * from public.startoday_tags'),/permission denied/);
assert.equal((await snapshot()).class_id,classId);
assert.equal((await snapshot()).data.students.length,1);
await commit(db.areas.map(data=>({table:'areas',id:data.id,data})));
assert.equal((await snapshot()).data.students.length,1);
assert.equal((await snapshot()).data.areas.length,6);
await commit(C.areaEditOps(db,'area-6','1인1역'));
assert.equal((await snapshot()).data.areas.find(a=>a.id==='area-6').name,'1인1역');
await assert.rejects(commit([{table:'areas',id:'invalid',data:{id:'invalid',name:'',sortOrder:0}}]),/INVALID_AREA/);
await assert.rejects(pg.query("insert into public.startoday_students(class_id,owner_id,id,data) values($1,$2,'hack','{}')",[classId,owner]),/permission denied/);
await commit(C.taskStateOps(db,db.assignments[0],'2026-11-05','s1','완료'));
snap=await snapshot();assert.equal(snap.data.records.length,1);const original=snap.data.records[0];
await commit([{table:'records',id:original.id,data:{...original,createdAt:'1900-01-01T00:00:00Z',text:'수정'}}]);
assert.equal((await snapshot()).data.records[0].createdAt,original.createdAt);
await assert.rejects(commit([{table:'students',id:'s2',data:{id:'s2',no:2,name:'rollback'}},{table:'forbidden',id:'x',data:{id:'x'}}]),/INVALID_TABLE/);
assert.equal((await snapshot()).data.students.length,1);
await assert.rejects(commit([],0),/REVISION_CONFLICT/);
await asUser(other);assert.equal((await pg.query('select * from public.startoday_students')).rows.length,0);
assert.equal((await pg.query('select * from public.startoday_areas')).rows.length,0);
await assert.rejects(commit([]),/FORBIDDEN/);
const otherSnap=await snapshot();assert.notEqual(otherSnap.class_id,classId);
await asUser(owner);
for(let i=0;i<3;i++)await pg.query('select public.startoday_backup($1)',[classId]);
assert.equal((await pg.query('select * from public.startoday_backups')).rows.length,2);
await commit(C.taskStateOps(snap.data,db.assignments[0],'2026-11-05','s1','면제'));
assert.equal((await snapshot()).data.records.length,1);assert.equal((await snapshot()).data.records[0].kind,'관찰');
console.log('PASS: SQL 재실행, 초기화, 테이블 직접 쓰기 차단, 원자적 저장/롤백, 최초 시각 불변, 충돌 검출, 교사별 RLS 격리, 2세대 백업, 자동 기록 삭제');
// School/grade/class/no identity and mandatory password change are enforced in SQL.
await asUser(owner);
const day=(await pg.query("select to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD') as day")).rows[0].day;
const config={...(await snapshot()).data.settings[0],schoolName:'가상초등학교',schoolCode:'NEIS001',grade:5,classGroup:'오',defaultStudentPassword:'바람123',academicCalendar:{term1Start:day,holidays:[C.addDays(day,2)]}};
await commit([{table:'settings',id:'main',data:config},{table:'records',id:'student-praise',data:{id:'student-praise',date:day,kind:'칭찬',studentIds:['s1'],text:'잘했어요',areas:['생활'],action:'PRIVATE_ACTION'}},{table:'records',id:'student-advice',data:{id:'student-advice',date:day,kind:'지도',studentIds:['s1'],text:'SECRET_ADVICE',areas:['생활']}},{table:'students',id:'s2',data:{id:'s2',no:2,name:'다른학생'}},{table:'records',id:'other-praise',data:{id:'other-praise',date:day,kind:'칭찬',studentIds:['s2'],text:'OTHER_STUDENT',areas:['생활']}}]);
await assert.rejects(commit([{table:'settings',id:'main',data:{...config,defaultStudentPassword:'13579'}}]),/INVALID_INITIAL_STUDENT_PASSWORD/);
await assert.rejects(commit([{table:'settings',id:'main',data:{...config,defaultStudentPassword:'Start77'}}]),/INVALID_INITIAL_STUDENT_PASSWORD/);
const studentDb=(await snapshot()).data;
await commit([{table:'assignments',id:'a1',data:{...studentDb.assignments[0],memo:'공개 준비물\n교과서',checkerStudentId:'s2'}}]);
const mathRule=studentDb.subject_rules.find(rule=>rule.code==='수학');
await commit([{table:'subject_rules',id:mathRule.id,data:{...mathRule,color:'#E8F4F0',accentColor:'#20604A',colorSource:'custom',defaultColorValue:null}},...C.taskStateOps(studentDb,studentDb.assignments[0],day,'s1','완료','SECRET_TASK_MEMO'),{table:'routines',id:'student-routine',data:{id:'student-routine',title:'우유 급식',target:'all',exceptions:{[day]:{exempt:true,memo:'SECRET_ROUTINE_MEMO'}},sortOrder:0}},{table:'timetables',id:'student-slot',data:{id:'student-slot',date:day,period:1,subjectCode:'수학',locationOverride:'우리 교실',memo:'[준비물] 태블릿\n15분에 이동',publicMemo:'[준비물] 태블릿\n15분에 이동',privateMemo:'당일 공개 수업 안내'}}]);
await commit([{table:'assignments',id:'future-own',data:{id:'future-own',title:'내 다음 달 과제',date:C.addDays(day,35),repeat:{type:'none'},target:{studentIds:['s1']},privateMemo:'PRIVATE_ASSIGNMENT'}},{table:'assignments',id:'future-other',data:{id:'future-other',title:'OTHER_TASK_SECRET',date:C.addDays(day,35),repeat:{type:'none'},target:{studentIds:['s2']}}},{table:'events',id:'public-event',data:{id:'public-event',date:C.addDays(day,35),title:'운동회',description:'체육복\n입기',privateMemo:'PRIVATE_EVENT'}}]);
async function schoolLogin(password='바람123',school='NEIS001',grade='5',group='오',no=1){return (await pg.query('select public.startoday_student_login($1,$2,$3,$4,$5) as data',[school,grade,group,no,password])).rows[0].data;}
async function changePassword(oldPassword,newPassword){return (await pg.query('select public.startoday_student_change_password($1,$2,$3,$4,$5,$6) as data',['NEIS001','5','오',1,oldPassword,newPassword])).rows[0].data;}
await pg.exec('set role anon');
await assert.rejects(pg.query('select * from public.startoday_students'),/permission denied/);
await assert.rejects(pg.query('select public.startoday_snapshot()'),/permission denied/);
await assert.rejects(pg.query('select public.startoday_student_payload($1,$2)',[classId,'s1']),/permission denied/);
await assert.rejects(pg.query("select public.startoday_student_authenticate('NEIS001','5','오',1,'바람123')"),/permission denied/);
assert.equal(await schoolLogin('wrong'),null);assert.equal(await schoolLogin('12345'),null);
assert.equal(await schoolLogin('바람123','NEIS001','4'),null);assert.equal(await schoolLogin('바람123','NEIS001','5','다른반'),null);
assert.deepEqual(await schoolLogin(),{mustChangePassword:true});
assert.deepEqual(await schoolLogin('바람123','가상초등학교'),{mustChangePassword:true});
await assert.rejects(pg.query("select public.startoday_student_login('1','12345')"),/does not exist/);
assert.equal(await changePassword('wrong','새암호7'),null);
for(const invalid of ['바람123','12345','바람12','ㄱㄴ123','바람abc123','행복!123','ab1','!!!!'])await assert.rejects(changePassword('바람123',invalid),/INVALID_STUDENT_PASSWORD/);
const teacherRevision=revision;
let view=await changePassword('바람123','별빛123');
assert.equal(view.mustChangePassword,false);assert.equal(view.student.name,'가상학생');assert.equal(view.praise.length,2);assert.equal(view.score.total,1);assert.equal(view.tasks.find(t=>t.date===day&&t.title==='연산').status,'완료');assert.equal(view.routines[0].status,'면제');assert.equal(view.timetable[0].location,'우리 교실');assert.equal(view.timetable[0].privateMemo,'당일 공개 수업 안내');assert(!JSON.stringify(view.calendar).includes('당일 공개 수업 안내'));assert.equal(view.timetable[0].publicMemo,'[준비물] 태블릿\n15분에 이동');assert(view.calendar.assignments.some(a=>a.id==='a1'));assert(view.calendar.states.some(s=>s.status==='완료'));assert(view.calendar.states.every(state=>!Object.hasOwn(state,'memo')));assert.equal(view.tasks.find(t=>t.date===day&&t.title==='연산').memo,'공개 준비물\n교과서');assert.equal(view.tasks.find(t=>t.date===day&&t.title==='연산').checkerName,'2. 다른학생');assert.equal(view.calendar.assignments.find(a=>a.id==='a1').checkerName,'2. 다른학생');assert.equal(view.timetable[0].periodTime,config.periodTimes[0]);assert(view.calendar.assignments.some(a=>a.id==='future-own'));assert(!JSON.stringify(view).includes('OTHER_TASK_SECRET'));assert(!JSON.stringify(view).includes('PRIVATE_ASSIGNMENT'));assert(!JSON.stringify(view).includes('PRIVATE_EVENT'));assert(view.calendar.events.some(e=>e.title==='운동회'));assert(view.calendar.events.some(e=>e.title==='개학식'));assert(view.calendar.events.some(e=>e.title==='자율휴업일'));assert.equal(view.timetable[0].color,'#E8F4F0');assert.equal(view.timetable[0].accentColor,'#20604A');assert.equal(view.timetable[0].colorSource,'custom');
for(const hidden of ['SECRET_ADVICE','SECRET_TASK_MEMO','SECRET_ROUTINE_MEMO','PRIVATE_ACTION','OTHER_STUDENT','owner_id','password','바람123','별빛123'])assert(!JSON.stringify(view).includes(hidden));
assert.equal(await schoolLogin('바람123'),null);assert.equal((await schoolLogin('별빛123')).student.id,'s1');
await assert.rejects(pg.query('select * from public.startoday_student_login_attempts'),/permission denied/);
await pg.exec('set role authenticated');await asUser(owner);
await assert.rejects(commit([],teacherRevision),/REVISION_CONFLICT/);revision=Number((await snapshot()).revision);
assert.equal((await snapshot()).data.students.find(s=>s.id==='s1').passwordChanged,true);
await commit([{table:'settings',id:'main',data:{...config,defaultStudentPassword:'행복한5반'}}]);
await pg.exec('set role anon');assert.equal((await schoolLogin('별빛123')).student.id,'s1');assert.deepEqual(await schoolLogin('행복한5반','NEIS001','5','오',2),{mustChangePassword:true});
await pg.exec('set role authenticated');await asUser(owner);
await commit([{table:'students',id:'s1',data:{...db.students[0],password:'행복한5반',passwordChanged:false,passwordResetRequired:true}}]);
await pg.exec('set role anon');assert.equal(await schoolLogin('별빛123'),null);assert.deepEqual(await schoolLogin('행복한5반'),{mustChangePassword:true});
for(let i=0;i<10;i++)assert.equal(await schoolLogin('틀린암호1'),null);assert.equal(await schoolLogin('행복한5반'),null);
await pg.exec('set role authenticated');await asUser(owner);
await commit([{table:'students',id:'s1',data:{...db.students[0],password:'행복한5반',passwordChanged:false,passwordResetRequired:true}}]);
await pg.exec('set role anon');assert.deepEqual(await schoolLogin('행복한5반'),{mustChangePassword:true});
await changePassword('행복한5반','새암호123');
await pg.exec('set role authenticated');await asUser(other);
await pg.query('select public.startoday_commit($1,$2,$3::jsonb)',[otherSnap.class_id,0,JSON.stringify([{table:'settings',id:'main',data:{...config,schoolName:'가상초등학교',schoolCode:'NEIS002'}},{table:'students',id:'same',data:{id:'same',no:1,name:'가상학생'}}])]);
await pg.exec('set role anon');assert.equal((await schoolLogin('새암호123')).student.id,'s1');assert.deepEqual(await schoolLogin('바람123','NEIS002'),{mustChangePassword:true});assert.equal(await schoolLogin('새암호123','가상초등학교'),null);
console.log('PASS: 학교·학년·반·번호 식별, 초기 비밀번호 데이터 차단, 문자 포함 새 비밀번호, 변경/초기화/잠금 해제, revision 충돌, 익명 권한 및 민감 필드 비노출');

// Peer checker RPCs authenticate each request and never grant general student writes.
await pg.exec('set role authenticated');await asUser(owner);revision=Number((await snapshot()).revision);
let peerDb=(await snapshot()).data;
const peerAssignment={...peerDb.assignments.find(a=>a.id==='a1'),checkerStudentId:'s1'};
await commit([{table:'assignments',id:'a1',data:peerAssignment},{table:'students',id:'s3',data:{id:'s3',no:3,name:'제외학생'}},{table:'attendance',id:'peer-excluded',data:{id:'peer-excluded',studentId:'s3',date:day,excluded:true}}]);
await pg.exec('set role anon');
async function peerList(no=1,password='새암호123',aid='a1'){return (await pg.query('select public.startoday_student_checker_list($1,$2,$3,$4,$5,$6) as data',['NEIS001','5','오',no,password,aid])).rows[0].data;}
async function peerSet(student,completed,aid='a1'){return (await pg.query('select public.startoday_student_checker_set($1,$2,$3,$4,$5,$6,$7,$8) as data',['NEIS001','5','오',1,'새암호123',aid,student,completed])).rows[0].data;}
await assert.rejects(pg.query('select public.startoday_checker_payload($1,$2,$3)',[classId,'s1','a1']),/permission denied/);
assert.equal(await peerList(1,'틀린암호123'),null);assert.equal(await peerList(2,'행복한5반'),null);assert.equal(await peerList(1,'새암호123','future-own'),null);
let checklist=await peerList();assert.equal(checklist.students.length,3);assert.equal(checklist.students.find(s=>s.id==='s3').excluded,true);assert.equal(checklist.assignment.title,'연산');assert.equal(checklist.classId,classId);
for(const hidden of ['password','SECRET','memo','지도','PRIVATE'])assert(!JSON.stringify(checklist).includes(hidden));
assert.equal((await schoolLogin('새암호123')).checkingAssignments[0].id,'a1');
assert.equal(await peerSet('same',true),null);assert.equal(await peerSet('s3',true),null);assert.equal(await peerSet('s2',true,'future-other'),null);
let peerResult=await peerSet('s1',true);assert(peerResult.students.find(s=>s.id==='s1').completed);assert(!JSON.stringify(peerResult).includes('SECRET_TASK_MEMO'));
await peerSet('s2',true);await peerSet('s2',true);
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);
assert.equal(snap.data.assignmentStates.find(s=>s.id===C.stateId('a1',day,'s1')).memo,'SECRET_TASK_MEMO');assert.equal(snap.data.records.filter(r=>r.autoRef===C.stateId('a1',day,'s2')).length,1);
await assert.rejects(commit([],revision-1),/REVISION_CONFLICT/);
const simple={id:'simple',title:'단순 확인',date:day,repeat:{type:'none'},target:'all',checkerStudentId:'s1',noStar:true};await commit([{table:'assignments',id:'simple',data:simple}]);
await pg.exec('set role anon');await peerSet('s2',true,'simple');await peerSet('s2',false,'simple');await peerSet('s2',true,'simple');await peerSet('s2',false);
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);assert(!snap.data.records.some(r=>r.autoRef===C.stateId('simple',day,'s2')));assert(!snap.data.records.some(r=>r.autoRef===C.stateId('a1',day,'s2')));assert.equal(snap.data.assignmentStates.find(s=>s.assignmentId==='simple').status,'완료');
await commit([{table:'assignments',id:'a1',data:{...peerAssignment,checkerStudentId:'s2'}}]);await pg.exec('set role anon');assert.equal(await peerList(),null);assert.equal(await peerSet('s1',true),null);
console.log('PASS: 확인자 인증/초기화 차단, 오늘·대상·출결·학급 권한, 비공개 메모 보존, 원자적 체크/취소 및 revision, 중복 별점 방지, 단순 체크리스트 별점 미생성');

// Student routine writes are self-only and never create score records.
await pg.exec('set role authenticated');await asUser(owner);revision=Number((await snapshot()).revision);
const rr={id:'self-routine',title:'우유 급식',target:{studentIds:['s1']},sortOrder:1};const rk=C.stateId(rr.id,day,'s1');await commit([{table:'routines',id:rr.id,data:rr},{table:'routineStates',id:rk,data:{id:rk,routineId:rr.id,studentId:'s1',date:day,status:'진행중',memo:'PRIVATE_ROUTINE'}}]);const recordCount=(await snapshot()).data.records.length;
await pg.exec('set role anon');
async function routineSet(id='self-routine',completed=true,password='새암호123',no=1){return (await pg.query('select public.startoday_student_routine_set($1,$2,$3,$4,$5,$6,$7) as data',['NEIS001','5','오',no,password,id,completed])).rows[0].data;}
assert.equal(await routineSet('self-routine',true,'틀린암호123'),null);assert.equal(await routineSet('self-routine',true,'행복한5반',2),null);assert.equal(await routineSet('student-routine'),null);assert.equal(await routineSet('missing'),null);
let routineResponse=await routineSet();assert.equal(routineResponse.snapshot.routines.find(r=>r.id===rr.id).status,'완료');assert(!JSON.stringify(routineResponse).includes('PRIVATE_ROUTINE'));routineResponse=await routineSet(rr.id,false);assert.equal(routineResponse.snapshot.routines.find(r=>r.id===rr.id).status,'진행중');
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);assert.equal(snap.data.records.length,recordCount);assert.equal(snap.data.routineStates.find(r=>r.id===rk).memo,'PRIVATE_ROUTINE');await commit([{table:'attendance',id:'self-exclude',data:{id:'self-exclude',studentId:'s1',date:day,excluded:true}}]);await pg.exec('set role anon');assert.equal(await routineSet(),null);
await pg.exec('set role authenticated');await asUser(owner);revision=Number((await snapshot()).revision);await commit([{table:'attendance',id:'self-exclude',remove:true},{table:'routines',id:rr.id,data:{...rr,deletedAt:C.now()}}]);await pg.exec('set role anon');assert.equal(await routineSet(),null);
console.log('PASS: 학생 루틴 본인 인증·대상·출결·예외·삭제 권한, 완료/진행중 토글, 메모 보존 및 별점 무변경');
// Practice 11: safe historical task projection and corrected reward policy.
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);
const yesterday=C.addDays(day,-1),pastTask={id:'past-task',title:'지난 과제',date:yesterday,repeat:{type:'none'},target:'all',statArea:'생활'};
await commit([{table:'assignments',id:pastTask.id,data:pastTask},{table:'settings',id:'main',data:{...snap.data.settings[0],lunchAfterPeriod:3}},{table:'events',id:'lunch-test',data:{id:'lunch-test',date:day,title:'점심 활동',period:7,timeOfDay:'lunch'}}]);
await pg.exec('set role anon');let patchView=await schoolLogin('새암호123');assert(patchView.tasks.some(t=>t.id===pastTask.id&&t.overdue&&t.date===yesterday));assert.equal(patchView.lunchAfterPeriod,3);assert.equal(patchView.calendar.events.find(e=>e.title==='점심 활동').timeOfDay,'lunch');
for(const [status,delta] of [['완료',1],['늦게완료',0],['안함',-1],['면제',0]]){
 await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);
 await commit(C.taskStateOps(snap.data,pastTask,yesterday,'s1',status,'PRIVATE_STATUS_MEMO'));
 await pg.exec('set role anon');const projection=await schoolLogin('새암호123');
 assert(!projection.tasks.some(t=>t.id===pastTask.id));assert(!JSON.stringify(projection).includes('PRIVATE_STATUS_MEMO'));
 const teacher=await (async()=>{await pg.exec('set role authenticated');await asUser(owner);return (await snapshot()).data;})();
 assert.equal(projection.score.total,C.scores(teacher,'s1','',day).total);assert.equal(C.delta(teacher.records.find(r=>r.autoRef===C.stateId(pastTask.id,yesterday,'s1'))),delta);
}
// Even an old, unmigrated late-completion praise must not grant points or leak its memo.
snap=await snapshot();revision=Number(snap.revision);const lateState={id:C.stateId(pastTask.id,yesterday,'s1'),assignmentId:pastTask.id,date:yesterday,studentId:'s1',status:'늦게완료'};
await commit([{table:'assignmentStates',id:lateState.id,data:lateState},{table:'records',id:'auto:'+lateState.id,data:{id:'auto:'+lateState.id,date:yesterday,studentIds:['s1'],kind:'칭찬',text:'LEGACY_PRIVATE',areas:['생활'],autoRef:lateState.id}}]);
await pg.exec('set role anon');patchView=await schoolLogin('새암호123');assert(!JSON.stringify(patchView).includes('LEGACY_PRIVATE'));assert(!patchView.praise.some(r=>r.text.includes('늦게')));
console.log('PASS: 지난 진행중 과제/점심 위치/시간 의미, 완료 +1·늦게완료/면제 0·안함 -1, 레거시 늦게완료 칭찬 차단 및 상태 메모 비노출');
// XP title replacement: content keywords never count; assigned areas do.
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);
const xpOps=Array.from({length:14},(_,i)=>({table:'records',id:'xp-title-'+i,data:{id:'xp-title-'+i,date:day,kind:'칭찬',studentIds:['s1'],text:'단어와 무관',areas:['학습태도','학습']}}));xpOps.push({table:'records',id:'keywords-ignored',data:{id:'keywords-ignored',date:day,kind:'칭찬',studentIds:['s1'],text:'독서 청소 준비물',areas:[]}});await commit(xpOps);
await pg.exec('set role anon');let kingdomView=await schoolLogin('새암호123');assert.equal(kingdomView.titleCounts.learning,14);assert.equal(kingdomView.titleCounts.reading,undefined);assert.deepEqual(kingdomView.titleCounts,C.kingdomCounts((await(async()=>{await pg.exec('set role authenticated');await asUser(owner);return(await snapshot()).data;})()),'s1',day));
await pg.exec('set role anon');async function titleSet(title,no=1,password='새암호123'){return(await pg.query('select public.startoday_student_title_set($1,$2,$3,$4,$5,$6) as data',['NEIS001','5','오',no,password,title])).rows[0].data;}
assert.equal(await titleSet('reading:1'),null);assert.equal(await titleSet('jobs:3'),null);assert.equal(await titleSet('learning:99'),null);assert.equal(await titleSet('learning:1',1,'틀린암호123'),null);assert.equal(await titleSet('learning:1',2,'행복한5반'),null);
assert.equal(await titleSet('learning:1'),null);
// At 15/30/45, each stage becomes eligible; immediately below it remains locked.
for(const [level,below,threshold]of [[1,14,15],[2,29,30],[3,44,45]]){
 await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);let count=C.kingdomCounts(snap.data,'s1',day).learning;
 if(count<below){await commit(Array.from({length:below-count},(_,i)=>({table:'records',id:'threshold-'+level+'-'+i,data:{id:'threshold-'+level+'-'+i,date:day,kind:'칭찬',studentIds:['s1'],text:'경계 검증',areas:['학습']}})));}
 await pg.exec('set role anon');assert.equal(await titleSet('learning:'+level),null);
 await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);await commit([{table:'records',id:'unlock-'+level,data:{id:'unlock-'+level,date:day,kind:'칭찬',studentIds:['s1'],text:'경계 해금',areas:['학습']}}]);
 await pg.exec('set role anon');const unlocked=await titleSet('learning:'+level);assert.equal(unlocked.snapshot.titleCounts.learning,threshold);assert.equal(unlocked.snapshot.student.equippedTitle,'learning:'+level);
}
let titleResult=await titleSet('learning:3');assert.equal(titleResult.snapshot.student.equippedTitle,'learning:3');assert.equal((await schoolLogin('새암호123')).student.equippedTitle,'learning:3');
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);await commit([{table:'settings',id:'main',data:{...snap.data.settings[0],titleGoal:30}}]);await pg.exec('set role anon');assert.equal(await titleSet('learning:3'),null);assert.equal((await titleSet('learning:1')).snapshot.titleConfig.goal,30);
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);await commit([{table:'settings',id:'main',data:{...snap.data.settings[0],titleGoal:15}}]);
console.log('PASS: 6대 XP 칭찬 집계, 중복·무영역 키워드 제외, 설정 목표 반영, 미획득/기존 키워드 칭호 장착 차단');
// Practice 14: aliases remain canonical for old clients and invalid batches roll back.
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);
const aliasTask={id:'alias-task',title:'학습 점검',date:day,repeat:{type:'none'},target:'all',statArea:'학습태도'};
await commit([{table:'assignments',id:aliasTask.id,data:aliasTask},{table:'areas',id:'area-1',data:{id:'area-1',name:'학습태도',sortOrder:0,deletedAt:null}},{table:'records',id:'alias-praise',data:{id:'alias-praise',date:day,kind:'칭찬',studentIds:['s1'],text:'학습 점검',areas:['학습태도','학습'],area:'학습태도'}}]);
snap=await snapshot();revision=Number(snap.revision);assert.equal(snap.data.areas.find(a=>a.id==='area-1').name,'학습');assert.deepEqual(snap.data.records.find(r=>r.id==='alias-praise').areas,['학습']);assert.equal(snap.data.assignments.find(a=>a.id===aliasTask.id).statArea,'학습');
const payload=C.markRemainingUndoneOps(snap.data,snap.data.assignments.find(a=>a.id===aliasTask.id),day);assert(payload.length>0);assert(payload.every(op=>C.isTaskDate(op.data.date)));await commit(payload);snap=await snapshot();revision=Number(snap.revision);assert.equal(snap.data.assignmentStates.find(s=>s.id===C.stateId(aliasTask.id,day,'s1')).status,'안함');
for(const invalid of [undefined,null,'','2026-1-01','2026/11/11','2026-02-30','2026-13-01','0000-01-01']){const before=await snapshot(),id='invalid-date-state';await assert.rejects(commit([{table:'records',id:'rollback-date',data:{id:'rollback-date',date:day,kind:'관찰',studentIds:['s1'],text:'must roll back',areas:[]}},{table:'assignmentStates',id,data:{id,assignmentId:aliasTask.id,studentId:'s1',date:invalid,status:'안함'}}]),/INVALID_STATE/);const after=await snapshot();assert.equal(after.revision,before.revision);assert(!after.data.records.some(r=>r.id==='rollback-date'));assert(!after.data.assignmentStates.some(s=>s.id===id));}
await pg.exec('set role anon');const aliasView=await schoolLogin('새암호123');assert.equal(aliasView.score.areas['학습태도'],undefined);assert.equal(aliasView.score.areas['학습'],C.scores(snap.data,'s1','',day).areas['학습']);assert(aliasView.praise.some(r=>r.text==='학습 점검'&&r.areas[0]==='학습'));
// Reapply over actual legacy rows, including an active duplicate and a custom name.
await pg.exec('reset role');
await pg.query("update public.startoday_records set data=jsonb_set(data,'{areas}',$1::jsonb) where class_id=$2 and id='alias-praise'",[JSON.stringify(['학습태도','학습']),classId]);
await pg.query("update public.startoday_areas set data=jsonb_set(data,'{name}','\"학습태도\"'::jsonb) where class_id=$1 and id='area-1'",[classId]);
await pg.query("insert into public.startoday_areas(class_id,owner_id,id,data) values($1,$2,'alias-duplicate',$3::jsonb),($1,$2,'custom-kept',$4::jsonb)",[classId,owner,JSON.stringify({id:'alias-duplicate',name:'학습',sortOrder:50}),JSON.stringify({id:'custom-kept',name:'자율학습태도',sortOrder:51})]);
await pg.exec(schema);await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);assert.equal(snap.data.areas.filter(a=>a.name==='학습').length,1);assert(snap.data.areas.some(a=>a.name==='자율학습태도'));assert.deepEqual(snap.data.records.find(r=>r.id==='alias-praise').areas,['학습']);
await pg.exec('reset role');await pg.query("update public.startoday_areas set data=jsonb_set(data,'{name}','\"우리의 배움\"'::jsonb) where class_id=$1 and id='area-1'",[classId]);await pg.exec(schema);await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();assert.equal(snap.data.areas.find(a=>a.id==='area-1').name,'우리의 배움');assert.equal(snap.data.areas.filter(a=>a.name==='학습').length,1);assert(snap.data.areas.some(a=>a.name==='학습'&&a.id!=='area-1'));
console.log('PASS: 학습 구 이름/중복 영역 마이그레이션, 커스텀 이름·ID 보존, 학생 집계/태그, 일괄 안함 payload, 빈/잘못된 날짜 원자적 롤백');
// Student nickname RPC is authenticated, self-only and strict about Hangul.
await pg.exec('set role anon');async function nicknameSet(nickname,no=1,password='새암호123'){return(await pg.query('select public.startoday_student_nickname_set($1,$2,$3,$4,$5,$6) as data',['NEIS001','5','오',no,password,nickname])).rows[0].data;}
for(const name of ['','영문a','별 명','별!','별1','ㄱ','가나다라마바사아자'])assert.equal(await nicknameSet(name),null);assert.equal(await nicknameSet('별님',1,'틀린암호123'),null);assert.equal(await nicknameSet('별님',2,'행복한5반'),null);
let nicknameResult=await nicknameSet('반짝별');assert.equal(nicknameResult.snapshot.student.nickname,'반짝별');assert.equal((await schoolLogin('새암호123')).student.nickname,'반짝별');assert(!JSON.stringify(nicknameResult).includes('password'));
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);assert.equal(snap.data.students.find(s=>s.id==='s1').password,'새암호123');assert(!snap.data.students.find(s=>s.id==='s2').nickname);
const quest={id:'long-quest',title:'독서 원정',date:C.addDays(day,-2),repeat:{type:'none'},target:{studentIds:['s1']},isQuest:true,questGoal:3,questTitle:'책의 탐험가',statArea:'과제',checkerStudentId:'s1'};await commit([{table:'assignments',id:quest.id,data:quest}]);
for(let n=1;n<=3;n++){snap=await snapshot();revision=Number(snap.revision);await commit(C.questStampOps(snap.data,quest,day,'s1',1));}
snap=await snapshot();revision=Number(snap.revision);assert.equal(snap.data.assignmentStates.find(s=>s.assignmentId===quest.id).stamps,3);assert.equal(snap.data.records.find(r=>r.autoRef===C.stateId(quest.id,quest.date,'s1')).date,day);assert.equal(snap.data.students.find(s=>s.id==='s1').rewardTitles.filter(t=>t.id==='quest:'+quest.id).length,1);
await pg.exec('set role anon');let questView=await schoolLogin('새암호123');assert.equal(questView.tasks.filter(t=>t.id===quest.id).length,1);assert.equal(questView.tasks.find(t=>t.id===quest.id).stamps,3);assert.equal(questView.tasks.find(t=>t.id===quest.id).goal,3);assert(!questView.checkingAssignments.some(a=>a.id===quest.id));assert.equal(await peerList(1,'새암호123',quest.id),null);assert.equal(await peerSet('s1',true,quest.id),null);assert.equal((await titleSet('quest:'+quest.id)).snapshot.student.equippedTitle,'quest:'+quest.id);assert.equal(await titleSet('quest:someone-else'),null);
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);await commit(C.questStampOps(snap.data,quest,day,'s1',-1));snap=await snapshot();revision=Number(snap.revision);assert(!snap.data.records.some(r=>r.autoRef===C.stateId(quest.id,quest.date,'s1')));assert.equal(snap.data.students.find(s=>s.id==='s1').rewardTitles.length,1);
// A later teacher profile edit cannot accidentally erase earned quest rewards.
await commit([{table:'students',id:'s1',data:{...snap.data.students.find(s=>s.id==='s1'),rewardTitles:[]}}]);snap=await snapshot();revision=Number(snap.revision);assert.equal(snap.data.students.find(s=>s.id==='s1').rewardTitles.length,1);
const invalidState={id:C.stateId(quest.id,quest.date,'s1'),assignmentId:quest.id,date:quest.date,studentId:'s1',status:'완료',stamps:999};await assert.rejects(commit([{table:'assignmentStates',id:invalidState.id,data:invalidState}]),/INVALID_QUEST_STATE/);
await commit([{table:'assignments',id:quest.id,remove:true},{table:'assignmentStates',id:invalidState.id,remove:true}]);await pg.exec('set role anon');assert.equal((await titleSet('quest:'+quest.id)).snapshot.student.equippedTitle,'quest:'+quest.id);assert.equal((await nicknameSet(null)).snapshot.student.nickname,null);
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);const rollbackQuest={...quest,id:'rollback-quest',date:day,questGoal:1,questTitle:'롤백 보상'};await commit([{table:'assignments',id:rollbackQuest.id,data:rollbackQuest}]);snap=await snapshot();revision=Number(snap.revision);const failedAward=[...C.questStampOps(snap.data,rollbackQuest,day,'s1',1),{table:'records',id:'bad-award',data:{id:'bad-award',date:day,kind:'invalid',studentIds:['s1'],text:'rollback'}}];await assert.rejects(commit(failedAward),/INVALID_RECORD/);snap=await snapshot();assert(!snap.data.assignmentStates.some(s=>s.assignmentId===rollbackQuest.id));assert(!snap.data.students.find(s=>s.id==='s1').rewardTitles.some(t=>t.id==='quest:'+rollbackQuest.id));
console.log('PASS: 한글 별명 본인 인증/초기비밀번호/입력 검증, 퀘스트 누적 스탬프·실제 완료일·보상 영구 보존, 또래 우회/미획득 보상 차단');
// Completion dates remain ordinary JSONB state fields, without new tables or columns.
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);
const datedQuest={...quest,id:'dated-quest',questGoal:2,questSubtasks:['나비야','작은별']};
await commit([{table:'assignments',id:datedQuest.id,data:datedQuest}]);snap=await snapshot();revision=Number(snap.revision);
await commit(C.questSubtaskOps(snap.data,datedQuest,day,'s1','나비야',true));snap=await snapshot();revision=Number(snap.revision);
assert.deepEqual(snap.data.assignmentStates.find(s=>s.assignmentId===datedQuest.id).completedSubtaskDates,{'나비야':day});
await commit(C.questSubtaskOps(snap.data,datedQuest,C.addDays(day,1),'s1','작은별',true));snap=await snapshot();revision=Number(snap.revision);
assert.deepEqual(C.questProgress(snap.data,datedQuest,'s1').completedSubtaskDates,{'나비야':day,'작은별':C.addDays(day,1)});
await commit(C.questSubtaskOps(snap.data,datedQuest,C.addDays(day,2),'s1','나비야',false));snap=await snapshot();revision=Number(snap.revision);
assert.deepEqual(C.questProgress(snap.data,datedQuest,'s1').completedSubtaskDates,{'작은별':C.addDays(day,1)});
await pg.exec('set role anon');
const datedStudentView=await schoolLogin('새암호123');
assert.deepEqual(datedStudentView.tasks.find(t=>t.id===datedQuest.id).completedSubtaskDates,{'작은별':C.addDays(day,1)});
assert(!datedStudentView.tasks.some(t=>t.id===datedQuest.id&&t.completedSubtaskDates['나비야']));
// Other students cannot receive this student's progress or completion dates.
await pg.exec('reset role');
const otherStudentView=(await pg.query('select public.startoday_student_payload($1,$2) as data',[classId,'s2'])).rows[0].data;
assert(!otherStudentView.tasks.some(t=>t.id===datedQuest.id));
console.log('PASS: 장기과제 항목별 완료일 JSONB 저장·보존·해제 및 학생 응답·타학생 격리');
// Three memo scopes: only memo1 is ever present in the student calendar.
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);
const memoDays=[C.addDays(day,-1),day,C.addDays(day,1)];
await commit(memoDays.map((date,i)=>({table:'timetables',id:'memo32-'+i,data:{id:'memo32-'+i,date,period:3,subjectCode:'국어',memo:'LEGACY32',publicMemo:'PUBLIC32-'+i,privateMemo:'SAME_DAY32-'+i,teacherMemo:'TEACHER32-'+i}})));
snap=await snapshot();revision=Number(snap.revision);assert.equal(snap.data.timetables.find(t=>t.id==='memo32-1').teacherMemo,'TEACHER32-1');
await pg.exec('set role anon');const memoView=await schoolLogin('새암호123');
assert(!JSON.stringify(memoView).includes('TEACHER32'));
assert.equal(memoView.timetable.find(t=>t.period===3).privateMemo,'SAME_DAY32-1');
assert.equal(memoView.timetable.find(t=>t.period===3).publicMemo,'PUBLIC32-1');
for(const [i,date] of memoDays.entries()){
 const slot=memoView.calendar.timetables.find(t=>t.date===date&&t.period===3);assert.equal(slot.publicMemo,'PUBLIC32-'+i);
 assert.deepEqual(Object.keys(slot).sort(),['date','period','publicMemo','subject']);
}
assert(!JSON.stringify(memoView.calendar).includes('SAME_DAY32'));
console.log('PASS: 교사 메모3 저장, 학생 당일 메모1·2, 학생 달력 과거·오늘·미래 메모1 전용, 메모2·3 비노출');
// Avatar RPCs authenticate the student and use only the server catalogue/prices.
await pg.exec('set role authenticated');await asUser(owner);
await pg.query('select public.startoday_economy_action($1,$2,$3,null,$4,$5)',[classId,'s1','adjust',1000,'아바타 검증']);
await pg.exec('reset role');await pg.query("update public.startoday_students set data=data||$1::jsonb where class_id=$2 and id='s1'",[JSON.stringify({avatarOwned:null,avatarEquipped:null}),classId]);
await pg.exec('set role anon');assert.deepEqual((await schoolLogin('새암호123')).avatar.owned,[]);assert.deepEqual((await schoolLogin('새암호123')).avatar.equipped,{});
const avatarCall=async(action,item,password='새암호123')=>(await pg.query(`select public.startoday_avatar_${action}($1,$2,$3,$4,$5,$6) as data`,['NEIS001','5','오',1,password,item])).rows[0].data;
const avatarBefore=(await schoolLogin('새암호123')).economy.balance;
assert.equal(await avatarCall('buy','hair_1','틀린암호123'),null);
await assert.rejects(avatarCall('equip','hair_1'),/AVATAR_NOT_OWNED/);
await assert.rejects(avatarCall('buy','not-a-catalog-item'),/INVALID_AVATAR_ITEM/);
let avatarResult=await avatarCall('buy','hair_1');assert.equal(avatarResult.snapshot.economy.balance,avatarBefore-10);assert.deepEqual(avatarResult.snapshot.avatar.owned,['hair_1']);assert.deepEqual(avatarResult.snapshot.avatar.catalog,C.AVATAR_CATALOG);
await assert.rejects(avatarCall('buy','hair_1'),/AVATAR_ALREADY_OWNED/);
avatarResult=await avatarCall('equip','hair_1');assert.equal(avatarResult.snapshot.avatar.equipped['머리'],'hair_1');
avatarResult=await avatarCall('equip','hair_1');assert.deepEqual(avatarResult.snapshot.avatar.equipped,{});
await assert.rejects(pg.query('select public.startoday_avatar_mutate($1,$2,$3,$4)',[classId,'s2','hair_1','buy']),/permission denied/);
await pg.exec('reset role');assert.deepEqual((await pg.query('select public.startoday_student_payload($1,$2) as data',[classId,'s2'])).rows[0].data.avatar.owned,[]);
await pg.exec('set role authenticated');await asUser(owner);snap=await snapshot();revision=Number(snap.revision);
await pg.query('select public.startoday_economy_action($1,$2,$3,null,$4,$5)',[classId,'s2','adjust',20,'교사 대리 아바타 검증']);snap=await snapshot();revision=Number(snap.revision);
await commit(C.avatarOps(snap.data,'s2','outfit_1','buy'));snap=await snapshot();revision=Number(snap.revision);
await commit(C.avatarOps(snap.data,'s2','outfit_1','equip'));snap=await snapshot();revision=Number(snap.revision);
assert.equal(snap.data.students.find(s=>s.id==='s2').avatarEquipped['옷'],'outfit_1');
const useItem={id:C.uid(),name:'33차 사용 쿠폰',category:'특별',price:0,stock:3};await commit([{table:'shop_items',id:useItem.id,data:useItem}]);
const giftResult=(await pg.query('select public.startoday_economy_action($1,$2,$3,$4,0,$5) as data',[classId,'s1','gift',useItem.id,''])).rows[0].data;
const giftId=giftResult.transactionId;
const usedResult=(await pg.query('select public.startoday_economy_action($1,$2,$3,$4,0,$5) as data',[classId,'s1','use',giftId,''])).rows[0].data;
const used=usedResult.data.economy_tx.find(t=>t.type==='사용'&&t.originalTxId===giftId);assert(used);assert.notEqual(used.id,giftId);assert.equal(used.amount,0);assert.equal(used.itemName,useItem.name);assert.equal(used.itemCategory,'특별');assert.equal(usedResult.data.economy_tx.find(t=>t.id===giftId).status,'사용완료');
await assert.rejects(pg.query('select public.startoday_economy_action($1,$2,$3,$4,0,$5)',[classId,'s1','use',giftId,'']),/INVALID_HOLDING/);
snap=await snapshot();revision=Number(snap.revision);
const ownedStudent=snap.data.students.find(s=>s.id==='s1');
await commit([{table:'students',id:'s1',data:{...ownedStudent,avatarOwned:[]}}]);snap=await snapshot();assert(snap.data.students.find(s=>s.id==='s1').avatarOwned.includes('hair_1'));
await pg.exec('reset role');const remaining=(await pg.query('select public.startoday_coin_balance($1,$2) as amount',[classId,'s1'])).rows[0].amount;
await pg.exec('set role authenticated');await asUser(owner);if(Number(remaining)!==0)await pg.query('select public.startoday_economy_action($1,$2,$3,null,$4,$5)',[classId,'s1','adjust',-Number(remaining),'잔액 부족 검증']);
await pg.exec('set role anon');await assert.rejects(avatarCall('buy','outfit_1'),/INSUFFICIENT_BALANCE/);assert.deepEqual((await schoolLogin('새암호123')).avatar.owned,['hair_1']);
console.log('PASS: 아바타 인증·카탈로그·가격·소유권·중복구매·장착해제·타학생 격리·교사 수정 보존, 별도 사용 거래 및 중복 차단');
await pg.close();
