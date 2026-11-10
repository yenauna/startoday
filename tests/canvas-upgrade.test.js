import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as C from '../js/core.js';
import { SUBJECT_MOODS, smartSubjectAccents, paletteContrast } from '../js/shared/subject-palette.js';
import { restoreToolRect } from '../js/shared/tools-core.js';
test('감성 10색은 기본 과목 배경과 중복되지 않고 추천 포인트는 읽기 쉬운 대비를 제공', () => {
  const defaults = C.DEFAULT_SUBJECT_CODES.map(code => C.defaultSubjectColors(code).background.toUpperCase());
  assert.equal(SUBJECT_MOODS.length, 10);
  assert.equal(new Set(SUBJECT_MOODS.map(x => x.background)).size, 10);
  for (const mood of SUBJECT_MOODS) {
    assert(!defaults.includes(mood.background));
    const pairs = smartSubjectAccents(mood.background);
    assert.equal(pairs.length, 3);
    assert.equal(new Set(pairs).size, 3);
    assert(pairs.every(c => paletteContrast(mood.background, c) >= 4.5));
  }
  for (const background of ['#142034', '#777777', '#888888', '#999999']) {
    const colors = smartSubjectAccents(background);
    assert(colors.every(c => paletteContrast(background, c) >= 4.5));
    assert.equal(new Set(colors).size, 3);
  }
});
test('창 배치는 저장한 도구별 좌표를 복원하고 손상된 값은 기본값으로 대체', () => {
  const saved = {
    left: 130,
    top: 90,
    width: 480,
    height: 330
  };
  assert.deepEqual(restoreToolRect(saved, 0, 1200, 700), saved);
  const corrupt = restoreToolRect({
    ...saved,
    width: NaN
  }, 0, 1200, 700);
  assert.equal(corrupt.width, 1200);
  assert.equal(corrupt.left, 0);
  const small = restoreToolRect(saved, 0, 390, 500);
  assert(small.width <= 390);
});
test('일정 시간대는 새 7/8 점심·방과후를 지원하면서 기존 숫자의 의미를 보존', () => {
  assert.equal(C.eventTimePeriod({
    period: 7
  }), 8);
  assert.equal(C.eventTimePeriod({
    period: 8
  }), 7);
  assert.equal(C.eventTimePeriod({
    period: 7,
    timeOfDay: 'lunch'
  }), 7);
  assert.equal(C.eventTimePeriod({
    period: 8,
    timeOfDay: 'after'
  }), 8);
  assert.equal(C.eventTimePeriod({
    period: 0
  }), 0);
  assert.equal(C.eventTimePeriod({
    period: null
  }), null);
});
test('아침→1~4교시→점심→5~6교시→방과후 타임라인은 날짜와 레거시 값을 안전하게 분류', () => {
  const db = C.initialDB(),
    date = '2026-11-11';
  db.events = [{
    id: 'morning',
    date,
    period: 0,
    title: '등교'
  }, {
    id: 'lunch',
    date,
    period: 7,
    timeOfDay: 'lunch',
    title: '급식'
  }, {
    id: 'legacy-after',
    date,
    period: 7,
    title: '동아리'
  }, {
    id: 'all',
    date,
    period: null,
    title: '종일'
  }, {
    id: 'past',
    date: '2026-11-10',
    period: 0,
    title: '어제'
  }];
  const timeline = C.dayTimeline(db, date);
  assert.deepEqual(timeline.map(p => p.period), [0, 1, 2, 3, 4, 7, 5, 6, 8]);
  assert.deepEqual(timeline.filter(p => p.type === 'event').map(p => p.events.map(e => e.title)), [['등교'], ['급식'], ['동아리']]);
});
test('PWA manifest는 하위 경로에서도 동작하는 독립 창 설정과 실제 아이콘을 제공', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert(manifest.icons.every(i => existsSync(new URL('../' + i.src, import.meta.url))));
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /rel="manifest" href="manifest.json"/);
});
test('주간 티커는 어제·오늘·다음 주 일정을 제외하고 다가오는 이번 주 일정만 제공', () => {
  const db = C.initialDB();
  db.events = [['어제', '2026-11-10'], ['오늘', '2026-11-11'], ['내일', '2026-11-12'], ['금요일', '2026-11-13'], ['다음주', '2026-11-16']].map(([title, date], i) => ({
    id: String(i),
    title,
    date
  }));
  assert.deepEqual(C.upcomingWeekEvents(db, '2026-11-11').map(e => e.title), ['내일', '금요일']);
});
