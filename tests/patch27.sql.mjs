import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const {PGlite}=createRequire(import.meta.url)(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const pg=new PGlite();
try{
await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');await pg.exec(schema);await pg.exec(schema);
const owner=C.uid(),other=C.uid();await pg.query('insert into auth.users values($1),($2)',[owner,other]);
const identity=async id=>pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const snap=async()=>(await pg.query('select public.startoday_snapshot() as data')).rows[0].data;
await pg.exec('set role authenticated');await identity(owner);const cid=(await snap()).class_id;
const d=C.initialDB();Object.assign(d.settings[0],{schoolName:'정돈초등학교',grade:5,classGroup:'1',defaultStudentPassword:'바람123'});d.students=[{id:'one',no:1,name:'가온',password:'나만암호7',passwordChanged:true}];
const item={id:C.uid(),name:'선물 쿠폰',price:0,stock:2};d.shop_items=[item];
for(const [index,offset] of [[0,-1],[1,0],[2,1]]){const date=C.addDays(C.today(),offset);d.timetables.push({id:'slot'+index,date,period:1,subjectCode:'국어',publicMemo:'공개 준비물',privateMemo:'날짜 메모 '+offset});}
async function commit(ops){const s=await snap();return pg.query('select public.startoday_commit($1,$2,$3::jsonb)',[cid,s.revision,JSON.stringify(ops)]);}
await commit(C.TABLES.flatMap(table=>d[table].map(data=>({table,id:data.id,data}))));
async function action(kind,target){return(await pg.query('select public.startoday_economy_action($1,$2,$3,$4,$5,$6) as data',[cid,'one',kind,target,0,''])).rows[0].data;}
let gift=await action('gift',item.id);assert.ok(gift.transactionId);assert.equal(gift.data.economy_tx.find(t=>t.id===gift.transactionId).type,'선물');
let undone=await action('undo_gift',gift.transactionId);assert.equal(undone.data.shop_items[0].stock,2);assert.equal(undone.data.economy_tx.find(t=>t.id===gift.transactionId).status,'취소됨');assert.equal(C.studentHoldings(undone.data,'one').length,0);
await assert.rejects(action('undo_gift',gift.transactionId),/INVALID_HOLDING/);
gift=await action('gift',item.id);await pg.exec('reset role');await pg.query("update public.startoday_economy_tx set created_at=clock_timestamp()-interval '6 seconds' where id=$1",[gift.transactionId]);await pg.exec('set role authenticated');await identity(owner);
await assert.rejects(action('undo_gift',gift.transactionId),/GIFT_UNDO_EXPIRED/);assert.equal((await snap()).data.shop_items[0].stock,1);
await action('use',gift.transactionId);await assert.rejects(action('undo_gift',gift.transactionId),/INVALID_HOLDING/);
const q={id:'delete-project',title:'삭제 프로젝트',date:C.today(),target:'all',repeat:{type:'none'},isQuest:true,questGoal:1,questTitle:'보존 칭호',statArea:'학습'};
await commit([{table:'assignments',id:q.id,data:q}]);await commit(C.questStampOps((await snap()).data,q,C.today(),'one',1));await commit(C.deleteLongAssignmentOps((await snap()).data,q.id));const state=await snap();assert.ok(state.data.assignments[0].deletedAt);assert.equal(state.data.assignmentStates.length,0);assert.ok(!state.data.records.some(r=>r.autoRef));assert.equal(state.data.students[0].rewardTitles.length,1);
await identity(other);await assert.rejects(action('undo_gift',gift.transactionId),/FORBIDDEN/);
await pg.exec('set role anon');await identity('');await assert.rejects(action('undo_gift',gift.transactionId),/permission denied/);
const view=(await pg.query('select public.startoday_student_login($1,$2,$3,$4,$5) as data',['정돈초등학교','5','1',1,'나만암호7'])).rows[0].data;
assert.equal(view.timetable.length,1);assert.equal(view.timetable[0].privateMemo,'날짜 메모 0');assert.ok(!JSON.stringify(view).includes('날짜 메모 -1'));assert.ok(!JSON.stringify(view).includes('날짜 메모 1'));assert.ok(!JSON.stringify(view.calendar).includes('날짜 메모'));assert.ok(!view.tasks.some(t=>t.id===q.id));
await pg.exec('reset role');await pg.exec(schema);
console.log('PASS: exact gift ID, atomic five-second undo/repeated/expired/used gift guards, ownership, project cleanup/permanent reward and same-day memo response boundaries');
}finally{await pg.close();}
