import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SELECTION_SPRINGS,stepSelectionSpring,selectionFrame,selectionSpring} from '../js/shared/selection-spring.js';

test('selection spring profiles preserve the requested physical constants',()=>{
  assert.deepEqual(SELECTION_SPRINGS,{pop:{k:520,c:16},soft:{k:260,c:24},settle:{k:280,c:22},fade:{k:420,c:32}});
});
test('all spring profiles settle at 30/60/120Hz without instability',()=>{
  for(const hz of [30,60,120])for(const profile of Object.values(SELECTION_SPRINGS)){
    const s={value:-120,velocity:0};
    for(let i=0;i<hz*3;i++)stepSelectionSpring(s,0,1/hz,profile);
    assert(Math.abs(s.value)<.001);assert(Math.abs(s.velocity)<.01);
  }
});
test('pop overshoots gently while reduced motion is critically damped and monotonic',()=>{
  for(const hz of [30,60,120]){
    const normal={value:.82,velocity:0},reduced={value:.82,velocity:0};
    let maximum=0,previous=.82;
    for(let i=0;i<hz*2;i++){
      stepSelectionSpring(normal,1,1/hz,SELECTION_SPRINGS.pop);
      stepSelectionSpring(reduced,1,1/hz,SELECTION_SPRINGS.pop,true);
      maximum=Math.max(maximum,normal.value);
      assert(reduced.value>=previous && reduced.value<=1);
      previous=reduced.value;
    }
    assert(maximum>1.02 && maximum<1.07);
    assert(Math.abs(reduced.value-1)<.0001);
  }
});
test('a delayed frame is bounded, and an interrupted spring can reverse and settle',()=>{
  const s={value:0,velocity:0};
  stepSelectionSpring(s,100,10,SELECTION_SPRINGS.soft);
  assert(Number.isFinite(s.value) && s.value<100);
  for(let i=0;i<180;i++)stepSelectionSpring(s,-20,1/60,SELECTION_SPRINGS.soft);
  assert(Math.abs(s.value+20)<.001);
});

test('nested motions share one rAF loop, stop at rest, and cancel immediately',()=>{
  const originalRaf=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
  const queue=new Map();let serial=0,completed=0;
  globalThis.requestAnimationFrame=fn=>{queue.set(++serial,fn);return serial;};
  globalThis.cancelAnimationFrame=id=>queue.delete(id);
  try{
    selectionFrame(()=>{
      selectionSpring({from:{x:0},to:{x:1},profile:'pop',update:()=>{},complete:()=>completed++});
      return false;
    });
    for(let i=1;i<400 && queue.size;i++){
      assert.equal(queue.size,1);
      const [id,fn]=queue.entries().next().value;queue.delete(id);fn(i*1000/60);
    }
    assert.equal(completed,1);assert.equal(queue.size,0);
    const motion=selectionSpring({from:{x:100},to:{x:0},update:()=>{}});
    assert.equal(queue.size,1);motion.cancel();assert.equal(queue.size,0);
  }finally{globalThis.requestAnimationFrame=originalRaf;globalThis.cancelAnimationFrame=originalCancel;}
});
