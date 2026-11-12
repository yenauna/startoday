import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const {PGlite}=createRequire(import.meta.url)(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const pg=new PGlite();
try {
await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
await pg.exec(schema);
const owner=C.uid(),other=C.uid();await pg.query('insert into auth.users values($1),($2)',[owner,other]);
const identity=async id=>pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const snapshot=async()=>(await pg.query('select public.startoday_snapshot() as data')).rows[0].data;
await pg.exec('set role authenticated');await identity(owner);
let s=await snapshot(),cid=s.class_id;
const d=C.initialDB();Object.assign(d.settings[0],{schoolName:'펀딩초등학교',grade:5,classGroup:'1',defaultStudentPassword:'바람123'});
d.students=[{id:'s1',no:1,name:'가온',password:'나만암호7',passwordChanged:true},{id:'s2',no:2,name:'나래',password:'다른암호7',passwordChanged:true}];
const item=C.uid(),plain=C.uid();
d.shop_items=[{id:item,name:'학급 파티',price:100,stock:null,isGroupBuy:true,groupGoal:100,groupCollected:0,isFunded:false,isUsed:false},{id:plain,name:'개인 물품',price:1,stock:null}];
for (const sid of ['s1','s2']) Object.assign(d,C.applyOps(d,C.teacherBalanceAdjustOps(d,sid,80)));
async function commit(ops){s=await snapshot();return pg.query('select public.startoday_commit($1,$2,$3::jsonb)',[cid,s.revision,JSON.stringify(ops)]);}
await commit(C.TABLES.flatMap(table=>d[table].map(data=>({table,id:data.id,data}))));
// Migration must be rerunnable on populated data.
await pg.exec('reset role');await pg.exec(schema);await pg.exec(schema);
await pg.exec('set role anon');await identity('');
async function fund(sid,amount,target=item,password=sid==='s1'?'나만암호7':'다른암호7',no=sid==='s1'?1:2){
 return (await pg.query('select public.startoday_shop_fund_group_buy($1,$2,$3,$4,$5,$6,$7,$8) as result',[sid,target,amount,'펀딩초등학교','5','1',no,password])).rows[0].result;
}
await assert.rejects(fund('s1',1,item,'틀린암호7'),/AUTH_REQUIRED/);
await assert.rejects(fund('s2',1,item,'나만암호7',1),/FORBIDDEN/);
await assert.rejects(pg.query('select public.startoday_shop_fund_group_buy($1,$2,$3)',['s1',item,1]),/AUTH_REQUIRED/);
await assert.rejects(fund('s1',81),/INSUFFICIENT_BALANCE/);
for (const amount of [0,-1,1000000001]) await assert.rejects(fund('s1',amount),/INVALID_AMOUNT/);
await assert.rejects(fund('s1',1,plain),/INVALID_GROUP_BUY/);
await assert.rejects(pg.query('select public.startoday_group_buy_mutate($1,$2,$3,$4)',[cid,'s1',item,1]),/permission denied/);
await assert.rejects(pg.query('select * from public.startoday_group_buy_contribs'),/permission denied/);
const first=await fund('s1',30);
assert.equal(first.snapshot.economy.balance,50);
assert.equal(first.snapshot.economy.items.find(i=>i.id===item).groupCollected,30);
await fund('s1',5);
let result=await fund('s2',40);
let group=result.snapshot.economy.items.find(i=>i.id===item);
assert.deepEqual(group.contributors.map(c=>[c.name,c.amount,c.isMe]),[['나래',40,true],['가온',35,false]]);
assert.equal(result.snapshot.economy.transactions.filter(t=>t.status==='보유').length,0);
assert.ok(!JSON.stringify(group).includes('암호'));
// Two requests for the last 25 coins can debit only one successful contribution.
const raced=await Promise.allSettled([fund('s1',100),fund('s2',100)]);
assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);
assert.match(raced.find(r=>r.status==='rejected').reason.message,/GROUP_BUY_CLOSED/);
await pg.exec('set role authenticated');await identity(owner);
s=await snapshot();group=s.data.shop_items.find(i=>i.id===item);
assert.equal(group.groupCollected,100);assert.equal(group.isFunded,true);
assert.equal(s.data.group_buy_contribs.reduce((sum,c)=>sum+c.amount,0),100);
assert.equal(s.data.economy_tx.filter(t=>t.groupBuy).reduce((sum,t)=>sum-t.amount,0),100);
assert.equal(C.studentBalance(s.data,'s1')+C.studentBalance(s.data,'s2'),60);
let columns=(await pg.query('select is_group_buy,group_goal,group_collected,is_funded,is_used from public.startoday_shop_items where id=$1',[item])).rows[0];
assert.deepEqual(columns,{is_group_buy:true,group_goal:100,group_collected:100,is_funded:true,is_used:false});
await assert.rejects(commit([{table:'shop_items',id:item,data:{...group,isGroupBuy:false}}]),/GROUP_BUY/);
await assert.rejects(commit([{table:'shop_items',id:item,data:{...group,groupGoal:110,price:110}}]),/GROUP_BUY/);
await assert.rejects(pg.query('select public.startoday_shop_use_group_buy($1,$2)',[other,item]),/FORBIDDEN/);
await identity(other);
assert.equal((await pg.query('select * from public.startoday_group_buy_contribs')).rows.length,0);
await assert.rejects(pg.query('select public.startoday_shop_use_group_buy($1,$2)',[other,item]),/FORBIDDEN/);
await identity(owner);
await assert.rejects(pg.query('select public.startoday_shop_use_group_buy($1,$2)',[owner,plain]),/INVALID_GROUP_BUY/);
const used=(await pg.query('select public.startoday_shop_use_group_buy($1,$2) as data',[owner,item])).rows[0].data;
assert.equal(used.data.shop_items.find(i=>i.id===item).isUsed,true);
await assert.rejects(pg.query('select public.startoday_shop_use_group_buy($1,$2)',[owner,item]),/INVALID_GROUP_USE/);
await pg.exec('set role anon');await identity('');
await assert.rejects(pg.query('select public.startoday_shop_use_group_buy($1,$2)',[owner,item]),/permission denied/);
await assert.rejects(fund('s1',1),/GROUP_BUY_CLOSED/);
// Normal buy/gift must not create personal holdings for a class reward.
await assert.rejects(pg.query('select public.startoday_shop_buy($1,$2,$3,$4,$5,$6)',['펀딩초등학교','5','1',1,'나만암호7',item]),/INVALID_GROUP_BUY/);
await pg.exec('reset role');await pg.exec(schema);
await pg.exec('set role authenticated');await identity(owner);
assert.equal((await snapshot()).data.group_buy_contribs.length,2);
console.log('PASS: group-buy SQL migration, auth/RLS, rollback, balance, cumulative rankings, goal cap/racing requests, projections and teacher-only one-time reward use');
} finally {await pg.close();}
