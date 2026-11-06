import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../js/store.js';
import {initialDB,uid} from '../js/core.js';
test('서버 저장 실패 시 화면 원본은 바꾸지 않음',async()=>{const s=new Store();s.db=initialDB();s.mode='cloud';s.classId='c';s.client={rpc:async()=>({error:{message:'network failure'}})};const row={id:uid(),name:'가상'};await assert.rejects(s.commit([{table:'students',id:row.id,data:row}]),/network failure/);assert.equal(s.db.students.length,0);assert.equal(s.busy,false)});
test('한 번의 원자적 호출에 모든 변경을 전달하고 revision 적용',async()=>{const s=new Store();s.db=initialDB();s.mode='cloud';s.classId='c';s.revision=5;let input;s.client={rpc:async(name,body)=>{input={name,body};return {data:6}}};const row={id:uid(),name:'가상'};await s.commit([{table:'students',id:row.id,data:row}]);assert.equal(input.name,'startoday_commit');assert.equal(input.body.p_revision,5);assert.equal(s.revision,6);assert.equal(s.db.students[0].name,'가상')});
test('충돌 발생 시 최신 데이터를 불러오고 저장은 중단',async()=>{const s=new Store();s.db=initialDB();s.mode='cloud';s.classId='c';let loaded=false;s.client={rpc:async()=>({error:{message:'REVISION_CONFLICT'}})};s.load=async()=>{loaded=true;s.db=initialDB()};await assert.rejects(s.commit([{table:'students',id:'x',data:{id:'x'}}]),/다른 기기/);assert.equal(loaded,true);assert.equal(s.db.students.length,0)});
