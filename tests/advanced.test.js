import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
function fixture() {
  const db = C.initialDB();
  db.students = [{
    id: 'a',
    no: 1,
    name: '가온'
  }, {
    id: 'b',
    no: 2,
    name: '지우'
  }, {
    id: 'c',
    no: 3,
    name: '다온'
  }, {
    id: 'd',
    no: 4,
    name: '라온'
  }];
  return db;
}
test('접속 조사·쉼표로 연결된 학생은 마지막 주어를 따라 모두 대상이 됨', () => {
  const db = fixture();
  for (const text of ['3번과 4번이 함께 발표', '3번하고 4번이 함께 발표', '3번랑 4번이 함께 발표']) assert.deepEqual(new Set(C.parseInput(text, db).studentIds), new Set(['c', 'd']));
  for (const text of ['가온이와 지우가 발표', '가온하고 지우가 발표', '가온이랑 지우가 발표', '1번, 2번이 발표', '가온, 지우가 발표']) assert.deepEqual(new Set(C.parseInput(text, db).studentIds), new Set(['a', 'b']), text);
  assert.deepEqual(new Set(C.parseInput('1번, 2번과 3번이 발표', db).studentIds), new Set(['a', 'b', 'c']));
  assert.deepEqual(C.parseInput('지우가 3번과 4번에게 도움', db).studentIds, ['b']);
  assert.deepEqual(C.parseInput('3번에게, 4번이 도움', db).studentIds, ['d']);
  assert.deepEqual(C.parseInput('가온이와 지우에게 도움', db).studentIds, []);
  assert.deepEqual(C.parseInput('지우개와 4번이 보임', db).studentIds, ['d']);
});
test('시간 미지정과 예전 기타 값은 빈 표시로 정규화하고 정상 교시는 유지', () => {
  const settings = C.initialDB().settings[0];
  assert.equal(C.inputPeriod('7교시', settings), '');
  assert.equal(C.periodAtTime({
    periodTimes: []
  }, new Date('2026-11-08T00:00Z')), '');
  for (const value of ['', null, undefined, '기타', '7교시']) assert.equal(C.recordPeriod(value), '');
  for (const period of C.PERIODS) assert.equal(C.recordPeriod(period), period);
  assert.equal(C.inputPeriod('쉬는시간', settings), '쉬는시간');
});
test('학기 자동 범위는 봄방학 사용 여부·겨울방학·월 경계를 반영', () => {
  const settings = {
    academicCalendar: {
      term1Start: '2026-03-02',
      summerEnd: '2026-07-20',
      term2Start: '2026-08-24',
      winterEnd: '2026-12-31',
      springEnd: '2027-02-10',
      springBreak: true
    }
  };
  assert.deepEqual(C.semesterRange(settings, 1), {
    from: '2026-03-02',
    to: '2026-07-20'
  });
  assert.deepEqual(C.semesterRange(settings, 2), {
    from: '2026-08-24',
    to: '2027-02-10'
  });
  assert.equal(C.hoursDefaultRange(settings, '2027-01-03').from, '2026-08-24');
  assert.equal(C.hoursDefaultRange(settings, '2026-06-02').from, '2026-03-02');
  assert.deepEqual(C.hoursDefaultRange(settings, '2026-08-01'), {
    from: '2026-08-01',
    to: '2026-08-31'
  });
  settings.academicCalendar.springBreak = false;
  assert.equal(C.semesterRange(settings, 2).to, '2026-12-31');
  assert.deepEqual(C.monthRange('2024-02'), {
    from: '2024-02-01',
    to: '2024-02-29'
  });
  assert.equal(C.semesterRange({}, 1), null);
});
test('선택 월·학기 변화는 누적과 독립적으로 계산하고 제외일을 배제', () => {
  const db = fixture();
  db.records = [['march', '2026-03-03', '칭찬'], ['oct', '2026-10-05', '지도'], ['nov', '2026-11-02', '칭찬'], ['excluded', '2026-11-03', '지도']].map(([id, date, kind]) => ({
    id,
    date,
    kind,
    studentIds: ['a'],
    areas: ['학습태도']
  }));
  db.attendance = [{
    id: 'ex',
    studentId: 'a',
    date: '2026-11-03',
    excluded: true
  }];
  const nov = C.studentScoreSummary(db, 'a', '2026-11-08', '2026-11-01', '2026-11-30'),
    oct = C.studentScoreSummary(db, 'a', '2026-11-08', '2026-10-01', '2026-10-31'),
    term = C.studentScoreSummary(db, 'a', '2026-11-08', '2026-03-02', '2026-07-20');
  assert.equal(nov.total, 1);
  assert.equal(oct.total, 1);
  assert.equal(term.total, 1);
  assert.equal(nov.change, 1);
  assert.equal(nov.adviceChange, 0);
  assert.equal(oct.change, -1);
  assert.equal(oct.adviceChange, -1);
  assert.equal(term.praiseChange, 1);
});
