import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function fixture(reduced=false){
 const frames=new Map(),events=new Map(),docEvents=new Map();let serial=0,now=0,confirmed=0;
 const fill={style:{}},top={style:{}};
 const btn={style:{},offsetWidth:48,isConnected:true,disabled:false,querySelector:q=>q==='.fill'?fill:top,addEventListener:(type,fn)=>events.set(type,fn),setPointerCapture(){}};
 const context={console:{error(){}},window:{addEventListener(){}},document:{hidden:false,addEventListener:(type,fn)=>docEvents.set(type,fn)},matchMedia:()=>({matches:reduced}),performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.createContext(context);vm.runInContext(readFileSync(new URL('../js/shared/hold-delete.js',import.meta.url),'utf8').replace('export function','function'),context);
 context.attachHoldDelete(btn,()=>confirmed++);
 const emit=(type,props={})=>events.get(type)?.({button:0,isPrimary:true,pointerId:1,preventDefault(){},stopPropagation(){},...props});
 const advance=n=>{for(let i=0;i<n;i++){now+=1000/60;const pending=[...frames];frames.clear();pending.forEach(([,fn])=>fn(now));}};
 return {btn,fill,top,emit,advance,frames,confirmed:()=>confirmed};
}
test('short holds drain their progress and the rAF queue stops at rest',async()=>{
 for(const reduce of [false,true]){
  const f=fixture(reduce);f.emit('pointerdown');f.advance(25);assert(parseFloat(f.fill.style.width)>0);f.emit('pointerup');f.advance(400);
  assert.equal(f.confirmed(),0);assert.equal(f.frames.size,0);assert.equal(f.fill.style.width,'0px');assert.equal(f.btn.style.transform,'');
 }
});
test('a full 1.2s hold confirms once and leaves no permanent done-state animation',async()=>{
 const f=fixture();f.emit('pointerdown');f.advance(60);await Promise.resolve();assert.equal(f.confirmed(),0);
 f.advance(20);await Promise.resolve();assert.equal(f.confirmed(),1);assert.equal(f.frames.size,0);
 f.emit('pointerup');f.advance(100);await Promise.resolve();assert.equal(f.confirmed(),1);
});
test('keyboard release, blur, pointer cancellation and removed controls never confirm',async()=>{
 for(const cancel of ['pointercancel','lostpointercapture','blur']){
  const f=fixture();f.emit('pointerdown');f.advance(20);f.emit(cancel);f.advance(400);await Promise.resolve();assert.equal(f.confirmed(),0);assert.equal(f.frames.size,0);
 }
 const f=fixture();f.emit('keydown',{key:'Enter',repeat:false});f.advance(20);f.emit('keyup',{key:'Enter'});f.advance(400);assert.equal(f.frames.size,0);assert.equal(f.confirmed(),0);
 f.emit('pointerdown');f.advance(10);f.btn.isConnected=false;f.advance(1);assert.equal(f.frames.size,0);assert.equal(f.confirmed(),0);
});
