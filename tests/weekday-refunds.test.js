import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
test('월간·주간 달력은 월~금 5열이며 연도 경계를 포함한다',()=>{
 for(let m=1;m<=12;m++){
  const day=`2026-${String(m).padStart(2,'0')}-15`;
  for(const mode of ['month','week']){
   const days=C.weekdayCalendarDates(day,mode);assert.equal(days.length,mode==='month'?30:5);
   days.forEach((d,i)=>assert.equal(C.weekday(d),i%5+1));
   assert.equal(new Set(days).size,days.length);
  }
 }
 assert.equal(C.weekdayCalendarDates('2027-01-01','week')[0],'2026-12-28');
});
test('주말 정리는 저장된 주말 일정만 삭제하고 수업·평일 일정을 보존한다',()=>{
 const d=C.initialDB();d.events=[{id:'fri',date:'2026-11-27'},{id:'sat',date:'2026-11-28'},{id:'sun',date:'2026-11-29'}];d.timetables=[{id:'weekend-class',date:'2026-11-28',period:1}];
 const next=C.applyOps(d,C.weekendEventDeleteOps(d));assert.deepEqual(next.events.map(e=>e.id),['fri']);assert.equal(next.timetables.length,1);
});
test('수업 이동·교체는 임의 ID와 교시·메모를 보존하고 중복 슬롯을 만들지 않는다',()=>{
 const d=C.initialDB();d.timetables=[{id:'source-uuid',date:'2026-11-23',period:2,subjectCode:'국어',publicMemo:'발표'},{id:'target-uuid',date:'2026-11-24',period:2,subjectCode:'수학',teacherMemo:'교사'}];
 const next=C.applyOps(d,C.timetableMoveOps(d,'2026-11-23:2','2026-11-24:2'));
 assert.equal(next.timetables.length,2);assert.equal(next.timetables.find(t=>t.id==='source-uuid').date,'2026-11-24');assert.equal(next.timetables.find(t=>t.id==='target-uuid').date,'2026-11-23');assert.equal(next.timetables[0].publicMemo,'발표');assert.equal(next.timetables[1].teacherMemo,'교사');
 const empty=C.applyOps(next,C.timetableMoveOps(next,'2026-11-24:2','2026-11-25:4'));assert.equal(empty.timetables[0].period,4);assert.equal(empty.timetables[0].id,'source-uuid');
 assert.deepEqual(C.timetableMoveOps(d,'2026-11-23:2','2026-11-23:2'),[]);assert.deepEqual(C.timetableMoveOps(d,'2026-11-23:1','2026-11-24:1'),[]);
 for(const bad of ['2026-02-30:1','2026-11-24:0','2026-11-24:7'])assert.throws(()=>C.timetableMoveOps(d,'2026-11-23:2',bad));
});
test('행사 날짜 이동은 교시와 메모를 보존하며 학사일정은 이동하지 않는다',()=>{
 const d=C.initialDB();d.events=[{id:'event',date:'2026-11-23',period:3,title:'행사',memo:'준비물'},{id:'academic',date:'2026-11-23',academic:true}];
 const n=C.applyOps(d,C.scheduleEventMoveOps(d,'event','2026-11-24'));assert.deepEqual({...n.events[0],updatedAt:undefined},{id:'event',date:'2026-11-24',period:3,title:'행사',memo:'준비물',updatedAt:undefined});assert.deepEqual(C.scheduleEventMoveOps(d,'academic','2026-11-24'),[]);
});
test('교사 환불은 학생 환불 제한과 무관하며 실제 결제액·재고 1개만 복구한다',()=>{
 let d=C.initialDB();d.students=[{id:'s',no:1,name:'학생'}];d.records=[];d.economy_tx=[{id:'paid',studentId:'s',type:'구매',amount:-7,status:'보유',itemId:'i',itemName:'쿠폰'},{id:'gift',studentId:'s',type:'선물',amount:0,status:'보유',itemId:'i',itemName:'쿠폰'}];d.shop_items=[{id:'i',name:'쿠폰',price:20,stock:0}];d.settings[0].allowRefund=false;
 assert.throws(()=>C.shopRefundOps(d,'s','paid'),/허용/);const before=C.studentBalance(d,'s');
 d=C.applyOps(d,C.shopRefundOps(d,'s','paid',true));assert.equal(C.studentBalance(d,'s'),before+7);assert.equal(d.shop_items[0].stock,1);assert.equal(d.economy_tx.find(t=>t.type==='환불').originalTxId,'paid');
 assert.throws(()=>C.shopRefundOps(d,'s','paid',true),/미사용/);assert.throws(()=>C.shopRefundOps(d,'s','gift',true),/미사용/);
 d.economy_tx.find(t=>t.id==='paid').status='보유';d.shop_items[0].stock=null;assert.equal(C.applyOps(d,C.shopRefundOps(d,'s','paid',true)).shop_items[0].stock,null);
});
test('로컬 Store도 학생 환불 제한을 유지하고 교사 경로에서만 예외를 적용한다',async()=>{
 const {Store}=await import('../js/store.js'),previous=globalThis.localStorage,cache=new Map();globalThis.localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
 try{
  const store=new Store();store.mode='demo';store.db=C.initialDB();store.db.students=[{id:'s',no:1,name:'학생'}];store.db.records=[];store.db.settings[0].allowRefund=false;store.db.shop_items=[{id:C.uid(),name:'쿠폰',category:'기타',price:7,stock:0}];const item=store.db.shop_items[0];store.db.economy_tx=[{id:C.uid(),studentId:'s',type:'구매',amount:-7,status:'보유',itemId:item.id,itemName:item.name,createdAt:C.now()}];const tx=store.db.economy_tx[0].id;cache.set('startoday-demo-v1',JSON.stringify(store.db));
  await assert.rejects(store.economyAction('refund','s',tx),/허용/);
  await store.economyAction('refund','s',tx,0,'',{teacherRefund:true});assert.equal(store.db.shop_items[0].stock,1);assert.equal(store.db.economy_tx.filter(t=>t.type==='환불').length,1);
 }finally{globalThis.localStorage=previous;}
});
