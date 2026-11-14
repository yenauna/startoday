import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('인사는 연타할 때 이전 타이머를 취소하고 리플로우·랜덤 문구와 900ms 타이머를 재시작',()=>{
 const source=readFileSync(new URL('../js/tabs/student-view.js',import.meta.url),'utf8'),pending=new Map(),calls=[];let id=0,reflows=0,random=0;
 const bubble={textContent:''},classes=new Set(),sceneClasses=new Set();const scene={classList:{add:c=>sceneClasses.add(c),remove:c=>sceneClasses.delete(c)}};
 const character={closest:()=>scene,classList:{add:c=>{classes.add(c);calls.push('add');},remove:c=>{classes.delete(c);calls.push('remove');}},querySelector:()=>bubble,get offsetWidth(){reflows++;calls.push('reflow');return 240;}};
 const ctx={Math:{random:()=>random,floor:Math.floor},WeakMap,clearTimeout:key=>pending.delete(key),setTimeout:(fn,ms)=>{assert.equal(ms,900);pending.set(++id,fn);return id;}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const STUDENT_GREETINGS'),source.indexOf('// Some browsers')),ctx);
 const event={target:{closest:()=>character}};
 for(const [value,label] of [[0,'👋 안녕!'],[.26,'✨ 반가워!'],[.51,'🌟 오늘도 화이팅!'],[.99,'😊 좋은 하루!']]){random=value;ctx.bounceStudentCharacter(event);assert.equal(bubble.textContent,label);assert.equal(pending.size,1);assert(classes.has('is-bouncing'));assert(sceneClasses.has('is-bouncing'));}
 assert.equal(reflows,4);assert.deepEqual(calls.slice(0,3),['remove','reflow','add']);
 [...pending.values()][0]();assert.equal(bubble.textContent,'');assert(!classes.has('is-bouncing'));assert(!sceneClasses.has('is-bouncing'));
 assert.doesNotThrow(()=>ctx.bounceStudentCharacter({target:{closest:()=>null}}));
});
