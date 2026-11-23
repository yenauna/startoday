import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import {constellationHero} from '../js/components/constellation.js';
import {snapshotNotifications,notificationStorageKey,unreadNotifications,acknowledgeNotification} from '../js/components/student-notifications.js';
test('화면 이름 모드는 실명·번호·가림·별명을 공유하고 원본 이름은 보존',()=>{
 const student={id:'s',no:1,name:'김가온',nickname:'반짝이'};
 assert.equal(C.screenStudentName(student,'real'),'1. 김가온');assert.equal(C.screenStudentName(student,'number'),'1번');assert.equal(C.screenStudentName(student,'masked'),'1. 김●온');assert.equal(C.screenStudentName(student,'alias'),'반짝이');assert.equal(C.screenStudentName({...student,nickname:''},'alias'),'별1');assert.equal(student.name,'김가온');
});
test('통합 별자리의 교사는 완료 인원만, 학생은 백분율·빈 상태·완료 효과를 표시',()=>{
 assert.match(constellationHero('반',2,19),/>2명 완료</);assert.doesNotMatch(constellationHero('반',2,19),/19명|하나씩 빛나요/);
 assert.match(constellationHero('나',3,5,'개'),/60% 완료/);assert.match(constellationHero('나',0,0,'개'),/오늘 등록된 과제가 없어요/);assert.doesNotMatch(constellationHero('나',0,0,'개'),/0% 완료|is-all-complete/);assert.match(constellationHero('나',3,3,'개'),/is-all-complete/);
});
function snapshot(){return {student:{id:'s',rewardTitles:[{id:'quest:q',name:'리코더 달인'}]},date:'2026-11-23',titleCounts:{learning:15},tasks:[{id:'today',date:'2026-11-23',title:'새 과제',status:'완료'},{id:'ongoing',date:'2026-11-20',title:'진행 과제',status:'진행중'},{id:'done',date:'2026-11-20',title:'지난 과제',status:'완료'},{id:'exempt',date:'2026-11-23',title:'면제',status:'면제'}],economy:{transactions:[{id:'pay',type:'지급',amount:10},{id:'gift',type:'선물',itemName:'면제권'},{id:'buy',type:'구매',itemName:'면제권'},{id:'negative',type:'지급',amount:-1},{id:'use',type:'사용',itemName:'면제권'}]}};}
test('기존 학생 snapshot에서 당일/진행 과제·해금/보상 칭호·교사 지급만 알림 생성',()=>{
 const notices=snapshotNotifications(snapshot());assert.deepEqual(notices.map(n=>n.id),['task:today:2026-11-23','task:ongoing:2026-11-20','title:learning:1','title:quest:q','economy:pay','economy:gift']);assert.deepEqual(snapshotNotifications({}),[]);assert.doesNotMatch(JSON.stringify(notices),/resident/);
});
test('확인 ID는 학급·학생별로 저장되고 재조회 및 망가진/차단된 저장소에서도 동작',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},s=snapshot(),a=notificationStorageKey('local','class','s'),b=notificationStorageKey('local','class','other'),c=notificationStorageKey('local','other','s');
 const before=unreadNotifications(s,a,storage).length;acknowledgeNotification(a,'economy:pay',storage);assert.equal(unreadNotifications(s,a,storage).length,before-1);assert(values.get(a).includes('economy:pay'));assert.equal(unreadNotifications(s,b,storage).length,before);assert.equal(unreadNotifications(s,c,storage).length,before);values.set(b,'{broken');assert.equal(unreadNotifications(s,b,storage).length,before);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};acknowledgeNotification(c,'economy:gift',blocked);assert.equal(unreadNotifications(s,c,blocked).length,before-1);
});
