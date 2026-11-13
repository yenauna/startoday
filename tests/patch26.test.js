import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function fixture(){const d=C.initialDB();d.students=[{id:'s',no:1,name:'박가나다',nickname:'반짝별',alias:'옛별명'}];d.assignments=[{id:'q',title:'리코더',isQuest:true,date:C.addDays(C.today(),30),endDate:C.addDays(C.today(),31),repeat:{type:'none'},target:'all',questGoal:3,questTitle:'연주의 달인',questSubtasks:['학교종','아리랑','작은별'],statArea:'과제'}];return d;}
test('장기과제는 시작 전·종료 후·출결 제외일에도 누적 체크하고 원하는 항목을 자유롭게 토글',()=>{
 let d=fixture();const a=d.assignments[0];d.attendance=[{id:'ex',date:C.today(),studentId:'s',excluded:true}];
 assert.equal(C.occurs(a,C.today()),true);assert.equal(C.occurs(a,C.addDays(a.endDate,10)),true);
 d=C.applyOps(d,C.questSubtaskOps(d,a,C.today(),'s','작은별',true));
 assert.deepEqual(C.questProgress(d,a,'s').completedSubtasks,['작은별']);
 d=C.applyOps(d,C.questSubtaskOps(d,a,C.today(),'s','학교종',true));
 d=C.applyOps(d,C.questSubtaskOps(d,a,C.today(),'s','작은별',false));
 assert.equal(C.questProgress(d,a,'s').stamps,1);
 d=C.applyOps(d,C.questSubtaskOps(d,a,C.today(),'s','아리랑',true));
 d=C.applyOps(d,C.questSubtaskOps(d,a,C.today(),'s','작은별',true));
 assert.equal(C.questProgress(d,a,'s').status,'완료');assert.equal(d.students[0].rewardTitles.length,1);
 d=C.applyOps(d,C.questSubtaskOps(d,a,C.today(),'s','학교종',false));
 assert.equal(d.students[0].rewardTitles.length,1);assert.equal(C.questProgress(d,a,'s').stamps,2);
 assert.throws(()=>C.questSubtaskOps(d,a,C.today(),'s','없는 곡',true));
 assert.throws(()=>C.questSubtaskOps(d,a,C.today(),'other','작은별',true));
 assert.throws(()=>C.questStampOps(d,{...a,deletedAt:C.now()},C.today(),'s',1));
 const reordered={...a,questSubtasks:['작은별','학교종','아리랑']};assert.deepEqual(C.questProgress(d,reordered,'s').completedSubtasks,['작은별','아리랑']);
 assert.equal(C.questGoal({...a,questGoal:20}),3);
});
test('기존 숫자 도장을 체크리스트로 전환하면 누적 수를 보존하고 중복 항목을 거부',()=>{
 const d=fixture(),a=d.assignments[0];d.assignmentStates=[{id:C.stateId(a.id,a.date,'s'),stamps:2}];
 assert.deepEqual(C.questProgress(d,a,'s').completedSubtasks,['학교종','아리랑']);
 assert.throws(()=>C.questGoal({...a,questSubtasks:['곡','곡']}),/중복/);
});
test('회수는 구매/선물 보유품만 1회 처리, 선택 재고 복구와 원장을 보존하며 잔액은 그대로',()=>{
 let d=fixture();d.shop_items=[{id:C.uid(),name:'스티커',price:10,stock:3}];
 d=C.applyOps(d,C.teacherBalanceAdjustOps(d,'s',100));
 d=C.applyOps(d,C.shopBuyOps(d,'s',d.shop_items[0].id));
 const balance=C.studentBalance(d,'s'),tx=C.studentHoldings(d,'s')[0];
 d=C.applyOps(d,C.teacherReclaimOps(d,'s',tx.id,true));
 assert.equal(d.shop_items[0].stock,3);assert.equal(C.studentBalance(d,'s'),balance);assert.equal(C.studentHoldings(d,'s').length,0);
 assert.equal(d.economy_tx.at(-1).type,'회수');assert.equal(d.economy_tx.at(-1).amount,0);
 assert.throws(()=>C.teacherReclaimOps(d,'s',tx.id,true));
 d=C.applyOps(d,C.teacherGiftOps(d,'s',d.shop_items[0].id));
 const gift=C.studentHoldings(d,'s')[0];d=C.applyOps(d,C.teacherReclaimOps(d,'s',gift.id,false));
 assert.equal(d.shop_items[0].stock,2);
 const backup={app:'startoday',version:1,data:d};
 d.assignments=[];assert.doesNotThrow(()=>C.validateBackup(backup));
});
test('교실 별명 모드는 학생 nickname을 사용하고 없으면 번호 별명을 사용',()=>{
 let mode='alias';const context={settings:()=>({nameDisplayMode:mode})};
 const source=readFileSync(new URL('../js/tabs/classroom.js',import.meta.url),'utf8');
 const start=source.indexOf('export function displayName'),end=source.indexOf('let classroomInteractionCleanup');
 vm.createContext(context);vm.runInContext(source.slice(start,end).replace('export ',''),context);
 const s=fixture().students[0];assert.equal(context.displayName(s),'반짝별');assert.equal(context.displayName({...s,nickname:''}),'별1');
 mode='real';assert.equal(context.displayName(s),'1. 박가나다');
});
