import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const p=(x,y,extra={})=>({x,y,...extra});
test('양방향 시선은 실제 유클리드 거리 한 칸 이하에서만 합침 (사분면 경계 무관)',()=>{
 const at=C.surveyPerspective(p(0,0),p(C.SURVEY_VIEW_CELL,0));assert.equal(at.split,false);assert.equal(at.distance,100/6);
 assert.equal(C.surveyPerspective(p(0,0),p(100/6+.001,0)).split,true);
 assert.equal(C.surveyPerspective(p(49.9,50.1),p(50.1,49.9)).split,false);
 assert.equal(C.surveyPerspective(p(55,55),p(95,95)).split,true);
 assert.equal(C.surveyPerspective(p(0,0),p(10,10)).distance,Math.hypot(10,10));
 for(const [a,b] of [[null,p(80,80)],[p(80,80),null],[null,null]])assert.deepEqual(C.surveyPerspective(a,b),{sent:a,received:b,distance:null,split:false});
});
test('관계선은 불편 우선·상호 가까움·한쪽 가까움을 구분하고 미응답을 거절로 해석하지 않음',()=>{
 assert.equal(C.surveyEdgeKind(p(65,50),p(80,90)),'positive');
 assert.equal(C.surveyEdgeKind(p(90,90),p(10,80)),'asymmetric');
 assert.equal(C.surveyEdgeKind(p(90,90),null),'asymmetric');
 assert.equal(C.surveyEdgeKind(p(90,90),p(10,39)),'warning');
 assert.equal(C.surveyEdgeKind(p(80,45),p(90,80)),'warning');
 assert.equal(C.surveyEdgeKind(null,null),null);assert.equal(C.surveyEdgeKind(p(10,80),null),null);
});
test('전체 관계망은 두 상호 연결 무리와 연결 적은 학생을 분리하며 입력을 변경하지 않음',()=>{
 const d=C.initialDB();d.students='abcdefghi'.split('').map((id,i)=>({id,no:i+1,name:id}));
 const responses=new Map(d.students.map(s=>[s.id,{surveyId:'now',studentId:s.id,placements:[]}]));
 const add=(a,b,x=85,y=85)=>responses.get(a).placements.push({targetId:b,x,y});
 for(const group of ['abc','def'])for(const a of group)for(const b of group)if(a!==b)add(a,b);
 add('g','h');add('h','g');add('i','a',80,20);
 d.survey_responses=[...responses.values(),{surveyId:'old',studentId:'i',placements:[{targetId:'g',x:90,y:90}]}];const before=JSON.stringify(d),graph=C.surveyGraph(d,'now','a');
 assert.equal(graph.groups.filter(g=>g.clustered).length,2);assert.deepEqual(graph.groups.map(g=>g.label),['무리 A','무리 B']);
 assert.deepEqual(graph.nodes.filter(n=>n.sparse).map(n=>n.id),['g','h','i']);assert.equal(graph.links.filter(l=>l.kind==='positive').length,7);
 assert.equal(new Set(graph.nodes.map(n=>n.id)).size,9);assert.equal(JSON.stringify(d),before);
 for(const n of graph.nodes){assert(Number.isFinite(n.x)&&Number.isFinite(n.y));assert(n.x>0&&n.x<graph.width&&n.y>0&&n.y<graph.height);}
 assert.equal(graph.views.find(v=>v.targetId==='i').sent,null);assert.equal(graph.views.find(v=>v.targetId==='i').received.y,20);
});
test('연결 중심 학생은 주변 학생의 연결이 적어도 챙김 필요 구역에 잘못 들어가지 않음',()=>{
 const d=C.initialDB();d.students='abcd'.split('').map((id,i)=>({id,no:i+1,name:id}));d.survey_responses=d.students.map(s=>({surveyId:'s',studentId:s.id,placements:s.id==='a'?'bcd'.split('').map(targetId=>({targetId,x:90,y:90})):[{targetId:'a',x:90,y:90}]}));
 const g=C.surveyGraph(d,'s','a');assert.equal(g.nodes[0].sparse,undefined);assert.equal(g.nodes[0].positiveDegree,3);assert.equal(g.groups[0].clustered,false);assert.equal(g.nodes.filter(n=>n.sparse).length,3);
});
test('과거 응답·잘못된 좌표는 제외하고 이전 태그 없는 응답과 양방향 이유를 그대로 보존',()=>{
 const d=C.initialDB();d.students=[{id:'a',name:'가온',no:1},{id:'b',name:'나래',no:2},{id:'c',name:'다온',no:3}];
 d.survey_responses=[{surveyId:'s',studentId:'a',placements:[{targetId:'b',x:70,y:80,reason:'함께 놀기'},{targetId:'c',x:101,y:50}]},{surveyId:'s',studentId:'b',placements:[{targetId:'a',x:10,y:20,tags:['아직 어색함'],reason:'대화를 못 함'}]},{surveyId:'old',studentId:'c',placements:[{targetId:'a',x:80,y:90}]}];
 const g=C.surveyGraph(d,'s','a');assert.equal(g.views.length,1);assert.equal(g.views[0].split,true);assert.equal(g.views[0].sent.reason,'함께 놀기');assert.deepEqual(g.views[0].received.tags,['아직 어색함']);assert.equal(g.links[0].kind,'warning');
});
