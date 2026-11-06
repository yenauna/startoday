import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import { Store } from '../js/store.js';
test('기존 클라우드 학급의 새 영역 테이블만 초기화하고 다른 자료 보존', async () => {
  const db = C.initialDB();
  db.students = [{
    id: 's',
    no: 1,
    name: '가상'
  }];
  db.areas = [];
  const s = new Store();
  s.mode = 'cloud';
  const calls = [];
  s.client = {
    rpc: async (name, body) => {
      calls.push({
        name,
        body
      });
      return name === 'startoday_snapshot' ? {
        data: {
          class_id: 'class',
          revision: 7,
          data: db
        }
      } : {
        data: 8
      };
    }
  };
  await s.load();
  assert.equal(s.db.students[0].name, '가상');
  assert.equal(s.revision, 8);
  assert.equal(calls[1].body.p_ops.length, 6);
  assert(calls[1].body.p_ops.every(op => op.table === 'areas'));
});
test('SQL 미적용 학급은 기존 읽기 동작을 유지하고 영역 저장만 안내', async () => {
  const db = C.initialDB();
  delete db.areas;
  const s = new Store();
  s.mode = 'cloud';
  let calls = 0;
  s.client = {
    rpc: async () => {
      calls++;
      return {
        data: {
          class_id: 'class',
          revision: 7,
          data: db
        }
      };
    }
  };
  await s.load();
  assert.equal(calls, 1);
  assert.equal(s.db.areas.length, 6);
  s.client = {
    rpc: async () => ({
      error: {
        message: 'INVALID_TABLE_OR_ID'
      }
    })
  };
  await assert.rejects(s.commit([{
    table: 'areas',
    id: 'area-1',
    data: s.db.areas[0]
  }]), /schema.sql/);
  assert.equal(s.revision, 7);
});
test('서로 이름이 달라진 영역을 백업 병합할 때 양쪽 참조 이름과 고유 ID 보존', () => {
  const current = C.defaultAreas(),
    incoming = C.defaultAreas();
  incoming[5].name = '1인1역';
  const merged = C.mergeAreaRows(current, incoming);
  assert.equal(merged.length, 7);
  assert.equal(new Set(merged.map(a => a.id)).size, 7);
  assert(merged.some(a => a.name === '알바'));
  assert(merged.some(a => a.name === '1인1역'));
});
function setup() {
  const db = C.initialDB();
  db.students = [{
    id: 's1',
    no: 1,
    name: '가상1',
    seat: {
      row: 0,
      col: 0
    }
  }, {
    id: 's2',
    no: 2,
    name: '가상2',
    seat: {
      row: 0,
      col: 1
    }
  }];
  return db;
}
test('영역 이름 변경은 기존 기록·태그·과제 참조를 원자적으로 이동', () => {
  let db = setup();
  db.records = [{
    id: 'r',
    kind: '칭찬',
    studentIds: ['s1'],
    date: '2026-11-06',
    areas: ['알바'],
    area: '알바'
  }];
  db.assignments = [{
    id: 'a',
    statArea: '알바'
  }];
  db.tags.push({
    id: 't',
    area: '알바'
  });
  db = C.applyOps(db, C.areaEditOps(db, 'area-6', '1인1역'));
  assert(C.areaNames(db).includes('1인1역'));
  assert.equal(db.records[0].areas[0], '1인1역');
  assert.equal(db.records[0].area, '1인1역');
  assert.equal(db.assignments[0].statArea, '1인1역');
  assert.equal(db.tags.at(-1).area, '1인1역');
  assert.equal(C.scores(db, 's1', '2026-11-06', '2026-11-06').areas['1인1역'], 1);
  assert.throws(() => C.areaEditOps(db, 'area-6', '과제'));
});
test('삭제 영역은 입력 목록에서 숨기고 기존 통계에서는 보존', () => {
  const db = setup();
  db.areas[5].deletedAt = C.now();
  db.records = [{
    kind: '칭찬',
    studentIds: ['s1'],
    date: '2026-11-06',
    areas: ['알바']
  }];
  assert(!C.areaNames(db).includes('알바'));
  assert.equal(C.scores(db, 's1', '2026-11-06', '2026-11-06').areas.알바, 1);
});
test('이전 버전 백업과 데모 자료에 기본 경험치 목록을 보완', () => {
  const db = setup();
  delete db.areas;
  assert.equal(C.validateBackup({
    app: 'startoday',
    version: 1,
    data: db
  }).areas.length, 6);
  delete db.areas;
  assert.equal(C.normalizeDB(db).areas.length, 6);
});
test('기간 결석 예약은 기존 메모를 갱신하고 날짜별 체크·점수에서 제외', () => {
  let db = setup();
  db = C.applyOps(db, C.attendanceOps(db, ['s1'], '2026-11-06', '2026-11-08', '체험학습'));
  assert.equal(db.attendance.length, 3);
  assert(C.excluded(db, 's1', '2026-11-07'));
  assert(!C.excluded(db, 's2', '2026-11-07'));
  db = C.applyOps(db, C.attendanceOps(db, ['s1'], '2026-11-07', '2026-11-07', '변경'));
  assert.equal(db.attendance.length, 3);
  assert.equal(db.attendance.find(a => a.date === '2026-11-07').memo, '변경');
  db.records = [{
    kind: '칭찬',
    studentIds: ['s1'],
    date: '2026-11-07',
    areas: ['생활']
  }];
  assert.equal(C.scores(db, 's1', '2026-11-07', '2026-11-07').total, 0);
  assert.throws(() => C.attendanceOps(db, [], '2026-11-06', '2026-11-08', ''));
  assert.throws(() => C.attendanceOps(db, ['s1'], '2026-11-08', '2026-11-06', ''));
});
test('좌석 교환·빈자리 이동·미배치 학생 이동의 고유 위치 보존', () => {
  let db = setup();
  db = C.applyOps(db, C.seatMoveOps(db, 's1', 0, 1));
  assert.deepEqual(db.students[0].seat, {
    row: 0,
    col: 1
  });
  assert.deepEqual(db.students[1].seat, {
    row: 0,
    col: 0
  });
  db = C.applyOps(db, C.seatMoveOps(db, 's1', 1, 1));
  assert.deepEqual(db.students[0].seat, {
    row: 1,
    col: 1
  });
  db.students.push({
    id: 's3',
    no: 3,
    name: '가상3',
    seat: null
  });
  db = C.applyOps(db, C.seatMoveOps(db, 's3', 0, 0));
  assert.equal(db.students[1].seat, null);
  assert.deepEqual(db.students[2].seat, {
    row: 0,
    col: 0
  });
  assert.throws(() => C.seatMoveOps(db, 's3', 20, 0));
  assert.deepEqual(C.seatMoveOps(db, 's3', 0, 0), []);
});
