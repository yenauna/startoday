import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
test('미래 디데이는 상단 카운트다운 전용이며 주간 티커에는 일반 미래 일정만 남김', () => {
  const db = C.initialDB(),
    date = '2026-11-11';
  db.events = [{
    id: 'future',
    date: '2026-11-12',
    period: 2,
    title: '디데이 시험',
    isDday: true
  }, {
    id: 'regular',
    date: '2026-11-13',
    title: '다음 행사',
    description: '준비물'
  }, {
    id: 'past',
    date: '2026-11-10',
    title: '지난 행사'
  }];
  db.timetables = [];
  const context = {
    C,
    db: () => db,
    state: {
      date
    },
    window: {
      addEventListener() {}
    },
    document: {
      addEventListener() {}
    },
    periodInfo: () => ({
      type: '일반'
    })
  };
  vm.createContext(context);
  const source = readFileSync(new URL('../js/tabs/dashboard.js', import.meta.url), 'utf8');
  vm.runInContext(source.slice(source.indexOf('export function weekSummary()'), source.indexOf('export function dashboard()')).replaceAll('export ', ''), context);
  assert.equal(context.weekSummary(), '다음 행사 · 준비물');
  assert(!C.dayTimeline(db, date).some(p => p.events?.some(e => e.id === 'future')));
  assert.equal(C.dday(db.events[0].date, date), 'D-1');
});
