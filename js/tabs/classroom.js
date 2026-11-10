import { render } from '../app.js';
import { closeModal } from '../components/modal.js';
import * as C from '../core.js';
import { db, settings, students } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, badge, esc, hashPin, run, toast } from '../shared/ui.js';
import { announcementView } from './dashboard.js';
import { openToolsOverlay, syncToolsVisibility } from './tools.js';
import { timeSlots } from './timetable.js';
export function displayName(s) {
  if (settings().nameDisplayMode === 'real') return `${s.no}. ${s.name}`;
  if (settings().nameDisplayMode === 'alias') return s.alias || `별${s.no}`;
  if (settings().nameDisplayMode === 'masked') {
    const n = s.name;
    return s.no + '. ' + (n.length <= 2 ? n[0] + '●' : n[0] + '●'.repeat(n.length - 2) + n.at(-1));
  }
  return String(s.no) + '번';
}
let classroomInteractionCleanup;
const dismissedCountdowns = new Set();
export function classroom() {
  classroomInteractionCleanup?.();
  document.title = '교실 화면 · 오늘의 별';
  classroomResizeObserver?.disconnect();
  document.querySelector('.print-root')?.remove();
  document.body.classList.remove('report-open');
  closeModal();
  if ($('#toast')) $('#toast').style.display = 'none';
  state.selected = [];
  state.actions?.clear();
  state.locked = true;
  syncToolsVisibility();
  const d = C.today();
  $('#app').innerHTML = `<div class="lockscreen"><div class="classroom-top"><div class="classroom-heading"><div class="classroom-brand"><h1>오늘의 별</h1><small>${esc(settings().className)}</small></div><div class="classroom-datetime"><time>${esc(C.formatDate(d))}</time><div id="class-clock" class="clock"></div></div></div>${announcementView()}<section class="panel classroom-schedule"><div class="row">${C.calendarEvents(db()).filter(e => e.date === d && C.eventTimePeriod(e) == null || e.isDday && e.date !== d).map(e => `<div class="classroom-event">${badge(e.title + (e.isDday ? ' ' + C.dday(e.date, d) : ''))}${e.description ? `<small class="event-description">${esc(e.description)}</small>` : ''}</div>`).join('')}</div><div class="schedule registered-schedule">${timeSlots(d, false, true, 'classroom')}</div></section></div><div class="students classroom-students">${students().map(student => classroomStudent(student, d)).join('')}</div><button type="button" id="class-tools" class="class-tools">🧰 수업도구</button><button type="button" class="lock-exit" id="lock-exit" aria-label="교사 화면 잠금 해제" title="길게 누르기 또는 두 번 탭하여 해제">🔒<span class="lock-hint" style="font-size:12px; margin-left:4px; font-weight:500;">길게 눌러 해제</span></button></div>`;
  $('#class-tools').onclick = openToolsOverlay;
  fitClassroom();
  classroomResizeObserver = new ResizeObserver(() => requestAnimationFrame(fitClassroom));
  classroomResizeObserver.observe(document.querySelector('.classroom-top'));
  classroomResizeObserver.observe(document.querySelector('.lockscreen'));
  document.fonts?.ready.then(() => {
    if (state.locked) fitClassroom();
  });
  const tick = () => {
    if (C.today() !== d) {
      classroom();
      return;
    }
    if ($('#class-clock')) $('#class-clock').textContent = new Date().toLocaleTimeString('ko-KR', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Seoul'
    });
    updateClassroomCountdown();
  };
  tick();
  clearInterval(state.clockTimer);
  state.clockTimer = setInterval(tick, 1000);
  let touchInteraction = false,
    hold,
    lastTouch = 0;
  classroomInteractionCleanup = () => clearTimeout(hold);
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
    classroomResizeObserver?.disconnect();
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
function updateClassroomCountdown() {
  const next = C.classroomCountdown(db(), settings());
  let overlay = document.querySelector('.fullscreen-countdown-overlay');
  if (!next || dismissedCountdowns.has(next.key)) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'fullscreen-countdown-overlay';
    overlay.setAttribute('aria-label', '수업 시작 알림 닫기');
    overlay.onclick = event => {
      event.stopPropagation();
      dismissedCountdowns.add(overlay.dataset.key);
      overlay.remove();
    };
    document.querySelector('.lockscreen')?.append(overlay);
  }
  overlay.dataset.key = next.key;
  const clock = new Date().toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/(\d+):(\d+):(\d+)/, '$1시 $2분 $3초');
  const remaining = next.remaining >= 60 ? `${Math.floor(next.remaining / 60)}분 ${next.remaining % 60}초 남음` : `${next.remaining}초 남음`;
  overlay.innerHTML = `<time class="countdown-clock">${esc(clock)}</time><strong class="countdown-remaining">${remaining}</strong><div class="countdown-lesson">[${next.period}교시] ${esc(next.subject)}${next.location ? ' (' + esc(next.location) + ')' : ''}</div>${next.memo ? `<p class="countdown-memo">${esc(next.memo)}</p>` : ''}<small>화면을 누르면 알림이 닫힙니다.</small>`;
}
function classroomStudent(student, date) {
  const excluded = C.excluded(db(), student.id, date),
    tasks = excluded ? [] : C.pending(db(), student.id, date),
    routines = excluded ? [] : C.pendingRoutines(db(), student.id, date);
  const pending = tasks.length + routines.length > 0;
  return `<article class="student classroom-student ${pending ? 'unfinished has-pending' : ''} ${excluded ? 'excluded' : ''}" aria-label="${esc(displayName(student))}"><div class="classroom-student-top"><div class="student-head"><strong class="classroom-student-name">${settings().nameDisplayMode === 'real' ? `<span class="classroom-label-number">${esc(student.no)}.</span> <span class="classroom-label-name">${esc(student.name)}</span>` : esc(displayName(student))}</strong></div>${settings().classroomShowScores ? `<div class="score classroom-score"><span class="score-star" aria-hidden="true">★</span><strong class="score-total">${C.cumulativeScores(db(), student.id, date).total}</strong></div>` : ''}</div><div class="pending-tasks">${tasks.map(({
    assignment: a,
    date: d
  }) => `<span class="task ${d < date ? 'overdue' : ''}" title="${esc(a.title)}">${esc(a.title)}</span>`).join('')}</div>${routines.length ? `<div class="routine-indicator"><div class="routine-names">${routines.map(r => `<span class="routine-task" title="${esc(r.title)}">${esc(r.title)}</span>`).join('')}</div></div>` : ''}${excluded ? '<small class="classroom-complete">제외</small>' : !pending ? '<small class="classroom-complete">오늘 할 일 완료</small>' : ''}</article>`;
}
let classroomResizeObserver = null;
function fitClassroom() {
  const grid = document.querySelector('.classroom-students');
  if (!state.locked || !grid) return;
  const count = grid.children.length,
    mobile = window.matchMedia('(max-width:768px)').matches,
    portrait = mobile && window.matchMedia('(orientation:portrait)').matches,
    lowHeight = window.matchMedia('(max-height:480px)').matches,
    readable = portrait || lowHeight;
  grid.classList.toggle('classroom-readable', readable);
  let columns = portrait ? 3 : lowHeight ? Math.max(1, Math.min(count || 1, Math.floor((grid.clientWidth + 5) / 135))) : mobile ? 5 : 1;
  if (!mobile && !lowHeight) {
    let best = Infinity;
    const neededHeight = Math.min(220, Math.max(100, ...[...grid.children].map(card => {
      const c = getComputedStyle(card);
      return parseFloat(c.paddingTop) + parseFloat(c.paddingBottom) + [...card.children].reduce((height, child) => {
        const style = getComputedStyle(child);
        return height + child.scrollHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      }, 0);
    })));
    for (let cols = 1; cols <= Math.max(count, 1); cols++) {
      const rows = Math.ceil(Math.max(count, 1) / cols),
        width = (grid.clientWidth - 8 * (cols - 1)) / cols,
        height = (grid.clientHeight - 8 * (rows - 1)) / rows;
      if (width < 105 && cols > 1) continue;
      const penalty = Math.abs(Math.log(Math.max(width, 1) / Math.max(height, 1) / 1.5)) + (cols * rows - count) / Math.max(count, 1) * .3 + Math.max(0, (neededHeight - height) / neededHeight) * 5;
      if (penalty < best) {
        best = penalty;
        columns = cols;
      }
    }
  }
  const rows = Math.max(1, Math.ceil(count / columns));
  grid.style.setProperty('--classroom-cols', columns);
  grid.style.setProperty('--classroom-rows', rows);
  grid.classList.toggle('classroom-dense', grid.clientHeight / rows < 160);
  if (readable) {
    // Measure natural content after setting the columns, so long pills wrap
    // instead of inheriting the previous orientation's narrow dimensions.
    const heights = Array.from({
      length: rows
    }, () => 0);
    [...grid.children].forEach((card, index) => {
      const style = getComputedStyle(card);
      const height = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + [...card.children].reduce((total, child) => {
        const childStyle = getComputedStyle(child);
        return total + child.scrollHeight + (parseFloat(childStyle.marginTop) || 0) + (parseFloat(childStyle.marginBottom) || 0);
      }, 0) + Math.max(0, card.children.length - 1) * (parseFloat(style.rowGap) || 0) + 2;
      const row = Math.floor(index / columns);
      heights[row] = Math.max(heights[row], Math.ceil(height));
    });
    const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
    const extra = Math.max(0, (grid.clientHeight - gap * (rows - 1) - heights.reduce((a, b) => a + b, 0)) / rows);
    grid.style.setProperty('--classroom-row-sizes', heights.map(height => height + extra + 'px').join(' '));
  } else grid.style.removeProperty('--classroom-row-sizes');
}
window.addEventListener('resize', () => {
  if (state.locked) requestAnimationFrame(fitClassroom);
});
