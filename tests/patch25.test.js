import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as C from '../js/core.js';

test('기록 저장은 최초 시각을 보존하고 빈 시각을 보정',()=>{
 let db=C.initialDB();const stamp='2026-11-13T05:32:00.000Z';
 const row={id:'record',createdAt:stamp};
 db=C.applyOps(db,[{table:'records',id:'record',data:row}]);
 for(const value of ['',null,undefined,'2030-01-01T00:00Z']){
  db=C.applyOps(db,[{table:'records',id:'record',data:{...row,createdAt:value}}]);
  assert.equal(db.records[0].createdAt,stamp);
 }
 db=C.applyOps(db,[{table:'records',id:'new',data:{id:'new',createdAt:''}}]);
 assert.ok(Number.isFinite(Date.parse(db.records[1].createdAt)));
 const context={C,state:{date:C.today()},esc:C.esc,name:()=> '가온',badge:()=>'',btn:()=>'',localTime:C.formatTimestamp};
 vm.createContext(context);
 vm.runInContext(readFileSync(new URL('../js/tabs/records.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ',''),context);
 assert.ok(context.newRecord({createdAt:''}).createdAt);
 assert.equal(context.newRecord({createdAt:stamp}).createdAt,stamp);
 const html=context.recordCard({id:'record',date:'2026-11-13',studentIds:['one'],areas:[],kind:'칭찬',text:'잘했어요',createdAt:stamp},false);
 assert.ok(html.includes('작성 26.11.13.(금) 14:32'));assert.ok(html.includes('datetime="'+stamp+'"'));
});
test('장기과제 달력 데이터 분리 및 recent3 범위는 기간 제한 없이 3개',()=>{
 const db=C.initialDB();db.students=[{id:'one',name:'가온'}];
 db.assignments=[{id:'normal',date:C.today(),repeat:{type:'none'},target:'all'},{id:'long',date:C.today(),repeat:{type:'none'},isQuest:true,questGoal:10,target:'all'}];
 assert.deepEqual(C.studentCalendarData(db,'one').assignments.map(a=>a.id),['normal']);
 assert.deepEqual(C.studentPraiseRange({studentPraisePeriod:'recent3'}),{limit:3,from:'',to:C.today()});
});
