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
// Student RPC must work without teacher Auth while returning no class snapshot.
await asUser(owner);
const day=(await pg.query("select to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD') as day")).rows[0].day;
await commit([{table:'records',id:'student-praise',data:{id:'student-praise',date:day,kind:'칭찬',studentIds:['s1'],text:'잘했어요',areas:['생활'],action:'PRIVATE_ACTION'}},{table:'records',id:'student-advice',data:{id:'student-advice',date:day,kind:'지도',studentIds:['s1'],text:'SECRET_ADVICE',areas:['생활']}},{table:'students',id:'s2',data:{id:'s2',no:2,name:'다른학생',password:'other-secret'}},{table:'records',id:'other-praise',data:{id:'other-praise',date:day,kind:'칭찬',studentIds:['s2'],text:'OTHER_STUDENT',areas:['생활']}}]);
const studentDb=(await snapshot()).data;
await commit([...C.taskStateOps(studentDb,studentDb.assignments[0],day,'s1','완료','SECRET_TASK_MEMO'),{table:'routines',id:'student-routine',data:{id:'student-routine',title:'우유 급식',target:'all',exceptions:{[day]:{exempt:true,memo:'SECRET_ROUTINE_MEMO'}},sortOrder:0}},{table:'timetables',id:'student-slot',data:{id:'student-slot',date:day,period:1,subjectCode:'수학',locationOverride:'우리 교실',memo:'SECRET_TIMETABLE_MEMO'}}]);
async function studentLogin(code,password='12345'){return (await pg.query('select public.startoday_student_login($1,$2) as data',[code,password])).rows[0].data;}
await pg.exec('set role anon');
await assert.rejects(pg.query('select * from public.startoday_students'),/permission denied/);
await assert.rejects(pg.query('select public.startoday_snapshot()'),/permission denied/);
assert.equal(await studentLogin('1','bad'),null);
let view=await studentLogin(classId+':1');
assert.equal(view.student.name,'가상학생');assert.equal(view.praise.length,2);assert.equal(view.score.total,1);assert.equal(view.tasks[0].status,'완료');assert.equal(view.routines[0].status,'면제');assert.equal(view.timetable[0].location,'우리 교실');
for(const hidden of ['SECRET_ADVICE','SECRET_TASK_MEMO','SECRET_ROUTINE_MEMO','SECRET_TIMETABLE_MEMO','PRIVATE_ACTION','OTHER_STUDENT','other-secret','owner_id','password'])assert(!JSON.stringify(view).includes(hidden));
await assert.rejects(pg.query('select * from public.startoday_student_login_attempts'),/permission denied/);
await pg.exec('set role authenticated');await asUser(owner);
await commit([{table:'students',id:'s1',data:{...db.students[0],password:'changed'}}]);
await pg.exec('set role anon');assert.equal(await studentLogin(classId+':1'),null);assert((await studentLogin(classId+':1','changed')).student);
await pg.exec('set role authenticated');await asUser(owner);
await commit([{table:'students',id:'s1',data:{...db.students[0],password:'12345'}}]);
await asUser(other);
await pg.query('select public.startoday_commit($1,$2,$3::jsonb)',[otherSnap.class_id,0,JSON.stringify([{table:'students',id:'same',data:{id:'same',no:1,name:'가상학생'}}])]);
await pg.exec('set role anon');assert.equal(await studentLogin('1'),null);assert.equal((await studentLogin(classId+':1')).student.id,'s1');
for(let i=0;i<10;i++)assert.equal(await studentLogin(classId+':1','wrong'),null);
assert.equal(await studentLogin(classId+':1'),null);
console.log('PASS: 익명 학생 인증, 학급 경계/중복 번호 거부, 비밀번호 변경·초기화, 실패 제한, 칭찬만 반환, 민감 필드 및 타 학생 기록 미반환');
await pg.close();


