import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
function roster(n) {
  const db = C.initialDB();
  db.students = Array.from({
    length: n
  }, (_, i) => ({
    id: 's' + i,
    no: i + 1,
    name: '학생' + i,
    seat: null
  }));
  return db;
}
test('신규 명단은 정방형으로 배치하고 자유 이동 빈칸을 제공', () => {
  for (const [n, side] of [[25, 5], [16, 4], [15, 4]]) {
    const db = roster(n),
      next = C.applyOps(db, C.autoSeatOps(db));
    assert.equal(new Set(next.students.map(s => s.seat.row + ':' + s.seat.col)).size, n);
    assert(next.students.every(s => s.seat.row < side && s.seat.col < side));
    assert.equal(next.settings[0].seatRows, side + 2);
    assert.equal(next.settings[0].seatCols, side + 2);
    assert.equal(C.autoSeatOps(next).length, 0);
  }
});
test('기존 자유 배치는 명단 추가·수정 시 보존하고 신규 학생만 빈칸에 배치', () => {
  let db = C.applyOps(roster(15), C.autoSeatOps(roster(15)));
  db = C.applyOps(db, C.seatMoveOps(db, 's0', 5, 5));
  const existing = structuredClone(db.students);
  const next = C.applyOps(db, C.withAutoSeats(db, [{
    table: 'students',
    id: 'new',
    data: {
      id: 'new',
      no: 50,
      name: '추가',
      seat: null
    }
  }]));
  for (const old of existing) assert.deepEqual(next.students.find(s => s.id === old.id).seat, old.seat);
  assert(next.students.find(s => s.id === 'new').seat);
  assert.equal(new Set(next.students.map(s => s.seat.row + ':' + s.seat.col)).size, 16);
});
test('날짜 표기와 사건 제목은 저장 원문을 바꾸지 않고 요일을 계산', () => {
  assert.equal(C.formatDate('2026-11-07'), '2026.11.07.(토)');
  assert.equal(C.formatDate('2026-02-30'), '');
  assert.equal(C.formatTimestamp('2026-11-06T23:30:00Z'), '2026.11.07.(토) 08:30');
  const db = roster(2);
  db.students[0].name = '김가온';
  db.students[1].name = '박지우';
  db.students[1].no = 3;
  assert.equal(C.incidentTitle(db, ['s1', 's0'], '2026-11-07'), '1김가온 3박지우 2026.11.07.(토)');
});
test('학생 표는 전체 순점수·칭찬·조언과 이번 달 변화, 제외일을 일관되게 계산', () => {
  const db = roster(1);
  db.records = [['past', '2026-10-10', '칭찬'], ['new', '2026-11-01', '칭찬'], ['advice', '2026-11-02', '지도'], ['exclude', '2026-11-03', '지도'], ['future', '2026-11-08', '칭찬'], ['memo', '2026-11-01', '추가기록']].map(([id, date, kind]) => ({
    id,
    date,
    kind,
    studentIds: ['s0'],
    areas: ['관계']
  }));
  db.attendance = [{
    id: 'ex',
    studentId: 's0',
    date: '2026-11-03',
    excluded: true
  }];
  const score = C.studentScoreSummary(db, 's0', '2026-11-07');
  assert.equal(score.total, 1);
  assert.equal(score.change, 0);
  assert.equal(score.praise, 2);
  assert.equal(score.praiseChange, 1);
  assert.equal(score.advice, 1);
  assert.equal(score.adviceChange, -1);
  assert.equal(score.areas['관계'], 1);
});
