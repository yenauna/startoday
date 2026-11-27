// Execute the complete schema in PostgreSQL (PGlite), including public teacher/student RPCs.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),{pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const pg=new PGlite({extensions:{pgcrypto}});
try {
 await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await pg.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
 await pg.query('insert into auth.users(id) values($1),($2)',[owner,other]);
 const as=async(role,id='')=>{await pg.exec(`set role ${role}`);await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
 await as('authenticated',owner);
 const snap=async()=>(await pg.query('select public.startoday_snapshot() as data')).rows[0].data;
 const initial=await snap(),cid=initial.class_id,d=C.initialDB(),item=C.uid();
 Object.assign(d.settings[0],{schoolName:'환불테스트학교',schoolCode:'REFUND001',grade:5,classGroup:'1',defaultStudentPassword:'바람123',allowRefund:false});
 d.students=[{id:'s',no:1,name:'가상학생'}];d.shop_items=[{id:item,name:'환불쿠폰',category:'기타',price:7,stock:3}];
 await pg.query('select public.startoday_commit($1,$2,$3::jsonb)',[cid,0,JSON.stringify(C.TABLES.flatMap(t=>d[t].map(data=>({table:t,id:data.id,data}))))]);
 await as('anon');
 assert((await pg.query("select public.startoday_student_change_password('REFUND001','5','1',1,'바람123','별빛123') as data")).rows[0].data);
 await as('authenticated',owner);
 const action=async(kind,target=null,amount=0)=>(await pg.query('select public.startoday_economy_action($1,$2,$3,$4,$5,$6) as data',[cid,'s',kind,target,amount,'테스트'])).rows[0].data;
 await action('adjust',null,100);const bought=await action('buy',item),purchase=bought.transactionId;assert(purchase);
 const gift=(await action('gift',item)).transactionId;
 await as('anon');await assert.rejects(pg.query("select public.startoday_shop_refund('REFUND001','5','1',1,'별빛123',$1)",[purchase]),/REFUNDS_DISABLED/);
 await as('authenticated',other);await assert.rejects(action('refund',purchase),/FORBIDDEN/);
 await as('authenticated',owner);await assert.rejects(action('refund',gift),/INVALID_HOLDING/);
 const refunded=await action('refund',purchase),tx=refunded.data.economy_tx.find(t=>t.type==='환불');
 assert.equal(tx.amount,7);assert.equal(tx.originalTxId,purchase);assert.equal(refunded.data.shop_items.find(i=>i.id===item).stock,2);
 await pg.exec('reset role');assert.equal(Number((await pg.query('select public.startoday_coin_balance($1,$2) as n',[cid,'s'])).rows[0].n),100);await as('authenticated',owner);
 await assert.rejects(action('refund',purchase),/INVALID_HOLDING/);
 console.log('PASS teacher refund RPC: student disabled, owner allowed, other owner/gift/duplicate denied; balance +7 and finite stock +1');
} finally {await pg.close();}
