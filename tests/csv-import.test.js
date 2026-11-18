import assert from 'node:assert/strict';
import test from 'node:test';
import { detectImportMapping, importKindFrom, parseCSV, parseImportDate, splitImportAreas } from '../js/shared/csv.js';

test('CSV: BOM, 따옴표, 쉼표, CRLF, 빈 줄을 RFC 4180으로 읽음', () => {
  const rows = parseCSV('\uFEFF이름,내용\r\n김가온,"쉼표, 포함한 기록"\r\n이나래,"따옴표 ""인용"" 처리"\r\n\r\n');
  assert.deepEqual(rows, [['이름', '내용'], ['김가온', '쉼표, 포함한 기록'], ['이나래', '따옴표 "인용" 처리']]);
});

test('CSV: 따옴표 안의 줄바꿈은 한 칸으로 유지', () => {
  const rows = parseCSV('이름,내용\n김가온,"첫 줄\n둘째 줄"\n');
  assert.deepEqual(rows, [['이름', '내용'], ['김가온', '첫 줄\n둘째 줄']]);
});

test('CSV: 빈 값과 마지막 열 없는 행도 열 수를 맞춤', () => {
  assert.deepEqual(parseCSV('a,b,c\n1,,3\n4,5\n'), [['a', 'b', 'c'], ['1', '', '3'], ['4', '5']]);
});

test('CSV: 읽을 내용이 없는 줄만 건너뜀', () => {
  assert.deepEqual(parseCSV('a,b\n,\n1,2\n'), [['a', 'b'], ['1', '2']]);
});

test('날짜: 점·붙임표·한글·8자리 표기를 ISO로 바꿈', () => {
  assert.equal(parseImportDate('2026.11.10'), '2026-11-10');
  assert.equal(parseImportDate('2026. 11. 10.'), '2026-11-10');
  assert.equal(parseImportDate('2026-3-4'), '2026-03-04');
  assert.equal(parseImportDate('2026년 11월 12일'), '2026-11-12');
  assert.equal(parseImportDate('20261113'), '2026-11-13');
  assert.equal(parseImportDate('2026-11-10T09:00:00Z'), '2026-11-10');
});

test('날짜: 잘못된 값은 빈 문자열', () => {
  assert.equal(parseImportDate(''), '');
  assert.equal(parseImportDate('어제'), '');
  assert.equal(parseImportDate('2026-02-31'), '');
  assert.equal(parseImportDate('2026-13-01'), '');
});

test('유형: 칭찬·조언·기록과 +1/-1/0을 앱 구분으로 옮김', () => {
  assert.equal(importKindFrom('칭찬').kind, '칭찬');
  assert.equal(importKindFrom('+1').kind, '칭찬');
  assert.equal(importKindFrom('격려').kind, '칭찬');
  assert.equal(importKindFrom('조언').kind, '지도');
  assert.equal(importKindFrom('-1').kind, '지도');
  assert.equal(importKindFrom('지도').kind, '지도');
  assert.equal(importKindFrom('기록').kind, '관찰');
  assert.equal(importKindFrom('0').kind, '관찰');
  assert.equal(importKindFrom('관찰').kind, '관찰');
  assert.equal(importKindFrom('추가기록').kind, '추가기록');
  assert.equal(importKindFrom('상담').extraType, '상담');
  assert.equal(importKindFrom('사건').extraType, '사건');
  assert.deepEqual(importKindFrom('알 수 없음'), {kind: '관찰', extraType: null, matched: false});
});

test('분야: 쉼표·가운뎃점·빗금으로 나누고 공백을 정리', () => {
  assert.deepEqual(splitImportAreas('관계, 학습'), ['관계', '학습']);
  assert.deepEqual(splitImportAreas('관계 · 생활 / 도전'), ['관계', '생활', '도전']);
  assert.deepEqual(splitImportAreas(''), []);
});

test('열 자동 인식: 이름·날짜·분야·유형·기록 내용을 찾아냄', () => {
  const headers = ['번호', '학생 이름', '작성 날짜', '분야', '구분', '기록 내용'];
  const rows = [
    ['1', '김가온', '2026-11-10', '관계', '칭찬', '급우와 협력하여 모둠 활동을 마무리함'],
    ['2', '이나래', '2026-11-11', '학습', '조언', '준비물을 챙기지 않아 다음 시간에 다시 확인함'],
    ['3', '다온', '2026-11-12', '생활', '기록', '급식실에서 질서를 지키고 뒷정리를 도움']
  ];
  assert.deepEqual(detectImportMapping(headers, rows), {name: 1, content: 5, date: 2, area: 3, type: 4});
});

test('열 자동 인식: 알아볼 열이 없으면 null', () => {
  const mapping = detectImportMapping(['가', '나'], [['1', '2']]);
  assert.equal(mapping.name, null);
  assert.equal(mapping.content, null);
});

test('열 자동 인식: 번호 열을 이름으로 고르지 않음', () => {
  const headers = ['번호', '이름', '내용'];
  const rows = [['1', '김가온', '모둠 활동에 적극적으로 참여하여 의견을 조율함'], ['2', '이나래', '발표 준비를 스스로 마치고 친구를 도움']];
  assert.equal(detectImportMapping(headers, rows).name, 1);
});
