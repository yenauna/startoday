import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
function fixture(count = 0) {
  const db = C.initialDB();
  db.students = [{
    id: 's',
    no: 1,
    name: '가온'
  }];
  db.records = Array.from({
    length: count
  }, (_, i) => ({
    id: 'r' + i,
    date: C.today(),
    kind: '칭찬',
    studentIds: ['s'],
    text: '독서 도서관 대출 청소',
    areas: ['생활']
  }));
  return db;
}
test('7대 영역·21개 칭호와 3/7/15회 승급은 점수와 독립적', () => {
  assert.equal(C.KINGDOM_DOMAINS.length, 7);
  assert.equal(C.KINGDOM_DOMAINS.flatMap(d => d.titles).length, 21);
  for (const [count, stage, next] of [[0, 0, 3], [2, 0, 3], [3, 1, 7], [6, 1, 7], [7, 2, 15], [14, 2, 15], [15, 3, null], [100, 3, null]]) {
    const db = fixture(count),
      reading = C.kingdomCatalog(C.kingdomCounts(db, 's')).find(d => d.id === 'reading');
    assert.equal(reading.stage, stage);
    assert.equal(reading.next, next);
    assert.equal(reading.remaining, next === null ? 0 : next - count);
    assert.equal(reading.unlocked.length, stage);
  }
});
test('모든 키워드는 공백을 허용하며 같은 기록/영역은 중복 없이 한 번만 집계', () => {
  for (const d of C.KINGDOM_DOMAINS) for (const keyword of d.keywords) assert(C.kingdomMatches(keyword).includes(d.id));
  const db = fixture(1);
  assert.equal(C.kingdomCounts(db, 's').reading, 1);
  assert.equal(C.kingdomCounts(db, 's').cleaning, 1);
  assert(C.kingdomMatches('[도서관] 책 소개').includes('reading'));
  db.records = [{
    id: 'subject',
    date: C.today(),
    kind: '칭찬',
    studentIds: ['s'],
    subjectCode: '체육',
    text: '[체육] 친구 도움'
  }];
  assert.equal(C.kingdomCounts(db, 's').fitness, 0);
  assert(C.kingdomMatches('수업준비를 잘함').includes('preparation'));
});
test('칭찬만 집계: 조언·관찰·추가기록·다른 학생·미래·출결제외는 제외', () => {
  const db = fixture(1);
  for (const [i, kind] of ['지도', '조언', '관찰', '추가기록'].entries()) db.records.push({
    ...db.records[0],
    id: 'n' + i,
    kind
  });
  db.records.push({
    ...db.records[0],
    id: 'other',
    studentIds: ['other']
  }, {
    ...db.records[0],
    id: 'future',
    date: C.addDays(C.today(), 1)
  });
  assert.equal(C.kingdomCounts(db, 's').reading, 1);
  db.attendance = [{
    id: 'ex',
    studentId: 's',
    date: C.today(),
    excluded: true
  }];
  assert.equal(C.kingdomCounts(db, 's').reading, 0);
});
test('기존 기록 자동 집계·수정·삭제·실행취소는 기록 원본이나 점수를 변경하지 않음', () => {
  let db = fixture(7);
  const original = structuredClone(db);
  assert.equal(C.kingdomCatalog(C.kingdomCounts(db, 's'))[0].stage, 2);
  assert.deepEqual(db, original);
  db.records.pop();
  assert.equal(C.kingdomCatalog(C.kingdomCounts(db, 's'))[0].stage, 1);
  db.records[0].kind = '관찰';
  assert.equal(C.kingdomCounts(db, 's').reading, 5);
  db = structuredClone(original);
  assert.equal(C.kingdomCounts(db, 's').reading, 7);
});
test('대표 칭호는 모든 획득 단계 중 선택하고 새로 읽어도 보존, 미획득/타인/임의 칭호 거부', () => {
  let db = fixture(15);
  for (const id of ['reading:1', 'reading:2', 'reading:3', 'cleaning:1']) {
    db = C.applyOps(db, C.studentTitleOps(db, 's', id));
    const restored = C.normalizeDB(JSON.parse(JSON.stringify(db)));
    assert.equal(C.kingdomEquipped(restored.students[0], C.kingdomCounts(restored, 's')).id, id);
  }
  for (const id of ['safety:1', 'reading:4', '<script>']) assert.throws(() => C.studentTitleOps(db, 's', id), /획득/);
  assert.throws(() => C.studentTitleOps(db, 'other', 'reading:1'));
  db = C.applyOps(db, C.studentTitleOps(db, 's', null));
  assert.equal(C.kingdomEquipped(db.students[0], C.kingdomCounts(db, 's')).name, '별의 주민');
});
test('기록 삭제로 장착 기준 미달이면 기본 칭호 표시, 다른 개인정보 필드는 보존', () => {
  let db = fixture(3);
  db.students[0].password = '비밀암호7';
  db = C.applyOps(db, C.studentTitleOps(db, 's', 'reading:1'));
  assert.equal(db.students[0].password, '비밀암호7');
  db.records = [];
  assert.equal(C.kingdomEquipped(db.students[0], C.kingdomCounts(db, 's')).id, null);
  assert.equal(db.students[0].equippedTitle, 'reading:1');
});
test('과제 자동 칭찬은 완료만 집계하고 상태 메모·늦게완료·면제는 감지하지 않음', () => {
  let db = fixture();
  const a = {
    id: 'a',
    title: '독서',
    target: 'all'
  };
  db.assignments = [a];
  for (const status of ['완료', '늦게완료', '면제', '안함', '진행중']) {
    db = C.applyOps(db, C.taskStateOps(db, a, C.today(), 's', status, '청소'));
    assert.equal(C.kingdomCounts(db, 's').reading, status === '완료' ? 1 : 0);
    assert.equal(C.kingdomCounts(db, 's').cleaning, 0);
  }
});
test('서버와 브라우저의 영역·키워드·칭호 모델은 같은 사전을 사용', async () => {
  const {
    readFile
  } = await import('node:fs/promises');
  const sql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const dictionary = sql.match(/from jsonb_array_elements\('(\[\{"id":"reading".*?\])'::jsonb\) domain;/s);
  assert(dictionary);
  assert.deepEqual(JSON.parse(dictionary[1]), C.KINGDOM_DOMAINS);
});
