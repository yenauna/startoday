import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
test('학사일정은 설정에서 파생되어 중복 저장 없이 수동 일정과 함께 표시', () => {
  const db = C.initialDB();
  db.events = [{
    id: 'manual',
    date: '2026-03-02',
    title: '수동 일정'
  }];
  db.settings[0].academicCalendar = {
    term1Start: '2026-03-02',
    summerEnd: '2026-07-20',
    term2Start: '2026-08-24',
    winterEnd: '2026-12-31',
    winterReturn: '2027-02-01',
    springEnd: '2027-02-10',
    springBreak: false,
    holidays: ['2026-05-04', '2026-05-04']
  };
  let events = C.calendarEvents(db);
  assert.equal(events.length, 6);
  assert.equal(db.events.length, 1);
  assert(!events.some(e => e.date === '2027-02-01'));
  db.settings[0].academicCalendar.springBreak = true;
  events = C.calendarEvents(db);
  assert.equal(events.length, 8);
  assert.equal(events.find(e => e.date === '2027-02-10').title, '종업식');
  assert.equal(events.find(e => e.date === '2026-05-04').title, '자율휴업일');
  db.settings[0].academicCalendar.term1Start = '2026-03-03';
  assert(!C.calendarEvents(db).some(e => e.academic && e.date === '2026-03-02'));
});
test('경험치 일괄 이름 교환·순서 변경은 기존 참조를 한 번만 치환하고 이력을 보존', () => {
  const db = C.initialDB();
  db.areas = C.defaultAreas();
  db.records = [{
    id: 'r',
    areas: ['학습태도', '과제'],
    text: '보존',
    studentIds: ['s']
  }];
  db.assignments = [{
    id: 'a',
    statArea: '학습태도'
  }];
  const draft = structuredClone(db.areas);
  [draft[0].name, draft[1].name] = [draft[1].name, draft[0].name];
  draft[0].deletedAt = C.now();
  draft.reverse();
  const next = C.applyOps(db, C.areaBatchOps(db, draft));
  assert.deepEqual(next.records[0].areas, ['과제', '학습태도']);
  assert.equal(next.records[0].text, '보존');
  assert.equal(next.assignments[0].statArea, '과제');
  assert.equal(next.areas.find(a => a.id === 'area-1').deletedAt, draft.find(a => a.id === 'area-1').deletedAt);
  assert.throws(() => C.areaBatchOps(db, [...draft, {
    ...draft[0],
    id: 'new'
  }]), /중복/);
  assert.equal(db.assignments[0].statArea, '학습태도');
});
test('알림장 숫자 포인트와 확장 색상은 선택 범위에만 적용하고 잘못된 값 차단', () => {
  const original = C.normalizeAnnouncement({
    text: '알림장 내용'
  });
  for (const size of ['18', '24', '32', '40', '48', '64']) for (const color of ['green', 'purple', 'orange', 'gray']) {
    const note = C.formatAnnouncement(original, 0, 3, {
      size,
      color
    });
    assert.equal(note.text, original.text);
    assert.equal(note.runs[0].size, size);
    assert.equal(note.runs[0].color, color);
    assert.equal(note.runs.at(-1).size, 'normal');
  }
  const bad = C.normalizeAnnouncement({
    runs: [{
      text: '안전',
      size: '999',
      color: 'url(x)'
    }]
  });
  assert.equal(bad.runs[0].size, 'normal');
  assert.equal(bad.runs[0].color, 'default');
});
