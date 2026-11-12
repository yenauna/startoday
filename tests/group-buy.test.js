import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import { Store } from '../js/store.js';
function fixture() {
  let d = C.initialDB();
  d.students = [{id:'s1',name:'가온'},{id:'s2',name:'나래'}];
  d.shop_items = [{id:C.uid(),name:'학급 파티',price:100,stock:null,isGroupBuy:true,groupGoal:100,groupCollected:0,isFunded:false,isUsed:false}];
  for (const id of ['s1','s2']) d = C.applyOps(d,C.teacherBalanceAdjustOps(d,id,80));
  return d;
}
test('공동구매: 기여 누적, 순위, 본인 표시, 차감 원장 및 개인 소장 제외',()=>{
  let d=fixture(), item=d.shop_items[0].id;
  d=C.applyOps(d,C.shopFundGroupBuyOps(d,'s1',item,30));
  d=C.applyOps(d,C.shopFundGroupBuyOps(d,'s2',item,40));
  d=C.applyOps(d,C.shopFundGroupBuyOps(d,'s1',item,5));
  assert.equal(C.studentBalance(d,'s1'),45);
  assert.equal(d.group_buy_contribs.length,2);
  assert.equal(d.group_buy_contribs.find(c=>c.studentId==='s1').amount,35);
  assert.equal(d.shop_items[0].groupCollected,75);
  assert.deepEqual(C.groupBuyContributors(d,item,'s1').map(c=>[c.name,c.amount,c.isMe]),[['나래',40,false],['가온',35,true]]);
  assert.equal(C.studentHoldings(d,'s1').length,0);
  assert.equal(C.scores(d,'s1').total,0);
  assert.equal(C.studentEconomySnapshot(d,'s1').items[0].contributors[1].isMe,true);
  assert.throws(()=>C.shopBuyOps(d,'s1',item),/공동구매/);
  assert.throws(()=>C.teacherGiftOps(d,'s1',item),/공동구매/);
  assert.throws(()=>C.shopUseGroupBuyOps(d,item),/달성/);
});
test('잔액과 정수 검증, 목표 초과 자동 보정, 달성·보상 사용은 1회만 허용',()=>{
  let d=fixture(),item=d.shop_items[0].id;
  for(const n of [0,-1,1.5,NaN,Infinity,1000000001]) assert.throws(()=>C.shopFundGroupBuyOps(d,'s1',item,n),/정수/);
  assert.throws(()=>C.shopFundGroupBuyOps(d,'s1',item,81),/잔액/);
  assert.throws(()=>C.shopFundGroupBuyOps(d,'other',item,1),/학생/);
  d=C.applyOps(d,C.shopFundGroupBuyOps(d,'s1',item,75));
  // A request larger than the balance is accepted only for the affordable remaining goal.
  d=C.applyOps(d,C.shopFundGroupBuyOps(d,'s2',item,100));
  assert.equal(d.shop_items[0].groupCollected,100);
  assert.equal(C.studentBalance(d,'s2'),55);
  assert.equal(d.shop_items[0].isFunded,true);
  assert.throws(()=>C.shopFundGroupBuyOps(d,'s2',item,1),/완료/);
  d=C.applyOps(d,C.shopUseGroupBuyOps(d,item));
  assert.equal(d.shop_items[0].isUsed,true);
  assert.throws(()=>C.shopUseGroupBuyOps(d,item),/미사용/);
  assert.throws(()=>C.shopItemEditOps(d,{...d.shop_items[0],groupGoal:200}),/달성 후/);
});
test('기여 후 유형 전환·목표 축소 차단, 진척 유지 및 체험 시드·백업 호환',()=>{
  let d=fixture(),item=d.shop_items[0].id;
  d=C.applyOps(d,C.shopFundGroupBuyOps(d,'s1',item,30));
  assert.throws(()=>C.shopItemEditOps(d,{...d.shop_items[0],isGroupBuy:false}),/유형/);
  assert.throws(()=>C.shopItemEditOps(d,{...d.shop_items[0],groupGoal:20}),/목표/);
  const updated=C.shopItemEditOps(d,{...d.shop_items[0],name:'보드게임',groupGoal:150,groupCollected:0,stock:3})[0].data;
  assert.equal(updated.groupCollected,30);assert.equal(updated.stock,null);assert.equal(updated.price,150);
  const demo=C.demoDB(),group=demo.shop_items.find(i=>i.isGroupBuy);
  assert.equal(group.groupCollected,65);assert.equal(group.groupGoal,100);
  assert.equal(C.groupBuyContributors(demo,group.id)[0].name,'가온');
  assert.equal(C.groupBuyContributors(demo,group.id)[0].amount,30);
  assert.doesNotThrow(()=>C.validateBackup({app:'startoday',version:1,data:demo}));
  const bad=structuredClone(demo);bad.group_buy_contribs[0].amount++;
  assert.throws(()=>C.validateBackup({app:'startoday',version:1,data:bad}),/합계/);
  const legacy=C.initialDB();delete legacy.group_buy_contribs;
  assert.deepEqual(C.normalizeDB(legacy).group_buy_contribs,[]);
});
test('로컬 저장 재독기로 두 기여를 직렬 적용하고 달성 후 추가 차감 차단',async()=>{
  const previous=globalThis.localStorage, map=new Map();
  globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  try {
    const d=fixture(),a=new Store(),b=new Store();
    a.mode=b.mode='demo';a.db=structuredClone(d);b.db=structuredClone(d);
    map.set('startoday-demo-v1',JSON.stringify(d));
    await a.economyAction('fund','s1',d.shop_items[0].id,60);
    await b.economyAction('fund','s2',d.shop_items[0].id,60);
    assert.equal(b.db.shop_items[0].groupCollected,100);
    assert.equal(C.studentBalance(b.db,'s2'),40);
    await assert.rejects(a.economyAction('fund','s1',d.shop_items[0].id,1),/완료/);
  } finally {globalThis.localStorage=previous;}
});
test('교사 클라우드 보상 사용은 소유자 RPC와 서버 snapshot을 사용',async()=>{
 const store=new Store(),d=fixture();store.mode='cloud';store.classId='class';store.user={id:'teacher'};store.db=d;
 let request;
 store.client={rpc:async(method,args)=>{request={method,args};return{data:{data:d,revision:5}};}};
 await store.economyAction('group_use',null,d.shop_items[0].id);
 assert.deepEqual(request,{method:'startoday_shop_use_group_buy',args:{p_teacher_id:'teacher',p_item_id:d.shop_items[0].id}});
 assert.equal(store.revision,5);
});
