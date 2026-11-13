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
const d=C.initialDB();Object.assign(d.settings[0],{schoolName:'프로젝트초등학교',grade:5,classGroup:'1',defaultStudentPassword:'바람123'});
d.students=[{id:'one',no:1,name:'가온',password:'나만암호7',passwordChanged:true},{id:'two',no:2,name:'나래'}];
const a={id:'project',title:'누적 리코더',date:C.addDays(C.today(),30),endDate:C.addDays(C.today(),31),target:'all',repeat:{type:'none'},isQuest:true,questGoal:3,questTitle:'연주의 달인',questSubtasks:['학교종','아리랑','작은별'],statArea:'과제'};
d.assignments=[a];d.attendance=[{id:'ex',date:C.today(),studentId:'one',excluded:true}];d.shop_items=[{id:C.uid(),name:'스티커',price:10,stock:2}];
async function commit(ops){const s=await snap();return pg.query('select public.startoday_commit($1,$2,$3::jsonb)',[cid,s.revision,JSON.stringify(ops)]);}
await commit(C.TABLES.flatMap(table=>d[table].map(data=>({table,id:data.id,data}))));
async function login(){await pg.exec('set role anon');await identity('');return(await pg.query('select public.startoday_student_login($1,$2,$3,$4,$5) as data',['프로젝트초등학교','5','1',1,'나만암호7'])).rows[0].data;}
let student=await login();assert.equal(student.tasks.find(t=>t.id===a.id).status,'진행중');assert.deepEqual(student.tasks.find(t=>t.id===a.id).questSubtasks,a.questSubtasks);
await pg.exec('set role authenticated');await identity(owner);
for(const item of ['작은별','학교종','아리랑']){const s=await snap();await commit(C.questSubtaskOps(s.data,a,C.today(),'one',item,true));}
let s=await snap();assert.equal(s.data.assignmentStates[0].stamps,3);assert.equal(s.data.students[0].rewardTitles.length,1);
student=await login();const task=student.tasks.find(t=>t.id===a.id);assert.equal(task.stamps,3);assert.equal(task.status,'완료');assert.deepEqual(task.completedSubtasks,a.questSubtasks);
await pg.exec('set role authenticated');await identity(owner);
const state=(await snap()).data.assignmentStates[0];
await assert.rejects(commit([{table:'assignmentStates',id:state.id,data:{...state,completedSubtasks:['없는 항목'],stamps:1,status:'진행중'}}]),/INVALID_COMPLETED_SUBTASKS/);
await assert.rejects(commit([{table:'assignments',id:a.id,data:{...a,questSubtasks:['중복','중복']}}]),/INVALID_QUEST_SUBTASKS/);
await commit(C.questSubtaskOps((await snap()).data,a,C.today(),'one','학교종',false));assert.equal((await snap()).data.students[0].rewardTitles.length,1);
// Closed project dates do not suppress progress or reject cumulative updates.
const past={...a,id:'past',date:C.addDays(C.today(),-10),endDate:C.addDays(C.today(),-9)};await commit([{table:'assignments',id:past.id,data:past}]);
await commit(C.questSubtaskOps((await snap()).data,past,C.today(),'one','아리랑',true));
student=await login();assert.equal(student.tasks.find(t=>t.id===past.id).stamps,1);
await pg.exec('set role authenticated');await identity(owner);
async function action(kind,sid,target,amount=0){return pg.query('select public.startoday_economy_action($1,$2,$3,$4,$5,$6)',[cid,sid,kind,target,amount,'']);}
await action('gift','one',d.shop_items[0].id);s=await snap();const gift=s.data.economy_tx.find(t=>t.type==='선물');const balance=C.studentBalance(s.data,'one');
await action('reclaim','one',gift.id,1);s=await snap();assert.equal(s.data.shop_items[0].stock,2);assert.equal(s.data.economy_tx.find(t=>t.id===gift.id).status,'회수됨');assert.equal(C.studentBalance(s.data,'one'),balance);
await assert.rejects(action('reclaim','one',gift.id,1),/INVALID_HOLDING/);
await action('gift','one',d.shop_items[0].id);s=await snap();const second=s.data.economy_tx.find(t=>t.type==='선물'&&t.status==='보유');await action('reclaim','one',second.id,0);assert.equal((await snap()).data.shop_items[0].stock,1);
// Only one of two gifts can consume the final stock.
const race=await Promise.allSettled([action('gift','one',d.shop_items[0].id),action('gift','two',d.shop_items[0].id)]);
assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.match(race.find(r=>r.status==='rejected').reason.message,/SOLD_OUT/);
await identity(other);await assert.rejects(action('reclaim','one',gift.id,1),/FORBIDDEN/);
await pg.exec('set role anon');await identity('');await assert.rejects(action('reclaim','one',gift.id,1),/permission denied/);
await pg.exec('reset role');await pg.exec(schema);
console.log('PASS: project date independence/checklist auth/goal consistency/student payload/permanent rewards, teacher reclaim with optional stock, repeated reclaim/oversold gift prevention and migration');
}finally{await pg.close();}
