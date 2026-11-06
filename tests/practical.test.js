import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
function fixture() {
  const db = C.initialDB();
  db.students = [{
    id: 's1',
    no: 10,
    name: '지우'
  }, {
    id: 's2',
    no: 1,
    name: '라온'
  }, {
    id: 's3',
    no: 51,
    name: '나래'
  }];
  return db;
}
test('독립된 이름과 한국어 조사만 매칭하고 지우개 같은 부분 단어는 차단', () => {
  const db = fixture();
  assert.deepEqual(C.parseInput('지우가 라온이의 지우개를 빌림', db).studentIds.sort(), ['s1', 's2']);
  for (const particle of ['가', '이', '는', '은', '를', '을', '의', '와', '과', '랑', '에게', '한테', '도']) assert(C.nameInSentence('지우' + particle + ' 참여', '지우'), particle);
  for (const text of ['지우개', '지우개를', '유지우', '지우면서', '지우는개', '학습지우']) assert(!C.nameInSentence(text, '지우'), text);
  assert(C.nameInSentence('(지우), 라온', '지우'));
  assert(C.nameInSentence('라온이의 책', '라온'));
  assert.deepEqual(C.parseInput('지우개를 사용', db).studentIds, []);
});
test('번호 목록, 중복 이름 경고와 고정 선택 우선 유지', () => {
  const db = fixture();
  assert.deepEqual(C.parseInput('1, 51번 준비', db).studentIds, ['s2', 's3']);
  assert.equal(C.parseInput('1001번 준비', db).studentIds.length, 0);
  assert.deepEqual(C.parseInput('지우가 참여', db, ['s3']).studentIds, ['s3']);
  db.students.push({
    id: 's4',
    no: 2,
    name: '지우'
  });
  assert(C.parseInput('지우가 참여', db).warnings.length);
  assert(C.nameInSentence('가(온)이 참여', '가(온)'));
});
test('교시 옵션은 6교시와 쉬는시간까지 지원', () => {
  assert(C.PERIODS.includes('쉬는시간'));
  assert(!C.PERIODS.includes('7교시'));
  assert.equal(C.parseInput('1번 쉬는 시간 메모', fixture()).period, '쉬는시간');
  assert.equal(C.parseInput('1번 7교시 메모', fixture()).period, '기타');
});
test('태그 없는 새 데이터와 예전 태그 포함 백업의 기록 보존', () => {
  const db = fixture();
  assert(!C.TABLES.includes('tags'));
  assert(!Object.hasOwn(db, 'tags'));
  db.tags = [{
    id: 'old',
    aliases: []
  }];
  db.records = [{
    id: 'r',
    studentIds: ['s1'],
    date: C.today(),
    kind: '관찰',
    text: '기존 기록',
    createdAt: C.now(),
    areas: [],
    tagIds: ['old']
  }];
  const restored = C.validateBackup({
    app: 'startoday',
    version: 1,
    data: db
  });
  assert.equal(restored.records[0].text, '기존 기록');
  assert(!Object.hasOwn(restored, 'tags'));
  assert(!Object.hasOwn(restored.records[0], 'tagIds'));
  assert(!Object.hasOwn(C.parseInput('지우가 참여', restored), 'tagIds'));
});
test('알림 선택 영역 서식은 원문과 다른 영역 서식을 보존', () => {
  let n = C.normalizeAnnouncement({
    text: '준비물 색연필 가져오기',
    size: 'large',
    color: 'default'
  });
  n = C.formatAnnouncement(n, 4, 7, {
    color: 'red'
  });
  assert.equal(n.text, '준비물 색연필 가져오기');
  assert.equal(n.runs[1].text, '색연필');
  assert.equal(n.runs[1].color, 'red');
  assert(n.runs.every(r => r.size === 'large'));
  n = C.formatAnnouncement(n, 4, 7, {
    size: 'huge'
  });
  assert.equal(n.runs[1].size, 'huge');
  const safe = C.normalizeAnnouncement({
    runs: [{
      text: '<script>\n메모',
      size: '1000px',
      color: 'javascript:bad'
    }]
  });
  assert.equal(safe.runs[0].color, 'default');
  assert.equal(safe.runs[0].size, 'normal');
  assert.equal(safe.text, '<script>\n메모');
});
test('달력의 루틴 면제는 대상·출결·기존 체크 이력을 보존', () => {
  const db = fixture(),
    date = '2026-11-07';
  db.routines = [{
    id: 'r1',
    title: '독서',
    target: 'all',
    sortOrder: 0,
    exceptions: {
      [date]: {
        exempt: true,
        memo: '체험학습'
      }
    }
  }, {
    id: 'r2',
    title: '정리',
    target: {
      studentIds: ['s1']
    },
    sortOrder: 1
  }];
  db.routineStates = [{
    id: C.stateId('r1', date, 's1'),
    routineId: 'r1',
    date,
    studentId: 's1',
    status: '완료'
  }];
  assert.equal(C.routineStatus(db, 'r1', date, 's1'), '면제');
  assert.deepEqual(C.pendingRoutines(db, 's1', date).map(r => r.id), ['r2']);
  assert.deepEqual(C.pendingRoutines(db, 's2', date), []);
  delete db.routines[0].exceptions[date];
  assert.equal(C.routineStatus(db, 'r1', date, 's1'), '완료');
  db.attendance = [{
    studentId: 's1',
    date,
    excluded: true
  }];
  assert.deepEqual(C.pendingRoutines(db, 's1', date), []);
});
