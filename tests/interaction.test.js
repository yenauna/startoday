import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as C from '../js/core.js';
test('학생 루틴 체크는 본인 대상만 허용하고 제외·면제·삭제 루틴을 보호', () => {
  let db = C.initialDB();
  const date = '2026-11-10';
  db.students = [{
    id: 'a',
    no: 1,
    name: '가온'
  }, {
    id: 'b',
    no: 2,
    name: '다온'
  }];
  db.routines = [{
    id: 'r',
    title: '급식',
    target: {
      studentIds: ['a']
    }
  }];
  db = C.applyOps(db, C.studentRoutineOps(db, 'a', 'r', true, date));
  assert.equal(C.routineStatus(db, 'r', date, 'a'), '완료');
  assert.equal(db.records.length, 0);
  db = C.applyOps(db, C.studentRoutineOps(db, 'a', 'r', false, date));
  assert.equal(C.routineStatus(db, 'r', date, 'a'), '진행중');
  assert.throws(() => C.studentRoutineOps(db, 'b', 'r', true, date));
  db.attendance = [{
    studentId: 'a',
    date,
    excluded: true
  }];
  assert.throws(() => C.studentRoutineOps(db, 'a', 'r', true, date));
  db.attendance = [];
  db.routines[0].exceptions = {
    [date]: {
      exempt: true
    }
  };
  assert.throws(() => C.studentRoutineOps(db, 'a', 'r', true, date));
  delete db.routines[0].exceptions;
  db.routines[0].deletedAt = C.now();
  assert.throws(() => C.studentRoutineOps(db, 'a', 'r', true, date));
});
test('루틴 토글은 상태의 교사 메모를 보존하며 명시적 면제를 변경하지 않음', () => {
  let db = C.initialDB();
  const date = '2026-11-10';
  db.students = [{
    id: 'a',
    no: 1,
    name: '가온'
  }];
  db.routines = [{
    id: 'r',
    target: 'all'
  }];
  const id = C.stateId('r', date, 'a');
  db.routineStates = [{
    id,
    routineId: 'r',
    studentId: 'a',
    date,
    status: '진행중',
    memo: 'PRIVATE'
  }];
  db = C.applyOps(db, C.studentRoutineOps(db, 'a', 'r', true, date));
  assert.equal(db.routineStates[0].memo, 'PRIVATE');
  db.routineStates[0].status = '면제';
  assert.throws(() => C.studentRoutineOps(db, 'a', 'r', false, date));
});
function undoFixture() {
  const context = {
    C,
    state: {
      viewMode: 'teacher'
    },
    document: {
      addEventListener() {}
    },
    console
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../js/shared/ui.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export ', ''), context);
  return context;
}
const event = (target = {
  closest: () => null
}, extra = {}) => ({
  key: 'z',
  ctrlKey: true,
  target,
  preventDefault() {
    this.prevented = true;
  },
  ...extra
});
test('Ctrl/Cmd+Z는 최근의 활성 토스트만 실행하고 만료·숨김 버튼은 건너뜀', () => {
  const f = undoFixture(),
    calls = [];
  const button = n => ({
    isConnected: true,
    disabled: false,
    getClientRects: () => [{}],
    click: () => calls.push(n)
  });
  const first = button(1),
    second = button(2);
  f.registerUndo(first);
  const unregister = f.registerUndo(second);
  assert(f.triggerToastUndo(event()));
  assert.deepEqual(calls, [2]);
  unregister();
  assert(f.triggerToastUndo(event(undefined, {
    ctrlKey: false,
    metaKey: true
  })));
  assert.deepEqual(calls, [2, 1]);
  first.disabled = true;
  assert.equal(f.triggerToastUndo(event()), false);
  first.disabled = false;
  f.registerUndo(first, () => false);
  assert.equal(f.triggerToastUndo(event()), false);
});
test('텍스트 입력/한글 조합/교실잠금/학생 화면에서는 토스트 단축키를 가로채지 않음', () => {
  const f = undoFixture();
  let clicks = 0;
  f.registerUndo({
    isConnected: true,
    getClientRects: () => [{}],
    click: () => clicks++
  });
  for (const extra of [{
    target: {
      closest: () => ({})
    }
  }, {
    isComposing: true
  }, {
    shiftKey: true
  }, {
    altKey: true
  }]) assert.equal(f.triggerToastUndo(event(undefined, extra)), false);
  f.state.locked = true;
  assert.equal(f.triggerToastUndo(event()), false);
  f.state.locked = false;
  f.state.viewMode = 'student';
  assert.equal(f.triggerToastUndo(event()), false);
  assert.equal(clicks, 0);
});
