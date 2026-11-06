import { bindQuickInput, renderLogin, renderShell } from './components/header.js';
import { db } from './shared/data.js';
import { installGlobalEvents } from './shared/events.js';
import { state, store } from './shared/state.js';
import { $, toast } from './shared/ui.js';
import { assignmentsView } from './tabs/assignments.js';
import { dashboard } from './tabs/dashboard.js';
import { recordsView } from './tabs/records.js';
import { routinesView } from './tabs/routines.js';
import { seatsView } from './tabs/seats.js';
import { settingsView } from './tabs/settings.js';
import { studentsView } from './tabs/students.js';
import { bindTimetableDrag, calendarView } from './tabs/timetable.js';
export function render() {
  if (state.locked) return;
  document.querySelector('.print-root')?.remove();
  document.body.classList.remove('report-open');
  if (!db()) {
    renderLogin();
    return;
  }
  $('#app').innerHTML = renderShell(renderTab);
  bindQuickInput();
  bindTimetableDrag();
}
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
boot();
function renderTab() {
  return {
    '대시보드': dashboard,
    '기록': recordsView,
    '시간표·일정': calendarView,
    '과제': assignmentsView,
    '루틴': routinesView,
    '학생': studentsView,
    '자리': seatsView,
    '설정': settingsView
  }[state.tab]();
}
