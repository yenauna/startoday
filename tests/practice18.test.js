import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
test('학생 달력 중요도는 명시적 false만 일반 안내로 처리하고 레거시 일정은 보존', () => {
  const db = C.initialDB();
  db.students = [{
    id: 's',
    no: 1,
    name: '가온'
  }];
  db.events = [{
    id: 'old',
    date: C.today(),
    title: '기존 안내'
  }, {
    id: 'important',
    date: C.today(),
    title: '중요 안내',
    isImportant: true
  }, {
    id: 'normal',
    date: C.today(),
    title: '일반 안내',
    description: '상세 유지',
    isImportant: false
  }];
  const before = structuredClone(db.events),
    data = C.studentCalendarData(db, 's');
  assert.deepEqual(data.events.map(e => e.isImportant), [true, true, false]);
  assert.equal(data.events[2].description, '상세 유지');
  assert.deepEqual(db.events, before);
  assert.equal(C.calendarEvents(db).length, 3);
});
test('학사일정과 일반 안내의 오늘 타임라인은 중요도와 무관하게 유지', () => {
  const db = C.initialDB();
  db.events = [{
    id: 'normal',
    date: C.today(),
    title: '준비물 안내',
    period: 0,
    isImportant: false
  }];
  const calendar = C.studentCalendarData(db, 's');
  assert.equal(calendar.events[0].isImportant, false);
  assert.ok(C.calendarEvents(db).some(e => e.title === '준비물 안내'));
  assert.ok(C.dayTimeline(db, C.today()).some(x => JSON.stringify(x).includes('준비물 안내')));
});
