import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
const context={C,esc:C.esc};vm.createContext(context);
vm.runInContext(readFileSync(new URL('../js/tabs/records.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ',''),context);
test('기록 작성·수정 일시는 한국 날짜와 요일로 표시하고 1분 미만 수정은 숨김',()=>{
 const r={date:'2026-11-01',createdAt:'2026-11-13T11:35:00Z'};
 assert.match(context.recordCreatedTime(r),/>작성 26\.11\.13\.\(금\) 20:35<\/time>/);
 for(const updatedAt of [undefined,'invalid','2026-11-13T11:35:59.999Z','2026-11-13T11:34:00Z'])assert(!context.recordCreatedTime({...r,updatedAt}).includes('수정'));
 const html=context.recordCreatedTime({...r,updatedAt:'2026-11-13T11:36:00Z'});
 assert.match(html,/수정 26\.11\.13\.\(금\) 20:36/);assert.match(html,/최근 수정/);
 assert.match(context.recordCreatedTime({...r,updatedAt:'2026-11-13T15:05:00Z'}),/수정 26\.11\.14\.\(토\) 00:05/);
});
function fixture(){const d=C.initialDB();d.students=[{id:'s',no:1,name:'가온'}];d.assignments=[{id:'q',title:'연주',date:'2026-01-01',isQuest:true,repeat:{type:'none'},target:'all',questSubtasks:['나비야','작은별'],questTitle:'연주가',statArea:'과제'}];return d;}
test('항목 완료일은 체크 날짜를 보존하고 해제·재체크 및 숫자 도장에도 일관되게 저장',()=>{
 let d=fixture(),a=d.assignments[0];const apply=(day,item,checked)=>d=C.applyOps(d,C.questSubtaskOps(d,a,day,'s',item,checked));
 apply('2026-11-13','작은별',true);assert.deepEqual(C.questProgress(d,a,'s').completedSubtaskDates,{'작은별':'2026-11-13'});
 apply('2026-11-14','나비야',true);apply('2026-11-15','작은별',true);
 assert.deepEqual(C.questProgress(d,a,'s').completedSubtaskDates,{'나비야':'2026-11-14','작은별':'2026-11-13'});
 apply('2026-11-16','작은별',false);assert.deepEqual(C.questProgress(d,a,'s').completedSubtaskDates,{'나비야':'2026-11-14'});
 apply('2026-11-17','작은별',true);assert.equal(C.questProgress(d,a,'s').completedSubtaskDates['작은별'],'2026-11-17');
 d=C.applyOps(d,C.questStampOps(d,a,'2026-11-18','s',-1));assert.deepEqual(C.questProgress(d,a,'s').completedSubtaskDates,{'나비야':'2026-11-14'});
 d=C.applyOps(d,C.questStampOps(d,a,'2026-11-19','s',1));assert.equal(C.questProgress(d,a,'s').completedSubtaskDates['작은별'],'2026-11-19');
 assert.equal(d.students[0].rewardTitles.length,1);assert.doesNotThrow(()=>C.validateBackup({app:'startoday',version:1,data:d}));
 const restored=JSON.parse(JSON.stringify(d));assert.deepEqual(C.questProgress(restored,a,'s'),C.questProgress(d,a,'s'));
});
test('날짜 없는 기존 도장은 날짜를 추측하지 않고 새 항목만 날짜를 저장',()=>{
 let d=fixture(),a=d.assignments[0];d.assignmentStates=[{id:C.stateId(a.id,a.date,'s'),stamps:1}];
 assert.deepEqual(C.questProgress(d,a,'s').completedSubtaskDates,{});
 d=C.applyOps(d,C.questSubtaskOps(d,a,'2026-11-13','s','작은별',true));
 assert.deepEqual(C.questProgress(d,a,'s').completedSubtaskDates,{'작은별':'2026-11-13'});
 assert.equal(C.formatShortDate('2026-11-13'),'26.11.13.(금)');assert.equal(C.formatShortDate('2026-11-13',false),'26.11.13.(금)');assert.equal(C.formatShortDate('invalid'),'');
});
