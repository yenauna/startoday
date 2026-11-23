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
import { assignmentsView } from './tabs/assignments.js';
import { dashboard } from './tabs/dashboard.js';
import { recordsView } from './tabs/records.js';
import { routinesView } from './tabs/routines.js';
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
const teacherTabs = ['대시보드', '기록', '사건', '시간표·일정', '과제', '루틴', '경제', '통계', '수업도구', '자리', '설정'];
export function navigate(tab) {
  state.tab = tab === '학생' ? '통계' : tab;
  if (!teacherTabs.includes(state.tab)) state.tab = '대시보드';
  history.pushState(null, '', '#' + encodeURIComponent(state.tab === '시간표·일정' ? '일정' : state.tab));
  render();
}
function readTabHash() {
  let tab;
  try {
    tab = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  if (tab === '학생') tab = '통계';
  if (tab === '일정') tab = '시간표·일정';
  if (teacherTabs.includes(tab)) {
    state.tab = tab;
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
  return {
    '대시보드': dashboard,
    '기록': recordsView,
    '사건': incidentsView,
    '시간표·일정': calendarView,
    '과제': assignmentsView,
    '루틴': routinesView,
    '통계': studentsView,
    '경제': economyView,
    '수업도구': toolsView,
    '자리': seatsView,
    '설정': settingsView
  }[state.tab]();
}
