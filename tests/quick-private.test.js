import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import {constellationHero} from '../js/components/constellation.js';
test('빠른 기록 비공개는 기존 추가 메모와 호환되며 칭찬·지도 종류를 보존',()=>{
 assert.deepEqual(C.quickRecordOptions('관찰',true),{kind:'추가기록',extraType:'메모',printIncluded:false});
 for(const kind of ['칭찬','지도'])assert.deepEqual(C.quickRecordOptions(kind,true),{kind,extraType:null,printIncluded:false});
 for(const kind of ['칭찬','관찰','지도'])assert.deepEqual(C.quickRecordOptions(kind),{kind,extraType:null,printIncluded:true});
 assert.equal(C.quickRecordOptions('추가기록').printIncluded,false);
});
test('보고서는 종류에 관계없이 비공개를 제외하고 과거 추가기록은 명시적으로 인쇄 포함된 경우만 제공',()=>{
 const d=C.initialDB(),date=C.today(),base={date,studentIds:['s'],createdAt:C.now()};d.records=[
  {id:'p',kind:'칭찬'},{id:'a',kind:'지도'},{id:'o',kind:'관찰'},
  ...['칭찬','지도','관찰','추가기록'].map((kind,i)=>({id:'private'+i,kind,printIncluded:false})),
  {id:'legacy',kind:'추가기록'},{id:'public-extra',kind:'추가기록',printIncluded:true},
  {id:'other',kind:'칭찬',studentIds:['other']},{id:'outside',kind:'칭찬',date:'2001-01-01'}
 ].map(r=>({...base,...r}));
 assert.deepEqual(C.reportRecords(d,'s',date,date).map(r=>r.id),['p','a','o','public-extra']);
});
test('학생 0% 별자리에만 가독성 보정 상태를 부여하며 완료·과제 없음 상태는 보존',()=>{
 assert.match(constellationHero('나',0,3,'개'),/is-zero-progress/);
 assert.doesNotMatch(constellationHero('나',0,0,'개'),/is-zero-progress/);
 assert.doesNotMatch(constellationHero('나',1,3,'개'),/is-zero-progress/);
 assert.doesNotMatch(constellationHero('학급',0,3,'명'),/is-zero-progress/);
 assert.match(constellationHero('나',3,3,'개'),/is-all-complete/);
});
