import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
function fixture(){const d=C.initialDB();d.students=[{id:'s',name:'가온',no:1},{id:'other',name:'나래',no:2}];d.shop_items=[{id:C.uid(),name:'쿠폰',category:'혜택',price:1,stock:3}];return d;}
test('아바타 구매는 카탈로그 가격만 차감하며 중복·미보유·잘못된 아이템·잔액부족을 차단',()=>{
 let d=fixture();assert.throws(()=>C.avatarOps(d,'s','hair_1','buy'),/잔액/);d=C.applyOps(d,C.teacherBalanceAdjustOps(d,'s',100));
 const before=C.studentBalance(d,'s');d=C.applyOps(d,C.avatarOps(d,'s','hair_1','buy'));
 assert.equal(C.studentBalance(d,'s'),before-10);assert.deepEqual(C.avatarSnapshot(d.students[0]).owned,['hair_1']);assert.equal(d.economy_tx.at(-1).type,'아바타구매');
 assert.throws(()=>C.avatarOps(d,'s','hair_1','buy'),/이미/);assert.throws(()=>C.avatarOps(d,'other','hair_1','equip'),/보유/);assert.throws(()=>C.avatarOps(d,'s','bad','buy'));assert.throws(()=>C.avatarOps(d,'s','hair_1','refund'));
 d=C.applyOps(d,C.avatarOps(d,'s','hair_1','equip'));assert.equal(C.avatarSnapshot(d.students[0]).equipped['머리'],'hair_1');d=C.applyOps(d,C.avatarOps(d,'s','hair_1','equip'));assert.deepEqual(C.avatarSnapshot(d.students[0]).equipped,{});
 assert.doesNotThrow(()=>C.validateBackup({app:'startoday',version:1,data:d}));assert.deepEqual(C.avatarSnapshot(JSON.parse(JSON.stringify(d.students[0]))).owned,['hair_1']);
 d=C.applyOps(d,[{table:'students',id:'s',data:{id:'s',name:'가온 수정',no:1}}]);assert.deepEqual(C.avatarSnapshot(d.students[0]).owned,['hair_1']);
 for(const item of C.AVATAR_CATALOG)assert(existsSync(new URL('../'+item.image,import.meta.url)));
});
test('물품 사용은 원래 구입 시각을 유지하고 별도 현재시각 사용 거래를 1회 추가',()=>{
 let d=fixture();d=C.applyOps(d,C.teacherGiftOps(d,'s',d.shop_items[0].id));const gift=d.economy_tx.at(-1);gift.createdAt='2020-01-01T00:00:00Z';const balance=C.studentBalance(d,'s');
 d=C.applyOps(d,C.shopUseOps(d,'s',gift.id));const use=d.economy_tx.at(-1),old=d.economy_tx.find(t=>t.id===gift.id);
 assert.equal(old.createdAt,gift.createdAt);assert.equal(old.status,'사용완료');assert.equal(use.type,'사용');assert.equal(use.amount,0);assert.equal(use.originalTxId,gift.id);assert.equal(use.itemName,'쿠폰');assert.equal(use.itemCategory,'혜택');assert(Date.parse(use.createdAt)>Date.parse(old.createdAt));assert.equal(C.studentBalance(d,'s'),balance);assert.throws(()=>C.shopUseOps(d,'s',gift.id));assert.doesNotThrow(()=>C.validateBackup({app:'startoday',version:1,data:d}));
});
test('교사 거래내역은 4열이며 아이템명만 표시하고 지급·차감은 사유와 부호 금액 표시',()=>{
 const ctx={C,esc:C.esc,name:()=> '가온',document:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../js/tabs/economy.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''),ctx);
 const html=ctx.economyHistory([{type:'구매',itemName:'스티커',amount:-987},{type:'사용',itemName:'쿠폰',amount:0},{type:'지급',memo:'도움',amount:5},{type:'차감',memo:'',amount:-3}],true);
 assert.equal((html.match(/<th>/g)||[]).length,4);assert(html.includes('도움 (+5)'));assert(html.includes('>-3<'));assert(!html.includes('987'));assert(!html.includes('<th>상태</th>'));
});
