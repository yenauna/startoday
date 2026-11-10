import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
const date = '2026-11-10';
function fixture() {
  const db = C.initialDB();
  db.students = [{
    id: 'one',
    no: 1,
    name: '가온'
  }, {
    id: 'two',
    no: 2,
    name: '다온'
  }];
  db.timetables = [{
    id: 'slot',
    date,
    period: 2,
    subjectCode: '국어',
    publicMemo: '필통\n준비',
    privateMemo: 'SECRET'
  }];
  return db;
}
const at = t => new Date(`${date}T${t}+09:00`);
test('일반 수업 카운트다운은 쉬는 시간 60초 전부터 시작하고 수업 시작 시 끝남', () => {
  const db = fixture(),
    st = db.settings[0];
  assert.equal(C.classroomCountdown(db, st, at('09:48:59')), null);
  const v = C.classroomCountdown(db, st, at('09:49:00'));
  assert.equal(v.remaining, 60);
  assert.equal(v.period, 2);
  assert.equal(v.memo, '필통\n준비');
  assert(!JSON.stringify(v).includes('SECRET'));
  assert.equal(C.classroomCountdown(db, st, at('09:49:59')).remaining, 1);
  assert.equal(C.classroomCountdown(db, st, at('09:50:00')), null);
});
test('이동/전담 수업은 300초 전, 진행 중인 이전 수업에서는 표시하지 않음', () => {
  const db = fixture(),
    st = db.settings[0];
  db.subject_rules.find(r => r.code === '국어').defaultType = '전담';
  assert.equal(C.classroomCountdown(db, st, at('09:44:59')), null);
  assert.equal(C.classroomCountdown(db, st, at('09:45:00')).remaining, 300);
  st.periodTimes[0] = '09:00–09:47';
  assert.equal(C.classroomCountdown(db, st, at('09:46:59')), null);
  assert.equal(C.classroomCountdown(db, st, at('09:47:00')).remaining, 180);
});
test('1교시 전/설정 시간/수업 없는 날짜를 구분하고 장소 이동도 5분 전에 안내', () => {
  const db = fixture(),
    st = db.settings[0];
  db.timetables[0].period = 1;
  db.timetables[0].locationOverride = '시청각실';
  st.periodTimes[0] = '08:40~09:20';
  assert.equal(C.classroomCountdown(db, st, at('08:35:00')).remaining, 300);
  assert.equal(C.classroomCountdown(db, st, new Date('2026-11-11T08:39:30+09:00')), null);
});
test('확인자 목록은 오늘 지정 과제만 제공하고 체크는 대상자와 출결을 검증', () => {
  const db = fixture();
  db.assignments = [{
    id: 'a',
    title: '읽기',
    date,
    repeat: {
      type: 'none'
    },
    target: 'all',
    checkerStudentId: 'one'
  }];
  db.students[1].password = 'SECRET_PASSWORD';
  let list = C.checkerChecklist(db, 'one', 'a', date);
  assert.equal(list.students.length, 2);
  assert(!JSON.stringify(list).includes('SECRET_PASSWORD'));
  assert.throws(() => C.checkerChecklist(db, 'two', 'a', date));
  assert.throws(() => C.checkerChecklist(db, 'one', 'a', C.addDays(date, 1)));
  db.attendance = [{
    studentId: 'two',
    date,
    excluded: true
  }];
  assert.throws(() => C.checkerStateOps(db, 'one', 'a', 'two', true, date));
  assert.throws(() => C.checkerStateOps(db, 'one', 'a', 'outsider', true, date));
});
test('또래 체크/해제는 교사의 비공개 상태 메모를 보존하고 자동 칭찬은 중복 생성하지 않음', () => {
  let db = fixture();
  const a = {
    id: 'a',
    title: '읽기',
    date,
    repeat: {
      type: 'none'
    },
    target: 'all',
    checkerStudentId: 'one',
    statArea: '생활'
  };
  db.assignments = [a];
  db.assignmentStates = [{
    id: C.stateId('a', date, 'two'),
    assignmentId: 'a',
    date,
    studentId: 'two',
    status: '진행중',
    memo: 'SECRET_MEMO'
  }];
  db = C.applyOps(db, C.checkerStateOps(db, 'one', 'a', 'two', true, date));
  db = C.applyOps(db, C.checkerStateOps(db, 'one', 'a', 'two', true, date));
  assert.equal(db.records.length, 1);
  assert.equal(db.assignmentStates[0].memo, 'SECRET_MEMO');
  assert.equal(C.scores(db, 'two', date, date).total, 1);
  db = C.applyOps(db, C.checkerStateOps(db, 'one', 'a', 'two', false, date));
  assert.equal(db.records.length, 0);
  assert.equal(db.assignmentStates[0].status, '진행중');
});
test('단순 체크리스트는 완료/안함 모두 별점 기록 없이 상태만 저장하고 기존 자동 기록도 제거', () => {
  let db = fixture();
  let a = {
    id: 'a',
    title: '읽기',
    date,
    repeat: {
      type: 'none'
    },
    target: 'all',
    checkerStudentId: 'one'
  };
  db.assignments = [a];
  db = C.applyOps(db, C.taskStateOps(db, a, date, 'two', '완료'));
  assert.equal(db.records.length, 1);
  a = {
    ...a,
    noStar: true
  };
  db = C.applyOps(db, [{
    table: 'assignments',
    id: 'a',
    data: a
  }, ...C.taskStateOps(db, a, date, 'two', '완료')]);
  assert.equal(db.records.length, 0);
  db = C.applyOps(db, C.taskStateOps(db, a, date, 'two', '안함'));
  assert.equal(db.records.length, 0);
  db = C.applyOps(db, C.checkerStateOps(db, 'one', 'a', 'two', true, date));
  assert.equal(db.records.length, 0);
  assert.equal(C.scores(db, 'two', date, date).total, 0);
});
test('수업 제목 딥 톤은 표시용 변수로만 제공하고 저장된 팔레트는 유지', () => {
  const before = C.subjectColors('국어'),
    style = C.subjectColorStyle('국어');
  assert(style.includes('--subject-accent:#397FAE;'));
  assert(style.includes('--subject-title-color:#2c6388;'));
  assert.deepEqual(C.subjectColors('국어'), before);
});
