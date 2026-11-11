import { modal, closeModal } from './modal.js';
import { render, navigate } from '../app.js';
import * as C from '../core.js';
import { db, name, settings } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, btn, esc, opts, toast } from '../shared/ui.js';
import { classroom } from '../tabs/classroom.js';
import { recordButtons, saveDirectRecords } from '../tabs/dashboard.js';
import { studentLoginDialog } from '../tabs/student-view.js';
export function header() {
  return `<header class="top">${btn('<img src="assets/logo-icon.jpg" class="logo" data-logo-slot alt="로고" style="object-fit:cover;border-radius:8px"><strong>오늘의 별</strong><small>' + esc(settings().className) + '</small>', () => {
    state.dashMode = 'normal';
    navigate('대시보드');
  }, 'brand brand-home', 'aria-label="오늘의 별 홈"')}<div class="row">${btn('교실 화면', classroom)}<div class="header-more">${btn('⋮', () => toggleMore(), 'more-toggle', 'id="header-more-toggle" aria-label="더보기" aria-haspopup="menu" aria-expanded="false" aria-controls="header-more-menu"')}<div id="header-more-menu" class="header-more-menu" role="menu" hidden>${btn('🪑 자리 배치', () => openMoreTab('자리'), '', 'role="menuitem"')}${btn('⚙️ 설정', () => openMoreTab('설정'), '', 'role="menuitem"')}${btn('🚪 로그아웃', async () => {
    toggleMore(false);
    await store.logout();
    state.selected = [];
    render();
  }, '', 'role="menuitem"')}</div></div></div></header>`;
}
function toggleMore(open) {
  const menu = $('#header-more-menu'),
    button = $('#header-more-toggle');
  if (!menu || !button) return;
  const show = open ?? menu.hidden;
  menu.hidden = !show;
  button.setAttribute('aria-expanded', String(show));
}
function openMoreTab(tab) {
  toggleMore(false);
  navigate(tab);
}
document.addEventListener('click', e => {
  if (!e.target.closest?.('.header-more')) toggleMore(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    toggleMore(false);
    if (e.target.closest?.('.header-more')) $('#header-more-toggle')?.focus();
  }
});
export function renderLogin() {
  clearInterval(state.clockTimer);
  $('#app').innerHTML = `<div class="panel login"><img src="assets/logo-icon.jpg" class="logo" alt="로고" style="width:54px;height:54px;border-radius:12px;margin-bottom:18px;object-fit:cover"><h1>오늘의 별</h1><p>오늘의 작은 행동을 기록하고,<br>아이들의 성장을 함께 살펴보세요.</p><p>생활지도 기록 · 과제와 루틴 · 시간표와 일정<br>선생님의 학급 운영을 한곳에서 관리합니다.</p>${store.client ? btn('선생님으로 시작하기 (Google)', () => store.login(), 'primary') : '<div class="notice">아직 연결 전입니다. config.js에 수파베이스 프로젝트 주소와 공개 키를 입력하면 구글 로그인이 활성화됩니다.</div>'}${btn('학생 로그인', studentLoginDialog)}${btn('가상 명단으로 먼저 살펴보기', () => {
    store.demo();
    render();
  })}<small>연결 전 체험 자료와 로그인 후 학급 자료는 별도로 관리됩니다.</small></div>`;
}
export function renderShell(renderTab) {
  return `<div class="sticky-navigation">${header()}<nav class="tabs" aria-label="주 메뉴">${['대시보드', '기록', '시간표·일정', '과제', '루틴', '경제', '통계', '수업도구'].map(t => btn(t === '시간표·일정' ? '일정' : t, () => {
    navigate(t);
  }, state.tab === t ? 'active' : '', state.tab === t ? 'aria-current="page"' : '')).join('')}</nav></div><div class="shell">${quickInput()}${store.mode === 'demo' ? '<div class="notice">가상 명단으로 체험 중입니다. 이 모드의 자료는 이 브라우저에만 저장됩니다. 실제 학급은 수파베이스 연결 후 구글 로그인으로 사용하세요.</div>' : ''}${settings().lastBackupAt && Date.now() - new Date(settings().lastBackupAt) > 7 * 86400000 ? '<div class="notice">마지막 백업 후 7일이 지났습니다. 설정에서 백업 파일을 내려받으세요.</div>' : !settings().lastBackupAt ? '<div class="muted" style="margin-bottom:10px">아직 백업하지 않았습니다. 설정에서 전체 자료를 내보낼 수 있습니다.</div>' : ''}<main id="main">${renderTab()}</main></div>`;
}
let quickScope = '',
  quickText = '',
  quickStudentQuery = '',
  quickPeriod = '자동',
  quickDate = '',
  quickAreas = [],
  saving = false;
function quickInput() {
  const scope = `${store.mode}:${store.classId}:${settings().academicYear}:${state.date}`;
  if (scope !== quickScope) {
    quickScope = scope;
    quickText = '';
    quickStudentQuery = '';
    quickPeriod = '자동';
    quickAreas = [];
    quickDate = state.date;
  }
  if (!state.selected.length && !['대시보드', '기록'].includes(state.tab)) return '';
  quickAreas = quickAreas.filter(a => C.areaNames(db()).includes(a));
  return `<div class="quick-wrap quick-composer-card ${state.selected.length ? 'selection-composer' : ''}" ${state.selected.length ? 'role="region" aria-label="선택 학생 기록"' : ''}>${state.selected.length ? `<div class="selection-composer-head">${btn('✕ 선택 취소', () => {
    state.selected = [];
    render();
  }, 'selection-dismiss')}</div>` : ''}<form class="quick" id="quick-form"><div class="quick-main"><div class="quick-entry-fields">${quickStudentsField()}<textarea id="quick-text" rows="1" aria-label="빠른 기록 입력" placeholder="내용">${esc(quickText)}</textarea></div><div class="chips quick-areas" role="group" aria-label="빠른 기록 경험치 영역">${C.areaNames(db()).map(a => btn(esc(a), () => {
    quickAreas = quickAreas.includes(a) ? quickAreas.filter(x => x !== a) : [...quickAreas, a];
    render();
  }, 'area-chip' + (quickAreas.includes(a) ? ' selected' : ''), `aria-pressed="${quickAreas.includes(a)}"`)).join('')}</div></div><div class="quick-controls"><label class="quick-date" title="기록 날짜 선택"><span>📅 ${quickDate === C.today() ? '오늘' : esc(C.formatDate(quickDate))}</span><input type="date" id="quick-date" aria-label="빠른 기록 날짜" value="${esc(quickDate)}" required></label>${btn(quickPeriodLabel(), openQuickPeriod, 'quick-period-toggle', `id="quick-period" value="${esc(quickPeriod)}" aria-haspopup="dialog" aria-label="시간·교시 선택"`)}<div class="record-actions">${recordButtons(saveQuick)}</div></div></form></div>`;
}
export function bindQuickInput() {
  const form = $('#quick-form');
  if (!form) return;
  const targetField = $('#quick-student-query');
  targetField.oninput = () => {
    quickStudentQuery = targetField.value;
    showQuickStudentResults();
  };
  targetField.onkeydown = e => {
    if (e.isComposing || e.keyCode === 229 || !['Enter', ',', ' '].includes(e.key)) return;
    const tokens = targetField.value.trim().split(/[,，\s]+/).filter(Boolean);
    const valid = tokens.length && tokens.every(token => quickStudentCandidates(token, db(), true).length === 1);
    if (e.key === 'Enter' || valid) {
      e.preventDefault();
      try {
        addQuickStudentQuery();
      } catch (error) {
        toast(error.message);
      }
    }
  };
  showQuickStudentResults();
  const field = $('#quick-text');
  const resize = () => {
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
    // A tall mobile draft must scroll with the page instead of covering cards.
    form.closest('.quick-wrap').classList.toggle('quick-expanded', form.closest('.quick-wrap').scrollHeight > window.innerHeight * 0.65);
  };
  field.oninput = () => {
    quickText = field.value;
    $('#quick-cancel').hidden = !state.selected.length && !quickText;
    updateAutoPeriod();
    resize();
  };
  $('#quick-date').onchange = e => {
    if (e.target.value) {
      quickDate = e.target.value;
      render();
    }
  };
  updateAutoPeriod();
  resize();
  form.onsubmit = e => {
    e.preventDefault();
    toast('저장할 기록 종류 버튼을 선택하세요.');
  };
}
export async function saveQuick(kind) {
  if (saving) return;
  const text = $('#quick-text')?.value.trim();
  if (!text) throw Error('내용을 입력하세요.');
  const ids = [...new Set(state.selected)];
  if (!ids.length) throw Error('대상 학생을 선택하세요.');
  const parsed = C.quickRecordContext(db(), text, $('#quick-date')?.value || quickDate || state.date, $('#quick-period').value);
  const recordText = parsed.subjectCode && !text.startsWith('[' + parsed.subjectCode + ']') ? '[' + parsed.subjectCode + '] ' + text : text;
  const scope = quickScope;
  saving = true;
  try {
    await saveDirectRecords(kind, recordText, ids, [...quickAreas], parsed);
    if (scope === quickScope && quickText.trim() === text && JSON.stringify(state.selected) === JSON.stringify(ids)) {
      quickText = '';
      quickStudentQuery = '';
      quickAreas = [];
      state.selected = [];
    }
    render();
  } finally {
    saving = false;
  }
}
function quickPeriodLabel() {
  return '⏰ ' + (quickPeriod === '자동' ? '시간자동' : quickPeriod || '시간 미지정');
}
export function openQuickPeriod() {
  const choose = value => {
    quickPeriod = value;
    const button = $('#quick-period');
    if (button) {
      button.value = value;
      button.textContent = quickPeriodLabel();
    }
    closeModal();
    updateAutoPeriod();
  };
  modal('시간·교시 선택', `<div class="quick-period-options">${[['자동', '시간 자동 (현재 시간 자동 매칭)'], ['', '시간 미지정']].map(([value, label]) => btn(label, () => choose(value), 'period-card' + (quickPeriod === value ? ' selected' : ''), `data-period-value="${value}" aria-pressed="${quickPeriod === value}"`)).join('')}</div><div class="quick-period-card-grid">${C.quickPeriodChoices(settings()).map(value => btn(value, () => choose(value), 'period-card' + (quickPeriod === value ? ' selected' : ''), `data-period-value="${value}" aria-pressed="${quickPeriod === value}"`)).join('')}</div>`);
}
function updateAutoPeriod() {
  const button = $('#quick-period');
  if (button && db()) {
    const inferred = C.inputPeriod(quickText, settings());
    button.title = quickPeriod === '자동' ? '시간자동' + (inferred ? ' · ' + inferred : '') : quickPeriod ? '직접 선택 · ' + quickPeriod : '시간 미지정';
  }
}
setInterval(updateAutoPeriod, 60000);
export function quickStudentCandidates(query, source = db(), exact = false) {
  const tokens = query.trim().split(/[,，\s]+/).filter(Boolean),
    students = C.activeStudents(source),
    found = new Map();
  for (const value of tokens) {
    const number = value.match(/^(\d+)(?:번)?$/);
    for (const student of students) {
      const match = number ? exact || tokens.length > 1 || value.endsWith('번') ? student.no === Number(number[1]) : String(student.no).startsWith(number[1]) : exact ? student.name === value || student.name.length === 3 && student.name.slice(1) === value : student.name.includes(value);
      if (match) found.set(student.id, student);
    }
  }
  return [...found.values()];
}
function quickStudentsField() {
  return `<div id="quick-students"><div class="chips selected-students" aria-label="선택 학생">${state.selected.map(id => btn(esc(name(id)) + ' ×', () => {
    state.selected = state.selected.filter(value => value !== id);
    render();
  }, 'quick-student-chip', `aria-label="${esc(name(id))} 선택 해제"`)).join('')}</div><div class="quick-student-search"><input id="quick-student-query" aria-label="대상 학생 번호 또는 이름" autocomplete="off" placeholder="번호나 이름 입력, 선택 가능, 여러 명 가능" value="${esc(quickStudentQuery)}" aria-controls="quick-student-results">${btn('학생추가', addQuickStudentQuery)}${btn('입력취소', resetQuickDraft, 'quick-cancel', `id="quick-cancel" ${!state.selected.length && !quickText ? 'hidden' : ''}`)}</div><div id="quick-student-results" class="quick-student-results" aria-label="학생 검색 결과"></div></div>`;
}
function addQuickStudent(id) {
  if (!C.activeStudents(db()).some(student => student.id === id)) throw Error('학생을 확인하세요.');
  if (!state.selected.includes(id)) state.selected = [...state.selected, id];
  quickStudentQuery = '';
  render();
  $('#quick-student-query')?.focus();
}
export function addQuickStudentQuery() {
  const query = $('#quick-student-query')?.value || quickStudentQuery;
  const tokens = query.trim().split(/[,，\s]+/).filter(Boolean);
  if (!tokens.length) throw Error('학생 번호 또는 이름을 입력하세요.');
  const ids = tokens.map(token => {
    const matches = quickStudentCandidates(token, db(), true);
    if (matches.length !== 1) throw Error(matches.length ? '같은 이름이나 번호가 있습니다. 검색 결과에서 학생을 선택하세요.' : '학생 번호 또는 이름을 확인하세요.');
    return matches[0].id;
  });
  state.selected = [...new Set([...state.selected, ...ids])];
  quickStudentQuery = '';
  render();
  $('#quick-student-query')?.focus();
}
function showQuickStudentResults() {
  const results = $('#quick-student-results');
  if (!results) return;
  results.innerHTML = quickStudentCandidates(quickStudentQuery).slice(0, 12).map(student => btn(esc(student.no + '. ' + student.name) + (state.selected.includes(student.id) ? ' · 선택됨' : ''), () => addQuickStudent(student.id), 'quick-student-result')).join('');
}
function resetQuickDraft() {
  state.selected = [];
  quickText = '';
  quickStudentQuery = '';
  quickAreas = [];
  render();
}
