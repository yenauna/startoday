import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import {Store} from '../js/store.js';
function fixture(){const d=C.initialDB();d.students=[{id:'s',name:'가온',no:1}];return d;}
test('새 카탈로그는 PNG 머리·교복 2개이며 오래된 소유 ID와 잘못된 소유 배열을 노출하지 않음',()=>{
 assert.deepEqual(C.AVATAR_CATALOG.map(x=>[x.id,x.image,x.price]),[['hair_1','assets/avatar/hair_1.png',10],['outfit_1','assets/avatar/outfit_1.png',10]]);
 for(const avatarOwned of [undefined,null,{},'hair_1',42])assert.deepEqual(C.avatarSnapshot({avatarOwned}).owned,[]);
 assert.deepEqual(C.avatarSnapshot({avatarOwned:['retired-item','hair_1'],avatarEquipped:{'머리':'retired-item'}}).owned,['hair_1']);
 assert.deepEqual(C.avatarSnapshot({avatarOwned:['hair_1'],avatarEquipped:null}).equipped,{});
});
test('로컬 구매 factory는 잠금 안의 최신 저장 데이터를 사용해 잔액 부족·중복 구매를 막음',async()=>{
 const previous=globalThis.localStorage,map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 try{
  const d=fixture(),store=new Store();store.mode='demo';store.classId='demo';store.db=C.applyOps(d,C.teacherBalanceAdjustOps(d,'s',100));
  map.set('startoday-demo-v1',JSON.stringify(d));
  await assert.rejects(store.commit(latest=>C.avatarOps(latest,'s','hair_1','buy')),/잔액/);
  map.set('startoday-demo-v1',JSON.stringify(C.applyOps(d,C.teacherBalanceAdjustOps(d,'s',100))));
  await store.commit(latest=>C.avatarOps(latest,'s','hair_1','buy'));
  await assert.rejects(store.commit(latest=>C.avatarOps(latest,'s','hair_1','buy')),/이미/);
  assert.equal(C.studentBalance(JSON.parse(map.get('startoday-demo-v1')),'s'),90);
 }finally{globalThis.localStorage=previous;}
});
test('교사 클라우드 구매 factory는 startoday_commit에 직렬화 가능한 ops로 전달',async()=>{
 const d=fixture(),store=new Store(),requests=[];store.mode='cloud';store.classId='c';store.revision=4;store.db=C.applyOps(d,C.teacherBalanceAdjustOps(d,'s',100));store.publishSync=()=>{};
 store.client={rpc:async(method,args)=>{requests.push({method,args});return {data:5};}};
 await store.commit(latest=>C.avatarOps(latest,'s','outfit_1','buy'));
 assert.equal(requests[0].method,'startoday_commit');assert(Array.isArray(requests[0].args.p_ops));assert.doesNotThrow(()=>JSON.stringify(requests));assert.equal(C.studentBalance(store.db,'s'),90);
});
