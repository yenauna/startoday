import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
function legacy() {
  const db = C.initialDB();
  db.areas[0].name = '학습태도';
  db.students = [{
    id: 's',
    no: 1,
    name: '가온'
  }];
  db.records = [{
    id: 'r',
    date: '2026-11-11',
    kind: '칭찬',
    studentIds: ['s'],
    text: '독서',
    areas: ['학습태도', '학습', '생활'],
    area: '학습태도',
    createdAt: '2026-11-11T00:00:00Z'
  }];
  db.assignments = [{
    id: 'a',
    title: '독서',
    date: '2026-11-11',
    repeat: {
      type: 'none'
    },
    target: 'all',
    statArea: '학습태도'
  }];
  return db;
}
test('기본 경험치는 학습이며 구 명칭은 ID·기록·칭호·점수 이력을 보존해 정규화', () => {
  const db = legacy(),
    old = structuredClone(db),
    before = C.kingdomCounts(db, 's', '2026-11-11');
  assert.equal(C.DEFAULT_AREAS[0], '학습');
  assert.equal(C.scores(db, 's', '', '2026-11-11').areas['학습'], 1);
  assert.equal(C.scores(db, 's', '', '2026-11-11').total, 1);
  assert.equal(C.classStatisticsSummary(db, '2026-11-11').topArea, '학습');
  const next = C.normalizeDB(db);
  assert.equal(next.areas[0].id, 'area-1');
  assert.equal(next.areas[0].name, '학습');
  assert.deepEqual(next.records[0].areas, ['학습', '생활']);
  assert.equal(next.records[0].area, '학습');
  assert.equal(next.assignments[0].statArea, '학습');
  assert.equal(next.records[0].createdAt, old.records[0].createdAt);
  assert.equal(next.records[0].text, old.records[0].text);
  assert.deepEqual(C.kingdomCounts(next, 's', '2026-11-11'), before);
  assert.deepEqual(C.areaMigrationOps(next), []);
});
test('학습/학습태도 중복 영역은 활성 행 하나로 병합하고 사용자 지정 이름은 보존', () => {
  const db = legacy();
  db.areas.push({
    id: 'new-name',
    name: '학습',
    sortOrder: 10,
    deletedAt: null
  }, {
    id: 'custom',
    name: '자율학습태도',
    sortOrder: 11,
    deletedAt: null
  });
  db.areas[0].deletedAt = C.now();
  const next = C.normalizeDB(db);
  assert.equal(next.areas.filter(a => a.name === '학습').length, 1);
  assert.equal(next.areas.find(a => a.name === '학습').id, 'new-name');
  assert(next.areas.some(a => a.name === '자율학습태도'));
  assert.equal(C.scores(next, 's', '', '2026-11-11').areas['학습'], 1);
});
test('기존 백업 복원도 구 이름을 정규화하고 영역 참조를 한 번만 세며 원본 문자열은 보존', () => {
  const db = legacy(),
    backup = {
      app: 'startoday',
      version: 1,
      data: db
    };
  const restored = C.validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(restored.records[0].areas, ['학습', '생활']);
  assert.equal(restored.assignments[0].statArea, '학습');
  assert.equal(restored.records[0].text, '독서');
});
test('영역 단일/일괄 변경은 구 이름을 이해하고 새로운 사용자 지정 이름으로 참조를 이동', () => {
  let db = legacy();
  db = C.applyOps(db, C.areaEditOps(db, 'area-1', '배움'));
  assert.equal(db.records[0].areas[0], '배움');
  assert.equal(db.assignments[0].statArea, '배움');
  assert.equal(db.areas[0].name, '배움');
});
test('시간 선택 카드는 점심을 3/4/5교시 뒤에 배치하고 기존 쉬는시간을 유지', () => {
  for (const n of [3, 4, 5]) {
    const cards = C.quickPeriodChoices({
        lunchAfterPeriod: n
      }),
      i = cards.indexOf('점심');
    assert.equal(cards[i - 1], n + '교시');
    assert.equal(cards[i + 1], n + 1 + '교시');
    assert.equal(new Set(cards).size, cards.length);
    assert(cards.includes('아침') && cards.includes('방과후') && cards.includes('쉬는시간'));
    assert(!cards.includes('7교시'));
  }
});
test('과제 날짜의 빈 값·잘못된 형식·실재하지 않는 날짜는 payload 생성 전에 거부', () => {
  const db = legacy(),
    a = db.assignments[0],
    before = JSON.stringify(db);
  for (const date of [undefined, null, '', '2026-1-11', '2026/11/11', '2026-11-11T00:00:00Z', '2026-02-30', '2026-13-01', '0000-01-01']) {
    assert.throws(() => C.taskStateOps(db, a, date, 's', '안함'), /날짜/);
    assert.throws(() => C.markRemainingUndoneOps(db, a, date), /날짜/);
  }
  assert.equal(JSON.stringify(db), before);
  assert(C.isTaskDate('2024-02-29'));
});
test('일괄 안함 트랜잭션은 모든 상태/자동 기록에 동일한 유효 날짜·참조·정규화 영역을 제공', () => {
  const db = legacy(),
    a = db.assignments[0],
    date = '2026-11-11';
  db.students.push({
    id: 'done',
    no: 2,
    name: '완료'
  }, {
    id: 'excluded',
    no: 3,
    name: '제외'
  });
  db.assignmentStates = [{
    id: C.stateId(a.id, date, 'done'),
    assignmentId: a.id,
    date,
    studentId: 'done',
    status: '완료',
    memo: '보존'
  }];
  db.attendance = [{
    id: 'ex',
    date,
    studentId: 'excluded',
    excluded: true
  }];
  const ops = C.markRemainingUndoneOps(db, a, date);
  assert.equal(ops.length, 2);
  for (const op of JSON.parse(JSON.stringify(ops))) {
    assert.equal(op.data.date, date);
    assert(C.isTaskDate(op.data.date));
    if (op.table === 'assignmentStates') assert.equal(op.id, C.stateId(a.id, date, op.data.studentId));else {
      assert.equal(op.data.autoRef, C.stateId(a.id, date, 's'));
      assert.deepEqual(op.data.areas, ['학습']);
      assert.equal(op.data.kind, '지도');
    }
  }
  const next = C.applyOps(db, ops);
  assert.equal(C.assignmentStatus(next, a.id, date, 's'), '안함');
  assert.equal(C.assignmentStatus(next, a.id, date, 'done'), '완료');
  assert.deepEqual(C.markRemainingUndoneOps(next, a, date), []);
});
test('클라우드 학습 개명은 전체 참조를 한 트랜잭션으로 보존하고 재진입 시 다시 쓰지 않음', async () => {
  const {
      Store
    } = await import('../js/store.js'),
    db = legacy(),
    store = new Store(),
    writes = [];
  store.mode = 'cloud';
  let remote = structuredClone(db),
    revision = 5;
  store.client = {
    rpc: async (name, args) => {
      if (name === 'startoday_snapshot') return {
        data: {
          class_id: 'c',
          revision,
          data: structuredClone(remote)
        }
      };
      assert.equal(name, 'startoday_commit');
      writes.push(args.p_ops);
      remote = C.applyOps(remote, args.p_ops);
      return {
        data: ++revision
      };
    }
  };
  await store.load();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].filter(op => op.table === 'areas').length, 1);
  assert(writes[0].some(op => op.table === 'records'));
  assert(writes[0].some(op => op.table === 'assignments'));
  assert.equal(remote.records[0].createdAt, db.records[0].createdAt);
  await store.load();
  assert.equal(writes.length, 1);
  assert.equal(store.db.assignments[0].statArea, '학습');
});
test('체험 모드 학습 개명은 로컬 스토리지에 저장되어 새 Store로 복원해도 유지', async () => {
  const {
      Store
    } = await import('../js/store.js'),
    previous = globalThis.localStorage,
    saved = new Map([['startoday-demo-v1', JSON.stringify(legacy())]]);
  globalThis.localStorage = {
    getItem: k => saved.get(k) || null,
    setItem: (k, v) => saved.set(k, v)
  };
  try {
    const store = new Store();
    store.demo();
    assert.equal(JSON.parse(saved.get('startoday-demo-v1')).records[0].areas[0], '학습');
    const fresh = new Store();
    fresh.demo();
    assert.equal(fresh.db.areas[0].name, '학습');
    assert.equal(fresh.db.assignments[0].statArea, '학습');
  } finally {
    if (previous === undefined) delete globalThis.localStorage;else globalThis.localStorage = previous;
  }
});
test('첫 영역을 별도로 개명한 사용자는 이름을 보존하고 고아 학습 참조만 별도 영역으로 복구', () => {
  const db = legacy();
  db.areas[0].name = '우리의 배움';
  const next = C.normalizeDB(db);
  assert.equal(next.areas.find(a => a.id === 'area-1').name, '우리의 배움');
  assert.equal(next.areas.filter(a => a.name === '학습').length, 1);
  assert.equal(C.scores(next, 's', '', '2026-11-11').areas['학습'], 1);
  assert.deepEqual(C.areaMigrationOps(next), []);
});
