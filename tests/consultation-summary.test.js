import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';

function setup() {
  const db = C.initialDB();
  db.students = [
    {id: 's1', no: 1, name: '김가온'},
    {id: 's2', no: 2, name: '박나래'},
    {id: 's3', no: 3, name: '이하늘'}
  ];
  return db;
}

test('상담 요약 기간은 이번 주·이번 달·최근 30일을 오늘 기준으로 잡고 전체는 학기 시작을 쓴다', () => {
  const db = setup();
  db.records = [
    {id: 'old', studentIds: ['s1'], date: '2026-04-02', kind: '관찰', areas: []},
    {id: 'newer', studentIds: ['s1'], date: '2026-05-01', kind: '관찰', areas: []}
  ];
  assert.deepEqual(C.consultationPeriodRange(db, 'week', '2026-11-26'), {from: '2026-11-23', to: '2026-11-26'});
  assert.deepEqual(C.consultationPeriodRange(db, 'month', '2026-11-26'), {from: '2026-11-01', to: '2026-11-26'});
  assert.deepEqual(C.consultationPeriodRange(db, '30d', '2026-11-26'), {from: '2026-10-28', to: '2026-11-26'});
  assert.deepEqual(C.consultationPeriodRange(db, 'all', '2026-11-26'), {from: '2026-04-02', to: '2026-11-26'});
  db.settings[0].academicCalendar = {
    term1Start: '2026-03-02',
    summerEnd: '2026-07-17',
    term2Start: '2026-08-18',
    winterEnd: '2027-01-08'
  };
  assert.deepEqual(C.consultationPeriodRange(db, 'all', '2026-11-26'), {from: '2026-08-18', to: '2026-11-26'});
  assert.deepEqual(C.consultationPeriodRange(db, 'all', '2026-05-06'), {from: '2026-03-02', to: '2026-05-06'});
});

test('분야는 기본 ID를 먼저 보고 이름을 바꾼 분야·새 분야도 낱말로 이어 붙이며 남는 것은 기타로 보낸다', () => {
  const db = setup(),
    rows = C.areaRows(db, true);
  assert.equal(C.consultationAreaGroup('학습', rows), 'academic');
  assert.equal(C.consultationAreaGroup('과제', rows), 'academic');
  assert.equal(C.consultationAreaGroup('관계', rows), 'social');
  assert.equal(C.consultationAreaGroup('도전', rows), 'life');
  assert.equal(C.consultationAreaGroup('알바', rows), 'life');
  const renamed = rows.map(row => row.id === 'area-1' ? {...row, name: '급식 예절'} : row);
  assert.equal(C.consultationAreaGroup('급식 예절', renamed), 'academic');
  assert.equal(C.consultationAreaGroup('급식 예절', rows), 'other');
  assert.equal(C.consultationAreaGroup('공부 기록', rows), 'academic');
  assert.equal(C.consultationAreaGroup('독서 토론', rows), 'academic');
  assert.equal(C.consultationAreaGroup('친구 사이', rows), 'social');
  assert.equal(C.consultationAreaGroup('급식 예절', rows), 'other');
  assert.equal(C.consultationAreaGroup('', rows), 'other');
});

test('상담 요약은 네 영역으로 기록을 나누고 출결 제외일을 빼며 추가기록·지도 기록을 기타에 모은다', () => {
  const db = setup();
  db.records = [
    {id: 'r1', studentIds: ['s1'], date: '2026-10-01', kind: '칭찬', areas: ['학습'], text: '수학 문제를 끝까지 풀었다'},
    {id: 'r2', studentIds: ['s1'], date: '2026-10-02', kind: '지도', areas: ['과제'], text: '과제를 두 번 잊었다', action: '쉬는 시간에 확인하기'},
    {id: 'r3', studentIds: ['s1'], date: '2026-10-03', kind: '칭찬', areas: ['생활'], text: '자리 정리를 잘했다'},
    {id: 'r4', studentIds: ['s1'], date: '2026-10-04', kind: '관찰', areas: ['관계'], text: '모둠에서 먼저 말을 걸었다'},
    {id: 'r5', studentIds: ['s1'], date: '2026-10-06', kind: '추가기록', extraType: '사건', areas: [], text: '상담실에서 이야기를 나눴다', printIncluded: false},
    {id: 'r6', studentIds: ['s1'], date: '2026-10-07', kind: '관찰', areas: [], text: '급식실에서 줄을 섰다'},
    {id: 'r7', studentIds: ['s1'], date: '2026-09-30', kind: '칭찬', areas: ['학습'], text: '기간 밖'},
    {id: 'r8', studentIds: ['s2'], date: '2026-10-02', kind: '칭찬', areas: ['학습'], text: '다른 학생'},
    {id: 'r9', studentIds: ['s1'], date: '2026-10-05', kind: '칭찬', areas: ['학습'], text: '출결 제외일'}
  ];
  db.attendance = [{id: C.stateId('attendance', '2026-10-05', 's1'), date: '2026-10-05', studentId: 's1', excluded: true, memo: '병결'}];
  db.assignments = [{id: 'a1', title: '연산', date: '2026-10-01', target: 'all', repeat: {type: 'daily'}, statArea: '과제'}];
  db.assignmentStates = [
    {id: C.stateId('a1', '2026-10-01', 's1'), assignmentId: 'a1', date: '2026-10-01', studentId: 's1', status: '완료'},
    {id: C.stateId('a1', '2026-10-02', 's1'), assignmentId: 'a1', date: '2026-10-02', studentId: 's1', status: '안함'}
  ];
  const summary = C.consultationSummary(db, 's1', '2026-10-01', '2026-10-07'),
    group = id => summary.groups.find(g => g.id === id);
  assert.deepEqual(summary.records.map(r => r.id), ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  assert.deepEqual(group('academic').records.map(r => r.id), ['r1', 'r2']);
  assert.deepEqual(group('academic').areas.map(a => [a.name, a.praise, a.advice]), [['과제', 0, 1], ['학습', 1, 0]]);
  assert.deepEqual(group('life').records.map(r => r.id), ['r3']);
  assert.deepEqual(group('social').records.map(r => r.id), ['r4']);
  assert.deepEqual(group('other').records.map(r => r.id), ['r2', 'r5', 'r6']);
  assert.equal(group('academic').counts.total, 2);
  assert.equal(group('academic').counts.praise, 1);
  assert.equal(group('academic').counts.advice, 1);
  assert.deepEqual(group('academic').latest.map(r => r.id), ['r2', 'r1']);
  assert.deepEqual(group('academic').advice.map(r => r.id), ['r2']);
  assert.equal(group('life').counts.praise, 1);
  assert.deepEqual(summary.attendance, [{date: '2026-10-05', memo: '병결'}]);
  assert.equal(summary.tasks.assignments.total, 6);
  assert.equal(summary.tasks.assignments.done, 1);
  assert.equal(summary.tasks.assignments.rate, 17);
  assert.equal(summary.score.total, 1);
});

test('분야가 비어 있는 기록과 나간 분야도 기타 특이사항에서 사라지지 않는다', () => {
  const db = setup();
  db.areas.push({id: 'area-9', name: '급식 예절', sortOrder: 9, deletedAt: null});
  db.areas.find(a => a.id === 'area-3').deletedAt = '2026-10-01T00:00:00Z';
  db.records = [
    {id: 'x1', studentIds: ['s1'], date: '2026-10-02', kind: '관찰', areas: ['급식 예절'], text: '식판을 스스로 정리함'},
    {id: 'x2', studentIds: ['s1'], date: '2026-10-03', kind: '관찰', areas: ['관계'], text: '지난 분야 기록'}
  ];
  const summary = C.consultationSummary(db, 's1', '2026-10-01', '2026-10-31'),
    other = summary.groups.find(g => g.id === 'other'),
    social = summary.groups.find(g => g.id === 'social');
  assert.deepEqual(other.records.map(r => r.id), ['x1']);
  assert.deepEqual(other.areas.map(a => a.name), ['급식 예절']);
  assert.deepEqual(social.records.map(r => r.id), ['x2']);
  assert.deepEqual(social.areas.map(a => a.name), ['관계']);
});

test('마음 지도 요약은 최근 회차의 친한 친구·불편한 친구·관심 신호·사유를 학생 기준으로 모은다', () => {
  const db = setup();
  db.surveys = [
    {id: 'v1', title: '1차', status: 'closed', createdAt: '2026-10-01T00:00:00Z'},
    {id: 'v2', title: '2차', status: 'open', createdAt: '2026-10-08T00:00:00Z'}
  ];
  db.survey_responses = [
    {id: 'p1', surveyId: 'v2', studentId: 's1', placements: [
      {targetId: 's2', x: 80, y: 80, reason: '같이 놀면 재밌다', tags: ['같이 놀면 재밌다']},
      {targetId: 's3', x: 20, y: 20, reason: '', tags: []}
    ]},
    {id: 'p2', surveyId: 'v2', studentId: 's2', placements: [
      {targetId: 's1', x: 80, y: 80, reason: '', tags: ['말이 잘 통한다']},
      {targetId: 's3', x: 30, y: 70, reason: '', tags: []}
    ]},
    {id: 'p3', surveyId: 'v2', studentId: 's3', placements: [
      {targetId: 's1', x: 70, y: 30, reason: '장난을 많이 친다', tags: ['장난을 많이 친다']},
      {targetId: 's2', x: 80, y: 75, reason: '', tags: []}
    ]}
  ];
  const mind = C.consultationMindSummary(db, 's1');
  assert.equal(mind.survey.id, 'v2');
  assert.equal(mind.roundCount, 2);
  assert.equal(mind.submitted, true);
  assert.deepEqual(mind.close.map(s => s.id), ['s2']);
  assert.deepEqual(mind.uneasy.map(s => s.id), ['s3']);
  assert.equal(mind.uneasy[0].note, '서로 불편 신호');
  assert.deepEqual(mind.counts, {received: 2, positive: 1, uncomfortable: 1});
  assert.deepEqual(mind.attention, {positive: 1, received: 2, distant: 1, total: 2});
  assert.deepEqual(mind.reasons.map(r => [r.target, r.direction, r.reason || r.tags.join(', ')]), [
    ['2. 박나래', '내가 보낸', '같이 놀면 재밌다'],
    ['2. 박나래', '상대가 보낸', '말이 잘 통한다'],
    ['3. 이하늘', '상대가 보낸', '장난을 많이 친다']
  ]);
  assert.equal(C.consultationMindSummary(setup(), 's1'), null);
});

test('마음 지도가 없는 학급에서는 상담 요약이 마음 지도 없이도 만들어진다', () => {
  const db = setup();
  db.records = [{id: 'r1', studentIds: ['s1'], date: '2026-10-01', kind: '칭찬', areas: ['학습'], text: '잘했다'}];
  const summary = C.consultationSummary(db, 's1', '2026-10-01', '2026-10-31');
  assert.equal(summary.mind, null);
  assert.equal(summary.groups.find(g => g.id === 'academic').counts.praise, 1);
  assert.throws(() => C.consultationSummary(db, 'nobody', '2026-10-01', '2026-10-31'), /학생을 찾지 못했습니다/);
  assert.throws(() => C.consultationSummary(db, 's1', '2026-10-31', '2026-10-01'), /날짜 범위/);
});
