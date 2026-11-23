import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import {constellationHero} from '../js/components/constellation.js';
test('오늘 별자리는 당일 일반 과제와 루틴만 세고 면제·장기·기한초과는 제외',()=>{
 const date=C.today(),tasks=[{date,status:'완료'},{date,status:'늦게완료'},{date,status:'진행중'},{date,status:'면제'},{date,status:'완료',isQuest:true},{date:'2020-01-01',status:'완료'},{date,status:'진행중',overdue:true}];
 assert.deepEqual(C.studentTodayProgress({date,tasks,routines:[{status:'완료'},{status:'진행중'},{status:'면제'}]}),{done:3,total:5});
 assert.deepEqual(C.studentTodayProgress({date}),{done:0,total:0});
 const html=constellationHero('<내 별자리>',3,5,'개');assert.equal((html.match(/class="constellation-lit"/g)||[]).length,3);assert.equal((html.match(/class="constellation-dim"/g)||[]).length,2);assert.match(html,/&lt;내 별자리&gt;/);assert.match(constellationHero('별자리',10,2),/data-progress-done="2"/);
});
test('학생 보기 순서는 번호·별·관심·자리 방향을 안정적으로 공유하며 원본을 변경하지 않음',()=>{
 const d=C.initialDB(),date=C.today();d.students=[{id:'a',no:1,name:'가온',seat:{row:1,col:1}},{id:'b',no:2,name:'나래',seat:{row:2,col:1}},{id:'c',no:3,name:'다온'}];d.records=[{id:'p',date,studentIds:['b'],kind:'칭찬',areas:['학습']},{id:'a',date,studentIds:['c'],kind:'지도',areas:['생활']}];
 const ids=mode=>C.orderedClassStudents(d,d.students,mode,date).map(s=>s.id);
 assert.deepEqual(ids('number'),['a','b','c']);assert.deepEqual(ids('stars'),['b','a','c']);assert.deepEqual(ids('attention'),['c','a','b']);d.settings[0].frontTop=true;assert.deepEqual(ids('seats'),['a','b','c']);d.settings[0].frontTop=false;assert.deepEqual(ids('seats'),['b','a','c']);assert.deepEqual(d.students.map(s=>s.id),['a','b','c']);
});
test('관계망은 회차별 상호/단방향 연결을 구분하고 개인 거리 반지름은 가까움에 반비례',()=>{
 const d=C.initialDB();d.students=['a','b','c','d'].map((id,i)=>({id,no:i+1,name:id}));d.survey_responses=[{surveyId:'now',studentId:'a',placements:[{targetId:'b',x:90,y:80},{targetId:'c',x:70,y:20},{targetId:'d',x:10,y:80}]},{surveyId:'now',studentId:'b',placements:[{targetId:'a',x:80,y:80}]},{surveyId:'old',studentId:'d',placements:[{targetId:'c',x:100,y:100}]}];
 const graph=C.surveyGraph(d,'now','a');assert.equal(graph.links.length,2);assert.equal(graph.links.find(l=>l.b==='b').mutual,true);assert.equal(graph.links.find(l=>l.b==='c').mutual,false);assert(graph.placements[0].radius<graph.placements[1].radius);assert(graph.placements[1].radius<graph.placements[2].radius);assert.equal(graph.placements[1].y,20);for(const n of graph.nodes){assert(n.x>=55&&n.x<=605);assert(n.y>=30&&n.y<=390);}assert.equal(C.surveyGraph(d,'now','d').placements.length,0);assert.equal(C.surveyGraph(d,'now','invalid').focus.id,'a');assert.equal(C.surveyGraph(C.initialDB(),'none').nodes.length,0);
});

test('주변 별빛은 실제 전체 완료일 때만 렌더링하고 반올림으로 100%가 되지 않음',()=>{
 assert.match(constellationHero('나',5,5,'개'),/constellation-sparkles/);assert.doesNotMatch(constellationHero('나',0,0,'개'),/constellation-sparkles/);assert.doesNotMatch(constellationHero('나',199,200,'개'),/constellation-sparkles/);assert.match(constellationHero('나',199,200,'개'),/99% 완료/);
});
