import { render } from '../app.js';
import { closeModal } from '../components/modal.js';
import * as C from '../core.js';
import { db, settings, students } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, badge, esc, hashPin, run, toast } from '../shared/ui.js';
import { announcementView, isUnfinished } from './dashboard.js';
import { timeSlots } from './timetable.js';
export function displayName(s) {
  if (settings().nameDisplayMode === 'real') return s.name;
  if (settings().nameDisplayMode === 'alias') return s.alias || `별${s.no}`;
  if (settings().nameDisplayMode === 'masked') {
    const n = s.name;
    return s.no + '. ' + (n.length <= 2 ? n[0] + '●' : n[0] + '●'.repeat(n.length - 2) + n.at(-1));
  }
  return String(s.no) + '번';
}
export function classroom() {
  document.querySelector('.print-root')?.remove();
  document.body.classList.remove('report-open');
  if ($('#modal').open) closeModal();
  state.selected = [];
  state.locked = true;
  const d = C.today();
  $('#app').innerHTML = `<div class="lockscreen"><div class="classroom-heading"><div class="classroom-brand"><h1>오늘의 별</h1><small>${esc(settings().className)}</small></div><div class="classroom-datetime"><time>${esc(C.formatDate(d))}</time><div id="class-clock" class="clock"></div></div></div>${announcementView()}<section class="panel"><div class="row">${C.calendarEvents(db()).filter(e => e.date === d || e.isDday).map(e => `<div class="classroom-event">${badge(e.title + (e.isDday ? ' ' + C.dday(e.date, d) : ''))}${e.description ? `<small class="event-description">${esc(e.description)}</small>` : ''}</div>`).join('') || ''}</div><div class="schedule registered-schedule" style="margin-top:14px">${timeSlots(d, false, true)}</div></section><div class="students">${students().map(s => `<div class="student ${isUnfinished(s.id, d) ? 'unfinished' : ''}"><strong>${esc(displayName(s))}</strong>${settings().classroomShowScores ? `<span class="classroom-score">★ ${C.cumulativeScores(db(), s.id, d).total}</span>` : ''}<small>${C.excluded(db(), s.id, d) ? '제외' : classroomPending(s.id, d)}</small></div>`).join('')}</div><button type="button" class="lock-exit" id="lock-exit" aria-label="교사 화면 잠금 해제" title="길게 누르기 또는 두 번 탭하여 해제">🔒</button></div>`;
  const tick = () => {
    if (C.today() !== d) {
      classroom();
      return;
    }
    if ($('#class-clock')) $('#class-clock').textContent = new Date().toLocaleTimeString('ko-KR', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Seoul'
    });
  };
  tick();
  clearInterval(state.clockTimer);
  state.clockTimer = setInterval(tick, 1000);
  let touchInteraction = false,
    hold,
    lastTouch = 0;
  const exit = $('#lock-exit');
  const unlock = async () => {
    if (settings().classroomPinHash) {
      const pin = prompt('교실 화면 해제 비밀번호');
      if (pin === null || (await hashPin(pin)) !== settings().classroomPinHash) {
        toast('비밀번호를 확인하세요.');
        return;
      }
    }
    clearInterval(state.clockTimer);
    if (touchInteraction) {
      // Swallow the synthetic click after a touch release so it cannot hit the
      // newly revealed top-right logout button underneath the unlock icon.
      const swallow = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 500);
    }
    state.locked = false;
    render();
  };
  exit.onpointerdown = e => {
    touchInteraction = e.pointerType === 'touch';
    e.preventDefault();
    hold = setTimeout(() => run(unlock), 1400);
  };
  exit.onpointerup = e => {
    e.preventDefault();
    clearTimeout(hold);
    if (e.pointerType === 'touch') {
      const now = Date.now();
      if (lastTouch && now - lastTouch < 350) {
        lastTouch = 0;
        run(unlock);
      } else lastTouch = now;
    }
  };
  exit.onpointercancel = () => clearTimeout(hold);
  exit.onpointerleave = () => clearTimeout(hold);
  exit.ondblclick = () => run(unlock);
  exit.onkeydown = e => {
    if (e.ctrlKey && e.key === 'Enter') run(unlock);
  };
}
function classroomPending(studentId, date) {
  const tasks = C.pending(db(), studentId, date).map(({
      assignment: a
    }) => a.title),
    routines = C.pendingRoutines(db(), studentId, date).map(r => r.title);
  const titles = [...tasks, ...routines];
  return titles.length ? `<span class="classroom-pending">${titles.map(title => `<span class="badge">${esc(title)}</span>`).join('')}</span>` : '오늘 할 일 완료';
}
