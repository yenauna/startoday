import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const {PGlite}=createRequire(import.meta.url)(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const pg=new PGlite();
await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');await pg.exec(schema);await pg.exec(schema);
const owner=C.uid(),other=C.uid();await pg.query('insert into auth.users values($1),($2)',[owner,other]);
await pg.exec('set role authenticated');
async function identity(id){await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function snap(){return (await pg.query('select public.startoday_snapshot() as data')).rows[0].data;}
await identity(owner);let s=await snap(),cid=s.class_id;
const d=C.initialDB();Object.assign(d.settings[0],{schoolName:'경제초등학교',grade:5,classGroup:'햇살',defaultStudentPassword:'바람123'});d.students=[{id:'s1',no:1,name:'가온',password:'나만암호7',passwordChanged:true},{id:'s2',no:2,name:'나래',password:'다른암호7',passwordChanged:true},{id:'s3',no:3,name:'다온'}];
d.records=Array.from({length:10},(_,i)=>({id:'r'+i,studentIds:['s1'],kind:'칭찬',areas:['학습'],date:C.today(),text:'비공개예시',createdAt:C.now()}));d.shop_items=[{id:C.uid(),category:'쿠폰',name:'구매물품',price:50,stock:2},{id:C.uid(),category:'혜택',name:'무한물품',price:0,stock:null},{id:C.uid(),category:'물품',name:'품절물품',price:1,stock:0}];
async function commit(ops){const before=await snap();await pg.query('select public.startoday_commit($1,$2,$3::jsonb)',[cid,before.revision,JSON.stringify(ops)]);}
await commit(C.TABLES.flatMap(table=>d[table].map(data=>({table,id:data.id,data}))));
d.events=[{id:'legacy',date:C.today(),title:'기존 일정'},{id:'normal',date:C.today(),title:'일반 안내',isImportant:false},{id:'important',date:C.today(),title:'중요 안내',isImportant:true}];
await commit(d.events.map(data=>({table:'events',id:data.id,data})));
const item=d.shop_items[0].id;
async function studentRpc(action,target,no=1,password='나만암호7'){return (await pg.query(`select public.startoday_shop_${action}($1,$2,$3,$4,$5,$6) as data`,['경제초등학교','5','햇살',no,password,target])).rows[0].data;}
async function ownerAction(action,student='s1',target=null,amount=0,memo=''){return (await pg.query('select public.startoday_economy_action($1,$2,$3,$4,$5,$6) as data',[cid,student,action,target,amount,memo])).rows[0].data;}
await ownerAction('adjust','s2',null,10,'비공개지급사유');
await pg.exec('set role anon');await identity('');
await assert.rejects(()=>pg.query('select * from public.startoday_shop_items'),/permission denied/);
await assert.rejects(()=>pg.query('select public.startoday_coin_balance($1,$2)',[cid,'s1']),/permission denied/);
assert.equal(await studentRpc('buy',item,3,'바람123'),null);
assert.equal(await studentRpc('buy',item,1,'틀린암호7'),null);
let result=await studentRpc('buy',item);assert.equal(result.snapshot.economy.balance,50);assert.equal(result.snapshot.economy.items.find(i=>i.id===item).stock,1);assert.equal(result.snapshot.economy.transactions.length,1);assert.ok(!JSON.stringify(result.snapshot.economy).includes('비공개지급사유'));assert.ok(!JSON.stringify(result.snapshot.economy).includes('나만암호7'));
assert.deepEqual(Object.fromEntries(result.snapshot.calendar.events.map(e=>[e.title,e.isImportant])),{'기존 일정':true,'일반 안내':false,'중요 안내':true});
const tx=result.snapshot.economy.transactions[0].id,revision=result.revision;
await assert.rejects(()=>studentRpc('refund',tx,2,'다른암호7'),/INVALID_HOLDING/);
await assert.rejects(()=>studentRpc('use',tx,2,'다른암호7'),/INVALID_HOLDING/);
await assert.rejects(()=>studentRpc('buy',d.shop_items[2].id),/SOLD_OUT/);
await pg.exec('set role authenticated');await identity(owner);s=await snap();assert.equal(s.revision,revision);s.data.shop_items.find(i=>i.id===item).price=99;s.data.shop_items.find(i=>i.id===item).name='변경물품';await commit([{table:'shop_items',id:item,data:s.data.shop_items.find(i=>i.id===item)}]);
await pg.exec('set role anon');await identity('');result=await studentRpc('refund',tx);assert.equal(result.snapshot.economy.balance,100);assert.equal(result.snapshot.economy.items.find(i=>i.id===item).stock,2);assert.equal(result.snapshot.economy.transactions.find(t=>t.type==='환불').amount,50);
await assert.rejects(()=>studentRpc('refund',tx),/INVALID_HOLDING/);
result=await studentRpc('buy',item);const useTx=result.snapshot.economy.transactions.find(t=>t.status==='보유').id;result=await studentRpc('use',useTx);assert.equal(result.snapshot.economy.transactions.find(t=>t.id===useTx).status,'사용완료');await assert.rejects(()=>studentRpc('refund',useTx),/INVALID_HOLDING/);await assert.rejects(()=>studentRpc('buy',item),/INSUFFICIENT_BALANCE/);
result=await studentRpc('buy',d.shop_items[1].id);assert.equal(result.snapshot.economy.items.find(i=>i.id===d.shop_items[1].id).stock,null);
await pg.exec('set role authenticated');await identity(owner);await ownerAction('gift','s1',item);s=await snap();assert.equal(s.data.shop_items.find(i=>i.id===item).stock,0);const gift=s.data.economy_tx.find(t=>t.type==='선물');assert.equal(gift.amount,0);await assert.rejects(()=>ownerAction('gift','s2',item),/SOLD_OUT/);
await ownerAction('adjust','s1',null,100,'지원');s=await snap();assert.equal(C.studentBalance(s.data,'s1'),101);
await commit([{table:'settings',id:'main',data:{...s.data.settings[0],allowRefund:false}}]);
await pg.exec('set role anon');await identity('');const free=(await studentRpc('buy',d.shop_items[1].id)).snapshot.economy.transactions.filter(t=>t.status==='보유'&&t.type==='구매').at(-1);await assert.rejects(()=>studentRpc('refund',free.id),/REFUNDS_DISABLED/);await assert.rejects(()=>studentRpc('refund',gift.id),/REFUNDS_DISABLED|INVALID_HOLDING/);
await assert.rejects(()=>pg.query('select public.startoday_economy_action($1,$2,$3,$4,$5,$6)',[cid,'s1','adjust',null,999,'攻撃']),/permission denied/);
await pg.exec('set role authenticated');await identity(other);await assert.rejects(()=>ownerAction('adjust','s1',null,100),/FORBIDDEN/);assert.equal((await pg.query('select * from public.startoday_economy_tx')).rows.length,0);assert.equal((await pg.query('select * from public.startoday_shop_items')).rows.length,0);
await pg.close();console.log('PASS: economy SQL auth/RLS, atomic purchases, stock, historical-price refunds, use, gift, settings, rollback, balance and student projection');
