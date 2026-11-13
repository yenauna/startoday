import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const {PGlite}=createRequire(import.meta.url)(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const pg=new PGlite();
await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');await pg.exec(schema);await pg.exec(schema);
const owner=C.uid();await pg.query('insert into auth.users values($1)',[owner]);
async function role(teacher){await pg.exec(teacher?'set role authenticated':'set role anon');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[teacher?owner:'']);}
async function snap(){return (await pg.query('select public.startoday_snapshot() as data')).rows[0].data;}
await role(true);const initial=await snap(),cid=initial.class_id;
async function commit(ops){await role(true);const s=await snap();return pg.query('select public.startoday_commit($1,$2,$3::jsonb)',[cid,s.revision,JSON.stringify(ops)]);}
async function login(){await role(false);return (await pg.query('select public.startoday_student_login($1,$2,$3,$4,$5) as data',['세부초등학교','5','1',1,'나만암호7'])).rows[0].data;}
const d=C.initialDB(),date=C.today();Object.assign(d.settings[0],{schoolName:'세부초등학교',grade:5,classGroup:'1',defaultStudentPassword:'바람123'});delete d.settings[0].studentPraisePeriod;
d.students=[{id:'one',no:1,name:'가온',password:'나만암호7',passwordChanged:true},{id:'two',no:2,name:'나래'}];
d.records=Array.from({length:65},(_,i)=>({id:'letter-'+i,date:C.addDays(date,-i),kind:'칭찬',studentIds:['one'],text:'편지 '+i,areas:['학습'],createdAt:C.now()}));
d.records.push({id:'private',date,kind:'지도',studentIds:['one'],text:'PRIVATE_ADVICE',areas:['관계'],createdAt:C.now()},{id:'future',date:C.addDays(date,1),kind:'칭찬',studentIds:['one'],text:'FUTURE_PRAISE',areas:['학습'],createdAt:C.now()},{id:'other',date,kind:'칭찬',studentIds:['two'],text:'OTHER_PERSON',areas:['학습'],createdAt:C.now()});
d.shop_items=[{id:C.uid(),category:'수학',name:'면제',price:10,stock:2},{id:C.uid(),category:'글쓰기',name:'도움권',price:0,stock:null}];
await commit(C.TABLES.flatMap(table=>d[table].map(data=>({table,id:data.id,data}))));
let student=await login();assert.equal(student.praise.length,65);assert.equal(student.score.total,64);const titles=student.titleCounts;
for(const [period,count]of [['all',65],['recent3',3],['30d',30],['7d',7],['month',Number(date.slice(-2))]]){
 await role(true);const s=await snap();await commit([{table:'settings',id:'main',data:{...s.data.settings[0],studentPraisePeriod:period}}]);student=await login();assert.equal(student.praise.length,count);assert.equal(student.score.total,64);assert.deepEqual(student.titleCounts,titles);assert.equal(student.economy.balance,640);assert.ok(student.praise.every(r=>r.kind==='칭찬'&&r.date>=C.studentPraiseRange({studentPraisePeriod:period},date).from&&r.date<=date));assert.ok(!JSON.stringify(student.praise).includes('PRIVATE_'));assert.ok(!JSON.stringify(student.praise).includes('OTHER_PERSON'));assert.ok(!JSON.stringify(student.praise).includes('FUTURE_PRAISE'));
}
await role(true);const s=await snap();for(const value of ['wrong',null,['all']])await assert.rejects(()=>commit([{table:'settings',id:'main',data:{...s.data.settings[0],studentPraisePeriod:value}}]),/INVALID_STUDENT_PRAISE_PERIOD/);
async function studentAction(action,target){await role(false);return (await pg.query(`select public.startoday_shop_${action}($1,$2,$3,$4,$5,$6) as data`,['세부초등학교','5','1',1,'나만암호7',target])).rows[0].data;}
const buy=await studentAction('buy',d.shop_items[0].id),purchase=buy.snapshot.economy.transactions.find(t=>t.type==='구매');assert.equal(purchase.itemCategory,'수학');assert.equal(buy.snapshot.economy.balance,630);
await role(true);let current=await snap();await commit([{table:'shop_items',id:d.shop_items[0].id,data:{...current.data.shop_items.find(i=>i.id===d.shop_items[0].id),category:'도전',deletedAt:C.now()}}]);student=await login();assert.equal(student.economy.transactions.find(t=>t.id===purchase.id).itemCategory,'수학');
const refund=await studentAction('refund',purchase.id);assert.equal(refund.snapshot.economy.balance,640);assert.equal(refund.snapshot.economy.transactions.find(t=>t.type==='환불').itemCategory,'수학');
await role(true);await pg.query('select public.startoday_economy_action($1,$2,$3,$4,$5,$6)',[cid,'one','gift',d.shop_items[1].id,0,'']);current=await snap();let gift=current.data.economy_tx.find(t=>t.type==='선물');assert.equal(gift.itemCategory,'글쓰기');delete gift.itemCategory;await commit([{table:'economy_tx',id:gift.id,data:gift},{table:'shop_items',id:d.shop_items[1].id,data:{...current.data.shop_items.find(i=>i.id===d.shop_items[1].id),deletedAt:C.now()}}]);student=await login();assert.equal(student.economy.transactions.find(t=>t.id===gift.id).itemCategory,'글쓰기');
await role(true);await pg.query('delete from public.startoday_shop_items where id=$1',[d.shop_items[1].id]);student=await login();assert.equal(student.economy.transactions.find(t=>t.id===gift.id).itemCategory,'기타');
// Patch 25: long assignments remain playable but never enter the calendar projection.
await role(true);
const long={id:'long-25',title:'장기과제 분리',date,repeat:{type:'none'},target:'all',isQuest:true,questGoal:3,questTitle:'꾸준한 탐험가'};
await commit([{table:'assignments',id:long.id,data:long}]);
student=await login();assert.ok(student.tasks.some(t=>t.id===long.id));assert.ok(!student.calendar.assignments.some(a=>a.id===long.id));
const blankRecord={id:'record-time-25',date,kind:'관찰',studentIds:['one'],text:'최초 시각',areas:['학습'],createdAt:''};
await commit([{table:'records',id:blankRecord.id,data:blankRecord}]);
let timed=(await snap()).data.records.find(r=>r.id===blankRecord.id);assert.ok(Number.isFinite(Date.parse(timed.createdAt)));
await commit([{table:'records',id:blankRecord.id,data:{...timed,createdAt:'',text:'수정'}}]);
assert.equal((await snap()).data.records.find(r=>r.id===blankRecord.id).createdAt,timed.createdAt);
console.log('PASS: SQL recent3, long assignment calendar separation and nonempty immutable creation timestamp');
await pg.close();console.log('PASS: SQL praise windows/all>50/privacy/unchanged scores, enum validation and purchase/gift/refund category snapshots + legacy fallback');
