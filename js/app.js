import {incidentsView} from './tabs/incidents.js';
import {syncViewportPreview} from './components/viewport-preview.js';
import {dismissDateRange} from './components/date-range.js';
import { captureSelectionMotion, animateSelectionMotion, clearSelectionMotion } from './shared/selection-motion.js';
import { clearTitleUnlock, syncTitleUnlock } from './components/title-unlock.js';
import { economyView, syncGroupBuyDialog } from './tabs/economy.js';
import { setupPwa } from './shared/pwa.js';
import { initNebulaParallax } from './shared/nebula-parallax.js';
import { bindQuickInput, renderLogin, renderShell, stopMobileRecordBar } from './components/header.js';
import { db } from './shared/data.js';
import { installGlobalEvents } from './shared/events.js';
import { state, store } from './shared/state.js';
import { classroomLocked } from './shared/classroom-lock.js';
import { $, toast } from './shared/ui.js';
import { dashboard } from './tabs/dashboard.js';
import { recordsView } from './tabs/records.js';
import { seatsView } from './tabs/seats.js';
import { settingsView, refreshRosterNicknames } from './tabs/settings.js';
import { studentsView } from './tabs/students.js';
import { bindTimetableDrag, calendarView } from './tabs/timetable.js';
import { classroom } from './tabs/classroom.js';
import { toolsView, syncToolsVisibility } from './tabs/tools.js';
import { renderStudentShell, studentSnapshot, studentViewScrollKey } from './tabs/student-view.js';
if (window.top !== window.self) {
  document.documentElement.innerHTML = '';
  location.replace('about:blank');
}
// 일정·과제·루틴은 하나의 '일정' 탭으로 합쳤다. 옛 주소(#시간표·일정, #과제, #루틴)는 같은 탭으로 이어진다.
const teacherTabs = ['대시보드', '기록', '사건', '일정', '경제', '통계', '수업도구', '자리', '설정'];
const legacyTabAliases = {
  '시간표·일정': '일정',
  '과제': '일정',
  '루틴': '일정'
};
export function navigate(tab) {
  if (tab === '학생') tab = '통계';
  const manage = tab === '과제' || tab === '루틴' ? tab : '';
  const resolved = legacyTabAliases[tab] || tab;
  state.tab = teacherTabs.includes(resolved) ? resolved : '대시보드';
  state.scheduleManage = state.tab === '일정' ? manage : '';
  history.pushState(null, '', '#' + encodeURIComponent(manage || state.tab));
  render();
}
// The 전체 관리 panel lives inside the 일정 tab; opening it keeps the tab address in place.
export function setScheduleManage(manage = '') {
  state.scheduleManage = manage === '과제' || manage === '루틴' ? manage : '';
  state.tab = '일정';
  history.replaceState(null, '', '#' + encodeURIComponent(state.scheduleManage || '일정'));
  render();
  if (state.scheduleManage) requestAnimationFrame?.(() => document.getElementById?.('schedule-manage')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}
function readTabHash() {
  let tab;
  try {
    tab = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  if (tab === '학생') tab = '통계';
  const manage = tab === '과제' || tab === '루틴' ? tab : '';
  const resolved = legacyTabAliases[tab] || tab;
  if (teacherTabs.includes(resolved)) {
    state.tab = resolved;
    if (resolved === '일정') state.scheduleManage = manage;
    if (tab === '통계') history.replaceState(null, '', '#' + encodeURIComponent('통계'));
  }
}
window.addEventListener('hashchange', () => {
  readTabHash();
  render();
});
readTabHash();
let lastStudentScrollKey = null;
export function render() {
  stopMobileRecordBar();
  syncViewportPreview(!!db()&&!(state.studentPasswordPending||state.viewMode==='student'||state.studentUser||state.impersonatingStudentId));
  dismissDateRange();
  syncToolsVisibility();
  // 잠금이 걸린 화면은 새로고침 뒤에도 풀리지 않는다.
  if (state.locked) {clearSelectionMotion();return;}
  if (state.studentPasswordPending || state.viewMode === 'student' || state.studentUser || state.impersonatingStudentId) {
    clearSelectionMotion();
    document.title = '학생 화면 · 오늘의 별';
    state.actions.clear();
    document.querySelector('.print-root')?.remove();
    document.body.classList.remove('report-open');
    const scrollY = window.scrollY;
    $('#app').innerHTML = renderStudentShell();
    syncGroupBuyDialog();
    const titleSnapshot = state.studentSnapshot;
    if (titleSnapshot?.student && !state.impersonatingStudentId) {
      syncTitleUnlock(titleSnapshot, `${store.mode}:${store.classId}:${titleSnapshot.student.id}`);
    } else clearTitleUnlock();
    const key = studentViewScrollKey();
    window.scrollTo?.(0, key === lastStudentScrollKey ? scrollY : 0);
    lastStudentScrollKey = key;
    return;
  }
  lastStudentScrollKey = null;
  clearTitleUnlock();
  document.querySelector('.print-root')?.remove();
  document.body.classList.remove('report-open');
  if (!db()) {
    clearSelectionMotion();
    document.title = '오늘의 별';
    renderLogin();
    return;
  }
  if (classroomLocked()) {
    classroom();
    return;
  }
  document.title = state.tab === '통계' ? '통계 · 오늘의 별' : '오늘의 별';
  // 합치기 전 탭 이름으로 상태를 잡은 화면이나 저장된 상태도 같은 일정 화면으로 이어진다.
  if (state.tab === '시간표·일정' || state.tab === '과제' || state.tab === '루틴') {
    state.scheduleManage = state.tab === '과제' || state.tab === '루틴' ? state.tab : state.scheduleManage || '';
    state.tab = '일정';
  }
  const selectionBefore = captureSelectionMotion();
  $('#app').innerHTML = renderShell(renderTab);
  bindQuickInput();
  animateSelectionMotion(selectionBefore);
  bindTimetableDrag();
  syncGroupBuyDialog();
}
window.addEventListener('startoday-sync', () => {
  if (state.locked) {
    const top = document.querySelector('.lockscreen')?.scrollTop || 0,
      roster = document.querySelector('.classroom-students')?.scrollTop || 0;
    classroom();
    requestAnimationFrame(() => {
      const screen = document.querySelector('.lockscreen'),
        grid = document.querySelector('.classroom-students');
      if (screen) screen.scrollTop = top;
      if (grid) grid.scrollTop = roster;
    });
    return;
  }
  if (state.studentUser && !state.impersonatingStudentId && ['demo', 'local'].includes(store.mode)) {
    const student = db()?.students.find(s => s.id === state.studentUser.id && !s.deletedAt);
    if (!student) return;
    state.studentSnapshot = studentSnapshot(db(), student);
    state.studentUser = state.studentSnapshot.student;
  }
  if (state.tab === '설정' && refreshRosterNicknames()) return;
  render();
});
window.addEventListener('startoday-auth', () => {
  state.selected = [];
  render();
});
window.addEventListener('startoday-error', e => toast(e.detail));
window.addEventListener('online', () => toast('네트워크가 연결되었습니다. 새로고침으로 최신 자료를 확인하세요.'));
window.addEventListener('offline', () => toast('네트워크 연결이 끊겼습니다. 클라우드 저장은 연결 후 다시 시도하세요.'));
export async function boot() {
  $('#app').innerHTML = '<div class="login"><h1>오늘의 별</h1><p>학급을 준비하고 있습니다…</p></div>';
  try {
    await store.connect();
    render();
  } catch (e) {
    if (!store.db?.settings?.length) store.db = null;
    render();
    toast(e.message + ' · SQL 적용 및 config.js 설정을 확인하세요.');
  }
}
installGlobalEvents();
initNebulaParallax();
setupPwa();
boot();
function renderTab() {
  return ({
    '대시보드': dashboard,
    '기록': recordsView,
    '사건': incidentsView,
    '일정': calendarView,
    '통계': studentsView,
    '경제': economyView,
    '수업도구': toolsView,
    '자리': seatsView,
    '설정': settingsView
  }[state.tab] || dashboard)();
}
