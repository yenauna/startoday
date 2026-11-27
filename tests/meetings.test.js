import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const stamp='2026-11-28T01:00:00Z';
function fixture(){const d=C.initialDB();d.students=[1,2,3,4].map(no=>({id:'s'+no,no,name:'학생'+no}));d.meeting_officers=[{id:'main',chairIds:['s1'],viceChairIds:['s2','s3']}];return d;}
const act=(d,s,a,p={},teacher=false,time=stamp)=>C.applyOps(d,C.meetingOps(d,s,a,p,teacher,time));
const propose=(d,id=C.uid(),teacher=false,extra={})=>act(d,teacher?null:'s4','propose',{id,title:'학급 약속',kind:'yesno',...extra},teacher);
test('학생 안건은 대기이며 회장 확인과 임원 과반 동의가 있어야 열린다',()=>{
 let d=propose(fixture()),id=d.meeting_topics[0].id;assert.equal(d.meeting_topics[0].status,'pending');assert.throws(()=>act(d,'s4','approve',{id,acknowledged:true}));assert.throws(()=>act(d,'s1','approve',{id}));
 d=act(d,'s1','approve',{id,acknowledged:true});assert.equal(d.meeting_topics[0].status,'pending');d=act(d,'s2','endorse',{id});assert.equal(d.meeting_topics[0].status,'open');assert.equal(d.meeting_topics[0].electorate.length,4);
});
test('검토 동의만으로는 회장 없이 열리지 않으며 논의 보류·삭제·임원 변경을 적용한다',()=>{
 let d=propose(fixture()),id=d.meeting_topics[0].id;d=act(d,'s2','endorse',{id});d=act(d,'s3','endorse',{id});assert.equal(d.meeting_topics[0].status,'pending');d=act(d,'s1','defer',{id});assert.equal(d.meeting_topics[0].approvals.length,0);d=act(d,null,'officers',{chairIds:['s1'],viceChairIds:['s2']},true);d=act(d,'s1','delete_topic',{id});assert.equal(C.meetingSnapshot(d,'s4').topics.length,0);
});
test('비밀투표는 진행 중 집계와 응답자를 숨기고 교사에게만 집계를 제공한다',()=>{
 let d=propose(fixture(),C.uid(),true,{openNow:true}),id=d.meeting_topics[0].id;d=act(d,'s1','vote',{id,choices:['yes']});const student=C.meetingSnapshot(d,'s4'),teacher=C.meetingSnapshot(d,null,true);assert(!('results'in student.topics[0]));assert(!JSON.stringify(student).includes('choices'));assert.equal(student.topics[0].participated,1);assert.equal(teacher.topics[0].results[0].count,1);assert.throws(()=>act(d,'s1','vote',{id,choices:['no']}));assert.throws(()=>act(d,'s2','vote',{id,choices:['yes','no']}));assert.throws(()=>act(d,'s2','vote',{id,choices:['abstain']}));
 for(const s of ['s2','s3','s4'])d=act(d,s,'vote',{id,choices:['no']});assert.equal(d.meeting_topics[0].status,'closed');assert.equal(C.meetingSnapshot(d,'s4').topics[0].results[1].count,3);
});
test('마감 시각과 교사 수동 마감은 결과를 공개하고 재투표를 막는다',()=>{
 let d=propose(fixture(),C.uid(),true,{openNow:true,closesAt:'2026-11-28T02:00:00Z'}),id=d.meeting_topics[0].id;assert.throws(()=>act(d,'s2','vote',{id,choices:['yes']},false,'2026-11-28T02:00:00Z'));d=C.applyOps(d,C.meetingAutoCloseOps(d,'2026-11-28T02:00:00Z'));assert.equal(C.meetingSnapshot(d,'s2').topics[0].results.length,2);
 d=propose(fixture(),C.uid(),true,{openNow:true});id=d.meeting_topics[0].id;assert.throws(()=>act(d,'s1','close',{id}));d=act(d,null,'close',{id},true);assert.equal(d.meeting_topics[0].status,'closed');
});
test('직접 선택지는 2개 이상 제한 없이 추가하고 복수 선택 상한을 강제한다',()=>{
 const options=Array.from({length:120},(_,i)=>({id:'o'+i,label:'선택지 '+i}));let d=propose(fixture(),C.uid(),true,{kind:'custom',options,maxChoices:2,openNow:true}),id=d.meeting_topics[0].id;d=act(d,'s1','vote',{id,choices:['o0','o119']});assert.throws(()=>act(d,'s2','vote',{id,choices:['o0','o1','o2']}));assert.throws(()=>act(d,'s2','vote',{id,choices:['o0','o0']}));assert.equal(C.meetingSnapshot(d,null,true).topics[0].results[119].count,1);
});
test('회의 성립은 3/4 경계를 정확히 계산하며 부회장·교사만 회의록을 저장한다',()=>{
 assert.deepEqual(C.meetingParticipation(4,1,0),{participants:3,rate:75,quorum:true});assert.equal(C.meetingParticipation(5,1,1).quorum,false);assert.equal(C.meetingParticipation(0,0,0).quorum,false);assert.throws(()=>C.meetingParticipation(4,3,2));
 let d=propose(fixture(),C.uid(),true,{openNow:true}),topic=d.meeting_topics[0].id;d=act(d,'s4','vote',{id:topic,choices:['yes']});const payload={id:C.uid(),date:'2026-11-28',moderators:['1. 학생1','직접 입력'],recorders:['2. 학생2'],total:4,absent:1,notAttending:0,content:'우리 반 약속을 논의함.',voteIds:[topic]};assert.throws(()=>act(d,'s1','minutes',payload));assert.throws(()=>act(d,'s4','minutes',payload));d=act(d,'s2','minutes',payload);assert.equal(C.meetingSnapshot(d,'s4').minutes[0].quorum,true);assert(!('results'in C.meetingSnapshot(d,'s4').minutes[0].voteCards[0]));assert.equal(C.meetingSnapshot(d,null,true).minutes[0].voteCards[0].results[0].count,1);assert.throws(()=>act(d,'s2','minutes',{...payload,version:0}));d=act(d,null,'close',{id:topic},true);assert.equal(C.meetingSnapshot(d,'s4').minutes[0].voteCards[0].results[0].count,1);
});
test('교사 원본의 학생 대리 화면에서도 진행 중 결과를 제거한다',()=>{
 const d=propose(fixture(),C.uid(),true,{openNow:true}),projection=C.meetingSnapshot(d,null,true);const result=C.meetingSnapshot({...d,meeting:{...projection,authoritative:true}},'s4');assert(!('results'in result.topics[0]));assert.equal(result.isTeacher,false);
});
test('마지막 수업 뒤 빈 교시는 접고 중간 빈 교시와 교시 연계 행사는 유지한다',()=>{
 const d=C.initialDB();d.timetables=[{id:'a',date:'2026-11-28',period:1},{id:'b',date:'2026-11-28',period:4}];assert.deepEqual(C.timetableVisiblePeriods(d,'2026-11-28'),[1,2,3,4]);assert.deepEqual(C.timetableVisiblePeriods(d,'2026-11-29'),[1]);assert.equal(C.timetableVisiblePeriods(d,'2026-11-28',true).length,6);d.events=[{id:'e',date:'2026-11-28',period:6,title:'행사'}];assert.equal(C.timetableVisiblePeriods(d,'2026-11-28').length,6);
});
test('선생님과 회장은 대기 안건의 선택지·복수 선택 개수를 확정하고 이전 검토를 초기화한다',()=>{
 let d=propose(fixture()),id=d.meeting_topics[0].id;d=act(d,'s2','endorse',{id});const p={id,kind:'custom',options:[{id:'a',label:'첫째'},{id:'b',label:'둘째'},{id:'c',label:'셋째'}],maxChoices:2};assert.throws(()=>act(d,'s4','configure_topic',p));d=act(d,'s1','configure_topic',p);assert.equal(d.meeting_topics[0].maxChoices,2);assert.equal(d.meeting_topics[0].approvals.length,0);
});
