import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import {Store} from '../js/store.js';
function fixture(){const d=C.initialDB();d.students=[{id:'s',no:1,name:'가온'}];d.assignments=[{id:'q',title:'독서',isQuest:true,date:C.today(),repeat:{type:'none'},target:'all',questGoal:1,questTitle:'독서가',statArea:'학습'}];d.shop_items=[{id:C.uid(),name:'스티커',price:0,stock:2}];return d;}
test('장기과제 삭제는 상태·자동 기록을 정리하고 수동 기록과 획득 칭호는 보존',()=>{
 let d=fixture(),a=d.assignments[0];d=C.applyOps(d,C.questStampOps(d,a,C.today(),'s',1));
 d.records.push({id:'manual',studentIds:['s'],date:C.today(),kind:'칭찬',areas:[],text:'수동',createdAt:C.now()});
 d=C.applyOps(d,C.deleteLongAssignmentOps(d,a.id));
 assert.ok(d.assignments[0].deletedAt);assert.equal(d.assignmentStates.length,0);assert.deepEqual(d.records.map(r=>r.id),['manual']);assert.equal(d.students[0].rewardTitles.length,1);
 assert.throws(()=>C.deleteLongAssignmentOps(d,a.id));
});
test('대시보드 미완료는 장기과제를 제외하되 일반 과제는 남긴다',()=>{
 const d=fixture();d.assignments.push({id:'normal',title:'숙제',date:C.today(),repeat:{type:'none'},target:'all'});
 assert.equal(C.pending(d,'s',C.today()).length,2);
 assert.deepEqual(C.dashboardPending(d,'s',C.today()).map(row=>row.assignment.id),['normal']);
});
test('당일 공개 메모는 실제 오늘에만 공개하고 과거·미래 날짜에는 숨긴다',()=>{
 const slot={privateMemo:'당일 안내'};
 assert.equal(C.sameDayMemo(slot,C.today()),'당일 안내');
 for(const date of [C.addDays(C.today(),-1),C.addDays(C.today(),1)]) assert.equal(C.sameDayMemo(slot,date),'');
});
test('선물 취소는 정확히 5초 이내의 미사용 선물만 원상복구하고 원장을 보존',()=>{
 let d=fixture();d=C.applyOps(d,C.teacherGiftOps(d,'s',d.shop_items[0].id));const gift=d.economy_tx.at(-1),created=Date.parse(gift.createdAt);
 assert.throws(()=>C.teacherUndoGiftOps(d,'s',gift.id,created+5000),/5초/);
 assert.throws(()=>C.teacherUndoGiftOps(d,'s',gift.id,created-1),/5초/);
 const cancelled=C.applyOps(d,C.teacherUndoGiftOps(d,'s',gift.id,created+4999));
 assert.equal(cancelled.shop_items[0].stock,2);assert.equal(C.studentHoldings(cancelled,'s').length,0);assert.equal(cancelled.economy_tx.at(-1).type,'선물취소');assert.equal(C.studentBalance(cancelled,'s'),C.studentBalance(d,'s'));
 assert.throws(()=>C.teacherUndoGiftOps(cancelled,'s',gift.id,created+1));
 const used=C.applyOps(d,C.shopUseOps(d,'s',gift.id));assert.throws(()=>C.teacherUndoGiftOps(used,'s',gift.id,created+1));
 assert.throws(()=>C.teacherUndoGiftOps(d,'other',gift.id,created+1));
 assert.doesNotThrow(()=>C.validateBackup({app:'startoday',version:1,data:cancelled}));
});
test('로컬 선물 action은 취소 대상의 정확한 거래 ID를 반환하고 반복 취소를 막는다',async()=>{
 const previous=globalThis.localStorage,map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 try{const store=new Store();store.mode='demo';store.db=fixture();map.set('startoday-demo-v1',JSON.stringify(store.db));const id=await store.economyAction('gift','s',store.db.shop_items[0].id);assert.equal(id,store.db.economy_tx.at(-1).id);await store.economyAction('undo_gift','s',id);assert.equal(store.db.shop_items[0].stock,2);await assert.rejects(store.economyAction('undo_gift','s',id));}finally{globalThis.localStorage=previous;}
});
