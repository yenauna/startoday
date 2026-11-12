import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
test('편지 기간의 양끝 날짜는 당일 포함 30일/7일이며 월·연도·윤년 경계에 안전', () => {
  assert.deepEqual(C.studentPraiseRange({
    studentPraisePeriod: '30d'
  }, '2026-01-02'), {
    from: '2025-12-04',
    to: '2026-01-02'
  });
  assert.deepEqual(C.studentPraiseRange({
    studentPraisePeriod: '7d'
  }, '2026-01-02'), {
    from: '2025-12-27',
    to: '2026-01-02'
  });
  assert.deepEqual(C.studentPraiseRange({
    studentPraisePeriod: '30d'
  }, '2024-03-01'), {
    from: '2024-02-01',
    to: '2024-03-01'
  });
  assert.deepEqual(C.studentPraiseRange({
    studentPraisePeriod: 'month'
  }, '2024-03-01'), {
    from: '2024-03-01',
    to: '2024-03-01'
  });
});
test('새 학급과 구 설정은 전체 칭찬을 기본으로 사용', () => {
  assert.equal(C.initialDB().settings[0].studentPraisePeriod, 'all');
  for (const value of [undefined, null, '', 'unknown']) assert.deepEqual(C.studentPraiseRange({
    studentPraisePeriod: value
  }, '2026-11-12'), {
    from: '',
    to: '2026-11-12'
  });
});
