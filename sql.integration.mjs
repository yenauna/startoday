// 선택 개발 의존성 @electric-sql/pglite를 이용해 실제 PostgreSQL 엔진으로 SQL 검증
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const pg=new PGlite();
await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');
await pg.exec(schema);await pg.exec(schema);
const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
await pg.query('insert into auth.users(id) values($1),($2)',[owner,other]);
await pg.exec('set role authenticated');
async function asUser(id){await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
async function snapshot(){return (await pg.query('select public.startoday_snapshot() as data')).rows[0].data}
await asUser(owner);let snap=await snapshot();const classId=snap.class_id;
const db=C.initialDB();db.students=[{id:'s1',no:1,name:'가상학생'}];db.assignments=[{id:'a1',title:'연산',date:'2026-11-05',repeat:{type:'daily'},target:'all',statArea:'과제'}];
let revision=0;
async function commit(ops,rev=revision){const r=await pg.query('select public.startoday_commit($1,$2,$3::jsonb) as rev',[classId,rev,JSON.stringify(ops)]);revision=Number(r.rows[0].rev);return revision}
await commit(C.TABLES.flatMap(t=>db[t].map(data=>({table:t,id:data.id,data}))));
assert.equal((await snapshot()).data.students.length,1);
await assert.rejects(pg.query("insert into public.startoday_students(class_id,owner_id,id,data) values($1,$2,'hack','{}')",[classId,owner]),/permission denied/);
await commit(C.taskStateOps(db,db.assignments[0],'2026-11-05','s1','완료'));
snap=await snapshot();assert.equal(snap.data.records.length,1);const original=snap.data.records[0];
await commit([{table:'records',id:original.id,data:{...original,createdAt:'1900-01-01T00:00:00Z',text:'수정'}}]);
assert.equal((await snapshot()).data.records[0].createdAt,original.createdAt);
await assert.rejects(commit([{table:'students',id:'s2',data:{id:'s2',no:2,name:'rollback'}},{table:'forbidden',id:'x',data:{id:'x'}}]),/INVALID_TABLE/);
assert.equal((await snapshot()).data.students.length,1);
await assert.rejects(commit([],0),/REVISION_CONFLICT/);
await asUser(other);assert.equal((await pg.query('select * from public.startoday_students')).rows.length,0);
await assert.rejects(commit([]),/FORBIDDEN/);
const otherSnap=await snapshot();assert.notEqual(otherSnap.class_id,classId);
await asUser(owner);
for(let i=0;i<3;i++)await pg.query('select public.startoday_backup($1)',[classId]);
assert.equal((await pg.query('select * from public.startoday_backups')).rows.length,2);
await commit(C.taskStateOps(snap.data,db.assignments[0],'2026-11-05','s1','면제'));
assert.equal((await snapshot()).data.records.length,0);
console.log('PASS: SQL 재실행, 초기화, 테이블 직접 쓰기 차단, 원자적 저장/롤백, 최초 시각 불변, 충돌 검출, 교사별 RLS 격리, 2세대 백업, 자동 기록 삭제');
await pg.close();
