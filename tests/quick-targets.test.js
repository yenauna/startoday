import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
function quickFixture() {
  const database = C.initialDB();
  database.students = [{
    id: 'one',
    no: 1,
    name: '지우'
  }, {
    id: 'two',
    no: 2,
    name: '다온'
  }, {
    id: 'three',
    no: 5,
    name: '김가온'
  }];
  const fields = {
    '#quick-text': {
      value: '다온이가 1번의 책을 챙겨줌'
    },
    '#quick-period': {
      value: '자동'
    },
    '#quick-date': {
      value: '2026-11-09'
    },
    '#quick-student-query': {
      value: '',
      focus() {}
    }
  };
  const state = {
    selected: ['one'],
    date: '2026-11-09',
    actions: new Map()
  };
  let saved;
  const context = {
    C,
    state,
    store: {
      mode: 'demo',
      classId: 'demo'
    },
    db: () => database,
    settings: () => database.settings[0],
    $: key => fields[key],
    esc: C.esc,
    name: id => id,
    btn: () => '',
    opts: () => '',
    render() {},
    toast() {},
    setInterval() {},
    document: {
      addEventListener() {}
    },
    saveDirectRecords: async (...args) => {
      saved = args;
    }
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../js/components/header.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export ', ''), context);
  vm.runInContext('quickText="다온이가 1번의 책을 챙겨줌";', context);
  return {
    database,
    fields,
    state,
    context,
    get saved() {
      return saved;
    }
  };
}
test('빠른 기록 대상은 본문의 학생 이름·조사와 독립적이며 본문을 그대로 저장', async () => {
  const f = quickFixture();
  await f.context.saveQuick('칭찬');
  assert.equal(f.saved[0], '칭찬');
  assert.equal(f.saved[1], '다온이가 1번의 책을 챙겨줌');
  assert.deepEqual(Array.from(f.saved[2]), ['one']);
  assert.equal(f.saved[4].date, '2026-11-09');
  assert.equal(f.state.selected.length, 0);
  f.fields['#quick-text'].value = '다온이가 정리함';
  await assert.rejects(f.context.saveQuick('칭찬'), /대상 학생/);
});
test('대상 칸은 번호·번호번·이름·성 제외 이름을 정확히 찾고 여러 학생을 중복 없이 선택', () => {
  const f = quickFixture();
  for (const query of ['1', '1번', '지우']) assert.equal(f.context.quickStudentCandidates(query, f.database, true)[0].id, 'one');
  assert.equal(f.context.quickStudentCandidates('가온', f.database, true)[0].id, 'three');
  f.fields['#quick-student-query'].value = '1, 2, 가온';
  f.context.addQuickStudentQuery();
  assert.deepEqual(Array.from(f.state.selected), ['one', 'two', 'three']);
});
test('동명이인 또는 잘못 입력한 학생은 임의로 선택하지 않고 기존 선택을 보존', () => {
  const f = quickFixture();
  f.database.students.push({
    id: 'four',
    no: 6,
    name: '김가온'
  });
  f.fields['#quick-student-query'].value = '가온';
  assert.throws(() => f.context.addQuickStudentQuery(), /같은 이름/);
  assert.deepEqual(f.state.selected, ['one']);
  f.fields['#quick-student-query'].value = '2, 99';
  assert.throws(() => f.context.addQuickStudentQuery(), /학생 번호/);
  assert.deepEqual(f.state.selected, ['one']);
});

test('여러 번호/이름을 입력하면 쉼표·공백을 기준으로 후보를 모두 표시',()=>{
 const f=quickFixture();
 for(const query of ['1 2 5','1, 2, 5','지우 다온 가온'])assert.deepEqual(Array.from(f.context.quickStudentCandidates(query,f.database)).map(s=>s.id),['one','two','three']);
});
