import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
function editorFixture() {
  const database = C.initialDB(),
    buttons = [];
  let dialog,
    closed = 0,
    assignmentDate;
  const form = {
    values: {
      type: '일반',
      memo: '',
      locationOverride: '',
      teacherOverride: ''
    },
    elements: {
      type: {
        onchange: null
      }
    }
  };
  const context = {
    C,
    up: (table, data) => ({
      table,
      id: data.id,
      data
    }),
    state: {
      date: '2026-11-07'
    },
    db: () => database,
    settings: () => database.settings[0],
    students: () => [],
    esc: C.esc,
    btn: (label, callback) => {
      buttons.push({
        label,
        callback
      });
      return `<button>${label}</button>`;
    },
    input: (label, name, value) => `<input name="${name}" value="${C.esc(value)}">`,
    select: (label, name) => `<select name="${name}"></select>`,
    textarea: (label, name) => `<textarea name="${name}"></textarea>`,
    checkbox: () => '',
    modal: (title, body, submit) => {
      dialog = {
        title,
        body,
        submit
      };
    },
    closeModal: () => closed++,
    commit: async ops => Object.assign(database, C.applyOps(database, ops)),
    $: () => form,
    FormData: class extends Map {
      constructor(f) {
        super(Object.entries(f.values));
      }
    },
    assignmentEditor: (_, date) => assignmentDate = date
  };
  const source = readFileSync(new URL('../js/tabs/timetable.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  vm.runInNewContext(source + '\nglobalThis.openEditor=dayEditor;', context);
  return {
    database,
    buttons,
    form,
    open: context.openEditor,
    get dialog() {
      return dialog;
    },
    get closed() {
      return closed;
    },
    get assignmentDate() {
      return assignmentDate;
    }
  };
}
test('교시 전용 모달은 선택 교시를 고정하고 과목 즉시 저장 시 기존 시각·세부 입력을 보존', async () => {
  const f = editorFixture(),
    date = '2026-11-07';
  f.database.timetables = [{
    id: date + '-2',
    date,
    period: 2,
    subjectCode: '국어',
    memo: '이전',
    createdAt: '2026-11-01T00:00:00Z'
  }];
  f.open(date, '시간표', 2);
  assert.equal(f.dialog.title, '2026.11.07.(토) · 2교시 시간표');
  assert(!f.dialog.body.includes('name="period"'));
  assert(!f.dialog.body.includes('name="subjectCode"'));
  assert(!f.dialog.body.includes('event-entry-tabs'));
  f.form.values = {
    type: '강사',
    memo: '준비물',
    locationOverride: '과학실',
    teacherOverride: '김선생'
  };
  f.form.elements.type.onchange();
  await f.buttons.find(b => b.label === '수학').callback();
  const saved = f.database.timetables[0];
  assert.equal(saved.period, 2);
  assert.equal(saved.subjectCode, '수학');
  assert.equal(saved.type, '강사');
  assert.equal(saved.memo, '준비물');
  assert.equal(saved.locationOverride, '과학실');
  assert.equal(saved.teacherOverride, '김선생');
  assert.equal(saved.createdAt, '2026-11-01T00:00:00Z');
  assert.equal(f.closed, 1);
  assert.throws(() => f.open(date, '시간표', 8), /교시/);
});
test('일반 일정 등록은 일정/과제만 제공하고 종일 행사 및 과제 시작일을 그대로 저장', async () => {
  const f = editorFixture(),
    date = '2026-11-07';
  f.open(date);
  assert.deepEqual(f.buttons.map(b => b.label), ['일정', '과제']);
  await f.dialog.submit(new Map([['title', ' 운동회 '], ['period', ''], ['description', '운동장'], ['isDday', 'on']]));
  assert.equal(f.database.events[0].title, '운동회');
  assert.equal(f.database.events[0].date, date);
  assert.equal(f.database.events[0].period, null);
  assert.equal(f.database.events[0].description, '운동장');
  assert.equal(f.database.events[0].isDday, true);
  f.open(date, '과제');
  assert.equal(f.assignmentDate, date);
});
