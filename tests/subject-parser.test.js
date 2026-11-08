import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
function fixture() {
  const db = C.initialDB();
  db.students = [{
    id: 'son',
    no: 1,
    name: '손흥민'
  }, {
    id: 'poro',
    no: 2,
    name: '뽀로로'
  }, {
    id: 'ji',
    no: 3,
    name: '지우'
  }, {
    id: 'min',
    no: 4,
    name: '민수'
  }, {
    id: 'gaon',
    no: 5,
    name: '가온'
  }];
  return db;
}
const privateParser = vm.runInNewContext(readFileSync(new URL('../js/core.js', import.meta.url), 'utf8').replace(/^export /gm, '') + '\n({mentionRole,studentMentions})');
const ids = (text, selected = []) => C.parseInput(text, fixture(), selected).studentIds;
test('조사 역할은 목적어·접속·주어·무조사 네 가지로 분류', () => {
  for (const suffix of ['의', '을', '를', '에게', '한테', '에게서', '한테서', '으로', '로', '에게는', '에게도', '한테서도', '으로는', '이에게', '이한테서', '이로']) assert.equal(privateParser.mentionRole(suffix), 'object', suffix);
  for (const suffix of ['과', '와', '랑', '하고', '이와', '이랑']) assert.equal(privateParser.mentionRole(suffix), 'conjunct', suffix);
  for (const suffix of ['이', '가', '은', '는', '도', '이가', '이는', '이도']) assert.equal(privateParser.mentionRole(suffix), 'subject', suffix);
  assert.equal(privateParser.mentionRole(''), 'bare');
});
test('접속 명단은 텍스트 순서로 주어·목적어 역할을 역전파', () => {
  for (const text of ['손흥민과 뽀로로가 도움', '손흥민과 뽀로로도 도움', '1번과 2번', '1번하고 2번', '손흥민과 뽀로로']) assert.deepEqual(ids(text), ['son', 'poro'], text);
  assert.deepEqual(ids('민수와 지우랑 손흥민하고 뽀로로가 발표'), ['min', 'ji', 'son', 'poro']);
  assert.deepEqual(ids('지우와 1, 2번'), ['ji', 'son', 'poro']);
  assert.deepEqual(ids('1, 2번과 3번을 관찰'), []);
  for (const text of ['지우와 민수를 도와줌', '지우랑 민수에게 줌', '지우하고 민수의 공책', '지우와 민수에게서 받음', '지우와 민수로 바꿈', '지우, 민수를 도와줌']) {
    const mentions = privateParser.studentMentions(text, C.activeStudents(fixture()));
    assert.equal(mentions.length, 2);
    assert(mentions.every(m => m.role === 'object'), text);
    assert.deepEqual(ids(text), []);
  }
  const ordered = privateParser.studentMentions('뽀로로와 손흥민이 발표', C.activeStudents(fixture()));
  assert(ordered[0].start < ordered[1].start);
  assert.deepEqual(ids('뽀로로와 손흥민이 발표'), ['poro', 'son']);
});
test('명시적 주어는 사전 선택을 대체하고 주어 생략·목적어만 있을 때는 사전 선택 유지', () => {
  assert.deepEqual(ids('손흥민과 뽀로로가 도움', ['ji']), ['son', 'poro']);
  assert.deepEqual(ids('지우도 참여', ['son']), ['ji']);
  assert.deepEqual(ids('1번과 2번', ['ji']), ['son', 'poro']);
  for (const text of ['뽀로로의 공책을 찢음', '지우와 민수를 도와줌', '열심히 참여함', '뽀로로에게서 받아옴', '민수로 바뀜']) assert.deepEqual(ids(text, ['son']), ['son'], text);
  assert.deepEqual(ids('2번', ['son']), ['son']);
  assert.deepEqual(ids('2번'), ['poro']);
  assert.deepEqual(ids('지우'), ['ji']);
  const parsed = C.parseInput('뽀로로의 공책을 찢음', fixture());
  assert.deepEqual(parsed.studentIds, []);
  assert(parsed.warnings.includes('학생을 선택하세요.'));
});
test('연결되지 않은 절·단어 내부·모호한 학생은 접속 처리로 잘못 승격하지 않음', () => {
  assert.deepEqual(ids('지우와 이야기한 뒤 민수가 발표'), ['min']);
  assert.deepEqual(ids('지우와. 민수가 발표'), ['min']);
  assert.deepEqual(ids('지우개를 손흥민이 정리'), ['son']);
  assert.deepEqual(ids('손흥민이 지우와 민수의 공책을 정리', ['poro']), ['son']);
  const db = fixture();
  db.students.push({
    id: 'kim',
    no: 6,
    name: '김흥민'
  });
  const result = C.parseInput('흥민이가 참여', db, ['son']);
  assert.deepEqual(result.studentIds, []);
  assert(result.warnings.some(w => w.includes('후보')));
  assert.deepEqual(C.parseInput('손흥민이가 참여', db, ['ji']).studentIds, ['son']);
  const original = '손흥민과 뽀로로에게 안내';
  const selected = ['ji', 'gaon'];
  const parsed = C.parseInput(original, fixture(), selected);
  assert.deepEqual(parsed.studentIds, selected);
  assert.equal(parsed.text, original);
  assert.deepEqual(selected, ['ji', 'gaon']);
});
