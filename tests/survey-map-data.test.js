import {test} from 'node:test';
import assert from 'node:assert/strict';
import {surveyNameBox,surveyPointTone,surveyQuadrantPosition,surveyRelationship,surveyLabelPositions} from '../js/components/survey-map-data.js';
test('이름표는 글자 폭에 맞게 축소하며 긴 이름은 안전하게 요약',()=>{
 assert.equal(surveyNameBox('가온').width,22);assert.equal(surveyNameBox('김가온').width,31);assert(surveyNameBox('김가온').width<84);assert.equal(surveyNameBox('김가온').height,15);assert(surveyNameBox('Alexander').width>surveyNameBox('A').width);assert(surveyNameBox('아주아주긴우리반친구이름입니다').text.endsWith('…'));assert.equal(surveyNameBox('김가온').fontSize,9);assert.equal(surveyNameBox('김가온',false).width,38);
});
test('개인 사분면은 원래 x와 y를 그대로 매핑하고 y축만 화면 방향으로 뒤집음',()=>{
 assert.deepEqual(surveyQuadrantPosition({x:0,y:0}),{x:52,y:368});assert.deepEqual(surveyQuadrantPosition({x:100,y:100}),{x:368,y:52});assert.deepEqual(surveyQuadrantPosition({x:50,y:50}),{x:210,y:210});
});
test('편안함·불편함 강도에 따라 농도가 달라지고 모든 값의 텍스트 대비가 4.5 이상',()=>{
 for(let y=0;y<=100;y++)assert(surveyPointTone(y).contrast>=4.5,`${y}: ${surveyPointTone(y).contrast}`);
 assert.notEqual(surveyPointTone(51).background,surveyPointTone(100).background);assert.notEqual(surveyPointTone(49).background,surveyPointTone(0).background);assert.equal(surveyPointTone(100).strength,1);assert.equal(surveyPointTone(0).strength,1);assert.equal(surveyPointTone(50).strength,0);
});
test('양방향 데이터가 있어야 관계 신호를 판정하고 미응답을 부정 신호로 취급하지 않음',()=>{
 const near={x:90,y:90},far={x:10,y:60},uncomfortable={x:80,y:10};assert.equal(surveyRelationship(near,near),'상호 친밀');assert.equal(surveyRelationship(near,far),'일방적 호감');assert.equal(surveyRelationship(near,uncomfortable),'갈등·불편 주의');assert.equal(surveyRelationship(near,null),'상대방 미응답');assert.equal(surveyRelationship(far,far),'쌍방 응답');
});

test('밀집 이름표는 점의 실제 위치를 보존하며 서로·응답 점과 겹치지 않고 보드 안에 배치',()=>{
 const points=Array.from({length:20},()=>({name:'김가온',x:80,y:75})),labels=surveyLabelPositions(points);
 for(const [i,label] of labels.entries()){
  assert.deepEqual(label.position,surveyQuadrantPosition(points[i]));
  assert(label.x-label.box.width/2>=52&&label.x+label.box.width/2<=368);
  assert(label.y-label.box.height/2>=52&&label.y+label.box.height/2<=368);
  assert(Math.abs(label.x-label.position.x)>label.box.width/2+3.6||Math.abs(label.y-label.position.y)>label.box.height/2+3.6);
  for(const other of labels.slice(0,i))assert(Math.abs(label.x-other.x)>=(label.box.width+other.box.width)/2||Math.abs(label.y-other.y)>=(label.box.height+other.box.height)/2);
 }
 assert.equal(new Set(labels.map(label=>`${label.x}:${label.y}`)).size,20);
});
