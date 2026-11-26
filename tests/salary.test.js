import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import { Store } from '../js/store.js';

const DAY = '2026-11-27';
const apply = (db, ops) => C.applyOps(db, ops);
function fixture() {
  const db = C.initialDB();
  db.settings[0].salary = { period: '2week', basis: 'praise', multiplier: 10, jobs: false, jobWages: {} };
  db.students = [
    { id: 's1', no: 1, name: '가온' },
    { id: 's2', no: 2, name: '나래' },
    { id: 's3', no: 3, name: '다온' }
  ];
  const rec = (id, studentId, kind, date) => ({ id, studentIds: [studentId], kind, date, text: kind, areas: ['학습'], createdAt: DAY + 'T00:00:00.000Z' });
  db.records = [
    rec('r1', 's1', '칭찬', C.addDays(DAY, -13)),
    rec('r2', 's1', '칭찬', DAY),
    rec('r3', 's1', '지도', DAY),
    rec('r4', 's2', '칭찬', C.addDays(DAY, -14)),
    rec('r5', 's2', '관찰', DAY),
    rec('r6', 's3', '지도', DAY),
    rec('r7', 's3', '지도', DAY)
  ];
  return db;
}
const rowOf = (preview, id) => preview.rows.find(row => row.studentId === id);

test('월급: 기존 학급은 실시간 합산 방식을 그대로 쓴다', () => {
  const db = fixture();
  assert.equal(C.pointMode(db.settings[0]), 'realtime');
  assert.equal(C.studentBalance(db, 's1', DAY), 10);
  const config = C.salaryConfig(db.settings[0]);
  assert.deepEqual(config, { period: '2week', basis: 'praise', multiplier: 10, jobs: false, jobWages: {} });
});

test('월급: 월급 정산 방식은 별×10을 자동 합산하지 않고 원장만 센다', () => {
  let db = fixture();
  db.settings[0].pointMode = 'salary';
  assert.equal(C.studentBalance(db, 's1', DAY), 0);
  db = apply(db, C.teacherBalanceAdjustOps(db, 's1', 70, '[월급] 2주 · 칭찬×10'));
  assert.equal(C.studentBalance(db, 's1', DAY), 70);
  db = apply(db, C.teacherBalanceAdjustOps(db, 's1', -20, '간식 구매'));
  assert.equal(C.studentBalance(db, 's1', DAY), 50);
});

test('월급: 기간은 2주=14일, 한달=30일이고 기간 밖 기록은 세지 않는다', () => {
  const db = fixture();
  assert.equal(C.salaryPeriodStart('2week', DAY), C.addDays(DAY, -13));
  assert.equal(C.salaryPeriodStart('month', DAY), C.addDays(DAY, -29));
  const twoWeeks = C.salaryPreview(db, db.settings[0], DAY);
  assert.equal(rowOf(twoWeeks, 's1').count, 2);
  assert.equal(rowOf(twoWeeks, 's2').count, 0);
  const month = C.salaryPreview(db, { ...db.settings[0], salary: { ...db.settings[0].salary, period: 'month' } }, DAY);
  assert.equal(rowOf(month, 's2').count, 1);
});

test('월급: 칭찬만/칭찬-조언과 0 미만 0포인트 처리, 배수 곱셈', () => {
  const db = fixture();
  const praise = C.salaryPreview(db, db.settings[0], DAY);
  assert.equal(rowOf(praise, 's1').base, 20);
  assert.equal(rowOf(praise, 's3').base, 0);
  const advice = C.salaryPreview(db, { ...db.settings[0], salary: { ...db.settings[0].salary, basis: 'praise-advice' } }, DAY);
  assert.equal(rowOf(advice, 's1').count, 1);
  assert.equal(rowOf(advice, 's1').base, 10);
  assert.equal(rowOf(advice, 's3').count, 0);
  assert.equal(rowOf(advice, 's3').base, 0);
  const five = C.salaryPreview(db, { ...db.settings[0], salary: { ...db.settings[0].salary, basis: 'praise-advice', multiplier: 5 } }, DAY);
  assert.equal(rowOf(five, 's1').total, 5);
  const zero = C.salaryPreview(db, { ...db.settings[0], salary: { ...db.settings[0].salary, multiplier: 0 } }, DAY);
  assert.equal(rowOf(zero, 's1').total, 0);
});

test('월급: 결석 제외 기록은 세지 않는다', () => {
  const db = fixture();
  db.attendance = [{ id: 'a1', studentId: 's1', date: DAY, excluded: true }];
  const preview = C.salaryPreview(db, db.settings[0], DAY);
  assert.equal(rowOf(preview, 's1').count, 1);
});

test('월급: 추가 직업이 있으면 기록 급여에 직업 월급을 더하고, 없으면 무시한다', () => {
  const db = fixture();
  const jobs = { ...db.settings[0].salary, jobs: true, jobWages: { s1: { name: '우유 당번', amount: 50 }, s2: { name: '칠판', amount: 20 } } };
  const preview = C.salaryPreview(db, { ...db.settings[0], salary: jobs }, DAY);
  assert.equal(rowOf(preview, 's1').jobName, '우유 당번');
  assert.equal(rowOf(preview, 's1').jobPay, 50);
  assert.equal(rowOf(preview, 's1').total, 70);
  assert.equal(rowOf(preview, 's2').total, 20);
  const off = C.salaryPreview(db, { ...db.settings[0], salary: { ...jobs, jobs: false } }, DAY);
  assert.equal(rowOf(off, 's1').total, 20);
});

test('월급: 잘못된 설정값은 기본값으로 되돌리고 지급액 안전 범위를 지킨다', () => {
  assert.equal(C.salaryConfig({ salary: { period: 'x', basis: 'y', multiplier: -3 } }).period, '2week');
  assert.equal(C.salaryConfig({ salary: { basis: 'y' } }).basis, 'praise');
  assert.equal(C.salaryConfig({ salary: { multiplier: -3 } }).multiplier, 10);
  assert.equal(C.salaryConfig({ salary: { multiplier: 1000001 } }).multiplier, 10);
  assert.equal(C.salaryConfig({ salary: { multiplier: '12' } }).multiplier, 12);
  const wages = C.salaryConfig({ salary: { jobs: true, jobWages: { s1: { name: ' 당번 ', amount: 1.5 }, s2: { name: '칠판', amount: -5 } } } }).jobWages;
  assert.deepEqual(wages.s1, { name: '당번', amount: 0 });
  assert.deepEqual(wages.s2, { name: '칠판', amount: 0 });
});

test('월급: 지급 메모에 기간·산식 요약을 남긴다', () => {
  assert.equal(C.salaryMemo({ salary: { period: '2week', basis: 'praise', multiplier: 10 } }), '[월급] 2주 · 칭찬×10');
  assert.equal(C.salaryMemo({ salary: { period: 'month', basis: 'praise-advice', multiplier: 5, jobs: true } }), '[월급] 한달 · 칭찬-조언×5 + 직업');
});

test('월급: 지급은 설정과 거래를 한 묶음으로 만들고, 지급 뒤 남은 기간은 다시 세지 않는다', () => {
  const db = fixture();
  const settings = { ...db.settings[0], pointMode: 'salary', salary: { period: '2week', basis: 'praise', multiplier: 10, jobs: true, jobWages: { s1: { name: '우유 당번', amount: 50 } } } };
  const result = C.salaryPayOps(db, settings, ['s1', 's2'], C.today());
  assert.equal(result.memo, '[월급] 2주 · 칭찬×10 + 직업');
  assert.equal(result.rows.length, 1, '지급액 0인 학생은 거래를 만들지 않는다');
  assert.equal(result.rows[0].studentId, 's1');
  assert.equal(result.ops.length, 2);
  assert.equal(result.ops[0].table, 'settings');
  assert.equal(result.ops[0].data.pointMode, 'salary');
  const tx = result.ops[1].data;
  assert.equal(tx.type, '지급');
  assert.equal(tx.amount, 70);
  assert.equal(tx.memo, '[월급] 2주 · 칭찬×10 + 직업');
  const paid = apply(db, result.ops);
  assert.equal(C.studentBalance(paid, 's1'), 70);
  assert.equal(C.lastSalaryDay(paid, 's1'), C.today());
  const after = C.salaryPreview(paid, settings, C.today());
  assert.equal(rowOf(after, 's1').paidOn, C.today());
  assert.equal(rowOf(after, 's1').count, 0);
  assert.equal(rowOf(after, 's1').jobPay, 0, '같은 기간에 직업 월급을 두 번 붙이지 않는다');
  assert.equal(rowOf(after, 's1').total, 0);
  assert.throws(() => C.salaryPayOps(paid, settings, ['s1'], C.today()), /지급할 학생을 선택하세요/);
  assert.throws(() => C.salaryPayOps(db, settings, [], C.today()), /지급할 학생을 선택하세요/);
});

test('월급: 이미 지급한 학생은 마지막 지급 다음 날부터 다시 센다', () => {
  const db = fixture();
  db.economy_tx = [{ id: 'tx1', studentId: 's1', type: '지급', amount: 70, memo: '[월급] 2주 · 칭찬×10', createdAt: DAY + 'T01:00:00.000Z' }];
  const window = C.salaryWindow(db, 's1', '2week', DAY);
  assert.equal(window.paidOn, DAY);
  assert.equal(window.from, '', '지급 당일에는 남은 기간이 없다');
  const nextDay = C.salaryWindow(db, 's1', '2week', C.addDays(DAY, 1));
  assert.equal(nextDay.from, C.addDays(DAY, 1));
  const preview = C.salaryPreview(db, db.settings[0], DAY);
  assert.equal(rowOf(preview, 's1').count, 0);
  const tomorrow = C.salaryPreview(db, db.settings[0], C.addDays(DAY, 1));
  assert.equal(rowOf(tomorrow, 's1').paidOn, DAY);
  assert.equal(rowOf(tomorrow, 's1').jobPay, 0, '같은 기간에는 직업 월급을 다시 주지 않는다');
  const later = C.addDays(DAY, 14);
  db.records.push({ id: 'r8', studentIds: ['s1'], kind: '칭찬', date: later, text: '칭찬', areas: ['학습'], createdAt: DAY + 'T00:00:00.000Z' });
  const nextPeriod = C.salaryPreview(db, db.settings[0], later);
  assert.equal(rowOf(nextPeriod, 's1').paidOn, '', '다음 기간에는 다시 지급할 수 있다');
  assert.equal(rowOf(nextPeriod, 's1').count, 1);
});

test('월급: 클라우드에서도 설정과 지급 거래를 한 번의 커밋으로 보낸다', async () => {
  const db = fixture();
  const settings = { ...db.settings[0], pointMode: 'salary', salary: { period: '2week', basis: 'praise', multiplier: 10, jobs: true, jobWages: { s1: { name: '우유 당번', amount: 50 }, s2: { name: '칠판', amount: 20 } } } };
  const result = C.salaryPayOps(db, settings, ['s1', 's2'], C.today());
  const store = new Store();
  store.db = db;
  store.mode = 'cloud';
  store.classId = 'c';
  store.revision = 1;
  let sent = null;
  store.client = { rpc: async (name, body) => { sent = { name, body }; return { data: 2 }; } };
  await store.commit(result.ops);
  assert.equal(sent.name, 'startoday_commit');
  assert.equal(sent.body.p_revision, 1);
  assert.equal(sent.body.p_ops.length, 3);
  assert.equal(sent.body.p_ops.filter(op => op.table === 'economy_tx').length, 2);
  assert.equal(store.revision, 2);
  assert.equal(C.studentBalance(store.db, 's2'), 20);
  assert.equal(C.pointMode(store.db.settings[0]), 'salary');
});
