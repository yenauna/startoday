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
  modal(db().assignments.some(item => item.id === r.id) ? '과제 수정' : r.isQuest ? '새 장기과제' : '새 과제', `<div class="formgrid">${input('과제 제목', 'title', r.title, 'text', 'required')}<div class="assignment-start-field">${input(r.isQuest ? '시작일 (기본 오늘)' : '시작일 / 마감일', 'date', r.date, 'date', 'required')}</div>${select('반복', 'repeat', [['none', '없음'], ['daily', '매일'], ['weekly', '매주 요일 지정']], r.repeat.type)}${select('경험치 영역', 'statArea', [['', '미지정'], ...C.areaNames(db(), true).filter(a => C.areaNames(db()).includes(a) || a === r.statArea)], r.statArea || '')}<div class="span2" id="repeat-days"><label>반복 요일</label>${multiple([[1, '월'], [2, '화'], [3, '수'], [4, '목'], [5, '금'], [6, '토'], [0, '일']].map(([x, y]) => [String(x), y]), 'weekdays', (r.repeat.weekdays || []).map(String))}</div>${targetForm(r.target)}${select('제출 방식', 'submissionMode', [['check', '단순 체크'], ['text', '글 제출'], ['photo', '사진 첨부']], r.submissionMode || 'check')}${checkbox('학급 친구들에게 제출물 공유', 'shareSubmissions', r.shareSubmissions)}${checkbox('칭찬 별점 부여하지 않음 (단순 체크리스트)', 'noStar', r.noStar)}${checkbox('장기과제', 'isQuest', r.isQuest)}<div id="quest-options" class="span2 formgrid">${input('마감일 (선택, 비워두면 무기한)', 'questEndDate', r.endDate || '', 'date')}${textarea('세부 항목 목록 (선택, 줄바꿈으로 구분)', 'questSubtasks', (r.questSubtasks || []).join('\n'))}${input('목표 횟수', 'questGoal', r.questGoal || 10, 'number', 'min="1" max="999" step="1"')}${input('완료 보상 칭호', 'questTitle', r.questTitle || '', 'text', 'maxlength="40"')}<small class="span2 muted">장기과제 도장은 교사가 확인합니다. 달성 보상 칭호는 영구 보존됩니다.</small></div>${textarea('메모(안내사항)', 'memo', r.memo || '')}${checkerPicker(r.checkerStudentId || '')}</div>`, async f => {
    const repeat = {
      type: f.get('isQuest') ? 'none' : f.get('repeat')
    };
    if (repeat.type === 'weekly') {
      repeat.weekdays = f.getAll('weekdays').map(Number);
      if (!repeat.weekdays.length) throw Error('요일을 선택하세요.');
    }
    const next = {
      ...r,
      title: f.get('title').trim(),
      date: f.get('date') || r.date,
      ...(f.get('isQuest') ? { endDate: f.get('questEndDate') || null } : {}),
      repeat,
      target: getTarget(f),
      statArea: f.get('statArea') || null,
      noStar: !!f.get('noStar'),
      submissionMode: ['check', 'text', 'photo'].includes(f.get('submissionMode')) ? f.get('submissionMode') : 'check',
      shareSubmissions: !!f.get('shareSubmissions'),
      isQuest: !!f.get('isQuest'),
      questGoal: Number(f.get('questGoal') || 10),
      questSubtasks: f.get('isQuest') ? [...new Set(String(f.get('questSubtasks') || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean))] : [],
      questTitle: String(f.get('questTitle') || '').trim(),
      memo: f.get('memo') || '',
      checkerStudentId: f.get('isQuest') ? null : f.get('checkerStudentId') || null
    };
    if (!next.title) throw Error('제목을 입력하세요.');
    if (next.checkerStudentId && !students().some(student => student.id === next.checkerStudentId)) throw Error('확인자 학생을 다시 선택하세요.');
    const states = db().assignmentStates.filter(s => s.assignmentId === next.id);
    if (next.isQuest) {
      next.questGoal = C.questGoal(next);
      if (next.endDate && next.endDate < next.date) throw Error('마감일은 시작일 이후로 입력하세요.');
      if (!next.questTitle) throw Error('완료 보상 칭호를 입력하세요.');
      if (next.questTitle.length > 40) throw Error('보상 칭호는 40자 이내로 입력하세요.');
    }
    if (states.length && !!a?.isQuest !== next.isQuest) throw Error('상태가 기록된 과제는 복사하여 새 장기과제로 등록하세요.');
    if (a?.isQuest && states.length && next.date !== a.date) throw Error('스탬프를 보존하려면 장기과제 시작일을 유지하세요.');
    const rewardOps = next.isQuest || !!a?.noStar === next.noStar ? [] : next.noStar ? db().records.filter(r => r.autoRef && states.some(s => s.id === r.autoRef)).map(r => ({
      table: 'records',
      id: r.id,
      remove: true
    })) : states.filter(s => C.targeted(next, s.studentId)).flatMap(s => C.taskStateOps(db(), next, s.date, s.studentId, s.status, s.memo || ''));
    const scratch = C.applyOps(db(), [up('assignments', next)]);
    const questOps = next.isQuest ? students().filter(s => C.targeted(next, s.id) && scratch.assignmentStates.some(st => st.assignmentId === next.id && st.studentId === s.id)).flatMap(s => C.questStampOps(scratch, next, state.date, s.id, 0)) : [];
    await commit([up('assignments', next), ...rewardOps, ...questOps]);
    closeModal();
  }, '저장', r.isQuest && db().assignments.some(item => item.id === r.id) ? btn('삭제', () => deleteLongAssignment(r), 'danger') : '');
  setupTarget();
  const questForm = $('#modal-form');
  const updateQuest = () => {
    const enabled = questForm.elements.isQuest.checked;
    $('#quest-options').hidden = !enabled;
    for (const input of $('#quest-options').querySelectorAll('input,textarea')) input.disabled = !enabled;
    questForm.elements.questTitle.required = enabled;
    const dateField = questForm.elements.date;
    dateField.closest('label').firstChild.textContent = enabled ? '시작일 (기본 오늘)' : '시작일 / 마감일';
    questForm.elements.repeat.closest('label').hidden = enabled;
    questForm.elements.repeat.disabled = enabled;
    if (enabled && !a) dateField.value = C.today();
    if (enabled) questForm.elements.repeat.value = 'none';
    syncQuestGoal();
    for (const input of questForm.querySelectorAll('[name=checkerStudentId]')) {
      input.disabled = enabled && !!input.value;
      if (enabled && !input.value) input.checked = true;
    }
  };
  const syncQuestGoal = () => {
    const items = [...new Set(questForm.elements.questSubtasks.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean))];
    questForm.elements.questGoal.readOnly = items.length > 0;
    if (items.length) questForm.elements.questGoal.value = items.length;
  };
  questForm.elements.questSubtasks.oninput = syncQuestGoal;
  if (a?.isQuest && db().assignmentStates.some(item => item.assignmentId === a.id)) questForm.elements.date.readOnly = true;
  questForm.elements.isQuest.onchange = updateQuest;
  updateQuest();
  const repeat = $('#modal-form').elements.repeat;
  const update = () => $('#repeat-days').hidden = repeat.value !== 'weekly';
  repeat.onchange = update;
  update();
}
export function assignmentsView() {
  const assignments = db().assignments.filter(a => !a.deletedAt);
  return `<div class="toolbar"><div><h2>과제</h2><small>과제 × 날짜 × 학생마다 상태가 독립적으로 저장됩니다.</small></div><div class="row"><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(state.date)) || '날짜 선택'}</span><input id="assignment-date" aria-label="과제 날짜" type="date" value="${state.date}"></span>${btn('+ 과제', () => assignmentEditor(), 'primary')}</div></div>${assignmentCalendar(assignments.filter(a => !a.isQuest))}${longAssignmentsPanel(assignments.filter(a => a.isQuest))}${bindLater('assignment-date', 'change', e => {
    state.date = e.target.value || C.today();
    assignmentMonth = state.date.slice(0, 7);
    render();
  })}`;
}
function longAssignmentsPanel(assignments) {
  return `<section class="panel long-assignments-panel"><div class="toolbar"><h3>장기과제</h3>${btn('+ 장기과제', () => assignmentEditor({ id: C.uid(), title: '', date: C.today(), repeat: { type: 'none' }, target: 'all', isQuest: true, questGoal: 10, questTitle: '', createdAt: C.now() }))}</div><div class="long-assignment-grid">${assignments.map(a => {
    const targets = students().filter(s => C.targeted(a,s.id));
    const complete = targets.filter(s => C.questProgress(db(),a,s.id).status === '완료').length;
    return `<article class="long-assignment-card"><div class="long-assignment-heading"><strong>${esc(a.title)}</strong> <span>(보상 : ${esc(a.questTitle || '없음')})</span>${a.endDate ? `<span class="long-assignment-deadline"> · 마감 : ${esc(C.formatShortDate(a.endDate))}</span>` : ''}</div><div class="long-assignment-bottom"><span class="long-assignment-count" aria-label="완료 ${complete}명 / 전체 ${targets.length}명">${complete}/${targets.length}</span><div class="long-assignment-actions">${btn('진행도/도장판', () => assignmentActions(a, state.date))}${btn('수정', () => assignmentEditor(a), 'record-edit')}${btn('삭제', () => deleteAssignment(a), 'danger record-delete')}</div></div></article>`;
  }).join('') || '<p class="muted">등록된 장기과제가 없습니다.</p>'}</div></section>`;
}
export function taskStateEditor(a, d, s, afterSave = null) {
  if (a.isQuest) {
    if (C.questSubtasks(a).length) return questSubtaskDialog(a, d, s, afterSave);
    const p = C.questProgress(db(), a, s);
    modal(name(s) + ' · ' + a.title, `${input('스탬프 수', 'stamps', p.stamps, 'number', `required min="0" max="${p.goal}" step="1"`)}${input('상태 메모', 'memo', db().assignmentStates.find(st => st.id === C.stateId(a.id, a.date, s))?.memo || '')}`, async f => {
      const n = Number(f.get('stamps'));
      if (!Number.isInteger(n) || n < 0 || n > p.goal) throw Error('스탬프 수를 확인하세요.');
      await commit(C.questStampOps(db(), a, d, s, n - C.questProgress(db(), a, s).stamps, f.get('memo')));
      if (afterSave) afterSave();else closeModal();
    });
    return;
  }
  const current = db().assignmentStates.find(x => x.id === C.stateId(a.id, d, s));
  modal(`${name(s)} · ${a.title}`, `<p class="muted">${esc(C.formatDate(d))}의 과제 · 완료 +1 · 안함 −1 · 늦게완료/진행중/면제 0</p>${C.excluded(db(), s, d) ? '<div class="notice">출결 제외일입니다. 상태는 보존되며 점수 집계에서는 제외됩니다.</div>' : ''}${select('상태', 'status', C.STATUSES, current?.status || '진행중')}${input('상태 메모 · 선택', 'memo', current?.memo || '')}`, async f => {
    await commit(C.taskStateOps(db(), a, d, s, f.get('status'), f.get('memo').trim()));
    if (afterSave) afterSave();else closeModal();
  });
}
export function taskQuickStatus(a, d, studentId) {
  if (a.isQuest) return taskStateEditor(a, d, studentId);
  let saving = false;
  modal(`${name(studentId)} · ${a.title}`, `<div class="task-quick-status">${C.STATUSES.map(status => btn(esc(status), async event => {
    if (saving) return;
    saving = true;
    const buttons = event.target.closest('.task-quick-status').querySelectorAll('button');
    buttons.forEach(button => button.disabled = true);
    try {
      const latest = db().assignments.find(item => item.id === a.id && !item.deletedAt);
      if (!latest) throw Error('과제를 확인하세요.');
      const current = db().assignmentStates.find(row => row.id === C.stateId(a.id, d, studentId));
      await commit(C.taskStateOps(db(), latest, d, studentId, status, current?.memo || ''));
      closeModal();
    } finally {
      saving = false;
      buttons.forEach(button => button.disabled = false);
    }
  }, 'task-quick-button task-status ' + (status === '완료' ? 'task-status-complete' : status === '안함' ? 'task-status-notdone' : 'task-status-pending'))).join('')}</div>`);
}
export function deleteAssignment(a, cutoffDate = state.date) {
  if (a.isQuest) return deleteLongAssignment(a);
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
  if (a.isQuest) {
    awaitQuestStamp(a, date, studentId, 1);
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
      list = assignments.filter(a => !a.isQuest && C.occurs(a, date));
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
  modal('과제 관리', `<h3>${esc(a.title)}</h3>${a.noStar ? badge('단순 체크리스트 · 별점 없음') : ''}${info.memo ? `<p class="assignment-public-memo">${esc(info.memo)}</p>` : ''}<p class="assignment-checker">🔍 확인 : ${info.checkerName ? esc(info.checkerName.replace(/^\d+\.\s*/, '')) : '선생님'}</p><p class="muted">${esc(C.formatDate(date))} · ${a.repeat.type === 'none' ? '1회' : a.repeat.type === 'daily' ? '매일' : '매주 ' + (a.repeat.weekdays || []).map(day => '일월화수목금토'[day]).join('·')}</p><div class="row">${btn('수정', () => assignmentEditor(a))}${btn('복사', () => assignmentEditor({
    ...a,
    id: C.uid(),
    createdAt: C.now(),
    date,
    deletedAt: null,
    endDate: null
  }))}${btn(a.isQuest ? '삭제' : '삭제/중단', () => deleteAssignment(a, date), 'danger')}</div>${assignmentProgress(a, date)}`);
  restoreAssignmentProgressScroll(scrollPosition);
}
function assignmentProgress(a, date) {
  const targets = students().filter(student => C.targeted(a, student.id));
  const eligible = a.isQuest ? targets : targets.filter(student => !C.excluded(db(), student.id, date));
  const completed = eligible.filter(student => ['완료', '늦게완료', '면제'].includes(C.assignmentStatus(db(), a.id, date, student.id))).length;
  return `<section class="assignment-progress" data-assignment-id="${esc(a.id)}" data-date="${esc(date)}"><div class="toolbar"><h3>학생 진행도 · 완료 ${completed}/${eligible.length}명</h3>${a.isQuest ? '<small>도장을 눌러 횟수를 늘리거나 줄이세요.</small>' : btn(eligible.length && completed === eligible.length ? '↩ 전원 미완료' : '✓ 전원 완료', async () => {
    await completeAll(a, date);
    refreshAssignmentProgress(a, date);
  }, 'complete-all', eligible.length ? '' : 'disabled')}${a.isQuest ? '' : btn('남은 진행중 전체 안함', () => markRemainingUndone(a, date), 'remaining-notdone')}</div><div class="assignment-progress-grid">${targets.map(student => {
    const status = C.assignmentStatus(db(), a.id, date, student.id),
      excluded = !a.isQuest && C.excluded(db(), student.id, date);
    if (a.isQuest) return `<div class="assignment-progress-item quest-progress-card${C.questProgress(db(), a, student.id).status === '완료' ? ' is-complete' : ''}"><strong>${esc(student.no)}. ${esc(C.studentLabel(student))}${excluded ? ' ' + badge('제외') : ''}</strong>${questControls(a, date, student.id)}</div>`;
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
function questControls(a, date, studentId) {
  const p = C.questProgress(db(), a, studentId),
    disabled = false;
  if (C.questSubtasks(a).length) return `<div class="quest-controls"><strong>🏅 ${p.stamps}/${p.goal}</strong>${btn('항목 도장판', () => questSubtaskDialog(a, date, studentId, () => assignmentActions(a, date)))}</div>`;
  return `<div class="quest-controls"><strong>🏅 ${p.stamps}/${p.goal}</strong>${btn('−', () => awaitQuestStamp(a, date, studentId, -1), '', disabled || p.stamps === 0 ? 'disabled' : '')}${btn('+ 도장', () => awaitQuestStamp(a, date, studentId, 1), '', disabled || p.stamps >= p.goal ? 'disabled' : '')}${btn('상세', () => taskStateEditor(a, date, studentId, () => assignmentActions(a, date)), '')}</div>`;
}
async function awaitQuestStamp(a, date, studentId, change) {
  const scope = assignmentScope();
  await persistAssignment(async () => {
    if (scope !== assignmentScope()) return;
    const ops = C.questStampOps(db(), a, date, studentId, change),
      award = ops.find(op => op.table === 'students');
    await commit(ops, award ? '🎉 ' + name(studentId) + ' · ' + a.questTitle + ' 칭호를 획득했어요!' : '스탬프를 저장했습니다.');
    refreshAssignmentProgress(a, date);
  });
}

function questSubtaskDialog(a, date, studentId, afterSave) {
  const latest = db().assignments.find(item => item.id === a.id && !item.deletedAt);
  if (!latest || !C.targeted(latest, studentId)) throw Error('장기과제 대상 학생을 확인하세요.');
  const p = C.questProgress(db(), latest, studentId);
  modal(name(studentId) + ' · ' + latest.title, `<section class="quest-subtask-editor"><p>🏅 ${p.stamps}/${p.goal} · 원하는 항목을 자유롭게 체크하거나 해제하세요.</p><div class="quest-subtask-buttons">${p.questSubtasks.map(item => {
    const checked = p.completedSubtasks.includes(item);
    return btn((checked ? '✅ ' : '○ ') + esc(item) + (checked && p.completedSubtaskDates[item] ? ` <small>(${esc(C.formatShortDate(p.completedSubtaskDates[item]))})</small>` : ''), async () => {
      const scope = assignmentScope();
      await persistAssignment(async () => {
        if (scope !== assignmentScope()) return;
        const current = db().assignments.find(row => row.id === latest.id && !row.deletedAt);
        if (!current) throw Error('장기과제를 확인하세요.');
        const ops = C.questSubtaskOps(db(), current, C.today(), studentId, item, !C.questProgress(db(), current, studentId).completedSubtasks.includes(item));
        await commit(ops, '항목 도장을 저장했습니다.');
        questSubtaskDialog(current, date, studentId, afterSave);
      });
    }, 'quest-subtask-toggle' + (checked ? ' is-complete' : ''), `aria-pressed="${checked}"`);
  }).join('')}</div>${afterSave ? btn('진행도로 돌아가기', afterSave) : ''}</section>`);
}

async function deleteLongAssignment(a) {
  if (!confirm('이 장기과제를 삭제할까요? 학생들의 스탬프 기록도 함께 삭제됩니다.')) return;
  await commit(C.deleteLongAssignmentOps(db(), a.id));
  closeModal();
}
