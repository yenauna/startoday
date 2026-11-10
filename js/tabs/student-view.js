import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { state, store } from '../shared/state.js';
import { btn, esc, input, toast } from '../shared/ui.js';
import { koreanPasswordField, bindKoreanPasswordFields } from '../components/korean-password.js';
import { schoolPickerFields, bindSchoolPicker, recentStudentSchool, rememberStudentSchool } from '../components/school-picker.js';
import { studentPasswordInfo, studentIdentityMatches, validateStudentPassword } from '../shared/student-auth.js';

// Only this allow-listed projection crosses into the student shell. Never pass
// teacher records, task memos, credentials or the class snapshot to its markup.
export function studentSnapshot(source, student, date = C.today()) {
  const score = C.scores(source, student.id, '', date);
  const excluded = C.excluded(source, student.id, date);
  const automaticPraise = record => {
    const status = source.assignmentStates.find(row => row.id === record.autoRef && row.studentId === student.id);
    const assignment = source.assignments.find(row => row.id === status?.assignmentId);
    return assignment && ['완료', '늦게완료'].includes(status?.status) ? assignment.title + (status.status === '늦게완료' ? ' 늦게 완료' : ' 완료') : null;
  };
  return {
    student: {
      id: student.id,
      no: student.no,
      name: student.name
    },
    className: source.settings[0]?.className || '우리반',
    date,
    calendar: C.studentCalendarData(source, student.id),
    score: {
      total: score.total,
      areas: score.areas
    },
    tasks: source.assignments.filter(a => C.targeted(a, student.id) && C.occurs(a, date)).map(a => ({
      title: a.title,
      date,
      ...C.assignmentPublicInfo(source, a),
      status: excluded ? '면제' : C.assignmentStatus(source, a.id, date, student.id)
    })),
    routines: source.routines.filter(r => !r.deletedAt && C.targeted(r, student.id)).map(r => ({
      title: r.title,
      status: excluded ? '면제' : C.routineStatus(source, r.id, date, student.id)
    })),
    timetable: source.timetables.filter(t => t.date === date && t.period >= 1 && t.period <= 6).sort((a, b) => a.period - b.period).map(t => {
      const rule = source.subject_rules.find(row => row.code === t.subjectCode);
      return {
        period: t.period,
        periodTime: source.settings[0]?.periodTimes?.[t.period - 1] || C.DEFAULT_PERIOD_TIMES[t.period - 1],
        subject: t.subjectCode,
        location: t.locationOverride || rule?.location || '',
        publicMemo: t.publicMemo ?? t.memo ?? '',
        color: rule?.color,
        accentColor: rule?.accentColor,
        colorSource: rule?.colorSource,
        defaultColorValue: rule?.defaultColorValue
      };
    }),
    praise: source.records.filter(r => r.kind === '칭찬' && r.studentIds.includes(student.id) && r.date <= date && (!r.autoRef || automaticPraise(r) !== null)).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 50).map(r => ({
      kind: '칭찬',
      date: r.date,
      period: C.recordPeriod(r.period),
      text: r.autoRef ? automaticPraise(r) : r.text,
      areas: r.areas || (r.area ? [r.area] : [])
    }))
  };
}
function studentRpcError(error) {
  if (error?.code === 'PGRST202' || error?.code === '42883') throw Error('학생 로그인을 준비 중입니다. 선생님이 최신 schema.sql을 적용해야 합니다.');
  if (error) throw Error(error.message?.includes('INVALID_STUDENT_PASSWORD') ? '새 비밀번호는 초기 비밀번호와 다르게, 완성된 한글을 포함해 5자 이상 입력하세요.' : '학생 로그인에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
}
function studentRpcIdentity(identity) {
  return {
    p_school: identity.school,
    p_grade: String(identity.grade),
    p_class: identity.classGroup,
    p_no: identity.no
  };
}
function localStudentMatch(identity) {
  const config = store.db.settings[0];
  const matches = C.activeStudents(store.db).filter(student => studentIdentityMatches(student, config, identity));
  return matches.length === 1 ? matches[0] : null;
}
export async function authenticateStudent(identity, password) {
  if (!/^[가-힣0-9]+$/.test(password)) throw Error('비밀번호는 한글과 숫자로만 입력할 수 있습니다');
  if (store.client && !['demo', 'local'].includes(store.mode)) {
    const {
      data,
      error
    } = await store.client.rpc('startoday_student_login', {
      ...studentRpcIdentity(identity),
      p_password: password
    });
    studentRpcError(error);
    return data;
  }
  if (!store.db) store.demo();
  const student = localStudentMatch(identity);
  if (!student) return null;
  const info = studentPasswordInfo(student, store.db.settings[0]);
  if (info.password !== password) return null;
  return info.mustChangePassword ? {
    mustChangePassword: true
  } : {
    ...studentSnapshot(store.db, student),
    mustChangePassword: false
  };
}
export async function changeStudentPassword(identity, previous, password) {
  if (store.client && !['demo', 'local'].includes(store.mode)) {
    const {
      data,
      error
    } = await store.client.rpc('startoday_student_change_password', {
      ...studentRpcIdentity(identity),
      p_old_password: previous,
      p_new_password: password
    });
    studentRpcError(error);
    return data;
  }
  const student = localStudentMatch(identity);
  if (!student) return null;
  const info = studentPasswordInfo(student, store.db.settings[0]);
  if (info.password !== previous) return null;
  validateStudentPassword(password, info.initial, previous);
  await store.commit([{
    table: 'students',
    id: student.id,
    data: {
      ...student,
      password,
      passwordChanged: true,
      passwordResetRequired: false,
      passwordChangedAt: C.now()
    }
  }]);
  return {
    ...studentSnapshot(store.db, store.db.students.find(s => s.id === student.id)),
    mustChangePassword: false
  };
}
function enterStudent(snapshot) {
  if (!snapshot?.student || snapshot.mustChangePassword) throw Error('학생 로그인 정보 또는 비밀번호가 올바르지 않습니다.');
  state.studentPasswordPending = false;
  state.studentUser = snapshot.student;
  state.studentSnapshot = snapshot;
  state.impersonatingStudentId = null;
  state.viewMode = 'student';
  state.selected = [];
  closeModal();
  render();
}
function requireStudentPassword(identity, previous) {
  state.studentPasswordPending = true;
  state.studentUser = null;
  state.studentSnapshot = null;
  render();
  modal('새 비밀번호 설정', `<p>처음 로그인했거나 비밀번호가 초기화되었습니다. 새 비밀번호를 설정해야 내 화면에 들어갈 수 있어요.</p>${koreanPasswordField('새 비밀번호', 'newPassword', '', 'required minlength="5" autocomplete="new-password"')}${koreanPasswordField('새 비밀번호 확인', 'confirmPassword', '', 'required autocomplete="new-password"')}<p class="muted">완성된 한글을 포함해 5자 이상 입력하세요. 한글과 숫자만 사용할 수 있고, 초기 비밀번호는 다시 사용할 수 없습니다. 예: 바람123</p>`, async f => {
    const password = f.get('newPassword');
    validateStudentPassword(password, previous);
    if (password !== f.get('confirmPassword')) throw Error('새 비밀번호 확인이 일치하지 않습니다.');
    const snapshot = await changeStudentPassword(identity, previous, password);
    enterStudent(snapshot);
    toast('비밀번호를 변경했습니다.');
  }, '변경하고 시작하기');
  bindKoreanPasswordFields(document.querySelector('#modal-form'));
}
export function studentLoginDialog() {
  const demo = !store.client || ['demo', 'local'].includes(store.mode);
  let config = store.db?.settings?.[0] || {};
  if (demo && !store.db) {
    try {
      config = JSON.parse(localStorage.getItem('startoday-demo-v1'))?.settings?.[0] || {};
    } catch {}
  }
  const recent = recentStudentSchool();
  modal('학생 로그인', `<div class="student-login-fields">${btn('가상 명단(1~20번) 번호로 즉시 로그인 준비', () => {
    store.demo();
    const form = document.querySelector('#modal-form'),
      config = store.db.settings[0];
    form.elements.schoolName.value = config.schoolName;
    form.elements.schoolCode.value = config.schoolCode || '';
    form.elements.grade.value = config.grade;
    form.elements.classGroup.value = config.classGroup;
    form.elements.password.value = config.defaultStudentPassword || '바람123';
  })}${schoolPickerFields(recent.name || (demo ? config.schoolName || '체험초등학교' : ''), recent.code || (demo ? config.schoolCode || '' : ''))}<div class="formgrid">${input('학년', 'grade', demo ? config.grade || 5 : '', 'number', 'required min="1" max="6"')}${input('반', 'classGroup', demo ? config.classGroup || '1' : '', 'text', 'required maxlength="40"')}${input('번호', 'no', '', 'number', 'required min="1" step="1"')}${koreanPasswordField('비밀번호', 'password', '', 'required autocomplete="current-password"')}</div><p class="muted">반 공통 초기 비밀번호는 선생님께 확인하세요. 새 체험 명단의 초기 비밀번호는 바람123입니다. 기존 영문 비밀번호는 선생님께 초기화를 요청하세요.</p></div>`, async f => {
    const identity = {
      school: (f.get('schoolCode') || f.get('schoolName')).trim(),
      grade: String(Number(f.get('grade'))),
      classGroup: f.get('classGroup').trim(),
      no: Number(f.get('no'))
    };
    if (!identity.school || !identity.classGroup || !Number.isInteger(identity.no) || identity.no < 1 || !/^[1-6]$/.test(identity.grade)) throw Error('학교, 학년, 반, 번호를 확인하세요.');
    const password = f.get('password'),
      snapshot = await authenticateStudent(identity, password);
    if (!snapshot) throw Error('학생 로그인 정보 또는 비밀번호가 올바르지 않습니다.');
    rememberStudentSchool(f.get('schoolName').trim(), f.get('schoolCode') || '');
    if (snapshot.mustChangePassword) {
      requireStudentPassword(identity, password);
      return;
    }
    enterStudent(snapshot);
  }, '로그인');
  bindSchoolPicker(document.querySelector('#modal-form'));
  bindKoreanPasswordFields(document.querySelector('#modal-form'));
}
export function previewStudent(id) {
  if (!store.db?.students.some(s => s.id === id && !s.deletedAt)) return;
  state.impersonatingStudentId = id;
  state.viewMode = 'student';
  state.selected = [];
  closeModal();
  render();
}
export function leaveStudentView() {
  closeModal();
  state.actions?.clear();
  studentCalendarScope = '';
  const preview = !!state.impersonatingStudentId;
  state.studentUser = null;
  state.studentPasswordPending = false;
  state.studentSnapshot = null;
  state.impersonatingStudentId = null;
  state.viewMode = 'teacher';
  if (!preview) {
    // Students never sign in to Supabase Auth. Discard the in-memory demo
    // snapshot on logout; preserve its existing local storage for teachers.
    store.db = null;
    store.mode = 'none';
  }
  render();
}
export function renderStudentShell() {
  if (state.studentPasswordPending) return `<main class="student-shell"><section class="student-card"><h2>새 비밀번호를 설정해 주세요</h2><p>비밀번호 변경을 완료해야 학생 화면을 볼 수 있습니다.</p>${btn('로그인으로 돌아가기', leaveStudentView)}</section></main>`;
  const student = state.impersonatingStudentId ? store.db?.students.find(s => s.id === state.impersonatingStudentId && !s.deletedAt) : state.studentUser;
  if (!student) return `<main class="student-shell"><p>학생 정보를 확인할 수 없습니다.</p>${btn('돌아가기', leaveStudentView)}</main>`;
  const data = state.impersonatingStudentId ? studentSnapshot(store.db, student) : state.studentSnapshot;
  if (!data) return `<main class="student-shell">${btn('다시 로그인', leaveStudentView)}</main>`;
  const pills = areas => (areas || []).map(a => `<span class="student-pill">${esc(a)}</span>`).join('');
  const taskList = (list, routine = false) => list.map(task => {
    const done = ['완료', '늦게완료', '면제'].includes(task.status);
    return `<div class="student-task ${done ? 'is-complete' : ''}"><div><strong class="${routine ? 'student-routine-title' : ''}">${esc(task.title)}</strong>${task.date ? `<small>${esc(C.formatDate(task.date))}</small>` : ''}${!routine && task.memo ? `<p class="assignment-public-memo">${esc(task.memo)}</p>` : ''}${!routine ? `<small class="assignment-checker">🔍 확인자: ${task.checkerName ? esc(task.checkerName) + ' 학생' : '선생님 직접 확인'}</small>` : ''}</div><span>${done ? '✓ ' : ''}${esc(task.status)}</span></div>`;
  }).join('') || '<p class="muted">오늘 할 일이 없습니다.</p>';
  return `<div class="student-shell">${state.impersonatingStudentId ? `<aside class="student-preview-banner">👁️ 선생님 대리 접속 모드 (${esc(student.no)}. ${esc(student.name)})${btn('교사 화면으로 돌아가기', leaveStudentView)}</aside>` : ''}<header class="student-header"><img class="logo" src="assets/logo-icon.jpg" alt="오늘의 별"><div><strong>${esc(data.className)}</strong><span>${esc(student.no)}. ${esc(student.name)}</span></div>${state.impersonatingStudentId ? '' : btn('로그아웃', leaveStudentView)}</header><main class="student-dashboard"><section class="student-card student-growth"><h2>내 별 점수</h2><div class="student-stars">★ ${esc(data.score.total)}개</div><div class="student-pills">${pills(Object.entries(data.score.areas || {}).map(([a, n]) => a + ' ' + n))}</div></section><section class="student-card student-timetable-card"><h2>오늘의 시간표</h2>${data.timetable.map(t => `<div class="student-task subject-color subject-stripe" style="${C.subjectColorStyle({
    code: t.subject,
    color: t.color,
    accentColor: t.accentColor,
    colorSource: t.colorSource,
    defaultColorValue: t.defaultColorValue
  })}"><div class="slot-period-row"><span class="slot-time">${esc(t.period)}교시</span><small class="slot-clock">${esc(t.periodTime || C.DEFAULT_PERIOD_TIMES[t.period - 1] || '')}</small></div><div class="slot-subject-row"><strong class="subject-title">${esc(t.subject)}</strong>${t.publicMemo ? `<span class="slot-public-memo">${esc(t.publicMemo)}</span>` : ''}</div></div>`).join('') || '<p class="muted">오늘 등록된 수업이 없습니다.</p>'}</section><section class="student-card student-tasks-card"><h2>오늘의 과제 &amp; 루틴</h2><h3>과제</h3>${taskList(data.tasks)}<h3>루틴</h3>${taskList(data.routines, true)}</section><section class="student-card student-calendar-card"><h2>과제·일정 달력</h2>${studentCalendarView(data, student.id)}</section><section class="student-card student-praise-card"><h2>선생님의 칭찬 편지함</h2>${(data.praise || []).filter(r => r.kind === '칭찬').map(r => `<article class="student-praise"><small>${esc(C.formatDate(r.date))}${r.period ? ' ' + esc(r.period) : ''}</small><p>${esc(r.text)}</p><div class="student-pills">${pills(r.areas)}</div></article>`).join('') || '<p class="student-empty">선생님의 따뜻한 칭찬이 여기에 차곡차곡 쌓여요! 오늘도 힘내요 ⭐</p>'}</section></main></div>`;
}
let studentCalendarScope = '',
  studentCalendarDate = '',
  studentCalendarMode = 'month';
export function studentCalendarItems(calendar, date) {
  const tasks = (calendar.assignments || []).filter(assignment => C.occurs(assignment, date)).map(assignment => ({
    title: assignment.title,
    memo: assignment.memo || '',
    checkerName: assignment.checkerName || '',
    status: (calendar.excludedDates || []).includes(date) ? '면제' : calendar.states?.find(row => row.assignmentId === assignment.id && row.date === date)?.status || '진행중',
    kind: 'task'
  }));
  const events = (calendar.events || []).filter(event => event.date === date).map(event => ({
    title: event.title,
    description: event.description || '',
    kind: 'event'
  }));
  const order = (a, b) => a.title.localeCompare(b.title, 'ko') || (a.status || a.description || '').localeCompare(b.status || b.description || '', 'ko');
  return [...events.sort(order), ...tasks.sort(order)];
}
function studentCalendarView(data, id) {
  if (!data.calendar) return '<p class="muted">달력 정보를 아직 불러오지 못했어요. 선생님께 알려주세요.</p>';
  const scope = store.mode + ':' + store.classId + ':' + id;
  if (scope !== studentCalendarScope) {
    studentCalendarScope = scope;
    studentCalendarDate = data.date || C.today();
    studentCalendarMode = 'month';
  }
  const first = studentCalendarDate.slice(0, 7) + '-01',
    start = studentCalendarMode === 'month' ? C.addDays(first, -((C.weekday(first) + 6) % 7)) : C.addDays(studentCalendarDate, -((C.weekday(studentCalendarDate) + 6) % 7));
  const move = step => {
    if (studentCalendarMode === 'week') studentCalendarDate = C.addDays(studentCalendarDate, step * 7);else {
      const date = new Date(first + 'T12:00Z');
      date.setUTCMonth(date.getUTCMonth() + step);
      studentCalendarDate = date.toISOString().slice(0, 10);
    }
    render();
  };
  const detail = studentCalendarItems(data.calendar, studentCalendarDate);
  return `<div class="row student-calendar-controls">${btn('‹', () => move(-1), '', 'aria-label="이전 학생 달력"')}<strong>${esc(studentCalendarDate.slice(0, 7).replace('-', '.'))}</strong>${btn('›', () => move(1), '', 'aria-label="다음 학생 달력"')}${btn('오늘', () => {
    studentCalendarDate = C.today();
    render();
  })}${['month', 'week'].map(mode => btn(mode === 'month' ? '월간' : '주간', () => {
    studentCalendarMode = mode;
    render();
  }, studentCalendarMode === mode ? 'primary' : '', `aria-pressed="${studentCalendarMode === mode}"`)).join('')}</div><div class="student-calendar-grid">${['월', '화', '수', '목', '금', '토', '일'].map(day => `<div class="weekday">${day}</div>`).join('')}${Array.from({
    length: studentCalendarMode === 'month' ? 42 : 7
  }, (_, index) => {
    const date = C.addDays(start, index),
      items = studentCalendarItems(data.calendar, date);
    return btn(`<strong>${Number(date.slice(-2))}</strong>${items.map(item => `<span class="student-calendar-pill ${item.kind === 'task' && !['완료', '늦게완료', '면제'].includes(item.status) ? 'has-incomplete' : ''}">${esc(item.title)}</span>`).join('')}`, () => {
      studentCalendarDate = date;
      render();
    }, 'student-calendar-day' + (date === studentCalendarDate ? ' selected' : '') + (date.slice(0, 7) !== first.slice(0, 7) ? ' faded' : ''), `data-calendar-date="${date}" aria-label="${esc(C.formatDate(date))}" aria-pressed="${date === studentCalendarDate}"`);
  }).join('')}</div><div class="student-calendar-detail"><h3>${esc(C.formatDate(studentCalendarDate))}</h3>${detail.map(item => `<div class="student-task"><div><strong>${esc(item.title)}</strong>${item.description ? `<small>${esc(item.description)}</small>` : ''}${item.kind === 'task' && item.memo ? `<p class="assignment-public-memo">${esc(item.memo)}</p>` : ''}${item.kind === 'task' ? `<small class="assignment-checker">🔍 확인자: ${item.checkerName ? esc(item.checkerName) + ' 학생' : '선생님 직접 확인'}</small>` : ''}</div>${item.status ? `<span>${esc(item.status)}</span>` : ''}</div>`).join('') || '<p class="muted">등록된 과제와 일정이 없습니다.</p>'}</div>`;
}
