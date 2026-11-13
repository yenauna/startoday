import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import { preferredKoreanVoice } from '../js/shared/tools-core.js';
function db() {
  const d = C.initialDB();
  d.students = [{
    id: 's',
    no: 1,
    name: '가온',
    alias: '교사별명',
    password: '보존암호7'
  }];
  d.assignments = [{
    id: 'q',
    title: '독서 도전',
    date: C.today(),
    target: 'all',
    repeat: {
      type: 'none'
    },
    isQuest: true,
    questGoal: 3,
    questTitle: '책의 탐험가',
    statArea: '과제'
  }];
  return d;
}
test('별명은 한글 1~8자만 허용하고 프로필의 비밀번호·교실 별명을 보존', () => {
  let d = db();
  for (const value of ['별', '반짝이는별님']) assert.equal(C.validateStudentNickname(value), value);
  for (const value of ['', null, 'a', '별  님', '별1', '별!', 'ㄱ', '가나다라마바사아자']) assert.throws(() => C.validateStudentNickname(value));
  d = C.applyOps(d, C.studentNicknameOps(d, 's', '반짝별'));
  assert.equal(d.students[0].password, '보존암호7');
  assert.equal(d.students[0].alias, '교사별명');
  assert.equal(C.studentLabel(d.students[0]), '가온(반짝별)');
  assert.equal(C.studentLabel(d.students[0], true), '가온 "반짝별"');
  assert.equal(C.applyOps(d, C.studentNicknameOps(d, 's', null)).students[0].nickname, null);
});
test('장기과제는 날짜를 넘겨 이어지고 목표에서 한 번만 보상·별점을 지급', () => {
  let d = db(),
    a = d.assignments[0];
  for (let i = 1; i <= 3; i++) {
    d = C.applyOps(d, C.questStampOps(d, a, C.addDays(a.date, i - 1), 's', 1));
    assert.equal(C.questProgress(d, a, 's').stamps, i);
    assert.equal(C.scores(d, 's', '', C.addDays(a.date, 5)).total, i === 3 ? 1 : 0);
  }
  assert.equal(d.records[0].date, C.addDays(a.date, 2));
  assert.equal(d.assignmentStates.length, 1);
  assert.equal(d.assignmentStates[0].date, a.date);
  assert.equal(d.students[0].rewardTitles.length, 1);
  assert.equal(d.students[0].rewardTitles[0].name, '책의 탐험가');
  d = C.applyOps(d, C.questStampOps(d, a, a.date, 's', 1));
  assert.equal(d.students[0].rewardTitles.length, 1);
  assert.equal(d.records.length, 1);
});
test('퀘스트 보상은 도장 감소·과제 삭제·백업 복원 후에도 영구 보존되며 장착 가능', () => {
  let d = db(),
    a = d.assignments[0];
  d = C.applyOps(d, C.questStampOps(d, a, a.date, 's', 3));
  d = C.applyOps(d, C.questStampOps(d, a, a.date, 's', -1));
  assert.equal(C.questProgress(d, a, 's').status, '진행중');
  assert.equal(d.records.length, 0);
  assert.equal(d.students[0].rewardTitles.length, 1);
  d = C.applyOps(d, C.studentTitleOps(d, 's', 'quest:q'));
  assert.equal(C.kingdomEquipped(d.students[0], C.kingdomCounts(d, 's')).name, '책의 탐험가');
  d.assignments = [];
  d.assignmentStates = [];
  const restored = C.validateBackup({
    app: 'startoday',
    version: 1,
    data: JSON.parse(JSON.stringify(d))
  });
  assert.equal(restored.students[0].equippedTitle, 'quest:q');
  assert.equal(restored.students[0].rewardTitles.length, 1);
});
test('단순 체크 퀘스트는 별점 없이 보상만 지급하고 제외·비대상·잘못된 증감은 차단', () => {
  let d = db(),
    a = d.assignments[0];
  a.noStar = true;
  d = C.applyOps(d, C.questStampOps(d, a, a.date, 's', 3));
  assert.equal(d.records.length, 0);
  assert.equal(d.students[0].rewardTitles.length, 1);
  assert.throws(() => C.taskStateOps(d, a, a.date, 's', '완료'), /스탬프/);
  assert.throws(() => C.questStampOps(d, a, a.date, 's', .5));
  assert.throws(() => C.questStampOps(d, a, a.date, 'other', 1));
  d.attendance = [{
    id: 'ex',
    date: a.date,
    studentId: 's',
    excluded: true
  }];
  assert.throws(() => C.questStampOps(d, a, a.date, 's', 1));
  assert.deepEqual(C.markRemainingUndoneOps(d, a, a.date), []);
});
test('퀘스트 미완료는 날짜마다 중복 나열하지 않고 또래 검사 대상에서 제외', () => {
  const d = db(),
    a = d.assignments[0];
  a.checkerStudentId = 's';
  assert.equal(C.pending(d, 's', C.addDays(a.date, 10)).length, 1);
  assert.equal(C.checkerAssignments(d, 's').length, 0);
  for (const goal of [0, 0.5, -1, 1000]) assert.throws(() => C.questGoal({
    ...a,
    questGoal: goal
  }));
});
test('자연스러운 한국어 음성을 우선하며 다른 언어는 선택하지 않고 선택 가능한 기본 음성으로 대체', () => {
  const legacy = {
      lang: 'ko-KR',
      name: 'Legacy',
      voiceURI: 'legacy',
      default: true
    },
    online = {
      lang: 'ko',
      name: 'Online',
      voiceURI: 'online'
    },
    natural = {
      lang: 'ko-KR',
      name: 'Microsoft SunHi Natural',
      voiceURI: 'natural'
    },
    english = {
      lang: 'en-US',
      name: 'Natural'
    };
  assert.equal(preferredKoreanVoice([english, legacy, online, natural]), natural);
  assert.equal(preferredKoreanVoice([english, legacy, online]), online);
  assert.equal(preferredKoreanVoice([legacy]), legacy);
  assert.equal(preferredKoreanVoice([english]), null);
});
test('오래 열린 교사 프로필 수정도 다른 창에서 얻은 로컬 퀘스트 보상을 지우지 않음', async () => {
  const {
      Store
    } = await import('../js/store.js'),
    before = globalThis.localStorage,
    d = db(),
    award = {
      id: 'quest:q',
      name: '책의 탐험가'
    },
    latest = structuredClone(d);
  latest.students[0].rewardTitles = [award];
  let raw = JSON.stringify(latest);
  globalThis.localStorage = {
    getItem: () => raw,
    setItem: (key, value) => {
      if (key === 'startoday-demo-v1') raw = value;
    }
  };
  try {
    const store = new Store();
    store.mode = 'local';
    store.db = d;
    await store.commit([{
      table: 'students',
      id: 's',
      data: {
        ...d.students[0],
        nickname: '반짝별',
        rewardTitles: []
      }
    }]);
    assert.equal(store.db.students[0].rewardTitles[0].name, '책의 탐험가');
    assert.equal(JSON.parse(raw).students[0].rewardTitles.length, 1);
  } finally {
    if (before === undefined) delete globalThis.localStorage;else globalThis.localStorage = before;
  }
});
