import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),{pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto'),pg=new PGlite({extensions:{pgcrypto}});
try{
 await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 const schema=readFileSync(new URL('../schema.sql',import.meta.url),'utf8');await pg.exec(schema);await pg.exec(schema);
 const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';await pg.query('insert into auth.users(id) values($1),($2)',[owner,other]);
 const as=async(role,id='')=>{await pg.exec(`set role ${role}`);await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};await as('authenticated',owner);
 const snapshot=async()=>(await pg.query('select public.startoday_snapshot() as data')).rows[0].data;
 let snap=await snapshot();const cid=snap.class_id,d=C.initialDB();d.students=[{id:'s1',no:1,name:'가온'}];Object.assign(d.settings[0],{schoolName:'가상알림학교',schoolCode:'NOTICE001',grade:5,classGroup:'1',defaultStudentPassword:'바람123'});
 const commit=async(ops,revision=null)=>{if(revision===null)revision=(await snapshot()).revision;return (await pg.query('select public.startoday_commit($1,$2,$3::jsonb) as rev',[cid,revision,JSON.stringify(ops)])).rows[0].rev;};
 await commit(C.TABLES.flatMap(t=>d[t].map(data=>({table:t,id:data.id,data}))));
 const draft=C.noticeDraft(d,'2026-03-04');draft.lifeText='교사 알림장 비공개 표식';draft.extraMemo='준비물 확인';const ops=C.noticeSaveOps(d,draft);await commit(ops);snap=await snapshot();assert.equal(snap.data.notices.length,1);assert.equal(snap.data.notices[0].lifeText,draft.lifeText);
 draft.lifeText='생활 수정';await commit(C.noticeSaveOps(d,draft));snap=await snapshot();assert.equal(snap.data.notices.length,1);assert.equal(snap.data.notices[0].lifeText,'생활 수정');
 const stale=snap.revision;await commit(C.noticeSaveOps(d,draft));await assert.rejects(commit(ops,stale),/REVISION_CONFLICT/);
 const invalid={...ops[0],data:{...ops[0].data,todayItems:[{key:'bad',kind:'event',sourceId:'e',text:'과거',date:'2026-03-03'}]}};await assert.rejects(commit([invalid]),/INVALID_NOTICE/);await assert.rejects(commit([{...ops[0],id:'other',data:{...ops[0].data,id:'other'}}]),/INVALID_NOTICE/);assert.equal((await snapshot()).data.notices.length,1);
 await assert.rejects(pg.query('delete from public.startoday_notices where class_id=$1',[cid]),/permission denied/);
 await pg.query('select public.startoday_backup($1)',[cid]);assert.equal((await pg.query('select data from public.startoday_backups where class_id=$1 order by created_at desc limit 1',[cid])).rows[0].data.data.notices.length,1);
 await as('authenticated',other);assert.equal((await pg.query('select * from public.startoday_notices')).rows.length,0);await assert.rejects(commit(ops,0),/FORBIDDEN/);
 await as('anon');await assert.rejects(pg.query('select * from public.startoday_notices'),/permission denied/);await assert.rejects(commit(ops,0),/AUTH_REQUIRED|permission denied/);await pg.query("select public.startoday_student_change_password('NOTICE001','5','1',1,'바람123','별빛학생1')");const student=(await pg.query("select public.startoday_student_login('NOTICE001','5','1',1,'별빛학생1') as data")).rows[0].data;assert(!JSON.stringify(student).includes('생활 수정'));assert(!JSON.stringify(student).includes('notices'));
 await as('authenticated',owner);snap=await snapshot();const saved=snap.data.notices[0];await commit([{table:'notices',id:saved.id,data:{...saved,deletedAt:C.now(),updatedAt:C.now()}}]);assert((await snapshot()).data.notices[0].deletedAt);await commit(C.noticeSaveOps(d,draft));assert.equal((await snapshot()).data.notices[0].deletedAt,null);
 await pg.exec('reset role');await pg.exec(schema);await as('authenticated',owner);assert.equal((await snapshot()).data.notices.length,1);await commit([{table:'notices',id:saved.id,remove:true}]);assert.equal((await snapshot()).data.notices.length,0);
 console.log('PASS 알림장: 날짜별 CRUD·스키마 재실행·원자적 검증·충돌·백업·교사 RLS·학생 응답 비노출');
}finally{await pg.close();}
