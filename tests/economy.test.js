import { Store } from '../js/store.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
function fixture() {
  const d = C.initialDB();
  d.students = [{
    id: 's',
    no: 1,
    name: '가온'
  }, {
    id: 'other',
    no: 2,
    name: '나래'
  }];
  d.records = [{
    id: 'p',
    studentIds: ['s'],
    kind: '칭찬',
    areas: ['학습'],
    date: C.today(),
    text: '칭찬',
    createdAt: C.now()
  }, {
    id: 'p2',
    studentIds: ['s'],
    kind: '칭찬',
    areas: ['학습'],
    date: C.today(),
    text: '칭찬',
    createdAt: C.now()
  }, {
    id: 'a',
    studentIds: ['s'],
    kind: '지도',
    areas: ['생활'],
    date: C.today(),
    text: '지도',
    createdAt: C.now()
  }];
  d.shop_items = [{
    id: C.uid(),
    category: '쿠폰',
    name: '자리',
    price: 10,
    stock: 2
  }, {
    id: C.uid(),
    category: '혜택',
    name: '자유',
    price: 0,
    stock: null
  }];
  return d;
}
const apply = (d, ops) => C.applyOps(d, ops);
test('별코인: 칭찬-지도 점수와 독립 거래 원장을 합산', () => {
  let d = fixture();
  assert.equal(C.studentBalance(d, 's'), 10);
  d = apply(d, C.teacherBalanceAdjustOps(d, 's', 20, '지원'));
  assert.equal(C.studentBalance(d, 's'), 30);
  d = apply(d, C.teacherBalanceAdjustOps(d, 's', -5));
  assert.equal(C.studentBalance(d, 's'), 25);
  assert.equal(C.scores(d, 's', '', C.today()).total, 1);
  assert.equal(C.studentBalance(d, 'other'), 0);
});
test('구매는 잔액·유한 재고를 차감하고 보유 목록에 추가', () => {
  let d = fixture();
  d = apply(d, C.shopBuyOps(d, 's', d.shop_items[0].id));
  assert.equal(C.studentBalance(d, 's'), 0);
  assert.equal(d.shop_items[0].stock, 1);
  assert.equal(C.studentHoldings(d, 's').length, 1);
  assert.equal(C.studentHoldings(d, 'other').length, 0);
  assert.throws(() => C.shopBuyOps(d, 's', d.shop_items[0].id), /잔액/);
});
test('무한 재고 및 0원 물품 구매·환불 시 null 유지', () => {
  let d = fixture();
  d = apply(d, C.shopBuyOps(d, 's', d.shop_items[1].id));
  d = apply(d, C.shopRefundOps(d, 's', d.economy_tx[0].id));
  assert.equal(d.shop_items[1].stock, null);
  assert.equal(C.studentBalance(d, 's'), 10);
});
test('품절·삭제·잘못된 가격·학생은 구매와 선물 차단', () => {
  const d = fixture(),
    id = d.shop_items[0].id;
  d.shop_items[0].stock = 0;
  assert.throws(() => C.shopBuyOps(d, 's', id), /품절/);
  assert.throws(() => C.teacherGiftOps(d, 's', id), /품절/);
  d.shop_items[0].stock = 1;
  d.shop_items[0].deletedAt = C.now();
  assert.throws(() => C.shopBuyOps(d, 's', id));
  delete d.shop_items[0].deletedAt;
  d.shop_items[0].price = -1;
  assert.throws(() => C.shopBuyOps(d, 's', id));
  assert.throws(() => C.shopBuyOps(d, 'missing', id));
});
test('환불은 원 구매가 복구·재고 반환·중복 환불 차단, 가격·이름 변경 무관', () => {
  let d = fixture();
  d = apply(d, C.shopBuyOps(d, 's', d.shop_items[0].id));
  const id = d.economy_tx[0].id;
  d.shop_items[0].price = 99;
  d.shop_items[0].name = '변경';
  d.shop_items[0].deletedAt = C.now();
  d = apply(d, C.shopRefundOps(d, 's', id));
  assert.equal(C.studentBalance(d, 's'), 10);
  assert.equal(d.shop_items[0].stock, 2);
  assert.equal(d.economy_tx[0].amount, -10);
  assert.equal(d.economy_tx[1].amount, 10);
  assert.equal(d.economy_tx[1].itemName, '자리');
  assert.throws(() => C.shopRefundOps(d, 's', id));
  assert.equal(C.studentHoldings(d, 's').length, 0);
});
test('환불 꺼짐·타인·선물·사용완료 물품 환불 차단', () => {
  let d = fixture();
  d = apply(d, C.shopBuyOps(d, 's', d.shop_items[0].id));
  const id = d.economy_tx[0].id;
  d.settings[0].allowRefund = false;
  assert.throws(() => C.shopRefundOps(d, 's', id), /허용/);
  d.settings[0].allowRefund = true;
  assert.throws(() => C.shopRefundOps(d, 'other', id));
  d = apply(d, C.shopUseOps(d, 's', id));
  assert.equal(d.economy_tx[0].status, '사용완료');
  assert.throws(() => C.shopRefundOps(d, 's', id));
  assert.throws(() => C.shopUseOps(d, 's', id));
  d = apply(d, C.teacherGiftOps(d, 's', d.shop_items[0].id));
  assert.throws(() => C.shopRefundOps(d, 's', d.economy_tx.at(-1).id));
});
test('교사 선물은 0원·유한 재고 차감, 지급/차감은 정수만 허용', () => {
  let d = fixture();
  d = apply(d, C.teacherGiftOps(d, 'other', d.shop_items[0].id));
  assert.equal(d.shop_items[0].stock, 1);
  assert.equal(C.studentBalance(d, 'other'), 0);
  assert.equal(d.economy_tx[0].type, '선물');
  for (const value of [0, 0.1, NaN, Infinity, 1000000001]) assert.throws(() => C.teacherBalanceAdjustOps(d, 's', value));
});
test('학생 경제 projection은 타인 거래·비공개 사유·삭제 물품 제외', () => {
  let d = fixture();
  d = apply(d, C.teacherBalanceAdjustOps(d, 's', 10, '민감사유'));
  d = apply(d, C.teacherGiftOps(d, 'other', d.shop_items[0].id));
  d.shop_items[1].deletedAt = C.now();
  const snap = C.studentEconomySnapshot(d, 's');
  assert.equal(snap.transactions.length, 1);
  assert.equal(snap.items.length, 1);
  assert.ok(!JSON.stringify(snap).includes('민감사유'));
  assert.equal(snap.transactions[0].studentId, undefined);
});
test('과거 백업은 새 경제 빈 배열로 복원하고 신규 원장은 보존', () => {
  const d = fixture();
  delete d.shop_items;
  delete d.economy_tx;
  const restored = C.validateBackup({
    app: 'startoday',
    version: 1,
    data: d
  });
  assert.deepEqual(restored.shop_items, []);
  assert.deepEqual(restored.economy_tx, []);
});
test('클라우드 거래 응답 대기 중 로그아웃하면 교사 스냅샷을 다시 채우지 않음', async () => {
  const store = new Store();
  store.mode = 'cloud';
  store.classId = 'class';
  store.user = {
    id: 'owner'
  };
  store.db = fixture();
  let resolve;
  store.client = {
    rpc: () => new Promise(r => resolve = r)
  };
  const pending = store.economyAction('adjust', 's', null, 10);
  await Promise.resolve();
  store.mode = 'none';
  store.db = null;
  store.user = null;
  resolve({
    data: {
      data: fixture(),
      revision: 99
    }
  });
  await assert.rejects(pending, /화면/);
  assert.equal(store.db, null);
  assert.equal(store.revision, 0);
});
