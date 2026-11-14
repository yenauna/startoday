import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
const load=(file,context)=>{vm.createContext(context);vm.runInContext(readFileSync(new URL('../js/tabs/'+file+'.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''),context);return context;};
test('날짜·짧은 날짜·전체 시각은 연도2자리·0패딩·요일을 유지하고 한국 자정을 적용',()=>{
 for(const [date,label] of [['2026-03-01','26.03.01.(일)'],['2027-02-01','27.02.01.(월)'],['2026-11-03','26.11.03.(화)']]){
  assert.equal(C.formatDate(date),label);assert.equal(C.formatShortDate(date),label);assert.equal(C.formatShortDate(date,false),label);
 }
 assert.equal(C.formatDate('2026-02-30'),'');assert.equal(C.formatTimestamp('2026-12-31T15:05:00Z'),'27.01.01.(금) 00:05');
});
test('학생 달력은 모든 날짜의 메모1만 투영하고 오늘의 일정은 실제 오늘에만 메모1·2 공개',()=>{
 const d=C.initialDB();d.students=[{id:'s',no:1,name:'가온'}];const days=[-1,0,1].map(n=>C.addDays(C.today(),n));
 d.timetables=days.map((date,i)=>({id:'slot'+i,date,period:1,subjectCode:'국어',publicMemo:'공개'+i,privateMemo:'당일'+i,teacherMemo:'TEACHER_SECRET'+i,memo:'옛 메모'}));
 d.timetables.push({id:'legacy',date:days[2],period:2,subjectCode:'수학',memo:'레거시 공개',teacherMemo:'LEGACY_SECRET'});
 const ctx=load('student-view',{C,document:{addEventListener(){}},esc:C.esc});
 for(const date of days){
  const data=ctx.studentSnapshot(d,d.students[0],date),calendar=JSON.stringify(data.calendar);
  assert(!calendar.includes('당일'));assert(!JSON.stringify(data).includes('SECRET'));
  assert.equal(data.timetable[0].publicMemo,date===C.today()?'공개1':'');assert.equal(data.timetable[0].privateMemo,date===C.today()?'당일1':'');
  assert(ctx.studentCalendarItems(data.calendar,date).some(item=>item.kind==='lesson'&&item.description===d.timetables.find(t=>t.date===date).publicMemo));
 }
 assert.equal(ctx.studentCalendarItems(C.studentCalendarData(d,'s'),days[2]).length,2);
 assert.equal(C.studentCalendarData(d,'s').timetables.at(-1).publicMemo,'레거시 공개');
});
test('교사 시간표·달력은 3종 메모, 교실화면은 당일 메모1·2만 표시',()=>{
 const d=C.initialDB();const days=[C.today(),C.addDays(C.today(),1)];d.timetables=days.map((date,i)=>({id:'t'+i,date,period:1,subjectCode:'국어',publicMemo:'PUBLIC',privateMemo:'TODAY_ONLY',teacherMemo:'TEACHER_ONLY'}));
 const ctx=load('timetable',{C,db:()=>d,settings:()=>d.settings[0],state:{calendarFilters:{detail:true,events:true}},esc:C.esc,btn:label=>label,document:{addEventListener(){}}});
 for(const date of days)for(const calendar of [false,true]){
  const teacher=ctx.timeSlots(date,calendar,true);for(const memo of ['PUBLIC','TODAY_ONLY','TEACHER_ONLY'])assert(teacher.includes(memo));
  const classroom=ctx.timeSlots(date,calendar,true,'classroom');assert(classroom.includes('PUBLIC'));assert(!classroom.includes('TEACHER_ONLY'));assert.equal(classroom.includes('TODAY_ONLY'),date===C.today());
 }
});
