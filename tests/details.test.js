import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
function fixture() {
  const db = C.initialDB();
  db.students = [{
    id: 'ji',
    no: 1,
    name: '지우'
  }, {
    id: 'da',
    no: 3,
    name: '다온'
  }, {
    id: 'son',
    no: 7,
    name: '손흥민'
  }];
  return db;
}
test('주어만 점수 대상으로 선택하고 상대방·소유자·목적어를 제외', () => {
  const db = fixture();
  for (const text of ['지우가 3번에게 지우개를 빌려줌', '지우는 다온이한테 도움', '지우가 다온의 책을 정리', '지우가 다온을 칭찬', '지우가 다온에게는 안내']) assert.deepEqual(C.parseInput(text, db).studentIds, ['ji'], text);
  assert.deepEqual(C.parseInput('3번은 지우에게 도움', db).studentIds, ['da']);
  assert.deepEqual(C.parseInput('다온에게 안내', db).studentIds, []);
  assert.deepEqual(C.parseInput('다온의 기록', db).studentIds, []);
  assert.deepEqual(C.parseInput('1, 3번 정리', db).studentIds, ['ji', 'da']);
  assert.deepEqual(C.parseInput('지우가 3번에게 도움', db, ['son']).studentIds, ['son']);
});
test('성을 뺀 이름은 유일한 후보일 때만 연결하고 중복 시 확인 경고', () => {
  const db = fixture();
  assert.deepEqual(C.parseInput('흥민이가 3번한테 도움', db).studentIds, ['son']);
  assert.deepEqual(C.parseInput('흥민이는 참여', db).studentIds, ['son']);
  assert.deepEqual(C.parseInput('손흥민이 참여', db).studentIds, ['son']);
  assert.deepEqual(C.parseInput('손흥민이가 참여', db).studentIds, ['son']);
  db.students.push({
    id: 'kim',
    no: 8,
    name: '김흥민'
  });
  const p = C.parseInput('흥민이가 참여', db);
  assert.deepEqual(p.studentIds, []);
  assert(p.warnings.some(x => x.includes('후보')));
  assert.deepEqual(C.parseInput('손흥민이가 참여', db).studentIds, ['son']);
  assert.deepEqual(C.parseInput('지우가 흥민이에게 도움', db).studentIds, ['ji']);
  assert.deepEqual(C.parseInput('흥민이야기를 기록', db).studentIds, []);
});
test('번호 치환은 조사와 구분자를 보존하고 미상·중복 번호는 바꾸지 않음', () => {
  const db = fixture();
  assert.equal(C.replaceStudentNumbers('지우가 3번에게 지우개를 빌려줌', db), '지우가 다온에게 지우개를 빌려줌');
  assert.equal(C.replaceStudentNumbers('1, 3번 2교시', db), '지우, 다온 2교시');
  assert.equal(C.replaceStudentNumbers('1번이 3번를 안내', db), '지우가 다온을 안내');
  assert.equal(C.replaceStudentNumbers('7번의 기록과 999번', db), '손흥민의 기록과 999번');
  assert.equal(C.replaceStudentNumbers('1003번과 3번째 3번호', db), '1003번과 3번째 3번호');
  db.students.push({
    id: 'dupe',
    no: 3,
    name: '가상'
  });
  assert.equal(C.replaceStudentNumbers('3번에게', db), '3번에게');
  const original = '1번이 안내 지도 내용: 3번에게 설명';
  assert.equal(C.parseInput(original, db).text, original);
  assert.equal(C.parseInput(original, db).action, '3번에게 설명');
});
test('시스템 시각은 한국 시간과 설정된 1~6교시·쉬는시간·점심 경계로 판정', () => {
  const st = C.initialDB().settings[0];
  const at = time => C.periodAtTime(st, new Date('2026-11-07T' + time + ':00+09:00'));
  for (const [time, period] of [['08:59', '아침'], ['09:00', '1교시'], ['09:40', '쉬는시간'], ['09:50', '2교시'], ['10:45', '3교시'], ['11:30', '4교시'], ['12:10', '점심'], ['12:59', '점심'], ['13:00', '5교시'], ['13:50', '6교시'], ['14:30', '방과후'], ['23:59', '방과후'], ['00:00', '아침']]) assert.equal(at(time), period, time);
  assert.equal(C.periodAtTime(st, new Date('2026-11-07T00:15:00Z')), '1교시');
  assert.equal(C.periodAtTime({
    periodTimes: ['09:99–10:00']
  }, new Date('2026-11-07T00:15:00Z')), '기타');
  const custom = {
    periodTimes: ['08:30–09:10', '09:20–10:00', '11:00–11:40', '12:30–13:10']
  };
  assert.equal(C.periodAtTime(custom, new Date('2026-11-07T12:00:00+09:00')), '점심');
  assert.equal(C.inputPeriod('1번 4교시 관찰', st, new Date('2026-11-07T00:15:00Z')), '4교시');
  assert.equal(C.inputPeriod('1번 쉬는 시간 관찰', st), '쉬는시간');
  assert.equal(C.inputPeriod('1번 7교시 관찰', st), '기타');
});
test('누적 점수는 선택일까지의 이력만 집계하고 제외일·타학생을 배제', () => {
  const db = fixture();
  db.records = [{
    id: 'past',
    date: '2026-11-05',
    studentIds: ['ji'],
    kind: '칭찬',
    areas: ['생활']
  }, {
    id: 'today',
    date: '2026-11-07',
    studentIds: ['ji'],
    kind: '칭찬',
    areas: ['생활']
  }, {
    id: 'excluded',
    date: '2026-11-06',
    studentIds: ['ji'],
    kind: '지도',
    areas: ['생활']
  }, {
    id: 'future',
    date: '2026-11-08',
    studentIds: ['ji'],
    kind: '칭찬',
    areas: ['생활']
  }, {
    id: 'other',
    date: '2026-11-05',
    studentIds: ['da'],
    kind: '칭찬',
    areas: ['생활']
  }];
  db.attendance = [{
    studentId: 'ji',
    date: '2026-11-06',
    excluded: true
  }];
  assert.equal(C.cumulativeScores(db, 'ji', '2026-11-07').total, 2);
  assert.equal(C.cumulativeScores(db, 'ji', '2026-11-07').areas.생활, 2);
  assert.equal(C.scores(db, 'ji', '2026-11-07', '2026-11-07').total, 1);
});
test('추가기록은 실제 하위 라벨만 반환하고 일반 기록 표기는 유지', () => {
  for (const extraType of ['메모', '사건', '상담']) assert.equal(C.recordLabel({
    kind: '추가기록',
    extraType
  }), extraType);
  assert.equal(C.recordLabel({
    kind: '추가기록'
  }), '추가 기록');
  assert.equal(C.recordLabel({
    kind: '관찰'
  }), '기록');
  assert.equal(C.recordLabel({
    kind: '지도'
  }), '조언');
});
test('과제 화면은 TDZ 없이 상태·메모를 표시하고 1클릭 순환 및 메모 편집을 지원', async () => {
  const db = fixture(),
    date = '2026-11-07';
  db.assignments = [{
    id: 'a',
    title: '독서',
    date,
    repeat: {
      type: 'none'
    },
    target: 'all',
    statArea: '과제'
  }];
  db.assignmentStates = [{
    id: C.stateId('a', date, 'ji'),
    assignmentId: 'a',
    studentId: 'ji',
    date,
    status: '안함',
    memo: '<확인>'
  }];
  const buttons = [],
    listeners = new Map(),
    timers = new Map();
  const taskButton = {
    textContent: '안함',
    className: 'task-status task-status-notdone',
    dataset: {
      taskAssignment: 'a',
      taskStudent: 'ji',
      taskDate: date
    }
  };
  let timerId = 0;
  let modalBody = '';
  const context = {
    C,
    store: {
      mode: 'demo',
      classId: 'qa'
    },
    document: {
      addEventListener: (type, fn) => listeners.set(type, fn),
      querySelectorAll: () => [taskButton]
    },
    setTimeout: fn => {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout: id => timers.delete(id),
    run: fn => fn(),
    commit: async ops => Object.assign(db, C.applyOps(db, ops)),
    state: {
      date
    },
    db: () => db,
    students: () => db.students,
    name: id => db.students.find(s => s.id === id).name,
    esc: C.esc,
    badge: x => x,
    empty: x => x,
    bindLater: () => '',
    input: () => '',
    select: () => '',
    btn: (label, callback, cls) => {
      buttons.push({
        label,
        callback,
        cls
      });
      return '<button>' + label + '</button>';
    },
    modal: (title, body) => {
      modalBody = body;
    }
  };
  const source = readFileSync(new URL('../js/tabs/assignments.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  vm.runInNewContext(source + '\nglobalThis.renderAssignments=assignmentsView;', context);
  const html = context.renderAssignments();
  assert(html.includes('&lt;확인&gt;'));
  const failed = buttons.find(b => b.label === '안함');
  assert.equal(failed.cls, 'task-status task-status-notdone');
  failed.callback();
  assert.equal(taskButton.className, 'task-status task-status-pending');
  failed.callback();
  assert.equal(taskButton.textContent, '안함');
  assert.equal(taskButton.className, 'task-status task-status-notdone');
  failed.callback();
  assert.equal(taskButton.textContent, '진행중');
  assert.equal(modalBody, '');
  await [...timers.values()][0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(db.assignmentStates[0].status, '진행중');
  assert.equal(db.assignmentStates[0].memo, '<확인>');
  assert.equal(db.records.filter(r => r.autoRef === C.stateId('a', date, 'ji')).length, 0);
  listeners.get('contextmenu')({
    target: {
      closest: () => taskButton
    },
    preventDefault() {}
  });
  assert(modalBody.includes(C.formatDate(date)));
  db.attendance = [{
    id: 'excluded',
    studentId: 'son',
    date,
    excluded: true
  }];
  Object.assign(db, C.applyOps(db, C.taskStateOps(db, db.assignments[0], date, 'son', '안함', '제외 전 메모')));
  buttons.length = 0;
  context.renderAssignments();
  await buttons.find(b => b.label === '✓ 전원 완료').callback();
  assert.equal(db.assignmentStates.filter(s => s.status === '완료').length, 2);
  assert.equal(db.assignmentStates.find(s => s.studentId === 'son').status, '안함');
  assert.equal(db.assignmentStates.find(s => s.studentId === 'ji').memo, '<확인>');
  buttons.length = 0;
  context.renderAssignments();
  await buttons.find(b => b.label === '↩ 전원 미완료').callback();
  assert.equal(db.assignmentStates.filter(s => s.status === '진행중').length, 2);
  assert.equal(db.records.filter(r => r.autoRef).length, 1);
  assert.equal(db.records[0].studentIds[0], 'son');
  assert.equal(db.assignmentStates.find(s => s.studentId === 'ji').memo, '<확인>');
});
