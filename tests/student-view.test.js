import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../js/core.js';
import * as Auth from '../js/shared/student-auth.js';
function fixture() {
  const source = C.initialDB();
  Object.assign(source.settings[0], {
    schoolName: '체험초등학교',
    grade: 5,
    classGroup: '1',
    defaultStudentPassword: '13579'
  });
  source.students = [{
    id: 'one',
    no: 1,
    name: '가온',
    password: '푸른바람7',
    passwordChanged: true
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
    ...Auth,
    document: {
      querySelector: () => null
    },
    koreanPasswordField: () => '',
    bindKoreanPasswordFields: () => {},
    schoolPickerFields: () => '',
    bindSchoolPicker: () => {},
    recentStudentSchool: () => ({}),
    rememberStudentSchool: () => {},
    toast: () => {},
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
  store.commit = async ops => {
    store.db = C.applyOps(store.db, ops);
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
test('학교·학년·반·번호 로그인은 잘못된 비밀번호를 거부하고 세션에 비밀번호를 남기지 않음', async () => {
  const f = fixture();
  f.context.studentLoginDialog();
  const fields = new Map([['schoolName', '체험초등학교'], ['schoolCode', ''], ['grade', '5'], ['classGroup', '1'], ['no', '1'], ['password', 'wrong']]);
  await assert.rejects(f.dialog.submit(fields));
  fields.set('password', '푸른바람7');
  await f.dialog.submit(fields);
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
  const f = fixture();
  f.store.mode = 'none';
  f.store.db = null;
  f.store.client = {
    rpc: async () => ({
      error: {
        code: 'PGRST202'
      }
    })
  };
  f.store.demo = () => {
    throw Error('must not load demo');
  };
  f.context.studentLoginDialog();
  await assert.rejects(f.dialog.submit(new Map([['schoolName', '체험초등학교'], ['schoolCode', ''], ['grade', '5'], ['classGroup', '1'], ['no', '1'], ['password', '13579']])), /schema.sql/);
  assert.equal(f.state.viewMode, 'teacher');
  assert.equal(f.state.studentUser, undefined);
  assert.equal(f.store.db, null);
});
test('초기 비밀번호 로그인은 대시보드 데이터 없이 변경 모달로 이동하고 문자 비밀번호 저장 후 진입', async () => {
  const f = fixture();
  delete f.source.students[0].password;
  delete f.source.students[0].passwordChanged;
  f.context.studentLoginDialog();
  await f.dialog.submit(new Map([['schoolName', '체험초등학교'], ['schoolCode', ''], ['grade', '5'], ['classGroup', '1'], ['no', '1'], ['password', '13579']]));
  assert.equal(f.state.studentPasswordPending, true);
  assert.equal(f.state.studentUser, null);
  assert.equal(f.state.studentSnapshot, null);
  assert(!f.context.renderStudentShell().includes('내 별 점수'));
  await assert.rejects(f.dialog.submit(new Map([['newPassword', '24680'], ['confirmPassword', '24680']])));
  await f.dialog.submit(new Map([['newPassword', '별빛123'], ['confirmPassword', '별빛123']]));
  assert.equal(f.state.studentPasswordPending, false);
  assert.equal(f.state.viewMode, 'student');
  assert.equal(f.store.db.students[0].passwordChanged, true);
});
test('학생 식별은 학교·학년·반·번호를 모두 비교하며 이름이나 임의 코드는 사용하지 않음', () => {
  const f = fixture(),
    student = f.source.students[0],
    config = f.source.settings[0],
    identity = {
      school: '체험초등학교',
      grade: '5',
      classGroup: '1',
      no: 1
    };
  assert(Auth.studentIdentityMatches(student, config, identity));
  for (const patch of [{
    school: '다른초등학교'
  }, {
    grade: '6'
  }, {
    classGroup: '오'
  }, {
    no: 2
  }]) assert(!Auth.studentIdentityMatches(student, config, {
    ...identity,
    ...patch
  }));
  assert(!Auth.studentIdentityMatches({
    ...student,
    deletedAt: 'today'
  }, config, identity));
});
test('개인 비밀번호는 반 공통 초기값 변경 시 유지되고 초기화 학생은 현재 초기값을 적용', () => {
  const config = {
    defaultStudentPassword: '13579'
  };
  assert.equal(Auth.studentPasswordInfo({
    id: 'new'
  }, config).password, '13579');
  const changed = {
    password: '나의별7',
    passwordChanged: true
  };
  assert.equal(Auth.studentPasswordInfo(changed, {
    defaultStudentPassword: '24680'
  }).password, '나의별7');
  assert.equal(Auth.studentPasswordInfo({
    ...changed,
    passwordChanged: false,
    passwordResetRequired: true
  }, {
    defaultStudentPassword: '24680'
  }).password, '24680');
  assert.equal(Auth.studentPasswordInfo({
    password: '12345'
  }, config).mustChangePassword, true);
});
test('새 비밀번호는 완성된 한글과 숫자만 5자 이상이며 초기값과 이전값 재사용 금지', () => {
  for (const value of ['12345', '바람12', '행복5', 'ㄱㄴㄷ123', '바람abc123', 'Star77', '바람!123', '바람 123']) {
    assert.throws(() => Auth.validateStudentPassword(value, '초기암호1', '이전암호1'), value);
  }
  assert.throws(() => Auth.validateStudentPassword('초기암호1', '초기암호1', '이전암호1'));
  assert.throws(() => Auth.validateStudentPassword('이전암호1', '초기암호1', '이전암호1'));
  for (const value of ['바람123', '행복한5반', '새로운별빛', '별빛123']) assert.doesNotThrow(() => Auth.validateStudentPassword(value, '초기암호1', '이전암호1'));
});

test('학생 달력은 본인 과제 상태와 공개 일정만 표시하고 비공개 수업 메모를 제외',()=>{
 const f=fixture(),date=C.today();f.source.assignments=[{id:'own',title:'내 과제',target:{studentIds:['one']},date,repeat:{type:'none'}},{id:'other',title:'OTHER_TASK_SECRET',target:{studentIds:['two']},date,repeat:{type:'none'}}];
 f.source.assignmentStates=[{assignmentId:'own',studentId:'one',date,status:'완료',memo:'PRIVATE_STATUS'}];f.source.events=[{id:'event',date,title:'공개 일정',description:'운동장\n모이기',privateMemo:'PRIVATE_EVENT'}];
 f.source.timetables=[{date,period:1,subjectCode:'국어',publicMemo:'준비물\n태블릿',privateMemo:'PRIVATE_CLASS'}];
 const data=f.context.studentSnapshot(f.source,f.source.students[0],date),json=JSON.stringify(data);assert.equal(data.timetable[0].publicMemo,'준비물\n태블릿');assert(!json.includes('PRIVATE_'));assert(!json.includes('OTHER_TASK_SECRET'));
 const items=f.context.studentCalendarItems(data.calendar,date);assert.equal(items.length,2);assert.equal(items.find(item=>item.kind==='task').status,'완료');assert.equal(f.context.studentCalendarItems(data.calendar,C.addDays(date,1)).length,0);
});
