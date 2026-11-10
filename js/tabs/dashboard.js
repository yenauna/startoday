import { render } from '../app.js';
import * as C from '../core.js';
import { commit, db, settings, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, badge, bindLater, btn, empty, esc, toast, input, select, textarea, multiple, run } from '../shared/ui.js';
import { modal, closeModal } from '../components/modal.js';
import { taskStateEditor } from './assignments.js';
import { newRecord } from './records.js';
import { setRoutine } from './routines.js';
import { studentDetail } from './students.js';
import { dayEditor, periodInfo, timeSlots } from './timetable.js';
export function weekSummary() {
  const start = C.addDays(state.date, -((C.weekday(state.date) + 6) % 7)),
    end = C.addDays(start, 4);
  return [...C.calendarEvents(db()).filter(e => e.date >= start && e.date <= end).map(e => `${e.title}${e.description ? ' · ' + e.description : ''}`), ...db().timetables.filter(t => t.date >= start && t.date <= end && periodInfo(t).type !== '일반').map(t => `${t.period}교시 ${t.subjectCode} ${periodInfo(t).type}`)].join(' · ') || '';
}
export function dashboard() {
  if (state.dashMode !== 'normal') return checkView();
  const list = students();
  const completed = list.filter(s => !isUnfinished(s.id, state.date) && !C.excluded(db(), s.id, state.date)).length;
  return `<div class="toolbar"><div><h2>${esc(settings().className)}의 하루</h2><small>${esc(C.formatDate(state.date))} · 작은 기록이 모여 성장이 됩니다.</small></div><div class="row"><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(state.date)) || '날짜 선택'}</span><input aria-label="대시보드 날짜" type="date" value="${state.date}" id="dash-date"></span>${btn('오늘', () => {
    state.date = C.today();
    render();
  })}${btn(state.compact ? '자세히' : '컴팩트', () => {
    state.compact = !state.compact;
    render();
  })}${btn('체크', () => {
    state.dashMode = 'check';
    enterChecklist();
    render();
  })}${btn('출결', () => {
    state.dashMode = 'attendance';
    render();
  })}</div></div>${announcementEditor()}<section class="panel"><div class="row between"><div class="row"><strong>오늘 일정</strong>${C.calendarEvents(db()).filter(e => e.date === state.date && (e.period == null || e.period === 0 || e.period === 7)).map(e => btn(esc(e.title) + (e.description ? `<small class="event-description">${esc(e.description)}</small>` : ''), () => dayEditor(state.date, '일정', null, e), 'event')).join('') || ''}${C.calendarEvents(db()).filter(e => e.isDday).sort((a, b) => a.date.localeCompare(b.date)).map(e => badge(e.title + ' ' + C.dday(e.date, state.date))).join('')}</div>${btn('+ 일정', () => dayEditor(state.date))}</div><div class="schedule registered-schedule" style="margin-top:12px">${timeSlots(state.date, false, true)}</div>${weekSummary() ? `<div class="ticker">${esc(weekSummary())}</div>` : ''}</section><div class="summary"><div class="metric"><small>오늘 함께하는 학생</small><strong>${list.filter(s => !C.excluded(db(), s.id, state.date)).length}<small> / ${list.length}명</small></strong></div><div class="metric"><small>할 일을 모두 마친 학생</small><strong>${completed}<small>명</small></strong></div><div class="metric"><small>오늘 남긴 기록</small><strong>${db().records.filter(r => r.date === state.date).length}<small>건</small></strong></div></div><div class="toolbar"><strong>우리 반 학생 <span class="muted">${list.length}명</span></strong><div class="row">${btn('🔀 ' + (dashboardOrder() === 'number' ? '번호순' : '자리대로'), () => setDashboardOrder(dashboardOrder() === 'number' ? 'seats' : 'number'))}</div></div><section class="${state.compact ? 'compact' : ''}">${dashboardStudents(list)}</section>${!list.length ? empty('아직 등록된 학생이 없습니다.', '설정에서 명단을 붙여 넣거나 학생을 추가하세요.') : ''}${bindLater('dash-date', 'change', e => {
    state.date = e.target.value || C.today();
    render();
  })}`;
}
export function isUnfinished(id, d) {
  if (C.excluded(db(), id, d)) return false;
  return C.pending(db(), id, d).length > 0 || C.pendingRoutines(db(), id, d).length > 0;
}
export function studentCard(s) {
  const missing = C.pending(db(), s.id, state.date),
    ex = C.excluded(db(), s.id, state.date),
    score = C.cumulativeScores(db(), s.id, state.date),
    routines = C.pendingRoutines(db(), s.id, state.date);
  const id = String(++state.actionNo);
  state.actions.set(id, () => {
    state.selected = state.selected.includes(s.id) ? state.selected.filter(x => x !== s.id) : [...state.selected, s.id];
    render();
  });
  return `<article role="button" tabindex="0" data-student-id="${esc(s.id)}" aria-pressed="${state.selected.includes(s.id)}" data-action="${id}" class="student ${isUnfinished(s.id, state.date) ? 'unfinished' : ''} ${missing.length ? 'has-pending' : ''} ${state.selected.includes(s.id) ? 'selected' : ''} ${ex ? 'excluded' : ''}"><div class="student-head"><strong>${esc(s.no)}. ${esc(s.name)}</strong>${btn('⋯', () => studentDetail(s.id), '', 'aria-label="' + esc(s.name) + ' 상세 보기"')}${ex ? badge('제외') : ''}</div><div class="score" aria-label="누적 별 점수 ${score.total}"><span class="score-star" aria-hidden="true">★</span><strong class="score-total">${score.total}</strong> <small>${C.areaNames(db(), true).filter(a => score.areas[a]).map(a => `<span class="area-score">${esc(a === '학습태도' ? '태도' : a)} ${score.areas[a]}</span>`).join(' ') || ''}</small></div><div class="pending-tasks">${missing.slice(0, 2).map(({
    assignment: a,
    date: d
  }) => btn(esc(a.title), () => taskStateEditor(a, d, s.id), 'task ' + (d < state.date ? 'overdue' : ''))).join('')}${missing.length > 2 ? btn('+ ' + (missing.length - 2) + '개', () => studentDetail(s.id), 'task pending-more') : ''}</div>${routines.length ? `<div class="routine-indicator"><div class="routine-names">${routines.map(r => btn(esc(r.title), () => completeRoutineWithUndo(r, state.date, s), 'routine-task')).join('')}</div></div>` : ''}</article>`;
}
const checkDrafts = new Map();
const recordKinds = [['칭찬', '칭찬', 'praise'], ['관찰', '기록', 'note'], ['추가기록', '추가기록', 'extra'], ['지도', '조언', 'advice']];
export function recordButtons(save) {
  return recordKinds.map(([kind, label, cls]) => btn(label, () => save(kind), 'record-action record-' + cls)).join('');
}
export async function saveDirectRecords(kind, text, ids, areas = [], seed = {}) {
  if (!C.KINDS.includes(kind)) throw Error('기록 종류를 선택하세요.');
  if (!text.trim()) throw Error('사유 또는 내용을 입력하세요.');
  const recordDate = seed.date || state.date;
  if (!ids.length || ids.some(id => !students().some(s => s.id === id))) throw Error('학생을 선택하거나 번호를 확인하세요.');
  if (ids.some(id => C.excluded(db(), id, recordDate))) throw Error('출결 제외 학생은 기록 대상에서 해제하세요.');
  const validAreas = areas.filter(a => C.areaNames(db()).includes(a));
  await commit([...new Set(ids)].map(id => up('records', newRecord({
    ...seed,
    studentIds: [id],
    text: text.trim(),
    action: C.replaceStudentNumbers(seed.action || '', db()),
    kind,
    areas: validAreas,
    extraType: kind === '추가기록' ? '메모' : null,
    printIncluded: kind !== '추가기록'
  }))));
}
export function renderSelectionClear() {
  return state.selected.length ? btn('✕ ' + state.selected.length + '명 선택 취소', () => {
    state.selected = [];
    render();
  }, 'selection-clear') : '';
}
function dashboardOrder() {
  try {
    return localStorage.getItem(`startoday-dashboard-order:${store.mode}:${store.classId}:${settings().academicYear}`) || 'number';
  } catch {
    return 'number';
  }
}
function setDashboardOrder(mode) {
  try {
    localStorage.setItem(`startoday-dashboard-order:${store.mode}:${store.classId}:${settings().academicYear}`, mode);
  } catch {}
  render();
}
function dashboardStudents(list) {
  if (dashboardOrder() !== 'seats') return `<div class="students">${list.map(studentCard).join('')}</div>`;
  const st = settings(),
    seated = list.filter(student => Number.isInteger(student.seat?.row) && Number.isInteger(student.seat?.col) && student.seat.row >= 0 && student.seat.col >= 0 && student.seat.row < 12 && student.seat.col < 12),
    placed = new Set();
  if (!seated.length) return `${list.length ? '<p class="muted">미배치 학생</p>' : ''}<div class="students">${list.map(studentCard).join('')}</div>`;
  const minRow = Math.min(...seated.map(student => student.seat.row)),
    maxRow = Math.max(...seated.map(student => student.seat.row)),
    minCol = Math.min(...seated.map(student => student.seat.col)),
    maxCol = Math.max(...seated.map(student => student.seat.col)),
    effectiveRows = maxRow - minRow + 1,
    effectiveCols = maxCol - minCol + 1;
  const rowOrder = Array.from({
    length: effectiveRows
  }, (_, index) => st.frontTop ? minRow + index : maxRow - index);
  const cells = rowOrder.flatMap(row => Array.from({
    length: effectiveCols
  }, (_, offset) => {
    const col = minCol + offset;
    const student = seated.find(s => s.seat?.row === row && s.seat?.col === col);
    if (student) placed.add(student.id);
    const gap = (st.seatLayout === 'pair' || st.seatLayout === 'group') && col % 2 === 1 && col < maxCol ? 22 : 0;
    return `<div class="dashboard-seat" data-seat-row="${row}" data-seat-col="${col}" style="margin-right:${gap}px;${st.seatLayout === 'group' && row % 2 === 1 && row !== rowOrder.at(-1) ? 'margin-bottom:24px;' : ''}">${student ? studentCard(student) : '<div class="empty-seat" aria-label="빈자리"></div>'}</div>`;
  })).join('');
  return `<div class="dashboard-seating">${st.frontTop ? '<div class="front">교실 앞</div>' : ''}<div class="students dashboard-seat-grid" style="--seat-cols:${effectiveCols};gap:${st.seatLayout === 'exam' ? 28 : 10}px">${cells}</div>${!st.frontTop ? '<div class="front">교실 앞</div>' : ''}</div>${list.some(s => !placed.has(s.id)) ? `<p class="muted">미배치 학생</p><div class="students">${list.filter(s => !placed.has(s.id)).map(studentCard).join('')}</div>` : ''}`;
}
export function routineChecklist(student, routines) {
  modal(student.no + '. ' + student.name + ' · 루틴', routines.map(r => btn('☐ ' + esc(r.title), async () => {
    await setRoutine(r, state.date, student.id, '완료');
    const pending = C.pendingRoutines(db(), student.id, state.date);
    if (pending.length) routineChecklist(student, pending);else closeModal();
  })).join(''));
}
const noticeDrafts = new Map();
const noticeSizes = {
    normal: 24,
    large: 36,
    huge: 52,
    '18': 24,
    '24': 32,
    '32': 128 / 3,
    '40': 160 / 3,
    '48': 64,
    '64': 256 / 3
  },
  noticeColors = {
    default: '#1E293B',
    red: '#B91C1C',
    blue: '#1D4ED8',
    yellow: '#FFE066',
    green: '#15803D',
    purple: '#7E22CE',
    orange: '#C2410C',
    gray: '#64748B'
  };
function noticeKey() {
  return `${store.mode}:${store.classId}:${settings().academicYear}`;
}
function noticeMarkup(note) {
  return C.normalizeAnnouncement(note).runs.map(r => `<span data-note-size="${r.size}" data-note-color="${r.color}" style="font-size:${noticeSizes[r.size]}px;color:${noticeColors[r.color]};${r.color === 'yellow' ? 'background:#0F172A;' : ''}">${esc(r.text)}</span>`).join('');
}
export function announcementView() {
  const n = C.normalizeAnnouncement(settings().announcement);
  return n.text ? `<section class="class-announcement" aria-label="알림 내용">${noticeMarkup(n)}</section>` : '';
}
function noticeDraft() {
  const key = noticeKey();
  let draft = noticeDrafts.get(key);
  if (!draft) {
    let cached;
    try {
      cached = JSON.parse(sessionStorage.getItem('startoday-notice:' + key));
    } catch {}
    draft = {
      key,
      note: C.normalizeAnnouncement(cached || settings().announcement),
      version: 0,
      dirty: !!cached,
      saving: false,
      selection: null,
      timer: null,
      error: false
    };
    noticeDrafts.set(key, draft);
  } else if (!draft.dirty && !draft.saving) draft.note = C.normalizeAnnouncement(settings().announcement);
  return draft;
}
export function announcementEditor() {
  const draft = noticeDraft();
  if (draft.dirty) queueNotice(draft);
  return `<section class="panel notice-panel"><div id="notice-toolbar" class="row compact-notice-toolbar" role="toolbar" aria-label="알림 서식">${select('', 'notice-size', [['normal', '글씨크기'], ['large', '크게'], ['huge', '아주 크게'], ...['18', '24', '32', '40', '48', '64'].map(n => [n, n + 'pt'])], draft.note.runs[0]?.size || 'normal').replace('<select ', '<select aria-label="글씨크기" ')}${select('', 'notice-color', [['default', '글씨색상'], ['red', '빨강'], ['blue', '파랑'], ['yellow', '노랑'], ['green', '초록'], ['purple', '보라'], ['orange', '주황'], ['gray', '회색']], draft.note.runs[0]?.color || 'default').replace('<select ', '<select aria-label="글씨색상" ')}<small id="notice-status" role="status">${draft.error ? '저장 실패 · 입력하면 다시 시도합니다.' : draft.dirty ? '자동 저장 대기 중' : '자동 저장됨'}</small></div><div id="notice-editor" contenteditable="true" role="textbox" aria-label="알림 내용" aria-multiline="true" spellcheck="false">${noticeMarkup(draft.note)}</div></section>`;
}
// Delegate editor events once, so repeated renders cannot duplicate input handlers.
for (const type of ['input', 'mouseup', 'keyup', 'pointerdown', 'change', 'paste', 'drop']) {
  document.addEventListener(type, e => {
    const editor = e.target.closest?.('#notice-editor'),
      toolbar = e.target.closest?.('#notice-toolbar');
    if (!editor && !toolbar) return;
    const draft = noticeDraft();
    if (type === 'input' && editor) noticeChanged(draft);
    if (['mouseup', 'keyup'].includes(type) && editor || type === 'pointerdown' && toolbar) rememberNoticeSelection(draft);
    if (type === 'change' && toolbar && ['notice-size', 'notice-color'].includes(e.target.name)) {
      const field = $('#notice-editor');
      draft.note = readNotice(field);
      const range = draft.selection || {
        start: 0,
        end: draft.note.text.length
      };
      draft.note = C.formatAnnouncement(draft.note, range.start, range.end, {
        [e.target.name === 'notice-size' ? 'size' : 'color']: e.target.value
      });
      field.innerHTML = noticeMarkup(draft.note);
      restoreNoticeSelection(range);
      noticeChanged(draft);
    }
    if (type === 'paste' && editor) {
      e.preventDefault();
      insertNoticeText(e.clipboardData.getData('text/plain'), draft);
    }
    if (type === 'drop' && editor) e.preventDefault();
  });
}
function readNotice(editor) {
  const runs = [];
  function walk(node, style = {
    size: 'normal',
    color: 'default'
  }) {
    if (node.nodeType === 3) {
      runs.push({
        ...style,
        text: node.nodeValue
      });
      return;
    }
    if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'IMG'].includes(node.tagName)) return;
    const next = {
      size: Object.hasOwn(noticeSizes, node.dataset.noteSize) ? node.dataset.noteSize : style.size,
      color: Object.hasOwn(noticeColors, node.dataset.noteColor) ? node.dataset.noteColor : style.color
    };
    if (node.tagName === 'BR') {
      const block = node.parentElement.closest('div,p');
      if (block && !block.textContent && block.querySelectorAll('br').length === 1 || !node.nextSibling && node.previousSibling?.nodeName === 'BR') return;
      runs.push({
        ...next,
        text: '\n'
      });
      return;
    }
    if (['DIV', 'P'].includes(node.tagName) && node !== editor && node.previousSibling) runs.push({
      ...next,
      text: '\n'
    });
    for (const child of node.childNodes) walk(child, next);
  }
  for (const child of editor.childNodes) walk(child);
  if (editor.innerHTML === '<br>') return C.normalizeAnnouncement({});
  return C.normalizeAnnouncement({
    runs
  });
}
function rememberNoticeSelection(draft) {
  const editor = $('#notice-editor'),
    selection = window.getSelection();
  if (!editor || !selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  const prefix = range.cloneRange();
  prefix.selectNodeContents(editor);
  prefix.setEnd(range.startContainer, range.startOffset);
  draft.selection = {
    start: prefix.toString().length,
    end: prefix.toString().length + range.toString().length
  };
}
function restoreNoticeSelection(saved) {
  const editor = $('#notice-editor');
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT),
    nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  if (!nodes.length) return;
  function point(offset) {
    for (const node of nodes) {
      if (offset <= node.length) return [node, offset];
      offset -= node.length;
    }
    const last = nodes.at(-1);
    return [last, last.length];
  }
  const range = document.createRange();
  range.setStart(...point(saved.start));
  range.setEnd(...point(saved.end));
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
function insertNoticeText(text, draft) {
  const editor = $('#notice-editor'),
    selection = window.getSelection();
  editor.focus();
  if (document.execCommand('insertText', false, text)) {
    rememberNoticeSelection(draft);
    return;
  }
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  noticeChanged(draft);
  rememberNoticeSelection(draft);
}
function noticeChanged(draft) {
  if (draft.key !== noticeKey()) return;
  draft.note = readNotice($('#notice-editor'));
  draft.version++;
  draft.dirty = true;
  draft.error = false;
  try {
    sessionStorage.setItem('startoday-notice:' + draft.key, JSON.stringify(draft.note));
  } catch {}
  queueNotice(draft);
  noticeStatus(draft, '자동 저장 대기 중');
}
function noticeStatus(draft, text) {
  if (!store.db || draft.key !== noticeKey()) return;
  const status = $('#notice-status');
  if (status) status.textContent = text;
}
function queueNotice(draft, delay = 500) {
  clearTimeout(draft.timer);
  draft.timer = setTimeout(() => flushNotice(draft), delay);
}
async function flushNotice(draft) {
  if (!draft.dirty || !store.db || draft.key !== noticeKey()) return;
  if (store.busy || draft.saving) {
    queueNotice(draft, 100);
    return;
  }
  const version = draft.version,
    note = structuredClone(draft.note);
  draft.saving = true;
  noticeStatus(draft, '자동 저장 중…');
  try {
    await store.commit([up('settings', {
      ...settings(),
      announcement: note
    })]);
    if (draft.version === version) {
      draft.dirty = false;
      draft.error = false;
      try {
        sessionStorage.removeItem('startoday-notice:' + draft.key);
      } catch {}
      noticeStatus(draft, '자동 저장됨');
    } else queueNotice(draft);
  } catch (e) {
    draft.error = true;
    noticeStatus(draft, '저장 실패 · ' + e.message);
  } finally {
    draft.saving = false;
  }
}
window.addEventListener('online', () => {
  for (const draft of noticeDrafts.values()) if (draft.dirty) queueNotice(draft);
});
function checkKey() {
  return `startoday-checklist-v1:${store.mode}:${store.classId}:${settings().academicYear}:${state.date}`;
}
function rememberChecks() {
  checkDrafts.set(checkKey(), [...state.checks]);
}
export function enterChecklist() {
  const key = checkKey();
  let ids = checkDrafts.get(key);
  if (!ids) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(saved)) ids = saved;
    } catch {}
  }
  state.checks = new Set(ids || students().filter(s => !C.excluded(db(), s.id, state.date)).map(s => s.id));
}
export function checkView() {
  const attendance = state.dashMode === 'attendance',
    all = students(),
    list = attendance ? all : all.filter(s => !C.excluded(db(), s.id, state.date)),
    ex = all.filter(s => C.excluded(db(), s.id, state.date)),
    checkedList = list.filter(s => state.checks.has(s.id)),
    missing = list.filter(s => !state.checks.has(s.id));
  return `<div class="toolbar"><h2>${attendance ? '출결 · 제외 표시' : '빠른 인원 점검'}</h2><div class="row">${!attendance ? btn('전원 체크', () => {
    state.checks = new Set(list.map(s => s.id));
    rememberChecks();
    render();
  }) + btn('전원 해제', () => {
    state.checks.clear();
    rememberChecks();
    render();
  }) + btn('저장', () => {
    localStorage.setItem(checkKey(), JSON.stringify([...state.checks]));
    rememberChecks();
    toast('체크 상태를 이 기기에 저장했습니다.');
  }, 'primary') + btn('초기화', () => {
    localStorage.removeItem(checkKey());
    checkDrafts.delete(checkKey());
    state.checks = new Set(list.map(s => s.id));
    rememberChecks();
    render();
  }) : ''}${btn('끝내기', () => {
    if (!attendance) rememberChecks();
    state.dashMode = 'normal';
    render();
  }, 'primary')}</div></div><div class="panel"><p>${attendance ? '날짜별 제외 표시와 사유를 보존합니다. 카드를 다시 누르면 제외를 취소합니다.' : '저장하면 창을 닫아도 유지됩니다. 예약된 결석 학생은 점검 대상에서 자동으로 빠집니다.'}</p><strong>${attendance ? `총 ${all.length}명 중 ${all.length - ex.length}명 · 제외: ${esc(ex.map(s => s.name).join(', ') || '없음')}` : `대상 ${list.length}명 · 체크 ${checkedList.length}명 · 제외 ${ex.length}명 · 미체크: ${esc(missing.map(s => s.name).join(', ') || '없음')}`}</strong></div><div class="check-mode students">${list.map(s => {
    const checked = attendance ? C.excluded(db(), s.id, state.date) : state.checks.has(s.id);
    const old = db().attendance.find(a => a.studentId === s.id && a.date === state.date);
    return btn(`${checked ? '✓ ' : ''}${esc(s.no)}. ${esc(s.name)}${attendance && old?.memo ? '<small>' + esc(old.memo) + '</small>' : ''}`, async () => {
      if (attendance) {
        const id = C.stateId('attendance', state.date, s.id);
        await commit([up('attendance', {
          ...old,
          id,
          studentId: s.id,
          date: state.date,
          excluded: !checked
        })], '');
      } else {
        checked ? state.checks.delete(s.id) : state.checks.add(s.id);
        rememberChecks();
        render();
      }
    }, 'student ' + (attendance ? checked ? 'excluded' : '' : checked ? 'checked' : ''));
  }).join('')}</div>${attendance ? reservationForm() : `<div class="panel" style="margin-top:16px"><label>점검 장소<input id="check-place" placeholder="예: 도서관"></label>${btn('미체크 명단을 관찰 기록으로 남기기', async () => {
    if (!missing.length) return toast('미체크 학생이 없습니다.');
    const place = $('#check-place').value || '인원 점검';
    await commit(missing.map(s => up('records', newRecord({
      studentIds: [s.id],
      date: state.date,
      kind: '관찰',
      text: place + ' 인원 점검에서 미체크',
      areas: []
    }))));
    state.dashMode = 'normal';
    render();
  })}</div>`}`;
}
export function reservationForm() {
  const future = db().attendance.filter(a => a.excluded && a.date >= C.today() && students().some(s => s.id === a.studentId)).sort((a, b) => a.date.localeCompare(b.date));
  return `<section class="panel" style="margin-top:16px"><h3>사전 결석 예약</h3><form id="absence-form"><div class="row">${input('시작일', 'from', state.date < C.today() ? C.today() : state.date, 'date', `required min="${C.today()}"`)}${input('종료일 · 단일일은 비워 두세요', 'to', '', 'date', `min="${C.today()}"`)}${input('사유 메모', 'memo', '', 'text', 'required placeholder="체험학습"')}</div><p>예약할 학생</p>${multiple(students().map(s => [s.id, s.no + '. ' + s.name]), 'studentIds', state.selected)}<button type="submit" class="primary" style="margin-top:12px">제외 예약 저장</button></form>${bindLater('absence-form', 'submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target),
      from = f.get('from'),
      to = f.get('to') || from;
    if (from < C.today()) throw Error('오늘 이후 날짜를 선택하세요.');
    await commit(C.attendanceOps(db(), f.getAll('studentIds'), from, to, f.get('memo')));
  })}<h3 style="margin-top:16px">예정된 제외 · ${future.length}건</h3>${future.map(a => `<div class="row"><span>${esc(C.formatDate(a.date))} · ${esc(students().find(s => s.id === a.studentId)?.name)} · ${esc(a.memo || '')}</span>${btn('예약 취소', () => commit([up('attendance', {
    ...a,
    excluded: false
  })]))}</div>`).join('')}</section>`;
}
// Follow midnight only while viewing the current day; preserve deliberately selected dates.
let observedDay = C.today();
setInterval(() => {
  const today = C.today();
  if (today === observedDay) return;
  const followToday = state.date === observedDay;
  observedDay = today;
  if (!followToday || !store.db) return;
  state.date = today;
  if (state.dashMode === 'check') enterChecklist();
  if (!state.locked) render();
}, 60000);
let routineUndo = null;
function closeRoutineUndo() {
  if (routineUndo) {
    clearInterval(routineUndo.timer);
    routineUndo.root.remove();
    routineUndo = null;
  }
}
function routineUndoScope() {
  return `${store.mode}:${store.classId}:${db()?.settings?.[0]?.academicYear}`;
}
async function completeRoutineWithUndo(r, date, student) {
  const scope = routineUndoScope();
  await setRoutine(r, date, student.id, '완료');
  if (scope !== routineUndoScope() || state.locked) return;
  closeRoutineUndo();
  const saved = db().routineStates.find(x => x.id === C.stateId(r.id, date, student.id));
  const root = document.createElement('div');
  root.className = 'routine-undo';
  root.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = `${student.name} ${r.title} 완료됨`;
  const button = document.createElement('button');
  button.type = 'button';
  root.append(text, button);
  document.body.append(root);
  const undo = {
    root,
    scope,
    expires: performance.now() + 5000,
    timer: null
  };
  routineUndo = undo;
  const tick = () => {
    if (routineUndo !== undo) return;
    const remaining = Math.ceil((undo.expires - performance.now()) / 1000);
    if (remaining <= 0 || scope !== routineUndoScope() || state.locked) return closeRoutineUndo();
    button.textContent = `↩ 실행취소 (${remaining}초)`;
  };
  button.onclick = () => run(async () => {
    if (routineUndo !== undo || performance.now() >= undo.expires || scope !== routineUndoScope()) return closeRoutineUndo();
    const current = db().routineStates.find(x => x.id === saved?.id);
    if (current?.status !== '완료' || current.updatedAt !== saved.updatedAt) {
      closeRoutineUndo();
      return;
    }
    button.disabled = true;
    try {
      await setRoutine(r, date, student.id, '진행중');
      if (routineUndo === undo) closeRoutineUndo();
    } finally {
      button.disabled = false;
    }
  });
  tick();
  undo.timer = setInterval(tick, 100);
}
