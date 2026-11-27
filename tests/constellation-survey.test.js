import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import {constellationHero} from '../js/components/constellation.js';
test('오늘 별자리는 당일 일반 과제와 루틴만 세고 면제·장기·기한초과는 제외',()=>{
 const date=C.today(),tasks=[{date,status:'완료'},{date,status:'늦게완료'},{date,status:'진행중'},{date,status:'면제'},{date,status:'완료',isQuest:true},{date:'2020-01-01',status:'완료'},{date,status:'진행중',overdue:true}];
 assert.deepEqual(C.studentTodayProgress({date,tasks,routines:[{status:'완료'},{status:'진행중'},{status:'면제'}]}),{done:3,total:5});
 assert.deepEqual(C.studentTodayProgress({date}),{done:0,total:0});
 const html=constellationHero('<내 별자리>',3,5,'개');assert.match(html,/class="constellation-cluster" data-stars="5" data-lit="3"/);assert.equal((html.match(/class="star-point is-lit"/g)||[]).length,3);assert.match(html,/&lt;내 별자리&gt;/);assert.match(constellationHero('별자리',10,2),/data-progress-done="2"/);
});
test('학생 보기 순서는 번호·별·관심·자리 방향을 안정적으로 공유하며 원본을 변경하지 않음',()=>{
 const d=C.initialDB(),date=C.today();d.students=[{id:'a',no:1,name:'가온',seat:{row:1,col:1}},{id:'b',no:2,name:'나래',seat:{row:2,col:1}},{id:'c',no:3,name:'다온'}];d.records=[{id:'p',date,studentIds:['b'],kind:'칭찬',areas:['학습']},{id:'a',date,studentIds:['c'],kind:'지도',areas:['생활']}];
 const ids=mode=>C.orderedClassStudents(d,d.students,mode,date).map(s=>s.id);
 assert.deepEqual(ids('number'),['a','b','c']);assert.deepEqual(ids('stars'),['b','a','c']);assert.deepEqual(ids('attention'),['c','a','b']);d.settings[0].frontTop=true;assert.deepEqual(ids('seats'),['a','b','c']);d.settings[0].frontTop=false;assert.deepEqual(ids('seats'),['b','a','c']);assert.deepEqual(d.students.map(s=>s.id),['a','b','c']);
});
test('관계망은 회차별 긍정·갈등 연결을 구분하고 원래 개인 응답 좌표를 보존',()=>{
 const d=C.initialDB();d.students=['a','b','c','d'].map((id,i)=>({id,no:i+1,name:id}));d.survey_responses=[{surveyId:'now',studentId:'a',placements:[{targetId:'b',x:90,y:80},{targetId:'c',x:70,y:20},{targetId:'d',x:10,y:80}]},{surveyId:'now',studentId:'b',placements:[{targetId:'a',x:80,y:80}]},{surveyId:'old',studentId:'d',placements:[{targetId:'c',x:100,y:100}]}];
 const graph=C.surveyGraph(d,'now','a');assert.equal(graph.links.length,2);assert.equal(graph.links.find(l=>l.b==='b').mutual,true);assert.equal(graph.links.find(l=>l.b==='c').mutual,false);assert.equal(graph.links.find(l=>l.b==='c').kind,'warning');assert.equal(graph.views.length,3);assert.equal(graph.placements[1].y,20);for(const n of graph.nodes){assert(n.x>=0&&n.x<=graph.width);assert(n.y>=0&&n.y<=graph.height);}assert.equal(C.surveyGraph(d,'now','d').placements.length,0);assert.equal(C.surveyGraph(d,'now','invalid').focus.id,'a');assert.equal(C.surveyGraph(C.initialDB(),'none').nodes.length,0);
});

test('주변 별빛은 실제 전체 완료일 때만 렌더링하고 반올림으로 100%가 되지 않음',()=>{
 assert.match(constellationHero('나',5,5,'개'),/constellation-sparkles/);assert.doesNotMatch(constellationHero('나',0,0,'개'),/constellation-sparkles/);assert.doesNotMatch(constellationHero('나',199,200,'개'),/constellation-sparkles/);assert.match(constellationHero('나',199,200,'개'),/99% 완료/);
});

test('학생 별자리는 오늘 할 일 개수만큼만 별과 선을 그리며 앞에서부터 켠다',()=>{
 const groups=markup=>[...markup.matchAll(/<g class="constellation-cluster" data-stars="(\d+)" data-lit="(\d+)"[^>]*>(.*?)<\/g>/gs)];
 const points=body=>[...body.matchAll(/<circle class="star-point[^"]*" cx="([\d.]+)" cy="([\d.]+)"/g)].map(match=>`${match[1]},${match[2]}`);
 const lines=body=>[...body.matchAll(/<path class="constellation-line( is-lit)?"/g)];
 // 할 일이 1개면 별 1개에 선 0개, 3개면 별 3개에 선 2개짜리 별자리 하나만 그린다.
 for(const [done,total,litLines] of [[0,1,0],[1,1,0],[1,2,0],[2,3,1],[3,7,2]]){
  const html=constellationHero('내 별자리',done,total,'개');
  const all=groups(html);
  assert.equal(all.length,1,`${done}/${total} 무리 수`);
  const [group]=all;
  assert.equal(Number(group[1]),total,`${done}/${total} 별 수`);
  assert.equal(Number(group[2]),done,`${done}/${total} 켜진 별`);
  assert.equal(points(group[3]).length,total);
  assert.equal(lines(group[3]).length,total ? total-1 : 0,`${done}/${total} 선 수`);
  assert.equal(lines(group[3]).filter(match=>match[1]).length,litLines,`${done}/${total} 켜진 선`);
  assert.equal((group[3].match(/class="star-point is-lit"/g)||[]).length,done);
  // 바탕 틀 없이 실제 별만 그린다(고정 16개 고리 없음).
  assert.doesNotMatch(html,/is-faint/);
 }
 // 오늘 할 일이 없으면 별자리를 아예 그리지 않는다.
 assert.doesNotMatch(constellationHero('내 별자리',0,0,'개'),/constellation-cluster|is-faint/);
 // 별 좌표는 할 일이 적은 날에도 많은 날의 앞쪽 좌표를 그대로 물려받고 서로 겹치지 않는다.
 const wide=points(groups(constellationHero('내 별자리',0,16,'개'))[0][3]);
 assert.equal(new Set(wide).size,16);
 for(const total of [1,3,5,8,12,16]) assert.deepEqual(points(groups(constellationHero('내 별자리',0,total,'개'))[0][3]),wide.slice(0,total),`${total}개`);
 // 준비된 16개보다 많으면 겹을 더 그려 개수를 정확히 맞춘다.
 const many=groups(constellationHero('내 별자리',20,20,'개'))[0];
 assert.equal(Number(many[1]),20);
 assert.equal(points(many[3]).length,20);
 assert.equal(new Set(points(many[3])).size,20);
 // 교사 화면은 학생 수만큼 별을 그리고 학생용 바탕 틀을 깔지 않는다.
 const teacher=groups(constellationHero('우리 반',3,22));
 assert.equal(teacher.length,1);
 assert.equal(Number(teacher[0][1]),22);
 assert.equal(Number(teacher[0][2]),3);
 assert.doesNotMatch(constellationHero('우리 반',3,22),/is-faint/);
 // 모두 마치면 반짝임은 그대로 붙는다.
 assert.match(constellationHero('내 별자리',3,3,'개'),/constellation-sparkles/);
});
