import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import { Store } from '../js/store.js';
test('새 체험 시드는 루틴 2종·과제 3종·상점 6종 및 무한 재고 제공', () => {
  const d = C.demoDB();
  assert.deepEqual(d.routines.map(r => r.title), ['우유 마시기', '점심 양치하기']);
  assert.equal(d.assignments.length, 3);
  assert.equal(d.shop_items.length, 6);
  assert.equal(d.shop_items.find(i => i.name === '5분 자유시간권').stock, null);
  assert.deepEqual(d.students.slice(0, 3).map(s => s.name), ['가온', '나래', '다온']);
  assert.equal(C.validateBackup({
    app: 'startoday',
    version: 1,
    data: d
  }).shop_items.length, 6);
});
test('11월 분산 예시 기록 및 첫 3명 각 영역 15회 칭찬 해금', () => {
  const d = C.demoDB(),
    year = C.today().slice(0, 4),
    date = year + '-11-11';
  assert.ok(new Set(d.records.map(r => r.date)).size >= 7);
  assert.ok(d.records.every(r => r.date >= year + '-11-02' && r.date <= date));
  for (const [i, area] of ['학습', '관계', '도전'].entries()) {
    const s = d.students[i];
    assert.ok(d.records.filter(r => r.kind === '칭찬' && r.studentIds.includes(s.id) && r.areas.includes(area)).length >= 15);
  }
  for (const [i, domain] of ['learning', 'relationships', 'challenge'].entries()) {
    const catalog = C.kingdomCatalog(C.kingdomCounts(d, d.students[i].id, date), C.kingdomConfig(d));
    assert.equal(catalog.find(row => row.id === domain).stage, 1);
  }
  for (const s of d.students.slice(3)) {
    const n = d.records.filter(r => r.studentIds.includes(s.id)).length;
    assert.ok(n >= 3 && n <= 8);
  }
  for (const kind of ['칭찬', '관찰', '지도']) assert.ok(d.records.some(r => r.kind === kind));
  for (const phrase of ['3+9=13', '동물원', '중임무황태', '가정통신문 배달하기', '수학 75쪽 채점하기']) assert.ok(d.records.some(r => r.text.includes(phrase)));
});
test('기존 체험 자료는 재접속 시 보존, 지정 키 제거 후 최신 시드 재구성', () => {
  const old = globalThis.localStorage,
    map = new Map();
  globalThis.localStorage = {
    getItem: k => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    removeItem: k => map.delete(k)
  };
  try {
    const store = new Store();
    store.demo();
    store.db.students[0].name = '보존학생';
    map.set('startoday-demo-v1', JSON.stringify(store.db));
    map.set('other-key', '보존');
    store.demo();
    assert.equal(store.db.students[0].name, '보존학생');
    map.delete('startoday-demo-v1');
    store.db = null;
    store.demo();
    assert.equal(store.db.students[0].name, '가온');
    assert.equal(store.db.shop_items.length, 6);
    assert.equal(map.get('other-key'), '보존');
  } finally {
    globalThis.localStorage = old;
  }
});

test('체험 학생마다 기록 원문이 중복되지 않고 획득 칭호가 장착됨', () => {
  const d = C.demoDB();
  for (const student of d.students) {
    const texts = d.records.filter(r => r.studentIds.includes(student.id)).map(r => r.text);
    assert.equal(new Set(texts).size, texts.length, student.name);
  }
  for (const student of d.students.slice(0, 3)) {
    const unlocked = C.kingdomCatalog(C.kingdomCounts(d, student.id, C.today().slice(0, 4) + '-11-11'), C.kingdomConfig(d)).flatMap(row => row.unlocked);
    assert.ok(unlocked.some(title => title.id === student.equippedTitle));
    assert.ok(student.equippedTitle.endsWith(':1'));
  }
});
