import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
test('명단은 붙은 마침표, 공백, 쉼표, 탭을 동일하게 파싱', () => {
  for (const text of ['1. 김민준', '1.김민준', '1 김민준', '1, 김민준', '1\t김민준']) assert.deepEqual(C.parseRoster(text)[0], {
    no: 1,
    name: '김민준',
    group: ''
  });
  assert.equal(C.parseRoster('김민준', 5)[0].no, 5);
  assert.equal(C.parseRoster('2.이서연\n3,박지우')[1].name, '박지우');
});
test('이번 달 요약은 활성 학생/출결을 고려하고 칭찬 영역 TOP 1을 집계', () => {
  const db = C.initialDB(),
    date = '2026-11-10';
  db.students = [{
    id: 'a',
    no: 1,
    name: '가온'
  }, {
    id: 'b',
    no: 2,
    name: '다온'
  }];
  db.records = [{
    id: 'p',
    date,
    kind: '칭찬',
    studentIds: ['a', 'b'],
    areas: ['생활']
  }, {
    id: 'a',
    date,
    kind: '지도',
    studentIds: ['a'],
    areas: ['생활']
  }, {
    id: 'old',
    date: '2026-10-10',
    kind: '칭찬',
    studentIds: ['a'],
    areas: ['과제']
  }];
  assert.deepEqual(C.classStatisticsSummary(db, date), {
    total: 1,
    praise: 2,
    advice: 1,
    praisePercent: 67,
    topArea: '생활',
    topCount: 2
  });
  db.attendance = [{
    studentId: 'b',
    date,
    excluded: true
  }];
  assert.equal(C.classStatisticsSummary(db, date).praise, 1);
});
test('공개 과제 메모와 확인자는 최소한의 정보만 반환', () => {
  const db = C.initialDB();
  db.students = [{
    id: 'check',
    no: 3,
    name: '다온',
    password: 'PRIVATE_PASS'
  }];
  const info = C.assignmentPublicInfo(db, {
    memo: '태블릿\n준비',
    checkerStudentId: 'check'
  });
  assert.deepEqual(info, {
    memo: '태블릿\n준비',
    checkerName: '3. 다온'
  });
  assert(!JSON.stringify(info).includes('PRIVATE_PASS'));
});
