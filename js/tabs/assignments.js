import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, name, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, badge, bindLater, btn, empty, esc, input, multiple, run, select, textarea, checkbox } from '../shared/ui.js';
export function targetForm(target = 'all') {
  return `<div class="span2">${select('대상', 'target', [['all', '전체 학생'], ['some', '선택 학생']], target === 'all' ? 'all' : 'some')}<div id="target-students" style="margin-top:9px">${multiple(students().map(s => [s.id, name(s.id)]), 'students', target?.studentIds || [])}</div></div>`;
}
export function setupTarget() {
  const form = $('#modal-form');
  const update = () => $('#target-students').hidden = form.elements.target.value === 'all';
  form.elements.target.onchange = update;
  update();
}
export function getTarget(f) {
  if (f.get('target') === 'all') return 'all';
  const ids = f.getAll('students');
  if (!ids.length) throw Error('대상 학생을 선택하세요.');
  return {
    studentIds: ids
  };
}
export function assignmentEditor(a = null, d = state.date) {
  const r = a || {
    id: C.uid(),
    title: '',
    date: d,
    repeat: {
      type: 'none',
      weekdays: []
    },
    target: 'all',
    statArea: C.areaRows(db()).find(area => area.id === 'area-2')?.name || null,
    createdAt: C.now()
  };
  modal(a ? '과제 수정' : '새 과제', `<div class="formgrid">${input('과제 제목', 'title', r.title, 'text', 'required')}${input('시작일 / 마감일', 'date', r.date, 'date', 'required')}${select('반복', 'repeat', [['none', '없음'], ['daily', '매일'], ['weekly', '매주 요일 지정']], r.repeat.type)}${select('경험치 영역', 'statArea', [['', '미지정'], ...C.areaNames(db(), true).filter(a => C.areaNames(db()).includes(a) || a === r.statArea)], r.statArea || '')}<div class="span2" id="repeat-days"><label>반복 요일</label>${multiple([[1, '월'], [2, '화'], [3, '수'], [4, '목'], [5, '금'], [6, '토'], [0, '일']].map(([x, y]) => [String(x), y]), 'weekdays', (r.repeat.weekdays || []).map(String))}</div>${targetForm(r.target)}${select('제출 방식', 'submissionMode', [['check', '단순 체크'], ['text', '글 제출'], ['photo', '사진 첨부']], r.submissionMode || 'check')}${checkbox('학급 친구들에게 제출물 공유', 'shareSubmissions', r.shareSubmissions)}${checkbox('칭찬 별점 부여하지 않음 (단순 체크리스트)', 'noStar', r.noStar)}${textarea('메모(안내사항)', 'memo', r.memo || '')}${checkerPicker(r.checkerStudentId || '')}</div>`, async f => {
    const repeat = {
      type: f.get('repeat')
    };
    if (repeat.type === 'weekly') {
      repeat.weekdays = f.getAll('weekdays').map(Number);
      if (!repeat.weekdays.length) throw Error('요일을 선택하세요.');
    }
    const next = {
      ...r,
      title: f.get('title').trim(),
      date: f.get('date'),
      repeat,
      target: getTarget(f),
      statArea: f.get('statArea') || null,
      noStar: !!f.get('noStar'),
      submissionMode: ['check', 'text', 'photo'].includes(f.get('submissionMode')) ? f.get('submissionMode') : 'check',
      shareSubmissions: !!f.get('shareSubmissions'),
      memo: f.get('memo') || '',
      checkerStudentId: f.get('checkerStudentId') || null
    };
    if (!next.title) throw Error('제목을 입력하세요.');
    if (next.checkerStudentId && !students().some(student => student.id === next.checkerStudentId)) throw Error('확인자 학생을 다시 선택하세요.');
    const states = db().assignmentStates.filter(s => s.assignmentId === next.id);
    const rewardOps = !!a?.noStar === next.noStar ? [] : next.noStar ? db().records.filter(r => r.autoRef && states.some(s => s.id === r.autoRef)).map(r => ({
      table: 'records',
      id: r.id,
      remove: true
    })) : states.filter(s => C.targeted(next, s.studentId)).flatMap(s => C.taskStateOps(db(), next, s.date, s.studentId, s.status, s.memo || ''));
    await commit([up('assignments', next), ...rewardOps]);
    closeModal();
  });
  setupTarget();
  const repeat = $('#modal-form').elements.repeat;
  const update = () => $('#repeat-days').hidden = repeat.value !== 'weekly';
  repeat.onchange = update;
  update();
}
export function assignmentsView() {
  const assignments = db().assignments.filter(a => !a.deletedAt),
    daily = assignments.filter(a => C.occurs(a, state.date));
  return `<div class="toolbar"><div><h2>과제</h2><small>과제 × 날짜 × 학생마다 상태가 독립적으로 저장됩니다.</small></div><div class="row"><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(state.date)) || '날짜 선택'}</span><input id="assignment-date" aria-label="과제 날짜" type="date" value="${state.date}"></span>${btn('+ 과제', () => assignmentEditor(), 'primary')}</div></div><section class="panel"><h3>${esc(C.formatDate(state.date))} 과제 상태</h3>${daily.length ? `<div class="table-wrap assignment-matrix"><table><thead><tr><th>학생</th>${daily.map(a => `<th>${btn(esc(a.title), () => assignmentActions(a, state.date), 'assignment-title')}<div>${btn(allTaskTargetsComplete(a, state.date) ? '↩ 전원 미완료' : '✓ 전원 완료', () => completeAll(a, state.date), 'complete-all')}${btn('남은 진행중 전체 안함', () => markRemainingUndone(a, state.date), 'remaining-notdone')}</div></th>`).join('')}</tr></thead><tbody>${students().map(s => `<tr><th>${esc(name(s.id))}${C.excluded(db(), s.id, state.date) ? badge('제외') : ''}</th>${daily.map(a => {
    const taskState = db().assignmentStates.find(x => x.id === C.stateId(a.id, state.date, s.id));
    return `<td>${C.targeted(a, s.id) ? btn(esc(taskState?.status || '진행중'), () => queueTaskToggle(a, state.date, s.id), taskStatusClass(taskState?.status || '진행중'), `data-task-assignment="${esc(a.id)}" data-task-student="${esc(s.id)}" data-task-date="${state.date}" title="클릭: 상태 변경 · 더블클릭/우클릭: 메모 수정"`) + `<div class="muted">${esc(taskState?.memo || '')}</div>` : '—'}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>` : empty('이 날짜에 등록된 과제가 없습니다.', '새 과제를 등록하거나 날짜를 바꾸세요.')}</section>${assignmentCalendar(assignments)}${bindLater('assignment-date', 'change', e => {
    state.date = e.target.value || C.today();
    assignmentMonth = state.date.slice(0, 7);
    render();
  })}`;
}
export function taskStateEditor(a, d, s, afterSave = null) {
  const current = db().assignmentStates.find(x => x.id === C.stateId(a.id, d, s));
  modal(`${name(s)} · ${a.title}`, `<p class="muted">${esc(C.formatDate(d))}의 과제 · 완료 +1 · 안함 −1 · 늦게완료/진행중/면제 0</p>${C.excluded(db(), s, d) ? '<div class="notice">출결 제외일입니다. 상태는 보존되며 점수 집계에서는 제외됩니다.</div>' : ''}${select('상태', 'status', C.STATUSES, current?.status || '진행중')}${input('상태 메모 · 선택', 'memo', current?.memo || '')}`, async f => {
    await commit(C.taskStateOps(db(), a, d, s, f.get('status'), f.get('memo').trim()));
    if (afterSave) afterSave();else closeModal();
  });
}
export function deleteAssignment(a, cutoffDate = state.date) {
  modal('과제 삭제 / 반복 중단', `<p>${esc(a.title)}</p>${select('처리 방식', 'mode', [['future', C.formatDate(cutoffDate) + '부터 앞으로만 중단 · 이전 상태/기록 보존'], ['all', '과제와 모든 상태·자동 기록을 삭제']], 'future')}`, async f => {
    if (!confirm('선택한 방식으로 처리할까요?')) return;
    const all = f.get('mode') === 'all';
    const cutoff = cutoffDate;
    let ops = [];
    const states = db().assignmentStates.filter(s => s.assignmentId === a.id && (all || s.date >= cutoff));
    ops.push(all ? {
      table: 'assignments',
      id: a.id,
      remove: true
    } : up('assignments', {
      ...a,
      endDate: C.addDays(cutoff, -1)
    }));
    for (const ast of states) {
      ops.push({
        table: 'assignmentStates',
        id: ast.id,
        remove: true
      });
      for (const r of db().records.filter(r => r.autoRef === ast.id)) ops.push({
        table: 'records',
        id: r.id,
        remove: true
      });
    }
    await commit(ops);
    closeModal();
  });
}
const taskToggles = new Map();
let assignmentWrites = Promise.resolve();
function persistAssignment(write) {
  const next = assignmentWrites.then(write);
  assignmentWrites = next.catch(() => {});
  return next;
}
function assignmentScope() {
  return `${store.mode}:${store.classId}:${db()?.settings?.[0]?.academicYear}`;
}
function cancelTaskToggle(key) {
  const pending = taskToggles.get(key);
  if (pending) {
    clearTimeout(pending.timer);
    pending.button.innerHTML = pending.previous;
    pending.button.className = pending.previousClass;
    taskToggles.delete(key);
  }
}
function queueTaskToggle(a, date, studentId, clickedButton = null) {
  if (clickedButton?.dataset.longPressed === 'true') {
    delete clickedButton.dataset.longPressed;
    return;
  }
  const key = C.stateId(a.id, date, studentId);
  if (taskToggles.has(key)) {
    cancelTaskToggle(key);
    return;
  }
  const scope = assignmentScope();
  const current = db().assignmentStates.find(x => x.id === key);
  const statuses = ['진행중', '완료', '안함'];
  const next = statuses[(statuses.indexOf(current?.status || '진행중') + 1) % statuses.length];
  const button = clickedButton || [...document.querySelectorAll('[data-task-assignment]')].find(b => b.dataset.taskAssignment === a.id && b.dataset.taskStudent === studentId && b.dataset.taskDate === date);
  const previous = button?.innerHTML || current?.status || '진행중';
  const previousClass = button?.className || '';
  if (button) {
    const statusLine = button.querySelector('.assignment-progress-status');
    if (statusLine) statusLine.textContent = next;else button.textContent = next;
    button.className = (statusLine ? 'assignment-progress-item ' : '') + taskStatusClass(next);
  }
  // Immediate visual feedback; a short window lets double-click open memo without changing data.
  const timer = setTimeout(() => {
    taskToggles.delete(key);
    run(async () => {
      try {
        await persistAssignment(async () => {
          if (scope !== assignmentScope() || !db()?.assignments.some(task => task.id === a.id && !task.deletedAt)) return;
          const latest = db().assignmentStates.find(x => x.id === key);
          await commit(C.taskStateOps(db(), a, date, studentId, next, latest?.memo || ''));
          refreshAssignmentProgress(a, date);
        });
      } catch (error) {
        if (button?.isConnected) {
          button.innerHTML = previous;
          button.className = previousClass;
        }
        throw error;
      }
    });
  }, 280);
  taskToggles.set(key, {
    timer,
    button: button || {
      textContent: previous
    },
    previous,
    previousClass
  });
}
for (const type of ['dblclick', 'contextmenu']) document.addEventListener(type, e => {
  const button = e.target.closest?.('[data-task-assignment]');
  if (!button) return;
  e.preventDefault();
  const {
    taskAssignment: id,
    taskStudent: student,
    taskDate: date
  } = button.dataset;
  cancelTaskToggle(C.stateId(id, date, student));
  const assignment = db().assignments.find(a => a.id === id);
  if (assignment) {
    const section = button.closest?.('.assignment-progress');
    const position = section ? {
      grid: section.querySelector('.assignment-progress-grid')?.scrollTop || 0,
      body: section.closest('.dialog-body')?.scrollTop || 0
    } : null;
    taskStateEditor(assignment, date, student, position ? () => assignmentActions(assignment, date, position) : null);
  }
});
async function completeAll(a, date) {
  const scope = assignmentScope();
  for (const s of students()) cancelTaskToggle(C.stateId(a.id, date, s.id));
  await persistAssignment(async () => {
    if (scope !== assignmentScope()) return;
    const targets = students().filter(s => C.targeted(a, s.id) && !C.excluded(db(), s.id, date));
    const status = targets.length && targets.every(s => ['완료', '늦게완료', '면제'].includes(C.assignmentStatus(db(), a.id, date, s.id))) ? '진행중' : '완료';
    const ops = targets.flatMap(s => {
      const current = db().assignmentStates.find(x => x.id === C.stateId(a.id, date, s.id));
      return C.taskStateOps(db(), a, date, s.id, status, current?.memo || '');
    });
    if (ops.length) await commit(ops, `${targets.length}명 ${status} 처리했습니다.`);
  });
}
function allTaskTargetsComplete(a, date) {
  const target = students().filter(s => C.targeted(a, s.id) && !C.excluded(db(), s.id, date));
  return target.length > 0 && target.every(s => ['완료', '늦게완료', '면제'].includes(C.assignmentStatus(db(), a.id, date, s.id)));
}
function taskStatusClass(status) {
  return 'task-status ' + (['완료', '늦게완료', '면제'].includes(status) ? 'task-status-complete' : status === '안함' ? 'task-status-notdone' : 'task-status-pending');
}
let assignmentMonth = '',
  assignmentCalendarScope = '';
function assignmentCalendar(assignments) {
  const scope = `${store.mode}:${store.classId}:${db()?.settings?.[0]?.academicYear}`;
  if (scope !== assignmentCalendarScope || !assignmentMonth) {
    assignmentCalendarScope = scope;
    assignmentMonth = state.date.slice(0, 7);
  }
  const first = assignmentMonth + '-01',
    start = C.addDays(first, -((C.weekday(first) + 6) % 7));
  return `<section class="panel assignment-calendar-panel"><div class="toolbar"><h3>월간 과제 달력 · ${esc(assignmentMonth.replace('-', '.'))}</h3><div class="row">${btn('‹', () => moveAssignmentMonth(-1), '', 'aria-label="이전 과제 월"')}${btn('오늘', () => {
    state.date = C.today();
    assignmentMonth = state.date.slice(0, 7);
    render();
  })}${btn('›', () => moveAssignmentMonth(1), '', 'aria-label="다음 과제 월"')}</div></div><div class="calendar assignment-calendar">${['월', '화', '수', '목', '금', '토', '일'].map(day => `<div class="weekday">${day}</div>`).join('')}${Array.from({
    length: 42
  }, (_, i) => {
    const date = C.addDays(start, i),
      list = assignments.filter(a => C.occurs(a, date));
    return `<div class="day assignment-day ${date.slice(0, 7) !== assignmentMonth ? 'faded' : ''} ${date === state.date ? 'selected-day' : ''}" data-date="${date}">${btn(String(Number(date.slice(-2))), () => {
      state.date = date;
      assignmentMonth = date.slice(0, 7);
      render();
    }, 'day-head', `aria-label="${esc(C.formatDate(date))} 과제 조회" aria-pressed="${date === state.date}"`)} ${btn('+', () => assignmentEditor(null, date), 'assignment-calendar-add', `aria-label="${date} 과제 추가"`)}${list.map(a => btn(esc(a.title) + exemptionBadge(a, date), () => assignmentActions(a, date), 'assignment-calendar-task' + (students().some(student => C.targeted(a, student.id) && !C.excluded(db(), student.id, date) && !['완료', '늦게완료', '면제'].includes(C.assignmentStatus(db(), a.id, date, student.id))) ? ' has-incomplete' : ''), `data-assignment-id="${esc(a.id)}" data-assignment-date="${date}"`)).join('')}</div>`;
  }).join('')}</div>${!assignments.length ? '<p class="muted" style="margin-top:12px">등록한 과제가 없습니다.</p>' : ''}</section>`;
}
function moveAssignmentMonth(amount) {
  const date = new Date(assignmentMonth + '-01T12:00Z');
  date.setUTCMonth(date.getUTCMonth() + amount);
  assignmentMonth = date.toISOString().slice(0, 7);
  render();
}
function assignmentActions(a, date, scrollPosition = null) {
  const info = C.assignmentPublicInfo(db(), a);
  modal('과제 관리', `<h3>${esc(a.title)}</h3>${a.noStar ? badge('단순 체크리스트 · 별점 없음') : ''}${info.memo ? `<p class="assignment-public-memo">${esc(info.memo)}</p>` : ''}<p class="assignment-checker">🔍 확인자: ${info.checkerName ? esc(info.checkerName) + ' 학생' : '선생님 직접 확인'}</p><p class="muted">${esc(C.formatDate(date))} · ${a.repeat.type === 'none' ? '1회' : a.repeat.type === 'daily' ? '매일' : '매주 ' + (a.repeat.weekdays || []).map(day => '일월화수목금토'[day]).join('·')}</p><div class="row">${btn('수정', () => assignmentEditor(a))}${btn('복사', () => assignmentEditor({
    ...a,
    id: C.uid(),
    createdAt: C.now(),
    date,
    deletedAt: null,
    endDate: null
  }))}${btn('삭제/중단', () => deleteAssignment(a, date), 'danger')}</div>${assignmentProgress(a, date)}`);
  restoreAssignmentProgressScroll(scrollPosition);
}
function assignmentProgress(a, date) {
  const targets = students().filter(student => C.targeted(a, student.id));
  const eligible = targets.filter(student => !C.excluded(db(), student.id, date));
  const completed = eligible.filter(student => ['완료', '늦게완료', '면제'].includes(C.assignmentStatus(db(), a.id, date, student.id))).length;
  return `<section class="assignment-progress" data-assignment-id="${esc(a.id)}" data-date="${esc(date)}"><div class="toolbar"><h3>학생 진행도 · 완료 ${completed}/${eligible.length}명</h3>${btn(eligible.length && completed === eligible.length ? '↩ 전원 미완료' : '✓ 전원 완료', async () => {
    await completeAll(a, date);
    refreshAssignmentProgress(a, date);
  }, 'complete-all', eligible.length ? '' : 'disabled')}${btn('남은 진행중 전체 안함', () => markRemainingUndone(a, date), 'remaining-notdone')}</div><div class="assignment-progress-grid">${targets.map(student => {
    const status = C.assignmentStatus(db(), a.id, date, student.id),
      excluded = C.excluded(db(), student.id, date);
    return btn(`<span class="assignment-progress-name">${esc(student.no)}. ${esc(student.name)}${excluded ? ' ' + badge('제외') : ''}</span><span class="assignment-progress-status">${esc(status)}</span>`, event => queueTaskToggle(a, date, student.id, event.target.closest('button')), 'assignment-progress-item ' + taskStatusClass(status), `data-student-id="${esc(student.id)}" data-task-assignment="${esc(a.id)}" data-task-student="${esc(student.id)}" data-task-date="${esc(date)}" title="클릭: 상태 변경 · 길게 누르기/우클릭: 상세 수정" ${excluded ? 'disabled' : ''}`);
  }).join('') || '<p class="muted">대상 학생이 없습니다.</p>'}</div></section>`;
}
function restoreAssignmentProgressScroll(position) {
  if (!position) return;
  const grid = document.querySelector?.('#modal .assignment-progress-grid'),
    body = document.querySelector?.('#modal .dialog-body');
  if (grid) grid.scrollTop = position.grid;
  if (body) body.scrollTop = position.body;
}
function refreshAssignmentProgress(a, date) {
  if (!document.querySelector?.('#modal')?.open) return;
  const section = document.querySelector?.('#modal .assignment-progress');
  if (!section || section.dataset.assignmentId !== a.id || section.dataset.date !== date) return;
  const position = {
    grid: section.querySelector('.assignment-progress-grid')?.scrollTop || 0,
    body: section.closest('.dialog-body')?.scrollTop || 0
  };
  const latest = db().assignments.find(assignment => assignment.id === a.id && !assignment.deletedAt);
  if (latest) assignmentActions(latest, date, position);else closeModal();
}
function exemptionBadge(a, date) {
  const count = students().filter(s => C.targeted(a, s.id) && !C.excluded(db(), s.id, date) && C.assignmentStatus(db(), a.id, date, s.id) === '면제').length;
  return count ? ' ' + badge('면제 ' + count) : '';
}
function checkerPicker(id) {
  const list = [['', '선생님'], ...students().map(s => [s.id, name(s.id)])];
  return `<fieldset class="span2 checker-picker"><legend>확인 (대신 체크해 주는 학생)</legend><div class="checker-card-picker" role="radiogroup" aria-label="과제 확인자">${list.map(([value, label]) => `<label class="checker-choice"><input type="radio" name="checkerStudentId" value="${esc(value)}" ${id === value ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;
}
async function markRemainingUndone(a, date) {
  const scope = assignmentScope();
  for (const student of students()) cancelTaskToggle(C.stateId(a.id, date, student.id));
  await persistAssignment(async () => {
    if (scope !== assignmentScope()) return;
    const ops = C.markRemainingUndoneOps(db(), a, date);
    if (ops.length) await commit(ops, '남은 진행중 과제를 안함 처리했습니다.');
  });
  refreshAssignmentProgress(a, date);
}
let taskHoldTimer;
document.addEventListener('pointerdown', e => {
  const button = e.target.closest?.('.assignment-progress-item[data-task-assignment]');
  if (!button || button.disabled || e.button !== 0) return;
  taskHoldTimer = setTimeout(() => {
    button.dataset.longPressed = 'true';
    button.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    }));
  }, 550);
});
for (const event of ['pointerup', 'pointercancel', 'pointermove']) document.addEventListener(event, () => clearTimeout(taskHoldTimer));
