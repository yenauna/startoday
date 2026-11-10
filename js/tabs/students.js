import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, name, settings, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, badge, btn, checkbox, empty, esc, input } from '../shared/ui.js';
import { taskStateEditor } from './assignments.js';
import { recordCard, recordEditor } from './records.js';
import { validateKoreanPassword } from '../shared/student-auth.js';
import { previewStudent } from './student-view.js';
let studentSort = 'number';
let studentRangeScope = '',
  studentRange = null,
  studentMonth = '';
function selectStudentMonth(month) {
  studentRange = C.monthRange(month);
  studentMonth = month;
}
function selectStudentSemester(term) {
  const range = C.semesterRange(settings(), term);
  if (!range) return;
  studentRange = range;
  studentMonth = '';
  render();
}
export function studentsView() {
  const today = C.today(),
    scope = `${store.mode}:${store.classId}:${settings().academicYear}`;
  if (scope !== studentRangeScope || !studentRange) {
    studentRangeScope = scope;
    studentSort = 'number';
    selectStudentMonth(today.slice(0, 7));
  }
  const range = {
    ...studentRange
  };
  const summary = C.classStatisticsSummary(db(), today);
  const rows = students().map(student => {
    const score = C.studentScoreSummary(db(), student.id, today, range.from, range.to),
      pending = C.pending(db(), student.id, today).length + C.pendingRoutines(db(), student.id, today).length;
    return {
      student,
      score,
      attention: score.advice + pending
    };
  });
  rows.sort((a, b) => (studentSort === 'stars' ? b.score.total - a.score.total : studentSort === 'attention' ? b.attention - a.attention : 0) || a.student.no - b.student.no);
  const change = n => `<span class="score-change ${n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral'}">(${n > 0 ? '+' : ''}${n})</span>`;
  return `<div class="toolbar"><div><h2>통계</h2><small>누적 점수 · 선택 기간 변화 ${esc(C.formatDate(range.from))} ~ ${esc(C.formatDate(range.to))}</small></div><div class="row">${btn('학생 선택 / 전체 내보내기', () => reportDialog(null, range.from, range.to))}</div></div><div class="statistics-summary" aria-label="이번 달 학급 요약"><span class="badge tone-yellow">이번 달 별점 ${summary.total}</span><span class="badge tone-praise">칭찬 ${summary.praise} : 조언 ${summary.advice} · 칭찬 ${summary.praisePercent}%</span><span class="badge tone-mint">칭찬 영역 TOP 1 · ${summary.topArea ? esc(summary.topArea) + ' ' + summary.topCount + '건' : '아직 없음'}</span></div><div class="statistics-sort row">${[['number', '번호순'], ['stars', '별점 많은 순'], ['attention', '관심 필요(조언·미완료 많은 순)']].map(([key, label]) => btn(label, () => {
    studentSort = key;
    render();
  }, studentSort === key ? 'primary' : '', `aria-pressed="${studentSort === key}" title="${key === 'attention' ? '누적 조언 + 현재 미완료 과제·루틴 수' : label}"`)).join('')}</div><div class="student-period-controls row"><input type="month" id="student-month" aria-label="학생 조회 월" value="${esc(studentMonth)}">${btn('이번 달', () => {
    selectStudentMonth(C.today().slice(0, 7));
    render();
  })}${btn('지난 달', () => {
    const d = new Date(C.today() + 'T12:00Z');
    d.setUTCMonth(d.getUTCMonth() - 1, 1);
    selectStudentMonth(d.toISOString().slice(0, 7));
    render();
  })}${[1, 2].map(term => btn(term + '학기', () => selectStudentSemester(term), '', C.semesterRange(settings(), term) ? '' : 'disabled title="설정에서 학사일정을 먼저 등록하세요"')).join('')}</div><div class="table-wrap"><table class="student-score-table"><thead><tr><th>학생</th><th>전체</th><th>칭찬</th><th>조언</th><th>경험치별</th></tr></thead><tbody>${rows.map(({
    student,
    score
  }) => {
    return `<tr><td>${btn(esc(name(student.id)), () => studentDetail(student.id, range.from, range.to))}</td><td>${score.total}${change(score.change)}</td><td>${score.praise}${change(score.praiseChange)}</td><td>${score.advice}${change(score.adviceChange)}</td><td><div class="statistics-area-badges">${C.areaNames(db(), true).filter(area => score.areas[area]).map(area => `<span class="badge statistics-area-badge ${score.areas[area] < 0 ? 'tone-advice' : 'tone-praise'}">${esc(area)} ${score.areas[area]}</span>`).join('')}</div></td></tr>`;
  }).join('')}</tbody></table></div>${!students().length ? empty('등록된 학생이 없습니다.', '학생을 추가하거나 설정에서 명단을 붙여 넣으세요.') : ''}${bindStudentMonth()}`;
}
function bindStudentMonth() {
  setTimeout(() => {
    const input = $('#student-month');
    if (input) input.onchange = () => {
      if (!input.value) return;
      selectStudentMonth(input.value);
      render();
    };
  }, 0);
  return '';
}
export function studentDetail(id, from = state.date.slice(0, 7) + '-01', to = state.date) {
  const s = db().students.find(s => s.id === id);
  if (!s) return;
  const score = C.scores(db(), id, from, to),
    records = db().records.filter(r => r.studentIds.includes(id) && r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    pending = C.pending(db(), id, state.date);
  modal(name(id), `<div class="student-detail-content" data-student-id="${esc(id)}" data-from="${esc(from)}" data-to="${esc(to)}"><div class="row" style="margin-bottom:14px">${btn('+ 기록', () => recordEditor({
    studentIds: [id],
    date: state.date
  }))}${btn('학생 수정', () => studentEditor(s))}${btn('👁️ 학생 화면으로 보기', () => previewStudent(s.id))}${btn('보고서로 내보내기', () => reportDialog(id, from, to), 'primary')}${btn('이번 주', () => studentDetail(id, C.addDays(state.date, -((C.weekday(state.date) + 6) % 7)), state.date))}${btn('이번 달', () => studentDetail(id, state.date.slice(0, 7) + '-01', state.date))}</div><div class="row"><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(from)) || '날짜 선택'}</span><input aria-label="기록 조회 시작" type="date" id="student-from" value="${from}"></span><span>~</span><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(to)) || '날짜 선택'}</span><input aria-label="기록 조회 종료" type="date" id="student-to" value="${to}"></span>${btn('조회', () => studentDetail(id, $('#student-from').value, $('#student-to').value))}</div><div class="panel" style="margin-top:14px"><h3>★ ${score.total} · 기간 요약</h3><div class="chips">${C.areaNames(db(), true).map(a => badge(a + ' ' + score.areas[a])).join('')}</div></div><h3>미완료 과제 ${pending.length}건</h3>${pending.map(({
    assignment: a,
    date: d
  }) => btn(esc(C.formatDate(d) + ' ' + a.title), () => taskStateEditor(a, d, id))).join('') || '<p class="muted">남은 과제가 없습니다.</p>'}<details style="margin-top:14px"><summary>과제 처리 이력</summary>${db().assignmentStates.filter(x => x.studentId === id && x.date >= from && x.date <= to).map(x => `<p>${esc(C.formatDate(x.date))} · ${esc(db().assignments.find(a => a.id === x.assignmentId)?.title || '(삭제된 과제)')} · ${esc(x.status)} ${esc(x.memo)}</p>`).join('') || '<p>처리 이력 없음</p>'}</details><details><summary>출결 제외 이력</summary><p>${db().attendance.filter(x => x.studentId === id && x.excluded).map(x => esc(C.formatDate(x.date))).sort().join(' · ') || '없음'}</p></details><h3 style="margin-top:20px">기록 ${records.length}건</h3>${records.map(r => recordCard(r, true, true)).join('') || empty('조회 기간에 기록이 없습니다.')}</div>`);
}
export async function resetStudentPassword(id) {
  const student = db().students.find(row => row.id === id);
  if (!student) return;
  const password = settings().defaultStudentPassword || '바람123';
  validateKoreanPassword(password);
  if (!confirm(`${student.no}. ${student.name} 학생의 비밀번호를 반 공통 초기 비밀번호로 초기화할까요?`)) return;
  await commit([up('students', {
    ...student,
    password,
    passwordChanged: false,
    passwordResetRequired: true
  })], '비밀번호를 초기화했습니다. 학생은 다음 로그인 시 새 비밀번호를 설정합니다.');
}
export function studentEditor(s = null) {
  const row = s || {
    id: C.uid(),
    no: Math.max(0, ...students().map(s => s.no)) + 1,
    name: '',
    group: '',
    seat: null,
    academicYear: settings().academicYear,
    studentCode: '',
    createdAt: C.now()
  };
  modal(s ? '학생 수정' : '학생 추가', `<div class="formgrid">${input('번호', 'no', row.no, 'number', 'min="1" required')}${input('이름', 'name', row.name, 'text', 'required')}${input('교실 화면 별칭', 'alias', row.alias || '')}</div>${s ? btn('비밀번호 초기화', () => resetStudentPassword(row.id), 'danger') : ''}<p class="muted">개별 설정 전에는 반 공통 초기 비밀번호가 적용됩니다. 학생은 첫 로그인 시 새 비밀번호를 설정합니다.</p>`, async f => {
    const next = {
      ...(db().students.find(current => current.id === row.id) || row),
      no: Number(f.get('no')),
      name: f.get('name').trim(),
      alias: f.get('alias'),
      deletedAt: null
    };
    if (!next.name || !Number.isInteger(next.no) || next.no < 1) throw Error('번호와 이름을 확인하세요.');
    const duplicate = students().filter(x => x.id !== row.id && x.no === next.no);
    if (duplicate.length && !confirm('같은 번호 학생이 있습니다. 그대로 저장할까요?')) return;
    if (!s) {
      const removed = db().students.find(x => x.deletedAt && x.no === next.no && x.name === next.name);
      if (removed && confirm('같은 번호·이름의 나간 학생이 있습니다. 기존 기록과 다시 연결할까요?')) {
        next.id = removed.id;
        next.createdAt = removed.createdAt;
        next.seat = null;
      }
    }
    await commit(C.withAutoSeats(db(), [up('students', next)]));
    closeModal();
  });
}
export function reportDialog(id, from, to) {
  if (id) {
    C.dates(from, to);
    const student = db().students.find(row => row.id === id);
    if (!student) throw Error('학생을 찾지 못했습니다.');
    closeModal();
    showReports([{
      student,
      records: C.reportRecords(db(), id, from, to)
    }], from, to, settings().reportPrintMode || 'color', false);
    return;
  }
  const list = students(),
    selected = list.map(s => s.id);
  if (!list.length) throw Error('내보낼 학생이 없습니다.');
  modal('학생 보고서 내보내기', `<div class="formgrid">${input('시작일', 'from', from, 'date', 'required')}${input('종료일', 'to', to, 'date', 'required')}</div><div class="report-targets"><div class="row">${btn('전체 학생 선택', () => document.querySelectorAll('#modal-form [name=reportStudents]').forEach(el => el.checked = true))}${btn('선택 해제', () => document.querySelectorAll('#modal-form [name=reportStudents]').forEach(el => el.checked = false))}</div><div class="checkgrid">${list.map(s => `<label class="inline"><input type="checkbox" name="reportStudents" value="${esc(s.id)}" ${selected.includes(s.id) ? 'checked' : ''}>${esc(s.no + '. ' + s.name)}</label>`).join('')}</div></div>${checkbox('작성 및 수정일 포함', 'includeTimestamps')}<p class="muted">추가 기록은 인쇄 포함으로 지정한 건만 출력합니다.</p>`, async f => {
    const from = f.get('from'),
      to = f.get('to');
    C.dates(from, to);
    const ids = new Set(f.getAll('reportStudents')),
      targets = list.filter(s => ids.has(s.id));
    if (!targets.length) throw Error('학생을 1명 이상 선택하세요.');
    const reports = targets.map(student => ({
      student,
      records: C.reportRecords(db(), student.id, from, to)
    }));
    closeModal();
    showReports(reports, from, to, settings().reportPrintMode || 'color', !!f.get('includeTimestamps'));
  }, '보고서 열기');
}
export function reportPreview(s, from, to) {
  showPrint(s, from, to, C.reportRecords(db(), s.id, from, to));
}
export function showPrint(s, from, to, records) {
  showReports([{
    student: s,
    records
  }], from, to, settings().reportPrintMode || 'color', false);
}
function reportPage(s, from, to, records, timestamps) {
  return `<section class="report-page"><p>오늘의 별 · ${esc(settings().className)}</p><h1>${esc(settings().reportHeader)}</h1><div class="report-student-meta"><strong>${esc(s.no)}. ${esc(s.name)}</strong><br><span class="muted">${esc(C.formatDate(from))} ~ ${esc(C.formatDate(to))}</span></div><h2>기간 요약</h2><p>칭찬 ${records.filter(r => r.kind === '칭찬').length}건 · 조언 ${records.filter(r => r.kind === '지도').length}건</p><table><thead><tr>${C.areaNames(db(), true).map(a => `<th>${esc(a)}</th>`).join('')}</tr></thead><tbody><tr>${C.areaNames(db(), true).map(a => `<td>${records.filter(r => (r.areas || []).includes(a)).reduce((n, r) => n + C.delta(r), 0)}</td>`).join('')}</tr></tbody></table><h2 style="margin-top:22px">학교생활 기록</h2>${records.map(r => `<article class="record ${r.kind === '칭찬' ? 'report-praise' : r.kind === '지도' ? 'report-advice' : ''} ${r.kind === '추가기록' && r.extraType === '사건' ? 'incident-record' : ''}"><strong>${esc(C.formatDate(r.date))}${C.recordPeriod(r.period) ? ' ' + esc(C.recordPeriod(r.period)) : ''} · ${esc(C.recordLabel(r))}</strong>${timestamps ? `<small class="report-timestamps">작성 ${esc(C.formatTimestamp(r.createdAt))}${r.updatedAt ? ' · 수정 ' + esc(C.formatTimestamp(r.updatedAt)) : ''}</small>` : ''}<div class="body">${esc(r.text)}</div>${r.action ? `<p class="body" style="margin-top:8px">지도 내용: ${esc(r.action)}</p>` : ''}${(r.areas || []).length ? `<div class="report-areas">${(r.areas || []).map(area => `<span class="report-area">${esc(area)}</span>`).join('')}</div>` : ''}</article>`).join('')}</section>`;
}
function showReports(reports, from, to, mode, timestamps = false) {
  const root = document.createElement('div');
  root.className = 'print-root report-' + (mode === 'mono' ? 'monochrome' : 'color');
  const changeMode = mode => {
    root.classList.toggle('report-monochrome', mode === 'mono');
    root.classList.toggle('report-color', mode === 'color');
    root.querySelectorAll('[data-report-color]').forEach(b => {
      const active = b.dataset.reportColor === mode;
      b.classList.toggle('primary', active);
      b.setAttribute('aria-pressed', String(active));
    });
  };
  root.innerHTML = `<div class="no-print row report-toolbar"><div class="report-color-buttons" role="group" aria-label="출력 색상">${btn('컬러', () => changeMode('color'), mode === 'color' ? 'primary' : '', 'data-report-color="color" aria-pressed="' + (mode === 'color') + '"')}${btn('흑백', () => changeMode('mono'), mode === 'mono' ? 'primary' : '', 'data-report-color="mono" aria-pressed="' + (mode === 'mono') + '"')}</div>${btn('인쇄 / PDF 저장', () => window.print(), 'primary')}${btn('보고서 닫기', () => {
    root.remove();
    document.body.classList.remove('report-open');
  })}<small>브라우저 인쇄 설정의 머리글·바닥글을 끄면 출력 시각과 주소가 빠집니다.</small></div>${reports.map(({
    student,
    records
  }) => reportPage(student, from, to, records, timestamps)).join('')}`;
  document.querySelector('.print-root')?.remove();
  document.body.append(root);
  document.body.classList.add('report-open');
  root.scrollIntoView();
}
