import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const stamp='2026-11-27T01:00:00.000Z';
function fixture(){const d=C.initialDB();d.students=[{id:'s',no:1,name:'가온'},{id:'other',no:2,name:'나래'}];d.settings[0].pointMode='salary';d.records=[];d.economy_tx=[{id:C.uid(),studentId:'s',type:'지급',amount:1000,createdAt:stamp}];d.stock_quotes=[{id:'005930.KS',symbol:'005930.KS',name:'삼성전자',priceKrw:70000,updatedAt:stamp}];return d;}
const apply=(d,action,payload,time=stamp)=>C.applyOps(d,C.financeOrderOps(d,'s',action,{requestId:C.uid(),...payload},time));
test('별 구간별 2주 단리, 홀수 기간 거부, 기존 가입 이율 고정과 만기 1회 지급',()=>{
 let d=fixture();d.records=Array.from({length:10},(_,i)=>({id:'p'+i,studentIds:['s'],kind:'칭찬',areas:['생활'],date:'2026-11-26',text:'칭찬'}));
 assert.equal(C.bankPreview(d,'s',100,4).ratePercent,3);assert.equal(C.bankPreview(d,'s',100,4).interest,6);assert.throws(()=>C.bankPreview(d,'s',100,3));
 d=apply(d,'deposit',{principal:100,weeks:4});assert.equal(C.studentBalance(d,'s'),900);assert.equal(d.bank_deposits[0].interest,6);
 d.settings[0].bankConfig={tiers:[{minStars:0,ratePercent:50}]};let ops=C.financeSettleOps(d,'2026-12-25T01:00:00.000Z');d=C.applyOps(d,ops);assert.equal(C.studentBalance(d,'s'),1006);assert.equal(d.bank_deposits[0].paidInterest,6);assert.equal(C.financeSettleOps(d,'2027-01-01T00:00:00Z').length,0);
});
test('예금 이자는 내림하고 잔액 부족·소수 원금·잘못된 설정을 거부한다',()=>{
 const d=fixture();assert.equal(C.bankPreview(d,'s',11,2).interest,0);for(const principal of [0,1.5,1001])assert.throws(()=>apply(d,'deposit',{principal,weeks:2}));
 for(const patch of [{bankConfig:{tiers:[]}},{bankConfig:{tiers:[{minStars:2,ratePercent:3}]}},{stockConfig:{krwPerPoint:0}},{stockConfig:{settlementMinutes:1.5}},{stockConfig:{open:'15:00',close:'09:00'}}])assert.throws(()=>C.financeConfig(patch));
 assert.equal(C.financeConfig({bankConfig:{tiers:[{minStars:0,ratePercent:.29}]}}).bank.tiers[0].ratePercent,.29);
});
test('시장가 매수는 4자리 내림·대금 올림 후 80분 뒤에만 주식이 입고된다',()=>{
 let d=fixture(),requestId=C.uid();d=apply(d,'buy',{amountPoints:100,symbol:'005930.KS',requestId});const o=d.stock_orders[0];assert.equal(o.shares,.1428);assert.equal(o.amountPoints,100);assert.equal(C.studentBalance(d,'s'),900);assert.equal(d.stock_holdings.length,0);assert.equal(Date.parse(o.settleAt)-Date.parse(stamp),80*60000);
 assert.deepEqual(C.financeOrderOps(d,'s','buy',{amountPoints:100,symbol:'005930.KS',requestId},stamp),[]);
 assert.equal(C.financeSettleOps(d,'2026-11-27T02:19:59Z').length,0);d=C.applyOps(d,C.financeSettleOps(d,'2026-11-27T02:20:00Z'));assert.equal(d.stock_holdings[0].shares,.1428);assert.equal(C.studentBalance(d,'s'),900);assert.equal(d.economy_tx.filter(t=>t.type==='주식정산').length,1);assert.equal(C.financeSettleOps(d,'2026-11-27T02:21:00Z').length,0);
});
test('매도는 수량을 즉시 차감하고 내린 정수 포인트를 정산 후에만 지급한다',()=>{
 let d=fixture();d.settings[0].stockConfig={settlementMinutes:0};d=apply(d,'buy',{amountPoints:100,symbol:'005930.KS'});assert.equal(d.stock_holdings[0].shares,.1428);
 d.settings[0].stockConfig={settlementMinutes:80};d=apply(d,'sell',{shares:.1,symbol:'005930.KS'});assert.equal(d.stock_holdings[0].shares,.0428);assert.equal(C.studentBalance(d,'s'),900);assert.equal(d.stock_orders.at(-1).amountPoints,70);assert.throws(()=>apply(d,'sell',{shares:.1,symbol:'005930.KS'}));assert.throws(()=>apply(d,'sell',{shares:.00001,symbol:'005930.KS'}));
 d=C.applyOps(d,C.financeSettleOps(d,'2026-11-27T02:20:00Z'));assert.equal(C.studentBalance(d,'s'),970);
});
test('KST 평일 시간과 오래된 시세 검증은 화면과 무관하게 주문에서 강제된다',()=>{
 const d=fixture(),s=C.financeConfig().stock;
 assert(C.marketOpen(s,'2026-11-27T00:00:00Z'));assert(C.marketOpen(s,'2026-11-27T05:30:59Z'));assert(!C.marketOpen(s,'2026-11-27T05:31:00Z'));assert(!C.marketOpen(s,'2026-11-28T01:00:00Z'));
 assert.throws(()=>apply(d,'buy',{amountPoints:10,symbol:'005930.KS'},'2026-11-27T06:00:00Z'),/거래 가능 시간/);assert.throws(()=>apply(d,'buy',{amountPoints:10,symbol:'005930.KS'},'2026-11-27T01:31:00Z'),/시세/);assert.throws(()=>apply(d,'buy',{amountPoints:1001,symbol:'005930.KS'}),/잔액/);assert.throws(()=>apply(d,'buy',{amountPoints:10,symbol:'../bad'}),/종목/);
});
test('미정산 주문은 이후 환산비율·가격·대기 시간 변경의 영향을 받지 않는다',()=>{
 let d=apply(fixture(),'buy',{amountPoints:100,symbol:'005930.KS'});d.settings[0].stockConfig={krwPerPoint:1000,settlementMinutes:0};d.stock_quotes[0].priceKrw=90000;d=C.applyOps(d,C.financeSettleOps(d,'2026-11-27T02:20:00Z'));assert.equal(d.stock_holdings[0].shares,.1428);assert.equal(d.stock_holdings[0].avgPriceKrw,70000);assert.equal(d.stock_orders[0].krwPerPoint,100);
 assert.equal(C.financeSnapshot(d,'other').orders.length,0);assert.equal(C.financeSnapshot(d,'other').deposits.length,0);
});
test('새 금융 거래도 정수 금액 검증을 따르고 구형 백업은 빈 금융 상태로 열린다',()=>{
 const d=fixture(),backup=()=>({app:'startoday',version:1,data:structuredClone(d)});let b=backup();for(const key of C.FINANCE_TABLES)delete b.data[key];assert.doesNotThrow(()=>C.validateBackup(b));
 b=backup();b.data.economy_tx.push({id:C.uid(),studentId:'s',type:'주식매수',amount:-1.5,createdAt:stamp});assert.throws(()=>C.validateBackup(b),/경제 거래/);
 b=backup();b.data.stock_orders=[{id:C.uid(),studentId:'s',symbol:'005930.KS',side:'buy',shares:.12345,priceKrw:70000,amountPoints:87,krwPerPoint:100,createdAt:stamp,settleAt:stamp,status:'pending'}];assert.throws(()=>C.validateBackup(b),/주식 주문/);
});
test('같은 주문 ID로 금액을 바꾸면 재사용할 수 없고 환율 반올림으로 차익을 만들 수 없다',()=>{
 const id=C.uid();let d=apply(fixture(),'buy',{amountPoints:100,symbol:'005930.KS',requestId:id});assert.throws(()=>C.financeOrderOps(d,'s','buy',{amountPoints:101,symbol:'005930.KS',requestId:id},stamp),/중복/);
 const cfg=C.financeConfig().stock,q={priceKrw:77777.7};for(const amount of [1,5,100,999]){const bought=C.stockCalculation('buy',q,cfg,amount);try{assert(C.stockCalculation('sell',q,cfg,bought.shares).amountPoints<=bought.amountPoints);}catch(error){assert.match(error.message,/주문 가능/);}}
});
test('금융 원장은 월급·상점 구매·선물·환불과 섞이지 않고 잔액만 공유한다',()=>{
 let d=fixture();d.shop_items=[{id:C.uid(),name:'쿠폰',category:'기타',price:50,stock:3}];const item=d.shop_items[0].id;
 d=apply(d,'buy',{amountPoints:100,symbol:'005930.KS'});d=C.applyOps(d,C.shopBuyOps(d,'s',item));d=C.applyOps(d,C.teacherGiftOps(d,'s',item));assert.equal(C.studentBalance(d,'s'),850);assert.equal(C.studentHoldings(d,'s').length,2);
 const purchase=d.economy_tx.find(t=>t.type==='구매');d=C.applyOps(d,C.shopRefundOps(d,'s',purchase.id,true));assert.equal(C.studentBalance(d,'s'),900);assert.equal(C.studentHoldings(d,'s').length,1);assert.equal(d.stock_orders[0].status,'pending');assert.equal(d.shop_items[0].stock,2);
});
test('로컬 상점 주문 전에도 만기 예금이 1회 정산되어 구매 가능 잔액에 반영된다',async()=>{
 const {Store}=await import('../js/store.js'),previous=globalThis.localStorage,map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 try{
  const store=new Store();store.mode='demo';store.db=fixture();store.db.economy_tx=[];store.db.bank_deposits=[{id:C.uid(),studentId:'s',principal:100,weeks:2,ratePercent:2,interest:2,paidInterest:0,status:'active',createdAt:'2026-01-01T00:00:00Z',maturesAt:'2026-01-15T00:00:00Z'}];store.db.shop_items=[{id:C.uid(),name:'쿠폰',category:'기타',price:50,stock:2}];map.set('startoday-demo-v1',JSON.stringify(store.db));
  await store.economyAction('buy','s',store.db.shop_items[0].id);assert.equal(C.studentBalance(store.db,'s'),52);assert.equal(store.db.bank_deposits[0].status,'matured');assert.equal(store.db.economy_tx.filter(t=>t.type==='예금만기').length,1);
 }finally{globalThis.localStorage=previous;}
});
test('로컬 수동 시세도 서버처럼 소수 넷째 자리 가격을 정확히 허용한다',async()=>{
 const {Store}=await import('../js/store.js'),previous=globalThis.localStorage,map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 try{const store=new Store();store.mode='demo';store.db=fixture();map.set('startoday-demo-v1',JSON.stringify(store.db));await store.financeAction('quote',null,{symbol:'005930.KS',name:'삼성전자',priceKrw:.0003});assert.equal(store.db.stock_quotes[0].priceKrw,.0003);await assert.rejects(store.financeAction('quote',null,{symbol:'005930.KS',name:'삼성전자',priceKrw:.00001}),/가격/);}finally{globalThis.localStorage=previous;}
});
