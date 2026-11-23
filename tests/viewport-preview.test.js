import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {previewViewportContent} from '../js/components/viewport-preview.js';
test('PC 점검은 실제 layout viewport 폭을 지정하고 복귀 시 원래 viewport 옵션을 보존',()=>{
 assert.equal(previewViewportContent(true),'width=1280');assert.equal(previewViewportContent(false),'width=device-width,initial-scale=1');assert.equal(previewViewportContent(false,'width=device-width,initial-scale=1.0,viewport-fit=cover'),'width=device-width,initial-scale=1.0,viewport-fit=cover');
});
test('PC 점검 선호는 세션에 유지하되 학생/로그인 화면에서는 원래 폭으로 복귀',()=>{
 let content='width=device-width,initial-scale=1.0',active=false;const values=new Map();
 const context={document:{querySelector:()=>({getAttribute:()=>content,setAttribute:(_,v)=>content=v}),documentElement:{classList:{toggle:(_,v)=>active=v}}},sessionStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}};
 vm.createContext(context);vm.runInContext(readFileSync(new URL('../js/components/viewport-preview.js',import.meta.url),'utf8').replaceAll('export ',''),context);
 context.syncViewportPreview(true);context.togglePcPreview();assert.equal(content,'width=1280');assert.equal(active,true);assert.equal(values.get('startoday-pc-preview'),'true');context.syncViewportPreview(false);assert.equal(content,'width=device-width,initial-scale=1.0');assert.equal(active,false);context.syncViewportPreview(true);assert.equal(content,'width=1280');context.togglePcPreview();assert.equal(content,'width=device-width,initial-scale=1.0');assert.equal(values.get('startoday-pc-preview'),'false');
});
