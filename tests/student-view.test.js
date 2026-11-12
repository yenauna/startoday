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

test('학생 일정은 종일 행사와 D-day를 포함하고 확인자 전용 카드는 지정 학생만 노출',()=>{
 const f=fixture(),date=C.today();f.source.assignments=[{id:'check',title:'검사할 과제',date,repeat:{type:'none'},target:'all',checkerStudentId:'one'}];f.source.events=[{id:'today',date,title:'오늘 행사',period:null},{id:'dday',date:C.addDays(date,7),title:'소풍',isDday:true}];
 f.context.previewStudent('one');let html=f.context.renderStudentShell();assert(html.includes('오늘의 일정'));assert(html.includes('오늘 행사'));assert(html.includes('소풍 D-7'));assert(html.includes('내가 확인할 친구 과제: 검사할 과제'));f.context.previewStudent('two');html=f.context.renderStudentShell();assert(!html.includes('내가 확인할 친구 과제'));
});
test('학생 달력 상세는 처음엔 접히고 날짜를 직접 선택했을 때만 표시',()=>{
 const f=fixture(),date=C.today();f.source.assignments=[{id:'a',title:'오늘 과제',date,repeat:{type:'none'},target:'all'}];f.context.previewStudent('one');let html=f.context.renderStudentShell();assert(html.includes('날짜를 선택하면 해당 일자의 과제와 일정을 볼 수 있어요'));assert(!html.includes('<div class="student-calendar-detail"><h3>'));f.buttons.find(b=>b.label.startsWith(`<strong>${Number(date.slice(5,7))}.${Number(date.slice(-2))}</strong>`) && b.label.includes('오늘 과제')).callback();html=f.context.renderStudentShell();assert(html.includes('<div class="student-calendar-detail"><h3>'));
});

test('클라우드 칭호 변경은 학생 인증 RPC만 사용하고 교사 저장·비밀번호 노출 없이 안전한 화면을 갱신',async()=>{
 const f=fixture(),date=C.today();f.source.records=Array.from({length:15},(_,i)=>({id:'k'+i,date,kind:'칭찬',studentIds:['one'],text:'독서',areas:['학습'],createdAt:C.now()}));
 const snapshot=f.context.studentSnapshot(f.source,f.source.students[0],date),requests=[],signals=[];
 f.context.kingdomCards=()=>'';f.store.mode='none';f.store.db=null;f.store.signalChange=(...args)=>signals.push(args);f.store.commit=()=>{throw Error('teacher write forbidden');};
 f.store.client={rpc:async(method,args)=>{requests.push({method,args});if(method==='startoday_student_login')return{data:{...snapshot,mustChangePassword:false}};assert.equal(method,'startoday_student_title_set');assert.equal(args.p_password,'푸른바람7');assert.equal(args.p_title,'learning:1');return{data:{classId:'class',revision:7,snapshot:{...snapshot,student:{...snapshot.student,equippedTitle:'learning:1'}}}};}};
 f.context.studentLoginDialog();await f.dialog.submit(new Map([['schoolName','체험초등학교'],['schoolCode',''],['grade','5'],['classGroup','1'],['no','1'],['password','푸른바람7']]));
 await f.context.equipStudentTitle('learning:1');assert.equal(f.state.studentSnapshot.student.equippedTitle,'learning:1');assert.equal(requests.length,2);assert.equal(signals[0][0],'cloud');assert.equal(signals[0][2],7);assert(!JSON.stringify(f.state.studentSnapshot).includes('password'));assert.equal(f.store.db,null);
});
test('교사 대리 접속 칭호 변경은 기존 저장 경로를 사용하고 미획득 칭호는 차단',async()=>{const f=fixture(),date=C.today();f.context.kingdomCards=()=>'';f.context.localStorage={getItem:()=>null};f.source.records=Array.from({length:15},(_,i)=>({id:'r'+i,date,kind:'칭찬',studentIds:['one'],text:'청소',areas:['생활']}));f.context.previewStudent('one');await f.context.equipStudentTitle('life:1');assert.equal(f.store.db.students[0].equippedTitle,'life:1');assert.equal(f.state.impersonatingStudentId,'one');await assert.rejects(f.context.equipStudentTitle('learning:3'),/획득/);assert.equal(f.store.db.students[0].equippedTitle,'life:1');});

test('클라우드 별명 변경은 본인 인증 RPC만 호출하고 새 안전한 프로필을 반영',async()=>{const f=fixture(),snapshot=f.context.studentSnapshot(f.source,f.source.students[0]),calls=[];f.store.mode='none';f.store.db=null;f.store.signalChange=()=>{};f.store.commit=()=>{throw Error('teacher write forbidden');};f.store.client={rpc:async(method,args)=>{calls.push({method,args});return method==='startoday_student_login'?{data:{...snapshot,mustChangePassword:false}}:{data:{classId:'c',revision:9,snapshot:{...snapshot,student:{...snapshot.student,nickname:'반짝별'}}}};}};f.context.studentLoginDialog();await f.dialog.submit(new Map([['schoolName','체험초등학교'],['schoolCode',''],['grade','5'],['classGroup','1'],['no','1'],['password','푸른바람7']]));await f.context.saveStudentNickname('반짝별');assert.equal(calls[1].method,'startoday_student_nickname_set');assert.equal(calls[1].args.p_nickname,'반짝별');assert.equal(calls[1].args.p_password,'푸른바람7');assert.equal(f.state.studentUser.nickname,'반짝별');assert.equal(f.store.db,null);});

test('칭찬 편지함 기간은 전체/30일/7일/이번 달로 필터링하고 점수·칭호·안전 필터는 유지',()=>{
 const f=fixture(),date='2026-11-12';
 f.source.records=Array.from({length:65},(_,i)=>({id:'letter-'+i,date:C.addDays(date,-i),kind:'칭찬',studentIds:['one'],text:'편지 '+i,areas:['학습'],createdAt:C.now()}));
 f.source.records.push({id:'private',date,kind:'지도',studentIds:['one'],text:'PRIVATE_ADVICE',areas:['관계'],createdAt:C.now()},{id:'future',date:C.addDays(date,1),kind:'칭찬',studentIds:['one'],text:'FUTURE_PRAISE',areas:['학습'],createdAt:C.now()},{id:'other',date,kind:'칭찬',studentIds:['two'],text:'OTHER_PERSON',areas:['학습'],createdAt:C.now()});
 const baseline=f.context.studentSnapshot(f.source,f.source.students[0],date);
 for(const [period,count] of [['all',65],['30d',30],['7d',7],['month',12]]){
  f.source.settings[0].studentPraisePeriod=period;const data=f.context.studentSnapshot(f.source,f.source.students[0],date);assert.equal(data.praise.length,count);assert.equal(data.score.total,baseline.score.total);assert.deepEqual(data.titleCounts,baseline.titleCounts);assert(data.praise.every(r=>r.kind==='칭찬'));assert(!JSON.stringify(data.praise).includes('PRIVATE_'));assert(!JSON.stringify(data.praise).includes('OTHER_PERSON'));assert(!JSON.stringify(data.praise).includes('FUTURE_PRAISE'));
 }
 delete f.source.settings[0].studentPraisePeriod;assert.equal(f.context.studentSnapshot(f.source,f.source.students[0],date).praise.length,65);
});
test('일반 안내도 수업이 없는 교시에 등록되면 학생 오늘 일정 타임라인에 표시',()=>{
 const f=fixture(),date=C.today();f.source.events=[{id:'normal',date,period:6,title:'6교시 일반 안내',description:'준비물 확인',isImportant:false}];
 const snapshot=f.context.studentSnapshot(f.source,f.source.students[0],date),html=f.context.studentDaySchedule(snapshot);assert(html.includes('6교시 일반 안내'));assert(html.includes('준비물 확인'));assert(html.includes('6교시'));assert.equal(snapshot.calendar.events[0].isImportant,false);
});

test('클라우드 공동구매 기여는 본인 인증·금액 RPC로 보내고 최신 안전 snapshot으로 갱신',async()=>{
 const f=fixture();let d=f.source;
 d.shop_items=[{id:C.uid(),name:'학급 파티',price:100,stock:null,isGroupBuy:true,groupGoal:100,groupCollected:0,isFunded:false,isUsed:false}];
 Object.assign(d,C.applyOps(d,C.teacherBalanceAdjustOps(d,'one',50)));
 let snapshot=f.context.studentSnapshot(d,d.students[0]);const calls=[];
 f.store.mode='none';f.store.db=null;f.store.signalChange=()=>{};
 f.store.client={rpc:async(method,args)=>{
   calls.push({method,args});
   if(method==='startoday_student_login')return {data:{...snapshot,mustChangePassword:false}};
   assert.equal(method,'startoday_shop_fund_group_buy');assert.equal(args.p_student_id,'one');assert.equal(args.p_password,'푸른바람7');assert.equal(args.p_amount,10);
   d=C.applyOps(d,C.shopFundGroupBuyOps(d,'one',d.shop_items[0].id,args.p_amount));
   snapshot=f.context.studentSnapshot(d,d.students[0]);return{data:{classId:'c',revision:4,snapshot}};
 }};
 f.context.studentLoginDialog();await f.dialog.submit(new Map([['schoolName','체험초등학교'],['schoolCode',''],['grade','5'],['classGroup','1'],['no','1'],['password','푸른바람7']]));
 await f.context.studentEconomyAct('fund',d.shop_items[0].id,'',10);
 assert.equal(f.state.studentSnapshot.economy.balance,40);
 assert.equal(f.state.studentSnapshot.economy.items[0].groupCollected,10);
 assert.equal(f.store.db,null);
 await f.context.studentEconomyAct('refresh');
 assert.equal(calls.at(-1).method,'startoday_student_login');
 assert.equal(f.state.studentSnapshot.economy.items[0].contributors[0].amount,10);
});
