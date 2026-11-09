import { render } from '../app.js';
import * as C from '../core.js';
import { db, name, settings } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, btn, esc, opts, toast } from '../shared/ui.js';
import { classroom } from '../tabs/classroom.js';
import { recordButtons, saveDirectRecords } from '../tabs/dashboard.js';
import { studentLoginDialog } from '../tabs/student-view.js';
export function header() {
  return `<header class="top">${btn('<img src="assets/logo-icon.jpg" class="logo" data-logo-slot alt="로고" style="object-fit:cover;border-radius:8px"><strong>오늘의 별</strong><small>' + esc(settings().className) + '</small>', () => {
    state.tab = '대시보드';
    state.dashMode = 'normal';
    render();
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
  state.tab = tab;
  render();
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
  return `<div class="sticky-navigation">${header()}<nav class="tabs" aria-label="주 메뉴">${['대시보드', '기록', '시간표·일정', '과제', '루틴', '학생'].map(t => btn(t === '시간표·일정' ? '일정' : t, () => {
    state.tab = t;
    render();
  }, state.tab === t ? 'active' : '', state.tab === t ? 'aria-current="page"' : '')).join('')}</nav></div><div class="shell">${quickInput()}${store.mode === 'demo' ? '<div class="notice">가상 명단으로 체험 중입니다. 이 모드의 자료는 이 브라우저에만 저장됩니다. 실제 학급은 수파베이스 연결 후 구글 로그인으로 사용하세요.</div>' : ''}${settings().lastBackupAt && Date.now() - new Date(settings().lastBackupAt) > 7 * 86400000 ? '<div class="notice">마지막 백업 후 7일이 지났습니다. 설정에서 백업 파일을 내려받으세요.</div>' : !settings().lastBackupAt ? '<div class="muted" style="margin-bottom:10px">아직 백업하지 않았습니다. 설정에서 전체 자료를 내보낼 수 있습니다.</div>' : ''}<main id="main">${renderTab()}</main></div>`;
}
let quickScope = '',
  quickText = '',
  quickPeriod = '자동',
  quickDate = '',
  quickAreas = [],
  saving = false;
function quickInput() {
  const scope = `${store.mode}:${store.classId}:${settings().academicYear}:${state.date}`;
  if (scope !== quickScope) {
    quickScope = scope;
    quickText = '';
    quickPeriod = '자동';
    quickAreas = [];
    quickDate = state.date;
  }
  if (!state.selected.length && !['대시보드', '기록'].includes(state.tab)) return '';
  quickAreas = quickAreas.filter(a => C.areaNames(db()).includes(a));
  return `<div class="quick-wrap quick-composer-card ${state.selected.length ? 'selection-composer' : ''}" ${state.selected.length ? 'role="region" aria-label="선택 학생 기록"' : ''}>${state.selected.length ? `<div class="selection-composer-head">${btn('✕ 선택 취소', () => {
    state.selected = [];
    render();
  }, 'selection-dismiss')}<div class="chips selected-students" aria-label="선택 학생">${state.selected.map(id => btn(esc(name(id)) + ' ×', () => {
    state.selected = state.selected.filter(x => x !== id);
    render();
  })).join('')}</div></div>` : ''}<form class="quick" id="quick-form"><div class="quick-main"><textarea id="quick-text" rows="1" aria-label="빠른 기록 입력" placeholder="예: 3번 2교시 친구를 도와줌">${esc(quickText)}</textarea><div class="chips quick-areas" role="group" aria-label="빠른 기록 경험치 영역">${C.areaNames(db()).map(a => btn(esc(a), () => {
    quickAreas = quickAreas.includes(a) ? quickAreas.filter(x => x !== a) : [...quickAreas, a];
    render();
  }, 'area-chip' + (quickAreas.includes(a) ? ' selected' : ''), `aria-pressed="${quickAreas.includes(a)}"`)).join('')}</div></div><div class="quick-controls"><label class="quick-date" title="기록 날짜 선택"><span>📅 ${quickDate === C.today() ? '오늘' : esc(C.formatDate(quickDate))}</span><input type="date" id="quick-date" aria-label="빠른 기록 날짜" value="${esc(quickDate)}" required></label><select id="quick-period" aria-label="교시">${opts([['자동', autoPeriodLabel()], ['', '시간 미지정'], ...C.PERIODS], quickPeriod)}</select><div class="record-actions">${recordButtons(saveQuick)}</div></div></form></div>`;
}
export function bindQuickInput() {
  const form = $('#quick-form');
  if (!form) return;
  const field = $('#quick-text'),
    period = $('#quick-period');
  const resize = () => {
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
    // A tall mobile draft must scroll with the page instead of covering cards.
    form.closest('.quick-wrap').classList.toggle('quick-expanded', form.closest('.quick-wrap').scrollHeight > window.innerHeight * 0.65);
  };
  field.oninput = () => {
    quickText = field.value;
    updateAutoPeriod();
    resize();
  };
  period.onchange = () => {
    quickPeriod = period.value;
    updateAutoPeriod();
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
  const parsed = C.parseInput(text, db(), state.selected);
  if (parsed.warnings.length) throw Error(parsed.warnings.join(' '));
  parsed.date = $('#quick-date')?.value || quickDate || state.date;
  const period = $('#quick-period').value;
  if (period !== '자동') parsed.period = period;
  delete parsed.warnings;
  const scope = quickScope;
  saving = true;
  try {
    await saveDirectRecords(kind, parsed.text, parsed.studentIds, [...quickAreas], parsed);
    if (scope === quickScope && quickText.trim() === text) {
      quickText = '';
      quickAreas = [];
      state.selected = [];
    }
    render();
  } finally {
    saving = false;
  }
}
function autoPeriodLabel() {
  return '시간자동';
}
function updateAutoPeriod() {
  const option = $('#quick-period option[value="자동"]');
  if (option && db()) {
    option.textContent = autoPeriodLabel();
    const inferred = C.inputPeriod(quickText, settings());
    $('#quick-period').title = quickPeriod === '자동' ? '시간자동' + (inferred ? ' · ' + inferred : '') : quickPeriod ? '직접 선택 · ' + quickPeriod : '시간 미지정';
  }
}
setInterval(updateAutoPeriod, 60000);
