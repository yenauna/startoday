import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
function fixture(){const d=C.initialDB();d.students=[{id:'s',no:1,name:'가온'}];return d;}
test('포인트 기간 경계는 오늘 포함 7/14/30일·이번 달이며 거래는 기간과 무관하게 누적',()=>{
 const date='2027-01-03',d=fixture();
 for(let i=0;i<45;i++)d.records.push({id:'p'+i,date:C.addDays(date,-i),kind:'칭찬',studentIds:['s'],areas:['학습'],createdAt:C.now()});
 d.records.push({id:'advice',date,kind:'지도',studentIds:['s'],areas:['학습'],createdAt:C.now()},{id:'future',date:C.addDays(date,1),kind:'칭찬',studentIds:['s'],areas:['학습'],createdAt:C.now()});
 d.economy_tx=[{id:C.uid(),studentId:'s',type:'차감',amount:-15,createdAt:'2020-01-01T00:00:00Z'}];
 const stars=C.scores(d,'s','',date).total,titles=C.kingdomCounts(d,'s',date);
 for(const [period,n,start] of [['all',45,''],['7d',7,'2026-12-28'],['14d',14,'2026-12-21'],['30d',30,'2026-12-05'],['month',3,'2027-01-01']]){
  d.settings[0].pointPeriod=period;assert.equal(C.pointPeriodStart(d.settings[0],date),start);assert.equal(C.studentBalance(d,'s',date),(n-1)*10-15);assert.equal(C.scores(d,'s','',date).total,stars);assert.deepEqual(C.kingdomCounts(d,'s',date),titles);
 }
 delete d.settings[0].pointPeriod;assert.equal(C.studentBalance(d,'s',date),425);
 d.settings[0].pointPeriod='7d';d.attendance=[{id:'x',date,studentId:'s',excluded:true}];assert.equal(C.studentBalance(d,'s',date),45);
});
test('오전·오후 포매터는 서울 자정·정오·저녁과 시계 초 예외·수업 범위를 지원',()=>{
 assert.equal(C.formatTime('2026-11-14T15:00:00Z'),'오전 12:00');assert.equal(C.formatTime('2026-11-15T03:00:00Z'),'오후 12:00');assert.equal(C.formatTime('2026-11-15T13:00:12Z'),'오후 10:00');assert.equal(C.formatTime('2026-11-15T13:00:12Z',true),'오후 10:00:12');assert.equal(C.formatTimestamp('2026-11-15T13:00:12Z'),'26.11.15.(일) 오후 10:00');assert.equal(C.formatTimeRange('09:00–13:40'),'오전 9:00–오후 1:40');assert.equal(C.formatTime('invalid'),'');
});
