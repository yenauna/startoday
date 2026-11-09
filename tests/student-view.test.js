import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
function fixture() {
  const source = C.initialDB();
  source.students = [{
    id: 'one',
    no: 1,
    name: '가온',
    password: 'secret'
  }, {
    id: 'two',
    no: 2,
    name: '다온'
  }];
  const buttons = [];
  let dialog;
  const state = {
      viewMode: 'teacher'
    },
    store = {
      db: source,
      mode: 'demo'
    };
  const context = {
    C,
    state,
    store,
    render() {},
    closeModal() {},
    esc: C.esc,
    input: () => '',
    btn(label, callback) {
      buttons.push({
        label,
        callback
      });
      return `<button>${label}</button>`;
    },
    modal(title, body, submit) {
      dialog = {
        title,
        body,
        submit
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../js/tabs/student-view.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export ', ''), context);
  return {
    source,
    state,
    store,
    context,
    buttons,
    get dialog() {
      return dialog;
    }
  };
}
test('학생 projection은 본인의 칭찬 허용 필드만 반환하고 점수 계산은 기존 로직과 동일', () => {
  const f = fixture(),
    date = C.today();
  f.source.records = [{
    id: 'p',
    studentIds: ['one'],
    kind: '칭찬',
    date,
    text: '좋은 행동',
    areas: ['생활'],
    action: 'PRIVATE_ACTION'
  }, {
    id: 'a',
    studentIds: ['one'],
    kind: '지도',
    date,
    text: 'SECRET_ADVICE',
    areas: ['생활']
  }, {
    id: 'i',
    studentIds: ['one'],
    kind: '추가기록',
    extraType: '사건',
    date,
    text: 'SECRET_INCIDENT'
  }, {
    id: 'o',
    studentIds: ['two'],
    kind: '칭찬',
    date,
    text: 'OTHER_STUDENT'
  }];
  f.source.assignments = [{
    id: 'a',
    title: '수학',
    date,
    target: 'all',
    repeat: {
      type: 'none'
    }
  }];
  f.source.assignmentStates = [{
    id: C.stateId('a', date, 'one'),
    assignmentId: 'a',
    studentId: 'one',
    status: '완료',
    memo: 'SECRET_TASK_MEMO'
  }];
  f.source.records.push({
    id: 'auto',
    studentIds: ['one'],
    kind: '칭찬',
    date,
    text: '수학 완료 · SECRET_TASK_MEMO',
    autoRef: C.stateId('a', date, 'one'),
    areas: ['과제']
  });
  const result = f.context.studentSnapshot(f.source, f.source.students[0], date),
    serialized = JSON.stringify(result);
  assert.equal(result.praise.length, 2);
  assert(result.praise.some(r => r.text === '수학 완료'));
  assert.equal(result.score.total, C.scores(f.source, 'one', '', date).total);
  assert.equal(result.tasks[0].status, '완료');
  for (const secret of ['SECRET_', 'OTHER_STUDENT', 'PRIVATE_ACTION', 'password', 'secret']) assert(!serialized.includes(secret));
  f.state.studentUser = result.student;
  f.state.studentSnapshot = result;
  result.praise.push({
    kind: '지도',
    date,
    text: 'INJECTED_ADVICE'
  });
  assert(!f.context.renderStudentShell().includes('INJECTED_ADVICE'));
});
test('학생 로그인은 잘못된 비밀번호/중복 이름을 거부하고 세션에 비밀번호를 남기지 않음', async () => {
  const f = fixture();
  f.context.studentLoginDialog();
  await assert.rejects(f.dialog.submit(new Map([['studentCode', '1번'], ['password', 'wrong']])));
  f.source.students[1].name = '가온';
  await assert.rejects(f.dialog.submit(new Map([['studentCode', '가온'], ['password', 'secret']])));
  await f.dialog.submit(new Map([['studentCode', '1'], ['password', 'secret']]));
  assert.equal(f.state.viewMode, 'student');
  assert.equal(f.state.studentUser.id, 'one');
  assert.equal(f.state.studentUser.password, undefined);
  f.context.leaveStudentView();
  assert.equal(f.state.studentUser, null);
  assert.equal(f.store.db, null);
});
test('대리 접속 복귀는 교사 DB와 모드를 유지하고 학생 로그아웃은 로그인 화면으로 복귀', () => {
  const f = fixture();
  f.context.previewStudent('one');
  assert.equal(f.state.impersonatingStudentId, 'one');
  assert(f.context.renderStudentShell().includes('선생님 대리 접속 모드'));
  f.context.leaveStudentView();
  assert.equal(f.state.viewMode, 'teacher');
  assert.equal(f.store.db, f.source);
  assert.equal(f.store.mode, 'demo');
});
test('클라우드 인증 실패나 RPC 미설치 시 체험 자료로 우회하거나 학생 세션을 열지 않음', async () => {
  const f=fixture();f.store.mode='none';f.store.db=null;
  f.store.client={rpc:async()=>({error:{code:'PGRST202'}})};
  f.store.demo=()=>{throw Error('must not load demo');};
  f.context.studentLoginDialog();
  await assert.rejects(f.dialog.submit(new Map([['studentCode','1'],['password','12345']])),/schema.sql/);
  assert.equal(f.state.viewMode,'teacher');assert.equal(f.state.studentUser,undefined);assert.equal(f.store.db,null);
});
