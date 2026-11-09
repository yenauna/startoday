import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../js/store.js';
import {initialDB,uid} from '../js/core.js';
test('서버 저장 실패 시 화면 원본은 바꾸지 않음',async()=>{const s=new Store();s.db=initialDB();s.mode='cloud';s.classId='c';s.client={rpc:async()=>({error:{message:'network failure'}})};const row={id:uid(),name:'가상'};await assert.rejects(s.commit([{table:'students',id:row.id,data:row}]),/network failure/);assert.equal(s.db.students.length,0);assert.equal(s.busy,false)});
test('한 번의 원자적 호출에 모든 변경을 전달하고 revision 적용',async()=>{const s=new Store();s.db=initialDB();s.mode='cloud';s.classId='c';s.revision=5;let input;s.client={rpc:async(name,body)=>{input={name,body};return {data:6}}};const row={id:uid(),name:'가상'};await s.commit([{table:'students',id:row.id,data:row}]);assert.equal(input.name,'startoday_commit');assert.equal(input.body.p_revision,5);assert.equal(s.revision,6);assert.equal(s.db.students[0].name,'가상')});
test('충돌 발생 시 최신 데이터를 불러오고 저장은 중단',async()=>{const s=new Store();s.db=initialDB();s.mode='cloud';s.classId='c';let loaded=false;s.client={rpc:async()=>({error:{message:'REVISION_CONFLICT'}})};s.load=async()=>{loaded=true;s.db=initialDB()};await assert.rejects(s.commit([{table:'students',id:'x',data:{id:'x'}}]),/다른 기기/);assert.equal(loaded,true);assert.equal(s.db.students.length,0)});
test('local 모드의 비밀번호 변경은 로컬 저장소에 보존되고 재로딩으로 유지',async()=>{
 const previous=globalThis.localStorage, saved=new Map();
 globalThis.localStorage={setItem:(key,value)=>saved.set(key,value),getItem:key=>saved.get(key)||null};
 try { const s=new Store();s.db=initialDB();s.mode='local';
 const row={id:'local-student',no:1,name:'가상학생',password:'별빛77',passwordChanged:true};
 await s.commit([{table:'students',id:row.id,data:row}]);
 const restored=JSON.parse(saved.get('startoday-demo-v1'));
 assert.equal(restored.students[0].password,'별빛77');assert.equal(restored.students[0].passwordChanged,true);
 } finally { if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous; }
});
