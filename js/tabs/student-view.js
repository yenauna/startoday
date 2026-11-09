import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { state, store } from '../shared/state.js';
import { btn, esc, input } from '../shared/ui.js';

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
    score: {
      total: score.total,
      areas: score.areas
    },
    tasks: source.assignments.filter(a => C.targeted(a, student.id) && C.occurs(a, date)).map(a => ({
      title: a.title,
      date,
      status: excluded ? '면제' : C.assignmentStatus(source, a.id, date, student.id)
    })),
    routines: source.routines.filter(r => !r.deletedAt && C.targeted(r, student.id)).map(r => ({
      title: r.title,
      status: excluded ? '면제' : C.routineStatus(source, r.id, date, student.id)
    })),
    timetable: source.timetables.filter(t => t.date === date && t.period >= 1 && t.period <= 6).sort((a, b) => a.period - b.period).map(t => ({
      period: t.period,
      subject: t.subjectCode,
      location: t.locationOverride || source.subject_rules.find(r => r.code === t.subjectCode)?.location || ''
    })),
    praise: source.records.filter(r => r.kind === '칭찬' && r.studentIds.includes(student.id) && r.date <= date && (!r.autoRef || automaticPraise(r) !== null)).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 50).map(r => ({
      kind: '칭찬',
      date: r.date,
      period: C.recordPeriod(r.period),
      text: r.autoRef ? automaticPraise(r) : r.text,
      areas: r.areas || (r.area ? [r.area] : [])
    }))
  };
}
export function studentLoginDialog() {
  modal('학생 로그인', `${input('학생 코드 또는 학급명+번호', 'studentCode', '', 'text', 'required autocomplete="username" placeholder="예: 1번 또는 학생 코드"')}${input('비밀번호', 'password', '', 'password', 'required autocomplete="current-password"')}<p class="muted">초기 비밀번호는 12345입니다.</p><small>체험 명단은 번호로, 실제 학급은 선생님께 받은 학생 코드로 로그인하세요.</small>`, async f => {
    const code = f.get('studentCode').trim(),
      password = f.get('password');
    let snapshot;
    if (store.client && store.mode !== 'demo') {
      const {
        data,
        error
      } = await store.client.rpc('startoday_student_login', {
        p_code: code,
        p_password: password
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') throw Error('학생 로그인을 준비 중입니다. 선생님이 최신 schema.sql을 적용해야 합니다.');
        throw Error('학생 로그인에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
      }
      snapshot = data;
    } else {
      if (!store.db) store.demo();
      const matches = C.activeStudents(store.db).filter(s => code === s.studentCode || code === s.name || code === String(s.no) || code === s.no + '번' || code === `${store.db.settings[0]?.className} ${s.no}번`);
      if (matches.length === 1 && String(matches[0].password ?? '12345') === password) snapshot = studentSnapshot(store.db, matches[0]);
    }
    if (!snapshot?.student) throw Error('학생 번호(코드) 또는 비밀번호가 올바르지 않습니다.');
    state.studentUser = snapshot.student;
    state.studentSnapshot = snapshot;
    state.impersonatingStudentId = null;
    state.viewMode = 'student';
    state.selected = [];
    closeModal();
    render();
  }, '로그인');
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
  const preview = !!state.impersonatingStudentId;
  state.studentUser = null;
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
  const student = state.impersonatingStudentId ? store.db?.students.find(s => s.id === state.impersonatingStudentId && !s.deletedAt) : state.studentUser;
  if (!student) return `<main class="student-shell"><p>학생 정보를 확인할 수 없습니다.</p>${btn('돌아가기', leaveStudentView)}</main>`;
  const data = state.impersonatingStudentId ? studentSnapshot(store.db, student) : state.studentSnapshot;
  if (!data) return `<main class="student-shell">${btn('다시 로그인', leaveStudentView)}</main>`;
  const pills = areas => (areas || []).map(a => `<span class="student-pill">${esc(a)}</span>`).join('');
  const taskList = list => list.map(task => {
    const done = ['완료', '늦게완료', '면제'].includes(task.status);
    return `<div class="student-task ${done ? 'is-complete' : ''}"><div><strong>${esc(task.title)}</strong>${task.date ? `<small>${esc(C.formatDate(task.date))}</small>` : ''}</div><span>${done ? '✓ ' : ''}${esc(task.status)}</span></div>`;
  }).join('') || '<p class="muted">오늘 할 일이 없습니다.</p>';
  return `<div class="student-shell">${state.impersonatingStudentId ? `<aside class="student-preview-banner">👁️ 선생님 대리 접속 모드 (${esc(student.no)}. ${esc(student.name)})${btn('교사 화면으로 돌아가기', leaveStudentView)}</aside>` : ''}<header class="student-header"><img class="logo" src="assets/logo-icon.jpg" alt="오늘의 별"><div><strong>${esc(data.className)}</strong><span>${esc(student.no)}. ${esc(student.name)}</span></div>${state.impersonatingStudentId ? '' : btn('로그아웃', leaveStudentView)}</header><main class="student-dashboard"><section class="student-card student-growth"><h2>내 별 점수</h2><div class="student-stars">★ ${esc(data.score.total)}개</div><div class="student-pills">${pills(Object.entries(data.score.areas || {}).map(([a, n]) => a + ' ' + n))}</div></section><section class="student-card"><h2>오늘의 과제 &amp; 루틴</h2><h3>과제</h3>${taskList(data.tasks)}<h3>루틴</h3>${taskList(data.routines)}</section><section class="student-card"><h2>오늘의 시간표</h2>${data.timetable.map(t => `<div class="student-task"><strong>${esc(t.period)}교시 ${esc(t.subject)}</strong><small>${esc(t.location)}</small></div>`).join('') || '<p class="muted">오늘 등록된 수업이 없습니다.</p>'}</section><section class="student-card"><h2>선생님의 칭찬 편지함</h2>${(data.praise || []).filter(r => r.kind === '칭찬').map(r => `<article class="student-praise"><small>${esc(C.formatDate(r.date))}${r.period ? ' ' + esc(r.period) : ''}</small><p>${esc(r.text)}</p><div class="student-pills">${pills(r.areas)}</div></article>`).join('') || '<p class="student-empty">선생님의 따뜻한 칭찬이 여기에 차곡차곡 쌓여요! 오늘도 힘내요 ⭐</p>'}</section></main></div>`;
}
