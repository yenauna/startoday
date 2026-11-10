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
assert.equal((await snapshot()).data.records.length,0);
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
await commit([{table:'subject_rules',id:mathRule.id,data:{...mathRule,color:'#E8F4F0',accentColor:'#20604A',colorSource:'custom',defaultColorValue:null}},...C.taskStateOps(studentDb,studentDb.assignments[0],day,'s1','완료','SECRET_TASK_MEMO'),{table:'routines',id:'student-routine',data:{id:'student-routine',title:'우유 급식',target:'all',exceptions:{[day]:{exempt:true,memo:'SECRET_ROUTINE_MEMO'}},sortOrder:0}},{table:'timetables',id:'student-slot',data:{id:'student-slot',date:day,period:1,subjectCode:'수학',locationOverride:'우리 교실',memo:'[준비물] 태블릿\n15분에 이동',publicMemo:'[준비물] 태블릿\n15분에 이동',privateMemo:'SECRET_TIMETABLE_MEMO'}}]);
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
assert.equal(view.mustChangePassword,false);assert.equal(view.student.name,'가상학생');assert.equal(view.praise.length,2);assert.equal(view.score.total,1);assert.equal(view.tasks[0].status,'완료');assert.equal(view.routines[0].status,'면제');assert.equal(view.timetable[0].location,'우리 교실');assert.equal(view.timetable[0].publicMemo,'[준비물] 태블릿\n15분에 이동');assert(view.calendar.assignments.some(a=>a.id==='a1'));assert(view.calendar.states.some(s=>s.status==='완료'));assert(view.calendar.states.every(state=>!Object.hasOwn(state,'memo')));assert.equal(view.tasks[0].memo,'공개 준비물\n교과서');assert.equal(view.tasks[0].checkerName,'2. 다른학생');assert.equal(view.calendar.assignments.find(a=>a.id==='a1').checkerName,'2. 다른학생');assert.equal(view.timetable[0].periodTime,config.periodTimes[0]);assert(view.calendar.assignments.some(a=>a.id==='future-own'));assert(!JSON.stringify(view).includes('OTHER_TASK_SECRET'));assert(!JSON.stringify(view).includes('PRIVATE_ASSIGNMENT'));assert(!JSON.stringify(view).includes('PRIVATE_EVENT'));assert(view.calendar.events.some(e=>e.title==='운동회'));assert(view.calendar.events.some(e=>e.title==='개학식'));assert(view.calendar.events.some(e=>e.title==='자율휴업일'));assert.equal(view.timetable[0].color,'#E8F4F0');assert.equal(view.timetable[0].accentColor,'#20604A');assert.equal(view.timetable[0].colorSource,'custom');
for(const hidden of ['SECRET_ADVICE','SECRET_TASK_MEMO','SECRET_ROUTINE_MEMO','SECRET_TIMETABLE_MEMO','PRIVATE_ACTION','OTHER_STUDENT','owner_id','password','바람123','별빛123'])assert(!JSON.stringify(view).includes(hidden));
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
await pg.close();
