import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
const context={C,esc:C.esc};
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../js/tabs/records.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ',''),context);
const label=r=>context.recordCreatedTime(r).match(/>작성 (.*?)<\/time>/)?.[1];
test('작성 표시는 한국 날짜가 같으면 시간만, 다르면 작성 월·일까지 표시',()=>{
 const createdAt='2026-11-13T11:35:00.000Z';
 assert.equal(label({date:'2026-11-13',createdAt}),'20:35');
 assert.equal(label({date:'2026-11-10',createdAt}),'11.13. 20:35');
 assert.equal(label({date:'2025-11-13',createdAt}),'11.13. 20:35');
 const html=context.recordCreatedTime({date:'2026-11-10',createdAt});
 assert.ok(html.includes('title="최초 작성 '+C.formatTimestamp(createdAt)+'"'));
 assert.ok(html.includes('datetime="'+createdAt+'"'));
});
test('작성 날짜는 UTC 문자열 앞부분이 아니라 한국 자정·연도 경계를 기준으로 비교',()=>{
 assert.equal(label({date:'2026-11-13',createdAt:'2026-11-12T15:05:00Z'}),'00:05');
 assert.equal(label({date:'2026-11-12',createdAt:'2026-11-12T15:05:00Z'}),'11.13. 00:05');
 assert.equal(label({date:'2026-12-31',createdAt:'2026-12-31T15:05:00Z'}),'1.1. 00:05');
 assert.equal(label({date:'2027-01-01',createdAt:'2027-01-01T00:05:00+09:00'}),'00:05');
 for(const createdAt of ['',null,undefined,'invalid'])assert.equal(context.recordCreatedTime({date:'2026-11-13',createdAt}),'');
});
