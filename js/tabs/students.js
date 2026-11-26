import {dateRangeField} from '../components/date-range.js';
import {icon} from '../components/icons.js';
import {teacherSurveys} from './surveys.js';
import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, name, settings, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, badge, btn, checkbox, empty, esc, input, multiple, saveFile, toast, opts } from '../shared/ui.js';
import { recordImportDialog } from './import-records.js';
import { taskStateEditor } from './assignments.js';
import { recordCard, recordEditor } from './records.js';
import { validateKoreanPassword } from '../shared/student-auth.js';
import { previewStudent } from './student-view.js';
let studentSort = 'number', statisticsSection='scores';
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
  const navigation=`<nav class="row statistics-subtabs">${btn('학생 통계',()=>{statisticsSection='scores';render();},statisticsSection==='scores'?'primary':'')}${btn('우리반 마음 지도',()=>{statisticsSection='surveys';render();},statisticsSection==='surveys'?'primary':'')}</nav>`;
  if(statisticsSection==='surveys')return navigation+teacherSurveys();
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
  return navigation+`<div class="toolbar"><div><h2>통계</h2><small>누적 별 개수 · 선택 기간 변화 ${esc(C.formatDate(range.from))} ~ ${esc(C.formatDate(range.to))}</small></div><div class="row">${btn('행발 문장 변환기', () => behaviorConverter(null, range.from, range.to))}${btn('CSV 가져오기', () => recordImportDialog())}${btn('학생 선택 / 전체 내보내기', () => reportDialog(null, range.from, range.to))}</div></div><div class="statistics-summary" aria-label="이번 달 학급 요약"><span class="badge tone-yellow">이번 달 별 ${summary.total}개</span><span class="badge tone-praise">칭찬 ${summary.praise} : 조언 ${summary.advice} · 칭찬 ${summary.praisePercent}%</span><span class="badge tone-mint">칭찬 영역 TOP 1 · ${summary.topArea ? esc(summary.topArea) + ' ' + summary.topCount + '건' : '아직 없음'}</span></div><div class="statistics-filters"><div class="statistics-sort row"><label class="sort-control">${icon('sort')}<select id="student-sort" aria-label="학생 정렬 기준">${opts([['number','번호순'],['stars','별 개수 많은 순'],['attention','관심 필요']],studentSort)}</select></label></div><div class="student-period-controls row"><input type="month" id="student-month" aria-label="학생 조회 월" value="${esc(studentMonth)}">${btn('이번 달', () => {
    selectStudentMonth(C.today().slice(0, 7));
    render();
  })}${btn('지난 달', () => {
    const d = new Date(C.today() + 'T12:00Z');
    d.setUTCMonth(d.getUTCMonth() - 1, 1);
    selectStudentMonth(d.toISOString().slice(0, 7));
    render();
  })}${[1, 2].map(term => btn(term + '학기', () => selectStudentSemester(term), '', C.semesterRange(settings(), term) ? '' : 'disabled title="설정에서 학사일정을 먼저 등록하세요"')).join('')}</div><div class="row student-custom-range">${dateRangeField(range.from,range.to,selected=>{studentRange=selected;studentMonth='';render();},'통계 조회 기간')}</div></div><div class="table-wrap"><table class="student-score-table"><thead><tr><th>학생</th><th>전체</th><th>칭찬</th><th>조언</th><th>분야별</th></tr></thead><tbody>${rows.map(({
    student,
    score
  }) => {
    return `<tr><td>${btn(esc(name(student.id)), () => studentDetail(student.id, range.from, range.to))}</td><td>별 ${score.total}개${change(score.change)}</td><td>${score.praise}${change(score.praiseChange)}</td><td>${score.advice}${change(score.adviceChange)}</td><td><div class="statistics-area-badges">${C.areaNames(db(), true).filter(area => score.areas[area]).map(area => `<span class="badge statistics-area-badge ${score.areas[area] < 0 ? 'tone-advice' : 'tone-praise'}">${esc(area)} ${score.areas[area]}</span>`).join('')}</div></td></tr>`;
  }).join('')}</tbody></table></div>${!students().length ? empty('등록된 학생이 없습니다.', '학생을 추가하거나 설정에서 명단을 붙여 넣으세요.') : ''}${bindStudentMonth()}`;
}
function bindStudentMonth() {
  setTimeout(() => {
    const sort=$('#student-sort');if(sort)sort.onchange=()=>{studentSort=sort.value;render();};
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
  modal(name(id), `<div class="student-kingdom-detail">${C.kingdomBadge(s, C.kingdomCounts(db(), s.id), C.kingdomConfig(db()))}<details><summary>👑 획득한 칭호 목록</summary>${C.kingdomSummary(C.kingdomCounts(db(), s.id), C.kingdomConfig(db()), s)}</details></div><div class="student-detail-content" data-student-id="${esc(id)}" data-from="${esc(from)}" data-to="${esc(to)}"><div class="row" style="margin-bottom:14px">${btn('+ 기록', () => recordEditor({
    studentIds: [id],
    date: state.date
  }))}${btn('학생 수정', () => studentEditor(s))}${btn('👁️ 학생 화면으로 보기', () => previewStudent(s.id))}${btn('행발 문장 변환기', () => behaviorConverter([id], from, to))}${btn('보고서로 내보내기', () => reportDialog(id, from, to), 'primary')}${btn('이번 주', () => studentDetail(id, C.addDays(state.date, -((C.weekday(state.date) + 6) % 7)), state.date))}${btn('이번 달', () => studentDetail(id, state.date.slice(0, 7) + '-01', state.date))}</div><div class="row"><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(from)) || '날짜 선택'}</span><input aria-label="기록 조회 시작" type="date" id="student-from" value="${from}"></span><span>~</span><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(to)) || '날짜 선택'}</span><input aria-label="기록 조회 종료" type="date" id="student-to" value="${to}"></span>${btn('조회', () => studentDetail(id, $('#student-from').value, $('#student-to').value))}</div><div class="panel" style="margin-top:14px"><h3>별 ${score.total}개 · 기간 요약</h3><div class="chips">${C.areaNames(db(), true).map(a => badge(a + ' ' + score.areas[a])).join('')}</div></div><h3>미완료 과제 ${pending.length}건</h3>${pending.map(({
    assignment: a,
    date: d
  }) => btn(esc(C.formatDate(d) + ' ' + a.title), () => taskStateEditor(a, d, id))).join('') || '<p class="muted">남은 과제가 없습니다.</p>'}<details style="margin-top:14px"><summary>과제 처리 이력</summary>${db().assignmentStates.filter(x => x.studentId === id && x.date >= from && x.date <= to).map(x => `<p>${esc(C.formatDate(x.date))} · ${esc(db().assignments.find(a => a.id === x.assignmentId)?.title || '(삭제된 과제)')} · ${esc(x.status)} ${esc(x.memo)}</p>`).join('') || '<p>처리 이력 없음</p>'}</details><details><summary>출결 제외 이력</summary><p>${db().attendance.filter(x => x.studentId === id && x.excluded).map(x => esc(C.formatDate(x.date))).sort().join(' · ') || '없음'}</p></details><h3 style="margin-top:20px">기록 ${records.length}건</h3>${records.length ? `<div class="record-search"><input type="search" id="student-record-search" placeholder="기록 내용에서 단어 찾기" aria-label="기록 내용에서 단어 찾기" autocomplete="off"><button type="button" id="student-record-search-clear" class="record-search-clear" aria-label="검색어 지우기" hidden>✕</button></div><p class="muted record-search-summary" id="student-record-search-summary" hidden></p>` : ''}<div id="student-record-list">${records.map(r => recordCard(r, true, true)).join('') || empty('조회 기간에 기록이 없습니다.')}${records.length ? '<p class="muted record-search-empty" id="student-record-search-empty" hidden>검색어와 맞는 기록이 없습니다.</p>' : ''}</div></div>`);
  bindStudentRecordSearch(records);
}
function bindStudentRecordSearch(records) {
  const field = $('#student-record-search');
  if (!field) return;
  const items = [...document.querySelectorAll('#student-record-list article.record')],
    haystack = new Map(records.map(r => [r.id, [r.text, r.action, C.recordLabel(r), ...C.recordAreas(r)].join(' ').toLowerCase()])),
    summary = $('#student-record-search-summary'),
    emptyMessage = $('#student-record-search-empty'),
    clear = $('#student-record-search-clear');
  const apply = () => {
    const query = field.value.trim().toLowerCase();
    let shown = 0;
    for (const item of items) {
      const match = !query || (haystack.get(item.dataset.recordId) || '').includes(query);
      item.hidden = !match;
      if (match) shown += 1;
    }
    if (clear) clear.hidden = !field.value;
    if (summary) {
      summary.hidden = !query;
      summary.textContent = query ? `기록 ${items.length}건 중 ${shown}건 표시` : '';
    }
    if (emptyMessage) emptyMessage.hidden = !query || shown > 0;
  };
  field.oninput = apply;
  field.onkeydown = event => {
    if (event.key !== 'Escape') return;
    field.value = '';
    apply();
  };
  if (clear) clear.onclick = () => {
    field.value = '';
    apply();
    field.focus();
  };
  apply();
}
export async function resetStudentPassword(id) {
  const student = db().students.find(row => row.id === id);
  if (!student) return;
  const password = String(settings().defaultStudentPassword || '');
  if (!password) throw Error('먼저 [초기화 비밀번호 설정]에서 반 공통 초기 비밀번호를 정해야 학생 비밀번호를 초기화할 수 있습니다.');
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
  modal(s ? '학생 수정' : '학생 추가', `<div class="formgrid">${input('번호', 'no', row.no, 'number', 'min="1" required')}${input('이름', 'name', row.name, 'text', 'required')}<label>성별<select name="gender">${opts([['','미지정'],['남','남'],['여','여']],row.gender||'')}</select></label>${input('별명', 'alias', row.nickname || row.alias || '')}</div>${s ? btn('비밀번호 초기화', () => resetStudentPassword(row.id), 'danger') : ''}<p class="muted">개별 설정 전에는 반 공통 초기 비밀번호가 적용됩니다. 학생은 첫 로그인 시 새 비밀번호를 설정합니다. 비밀번호는 암호화되어 저장되므로 선생님도 볼 수 없고, 초기화만 할 수 있습니다.</p>`, async f => {
    const next = {
      ...(db().students.find(current => current.id === row.id) || row),
      no: Number(f.get('no')),
      name: f.get('name').trim(),
      alias: f.get('alias'),
      gender: ['남','여'].includes(f.get('gender'))?f.get('gender'):'',
      ...(String(f.get('alias') || '') !== (row.nickname || row.alias || '') ? { nickname: /^[가-힣]{1,8}$/.test(String(f.get('alias') || '')) ? f.get('alias') : null } : {}),
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
  modal('학생 보고서 내보내기', `<div class="formgrid">${input('시작일', 'from', from, 'date', 'required')}${input('종료일', 'to', to, 'date', 'required')}</div><div class="report-targets"><div class="row">${btn('전체 학생 선택', () => document.querySelectorAll('#modal-form [name=reportStudents]').forEach(el => el.checked = true))}${btn('선택 해제', () => document.querySelectorAll('#modal-form [name=reportStudents]').forEach(el => el.checked = false))}</div>${multiple(list.map(s => [s.id, s.no + '. ' + s.name]), 'reportStudents', selected)}</div>${checkbox('작성 및 수정일 포함', 'includeTimestamps')}<p class="muted">추가기록은 인쇄 포함으로 지정한 건만 출력합니다.</p>`, async f => {
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
  return `<section class="report-page"><p>오늘의 별 · ${esc(settings().className)}</p><h1>${esc(settings().reportHeader)}</h1><div class="report-student-meta"><strong>${esc(s.no)}. ${esc(s.name)}</strong><br><span class="muted">${esc(C.formatDate(from))} ~ ${esc(C.formatDate(to))}</span></div><h2>기간 요약</h2><p>칭찬 ${records.filter(r => r.kind === '칭찬').length}건 · 조언 ${records.filter(r => r.kind === '지도').length}건</p><table><thead><tr>${C.areaNames(db(), true).map(a => `<th>${esc(a)}</th>`).join('')}</tr></thead><tbody><tr>${C.areaNames(db(), true).map(a => `<td>${records.filter(r => (r.areas || []).includes(a)).reduce((n, r) => n + C.delta(r), 0)}</td>`).join('')}</tr></tbody></table><h2 style="margin-top:22px">학교생활 기록</h2>${records.map(r => `<article class="record ${r.kind === '칭찬' ? 'report-praise' : r.kind === '지도' ? 'report-advice' : ''} ${r.kind === '추가기록' && r.extraType === '사건' ? 'incident-record' : ''}"><strong>${esc(C.formatDate(r.date))}${C.recordPeriod(r.period) ? ' ' + esc(C.recordPeriod(r.period)) : ''} · ${esc(C.recordLabel(r))}</strong>${timestamps ? `<small class="report-timestamps">작성 ${esc(C.formatTimestamp(r.createdAt))}${r.updatedAt ? ' · 수정 ' + esc(C.formatTimestamp(r.updatedAt)) : ''}</small>` : ''}<div class="body">${esc(r.text)}</div>${r.action ? `<p class="body" style="margin-top:8px">지도 내용: ${esc(r.action)}</p>` : ''}${(r.areas || []).length ? `<div class="report-areas">${C.recordAreas(r).map(area => `<span class="report-area">${esc(area)}</span>`).join('')}</div>` : ''}</article>`).join('')}</section>`;
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

async function copyBehavior(text) {
  try {
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
    else {const field=document.createElement('textarea');field.value=text;$('#modal .dialog-body').append(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw Error('copy');}
    toast('복사했습니다.');
  } catch {toast('복사하지 못했습니다. 문장을 선택해 직접 복사해 주세요.');}
}
// Drafts stay on this device, keyed by class and student id.
const BEHAVIOR_DRAFT_KEY = 'startoday-behavior-drafts-v1';
function behaviorDraftScope() {
  return `${store.mode || 'local'}:${store.classId || 'default'}`;
}
function readBehaviorDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(BEHAVIOR_DRAFT_KEY) || '{}'),
      rows = saved && typeof saved === 'object' ? saved[behaviorDraftScope()] : null;
    return rows && typeof rows === 'object' ? rows : {};
  } catch {
    return {};
  }
}
function writeBehaviorDrafts(rows) {
  try {
    const saved = JSON.parse(localStorage.getItem(BEHAVIOR_DRAFT_KEY) || '{}'),
      next = saved && typeof saved === 'object' ? saved : {};
    next[behaviorDraftScope()] = rows;
    localStorage.setItem(BEHAVIOR_DRAFT_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
function savedBehaviorDraft(id) {
  const row = readBehaviorDrafts()[id];
  return row && typeof row.text === 'string' ? row : null;
}
function saveBehaviorDraft(id, text) {
  const rows = readBehaviorDrafts(),
    value = String(text ?? '');
  if (!value.trim()) {
    delete rows[id];
    return writeBehaviorDrafts(rows);
  }
  rows[id] = {text: value, updatedAt: new Date().toISOString()};
  return writeBehaviorDrafts(rows);
}
function clearBehaviorDraft(id) {
  const rows = readBehaviorDrafts();
  delete rows[id];
  return writeBehaviorDrafts(rows);
}
export function behaviorConverter(ids = null, from = studentRange?.from || state.date.slice(0,7)+'-01', to = studentRange?.to || state.date) {
  const list=students(),selected=ids||list.map(s=>s.id);
  let generated=[],period={from,to},analysis=null;
  const summaryFor=id=>C.behaviorSummary(db(),id,period.from,period.to,analysis);
  const draftField=id=>[...document.querySelectorAll('[data-behavior-draft]')].find(e=>e.dataset.behaviorDraft===id);
  const currentText=id=>draftField(id)?.value??'';
  const draftsText=()=>generated.map(s=>`${name(s.id)}\n${currentText(s.id)}`).join('\n\n');
  const draftStatus=id=>{const saved=savedBehaviorDraft(id);return saved?`저장된 초안 · ${C.formatTime(saved.updatedAt)}`:'저장 안 됨 · 고치면 자동 저장됩니다';};
  const setStatus=id=>{const el=[...document.querySelectorAll('[data-behavior-status]')].find(e=>e.dataset.behaviorStatus===id);if(!el)return;const saved=savedBehaviorDraft(id);el.classList.toggle('is-saved',!!saved);el.textContent=draftStatus(id);};
  const storeDraft=id=>{const ok=saveBehaviorDraft(id,currentText(id));setStatus(id);if(!ok)toast('자동 저장 공간을 쓸 수 없습니다. 초안을 복사해 두세요.');return ok;};
  const draftText=s=>savedBehaviorDraft(s.id)?.text??C.behaviorDraft(summaryFor(s.id));
  const regenerate=id=>{
    if(savedBehaviorDraft(id)&&!confirm(`${name(id)}의 저장된 초안을 지금 기록으로 새로 만든 초안으로 바꿀까요?`))return;
    const field=draftField(id);if(!field)return;
    analysis=C.behaviorAnalysis(db(),period.from,period.to);
    field.value=C.behaviorDraft(summaryFor(id));
    storeDraft(id);
    toast('초안을 새로 만들었습니다.');
  };
  const forget=id=>{
    if(!savedBehaviorDraft(id))return toast('저장된 초안이 없습니다.');
    if(!confirm(`${name(id)}의 저장된 초안을 지울까요?`))return;
    clearBehaviorDraft(id);
    const field=draftField(id);if(field)field.value='';
    setStatus(id);
    toast('저장된 초안을 지웠습니다.');
  };
  const downloadDrafts=kind=>{
    if(!generated.length)return toast('먼저 초안을 생성할 학생을 선택하세요.');
    const rows=generated.map(s=>({no:s.no,label:C.studentLabel(s),count:summaryFor(s.id).records.length,text:currentText(s.id)}));
    const range=`${C.formatDate(period.from)} ~ ${C.formatDate(period.to)}`,stamp=C.today().replaceAll('-','');
    if(kind==='csv'){
      const quote = value => {
        const text = String(value ?? '');
        const escaped = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
        return `"${escaped.replace(/"/g, '""')}"`;
      };
      const csv='\uFEFF'+['번호,학생,기간,기록 수,초안',...rows.map(r=>[r.no,r.label,range,r.count,r.text].map(quote).join(','))].join('\r\n');
      saveFile(`행발_초안_${stamp}.csv`,csv,'text/csv;charset=utf-8');
      toast('CSV 파일로 내려받았습니다.');
    }else{
      saveFile(`행발_초안_${stamp}.txt`,rows.map(r=>`${r.no}. ${r.label} (${r.count}건)\n${r.text}`).join('\n\n'),'text/plain;charset=utf-8');
      toast('텍스트 파일로 내려받았습니다.');
    }
  };
  const card=s=>{
    const summary=summaryFor(s.id),saved=savedBehaviorDraft(s.id);
    return `<article class="behavior-result" data-behavior-id="${esc(s.id)}"><h3>${esc(name(s.id))}</h3><p class="muted">칭찬 ${summary.praise}건 · 조언 ${summary.advice}건 · 과제 ${summary.assignments.done}/${summary.assignments.total} · 루틴 ${summary.routines.done}/${summary.routines.total} · 일괄 기록 제외 ${summary.meta.excludedBulkRecords}건</p><label>행발 초안<textarea data-behavior-draft="${esc(s.id)}" aria-label="${esc(name(s.id))} 행발 초안">${esc(draftText(s))}</textarea></label><div class="row behavior-draft-meta"><span class="behavior-draft-status ${saved?'is-saved':''}" data-behavior-status="${esc(s.id)}">${esc(draftStatus(s.id))}</span>${btn('초안 새로 생성(덮어쓰기)',()=>regenerate(s.id))}${btn('저장된 초안 지우기',()=>forget(s.id),'danger')}</div><div class="row">${btn('초안 복사',()=>copyBehavior(currentText(s.id)))}${btn('개별 AI용 프롬프트 복사',()=>copyBehavior(C.behaviorPrompt(db(),[s.id],period.from,period.to)))}</div><details><summary>분석 근거 확인</summary><p>${summary.areas.map(a=>esc(`${a.area}: 칭찬 ${a.praise} / 조언 ${a.advice}`)).join(' · ')}</p>${summary.records.map(r=>`<p>${esc(C.formatDate(r.date))} · ${esc(r.kind)} · ${esc(r.text)}${r.action?' / 지도: '+esc(r.action):''}</p>`).join('')||'<p>기간 내 기록이 없습니다.</p>'}</details></article>`;
  };
  const bindDrafts=()=>{
    for(const field of document.querySelectorAll('[data-behavior-draft]'))field.oninput=()=>storeDraft(field.dataset.behaviorDraft);
  };
  const renderResults=()=>{
    analysis=C.behaviorAnalysis(db(),period.from,period.to);
    $('#behavior-results').innerHTML=`<p class="muted">${esc(C.formatDate(period.from))} ~ ${esc(C.formatDate(period.to))} · ${generated.length}명</p><div class="row behavior-toolbar">${btn('전체 초안 복사',()=>copyBehavior(draftsText()))}${btn('AI용 프롬프트 복사',()=>copyBehavior(C.behaviorPrompt(db(),generated.map(s=>s.id),period.from,period.to)))}${btn('AI용 기록 CSV 내려받기',()=>{saveFile(`행발_AI분석용_기록_${C.today().replaceAll('-','')}.csv`,C.behaviorAnalysisCSV(db(),generated.map(s=>s.id),period.from,period.to),'text/csv;charset=utf-8');toast('비식별 AI 분석용 기록 CSV를 내려받았습니다.');})}${btn('CSV로 내려받기',()=>downloadDrafts('csv'))}${btn('텍스트로 내려받기',()=>downloadDrafts('txt'))}</div>`+generated.map(card).join('');
    bindDrafts();
  };
  const generate=()=>{
    const nextFrom=$('#behavior-from').value,nextTo=$('#behavior-to').value;C.dates(nextFrom,nextTo);
    const chosen=[...document.querySelectorAll('[name=behaviorStudents]:checked')].map(e=>e.value);
    if(!chosen.length){toast('학생을 선택하세요.');return;}
    period={from:nextFrom,to:nextTo};generated=list.filter(s=>chosen.includes(s.id));
    renderResults();
  };
  modal('행발 문장 변환기',`<div class="behavior-converter"><p class="muted">선택 기간의 실제 기록을 바탕으로 앱에서 초안을 생성합니다. 초안을 검토·수정한 뒤 사용하세요. 고친 초안은 이 기기에 자동 저장되며 다시 열어도 그대로 남습니다. AI용 복사는 명단의 이름·별명·번호와 연락처를 가립니다. 외부로 붙여넣기 전 근거의 비식별 상태도 확인해 주세요.</p><div class="row">${input('시작일','behaviorFrom',from,'date','id="behavior-from"')}${input('종료일','behaviorTo',to,'date','id="behavior-to"')}</div><div class="row">${btn('전체 선택',()=>document.querySelectorAll('[name=behaviorStudents]').forEach(e=>e.checked=true))}${btn('선택 해제',()=>document.querySelectorAll('[name=behaviorStudents]').forEach(e=>e.checked=false))}${btn('선택 학생 초안 생성',generate,'primary')}</div><div class="behavior-students">${list.map(s=>`<label><input type="checkbox" name="behaviorStudents" value="${esc(s.id)}" ${selected.includes(s.id)?'checked':''}>${esc(name(s.id))}</label>`).join('')}</div><div id="behavior-results" aria-live="polite"></div></div>`);
  if(selected.length)generate();
}
