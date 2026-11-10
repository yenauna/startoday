import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
function fixture() {
  const db = C.initialDB();
  db.students = Array.from({
    length: 6
  }, (_, i) => ({
    id: 's' + i,
    no: i + 1,
    name: '학생' + i
  }));
  db.assignments = [{
    id: 'a',
    title: '수학',
    date: '2026-11-01',
    repeat: {
      type: 'daily'
    },
    target: 'all',
    statArea: '과제'
  }];
  return db;
}
test('과제 완료 +1, 늦게완료/면제 0, 안함 -1 및 괄호 메모는 전환해도 중복되지 않음', () => {
  let db = fixture();
  const a = db.assignments[0];
  for (const [status, kind, score] of [['완료', '칭찬', 1], ['늦게완료', '관찰', 0], ['안함', '지도', -1], ['면제', '관찰', 0]]) {
    db = C.applyOps(db, C.taskStateOps(db, a, '2026-11-02', 's0', status, '확인'));
    assert.equal(db.records.length, 1);
    assert.equal(db.records[0].kind, kind);
    assert.equal(C.scores(db, 's0', '', '2026-11-03').total, score);
    assert.equal(db.records[0].text, `수학 ${status === '늦게완료' ? '늦게 완료' : status} (확인)`);
  }
  db = C.applyOps(db, C.taskStateOps(db, a, '2026-11-02', 's0', '진행중'));
  assert.equal(db.records.length, 0);
});
test('단순 체크 과제는 늦게완료와 면제를 포함한 모든 상태에서 기록을 만들지 않음', () => {
  const db = fixture(),
    a = db.assignments[0];
  a.noStar = true;
  for (const status of C.STATUSES) assert.equal(C.applyOps(db, C.taskStateOps(db, a, a.date, 's0', status)).records.length, 0);
});
test('진행중 일괄 안함은 출결 제외/완료/늦게완료/면제/대상 외 학생을 보존', () => {
  let db = fixture(),
    a = db.assignments[0];
  a.target = {
    studentIds: ['s0', 's1', 's2', 's3', 's4']
  };
  for (const [id, status] of [['s1', '완료'], ['s2', '늦게완료'], ['s3', '면제']]) db = C.applyOps(db, C.taskStateOps(db, a, a.date, id, status));
  db.attendance = [{
    id: 'ex',
    studentId: 's4',
    date: a.date,
    excluded: true
  }];
  const next = C.applyOps(db, C.markRemainingUndoneOps(db, a, a.date));
  assert.equal(C.assignmentStatus(next, a.id, a.date, 's0'), '안함');
  for (const id of ['s1', 's2', 's3', 's4', 's5']) assert.equal(C.assignmentStatus(next, a.id, a.date, id), C.assignmentStatus(db, a.id, a.date, id));
  assert.deepEqual(C.markRemainingUndoneOps(next, a, a.date), []);
});
test('기존 자동 기록 정책 전환은 ID/생성일/직접 기록을 보존하고 재실행은 멱등', () => {
  let db = fixture(),
    a = db.assignments[0];
  db = C.applyOps(db, C.taskStateOps(db, a, a.date, 's0', '늦게완료', '이전'));
  db.records[0] = {
    ...db.records[0],
    kind: '칭찬',
    text: '수학 늦게 완료 · 이전',
    createdAt: '2026-11-01T00:00:00Z',
    action: '유지'
  };
  db.records.push({
    id: 'manual',
    kind: '칭찬',
    text: '직접 작성',
    studentIds: ['s0'],
    date: a.date
  });
  const old = structuredClone(db.records),
    next = C.applyOps(db, C.assignmentPolicyOps(db));
  assert.equal(next.records[0].kind, '관찰');
  assert.equal(next.records[0].id, old[0].id);
  assert.equal(next.records[0].createdAt, old[0].createdAt);
  assert.equal(next.records[0].action, '유지');
  assert.deepEqual(next.records[1], old[1]);
  assert.deepEqual(C.assignmentPolicyOps(next), []);
});
test('점심 3/4/5교시 설정은 기존 시간 의미를 보존하며 해당 교시 바로 다음에 배치', () => {
  const db = fixture();
  db.events = [{
    id: 'lunch',
    title: '점심 행사',
    date: '2026-11-02',
    period: 7,
    timeOfDay: 'lunch'
  }];
  for (const position of [3, 4, 5]) {
    db.settings[0].lunchAfterPeriod = position;
    const parts = C.dayTimeline(db, '2026-11-02'),
      index = parts.findIndex(p => p.type === 'event' && p.period === 7);
    assert.equal(parts[index - 1].period, position);
    assert.equal(parts[index + 1].period, position + 1);
    assert.equal(parts[index].events[0].title, '점심 행사');
  }
  assert.equal(C.lunchPosition({
    lunchAfterPeriod: 0
  }), 4);
  assert.equal(C.initialDB().settings[0].lunchAfterPeriod, 4);
});
function studentFixture() {
  const db = fixture(),
    state = {
      studentUser: db.students[0],
      viewMode: 'student'
    },
    context = {
      C,
      state,
      store: {
        db
      },
      document: {
        addEventListener() {}
      },
      esc: C.esc,
      btn: () => ''
    };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../js/tabs/student-view.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export ', ''), context);
  return {
    db,
    state,
    context
  };
}
test('학생 밀린 과제는 날짜별 진행중만 포함하고 출결 제외·완료는 제거, 비공개 메모는 차단', () => {
  const {
      db,
      context
    } = studentFixture(),
    a = db.assignments[0],
    date = '2026-11-03';
  db.assignmentStates = [{
    id: C.stateId('a', '2026-11-01', 's0'),
    assignmentId: 'a',
    studentId: 's0',
    date: '2026-11-01',
    status: '완료',
    memo: 'PRIVATE'
  }];
  let result = context.studentSnapshot(db, db.students[0], date);
  assert.deepEqual(Array.from(result.tasks, t => t.date), [date, '2026-11-02']);
  assert.equal(result.tasks[1].overdue, true);
  assert(!JSON.stringify(result).includes('PRIVATE'));
  db.attendance = [{
    id: 'ex',
    studentId: 's0',
    date: '2026-11-02',
    excluded: true
  }];
  assert.equal(context.studentSnapshot(db, db.students[0], date).tasks.length, 1);
});
test('학생 편지함은 구버전 늦게완료 칭찬을 숨기며 순수 칭찬만 허용', () => {
  const {
      db,
      context
    } = studentFixture(),
    date = '2026-11-02';
  db.assignmentStates = [{
    id: C.stateId('a', date, 's0'),
    assignmentId: 'a',
    date,
    studentId: 's0',
    status: '늦게완료'
  }];
  db.records = [{
    id: 'old',
    autoRef: C.stateId('a', date, 's0'),
    date,
    studentIds: ['s0'],
    kind: '칭찬',
    text: 'PRIVATE_MEMO'
  }];
  assert.equal(context.studentSnapshot(db, db.students[0], date).praise.length, 0);
});
test('학생 시간표도 점심 위치와 아침/방과후 흐름을 따르고 실명 확인자 호칭은 간결', () => {
  const {
    context
  } = studentFixture();
  const data = {
    date: '2026-11-02',
    lunchAfterPeriod: 3,
    timetable: [3, 4].map(period => ({
      period,
      subject: '국어',
      publicMemo: '준비물\n태블릿'
    })),
    calendar: {
      events: [{
        date: '2026-11-02',
        period: 7,
        timeOfDay: 'lunch',
        title: '점심 활동'
      }, {
        date: '2026-11-02',
        period: 0,
        title: '아침 활동'
      }, {
        date: '2026-11-02',
        period: 8,
        timeOfDay: 'after',
        title: '방과후 활동'
      }]
    }
  };
  const html = context.studentDaySchedule(data);
  assert(html.indexOf('3교시') < html.indexOf('점심 활동'));
  assert(html.indexOf('점심 활동') < html.indexOf('4교시'));
  assert(html.indexOf('아침 활동') < html.indexOf('3교시'));
  assert(html.indexOf('방과후 활동') > html.indexOf('4교시'));
  assert.equal(context.checkerLabel('3. 가온'), '가온');
  assert.equal(context.checkerLabel(''), '선생님');
});
test('20색 서식 팔레트와 숫자 pt는 저장 후에도 유지되며 기존 명명 서식과 호환', () => {
  assert.equal(C.TEXT_COLOR_CARDS.length, 20);
  for (const color of C.TEXT_COLOR_CARDS) for (const size of ['16', '20', '24', '32', '40', '48', '64']) {
    const n = C.formatAnnouncement({
      text: '안내'
    }, 0, 2, {
      color: color.color,
      size
    });
    assert.equal(n.runs[0].size, size);
    assert.equal(n.runs[0].color, color.color);
  }
  assert.equal(C.normalizeAnnouncement({
    text: '이전',
    size: 'huge',
    color: 'red'
  }).runs[0].color, 'red');
});
test('창체 및 자율/자치 별칭은 독립 라벤더 기본값을 공유하며 직접 지정 색은 보존', () => {
  for (const code of ['창체', '자율', '자치', '자율자치', '동아리', '진로', '학자시']) assert.deepEqual(C.defaultSubjectColors(code), {
    background: '#EDE9FA',
    accent: '#7256A5'
  });
  assert.deepEqual(C.subjectColors({
    code: '동아리',
    color: '#F0F3F7',
    accentColor: '#65758C',
    colorSource: 'custom'
  }), {
    background: '#F0F3F7',
    accent: '#65758C'
  });
  assert.equal(C.subjectColors({
    code: '창체',
    color: '#F0F3F7',
    defaultColorValue: '#F0F3F7',
    colorSource: 'default'
  }).background, '#EDE9FA');
});
