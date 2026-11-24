import { render, setScheduleManage } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, name, students, up } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, bindLater, btn, empty, esc, input, select, toast } from '../shared/ui.js';
import { getTarget, setupTarget, targetForm } from './assignments.js';
export function routineEditor(r = null) {
  const row = r || {
    id: C.uid(),
    title: '',
    target: 'all',
    sortOrder: db().routines.length,
    createdAt: C.now()
  };
  modal(r ? '루틴 수정' : '새 루틴', `<div class="formgrid">${input('루틴 제목', 'title', row.title, 'text', 'required')}${input('정렬 순서', 'sortOrder', row.sortOrder, 'number')}${targetForm(row.target)}</div>`, async f => {
    await commit([up('routines', {
      ...row,
      title: f.get('title').trim(),
      sortOrder: Number(f.get('sortOrder')),
      target: getTarget(f)
    })]);
    closeModal();
  });
  setupTarget();
}
export async function setRoutine(r, d, s, status) {
  const row = {
    id: C.stateId(r.id, d, s),
    routineId: r.id,
    date: d,
    studentId: s,
    status,
    updatedAt: C.now()
  };
  await commit([up('routineStates', row)], '');
}
let routineMonth = '';
export function routinesView(embedded = false) {
  const routines = db().routines.filter(r => !r.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!routineMonth) routineMonth = state.date.slice(0, 7);
  return `<div class="toolbar"><div>${embedded ? '<h3>루틴 전체 목록</h3>' : '<h2>루틴</h2>'}<small>반복할 루틴과 날짜별 예외를 관리합니다. 점수에는 영향을 주지 않습니다.</small></div>${btn('+ 루틴', () => routineEditor(), 'primary')}</div><section class="panel"><div class="toolbar"><h3>${esc(routineMonth.replace('-', '.'))}</h3><div class="row">${btn('이전 달', () => changeRoutineMonth(-1))}${btn('오늘', () => {
    state.date = C.today();
    routineMonth = state.date.slice(0, 7);
    render();
  })}${btn('다음 달', () => changeRoutineMonth(1))}</div></div>${routineCalendar(routines)}</section><section class="panel"><div class="toolbar"><h3>루틴 목록</h3><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(state.date)) || '날짜 선택'}</span><input aria-label="루틴 날짜" type="date" id="routine-date" value="${state.date}"></span></div><div class="table-wrap"><table class="routine-table"><thead><tr><th>루틴</th><th>대상</th><th>선택일 진행</th><th>관리</th></tr></thead><tbody>${routines.map(r => {
    const target = students().filter(s => C.targeted(r, s.id) && !C.excluded(db(), s.id, state.date)),
      done = target.filter(s => C.routineStatus(db(), r.id, state.date, s.id) === '완료').length;
    const exception = r.exceptions?.[state.date];
    return `<tr><td>${esc(r.title)}</td><td>${r.target === 'all' ? '전체' : target.length + '명'}</td><td>${exception?.exempt ? '쉬는 날 · ' + esc(exception.memo || '') : done + ' / ' + target.length + '명 완료'}</td><td><div class="row">${['진행중', '완료', '면제'].map(status => btn(status === '진행중' ? '전체 리셋' : '전체 ' + status, () => bulkRoutine(r, status), '', exception?.exempt ? 'disabled' : '')).join('')}${btn('수정', () => routineEditor(r))}${btn('삭제', async () => {
      if (confirm('루틴을 삭제할까요? 기존 체크 이력은 보존합니다.')) await commit([up('routines', {
        ...r,
        deletedAt: C.now()
      })]);
    }, 'danger')}</div></td></tr>`;
  }).join('')}</tbody></table></div>${!routines.length ? empty('매일 확인할 루틴을 등록하세요.') : ''}</section>${routines.length ? exceptionEditor(routines) : ''}${bindLater('routine-date', 'change', e => {
    state.date = e.target.value || C.today();
    routineMonth = state.date.slice(0, 7);
    render();
  })}`;
}
function changeRoutineMonth(delta) {
  const date = new Date(routineMonth + '-01T12:00Z');
  date.setUTCMonth(date.getUTCMonth() + delta);
  routineMonth = date.toISOString().slice(0, 7);
  render();
}
function routineCalendar(routines) {
  const first = routineMonth + '-01',
    offset = (C.weekday(first) + 6) % 7,
    start = C.addDays(first, -offset);
  return `<div class="routine-calendar">${['월', '화', '수', '목', '금', '토', '일'].map(d => `<div class="weekday">${d}</div>`).join('')}${Array.from({
    length: 42
  }, (_, i) => {
    const d = C.addDays(start, i);
    const items = routines.map(r => {
      const target = students().filter(s => C.targeted(r, s.id) && !C.excluded(db(), s.id, d));
      const done = target.filter(s => C.routineStatus(db(), r.id, d, s.id) === '완료').length;
      const exempt = r.exceptions?.[d]?.exempt;
      return `<span class="routine-calendar-pill ${exempt ? 'exempt' : target.length && done === target.length ? 'done' : ''}">${esc(r.title)}<small>${exempt ? '쉬는 날' : done + '/' + target.length}</small></span>`;
    }).join('');
    return btn(`<strong>${Number(d.slice(-2))}</strong>${items}`, () => {
      state.date = d;
      routineMonth = d.slice(0, 7);
      render();
    }, 'routine-day' + (d === state.date ? ' selected' : '') + (d.slice(0, 7) !== routineMonth ? ' faded' : ''), `aria-label="${C.formatDate(d)} 루틴 예외" aria-pressed="${d === state.date}"`);
  }).join('')}</div>`;
}
export async function bulkRoutine(r, status) {
  if (!confirm(`${r.title}: ${C.formatDate(state.date)} 대상 학생 전체를 ${status}으로 바꿀까요?`)) return;
  const target = students().filter(s => C.targeted(r, s.id) && !C.excluded(db(), s.id, state.date));
  if (r.exceptions?.[state.date]?.exempt) return toast('쉬는 날에는 기존 체크 이력을 변경하지 않습니다.');
  await commit(target.map(s => up('routineStates', {
    id: C.stateId(r.id, state.date, s.id),
    routineId: r.id,
    date: state.date,
    studentId: s.id,
    status,
    updatedAt: C.now()
  })));
}
function exceptionEditor(routines) {
  return `<section class="panel"><h3>${esc(C.formatDate(state.date))} 예외 설정</h3><form id="routine-exception" class="row">${select('루틴', 'routineId', routines.map(r => [r.id, r.title]), routines[0].id)}${select('이날 처리', 'exempt', [['true', '쉬는 날 · 자동 면제'], ['false', '정상 진행']], routines[0].exceptions?.[state.date]?.exempt ? 'true' : 'false')}${input('사유', 'memo', routines[0].exceptions?.[state.date]?.memo || '', 'text', 'placeholder="체험학습 등"')}<button type="submit" class="primary">예외 적용</button></form>${bindLater('routine-exception', 'change', e => {
    if (e.target.name !== 'routineId') return;
    const r = routines.find(r => r.id === e.target.value),
      f = e.currentTarget;
    f.elements.exempt.value = r.exceptions?.[state.date]?.exempt ? 'true' : 'false';
    f.elements.memo.value = r.exceptions?.[state.date]?.memo || '';
  })}${bindLater('routine-exception', 'submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target),
      r = db().routines.find(r => r.id === f.get('routineId'));
    if (!r || r.deletedAt) throw Error('루틴을 다시 선택하세요.');
    const exceptions = {
      ...r.exceptions
    };
    if (f.get('exempt') === 'true') exceptions[state.date] = {
      exempt: true,
      memo: f.get('memo').trim()
    };else delete exceptions[state.date];
    await commit([up('routines', {
      ...r,
      exceptions
    })]);
  })}</section>`;
}

// 선택 날짜의 루틴을 일정 탭 오른쪽 카드에서 바로 체크한다.
export async function saveRoutineException(r, d, exempt, memo = '') {
  const exceptions = { ...r.exceptions };
  if (exempt) exceptions[d] = { exempt: true, memo: memo || '' };
  else delete exceptions[d];
  await commit([up('routines', { ...r, exceptions })]);
}
export function routineExceptionDialog(r, d) {
  const current = r.exceptions?.[d];
  modal(`${r.title} · ${C.formatDate(d)} 예외`, `<p class="muted">쉬는 날로 정하면 그 날짜의 루틴은 자동 면제되고, 이미 저장된 체크 이력은 바뀌지 않습니다.</p><label class="inline"><input type="checkbox" name="exempt" ${current?.exempt ? 'checked' : ''}>쉬는 날로 설정</label>${input('사유', 'memo', current?.memo || '', 'text', 'placeholder="체험학습 등"')}`, async f => {
    await saveRoutineException(r, d, !!f.get('exempt'), String(f.get('memo') || '').trim());
    closeModal();
  }, '저장');
}
function routineRow(r, d, expanded) {
  const exception = r.exceptions?.[d],
    target = students().filter(s => C.targeted(r, s.id) && !C.excluded(db(), s.id, d)),
    done = target.filter(s => C.routineStatus(db(), r.id, d, s.id) === '완료').length,
    exempt = !!exception?.exempt;
  return `<article class="schedule-routine${exempt ? ' is-exempt' : ''}" data-schedule-routine="${esc(r.id)}">
    <div class="schedule-routine-head"><strong>${esc(r.title)}</strong><span class="schedule-routine-count">${exempt ? '🚫 쉬는 날' : '완료 ' + done + '/' + target.length}</span></div>
    <div class="row schedule-routine-actions">${exempt ? btn('쉬는 날 해제', () => saveRoutineException(r, d, false)) : [btn('전체 완료', () => bulkRoutine(r, '완료')), btn('전체 면제', () => bulkRoutine(r, '면제')), btn('리셋', () => bulkRoutine(r, '진행중'))].join('')}${btn(exempt ? '사유 보기' : '쉬는 날', () => routineExceptionDialog(r, d), 'schedule-routine-exempt')}${btn(expanded ? '학생 접기' : '학생 체크', () => {
    state.scheduleRoutineOpen = { ...(state.scheduleRoutineOpen || {}), [r.id]: !expanded };
    render();
  }, 'schedule-task-toggle', `aria-expanded="${expanded}"`)}</div>
    ${exception?.memo ? `<small class="muted schedule-routine-memo">${esc(exception.memo)}</small>` : ''}
    ${expanded ? `<div class="schedule-routine-students">${target.map(student => {
    const status = C.routineStatus(db(), r.id, d, student.id);
    return btn(`${student.no}. ${esc(student.name)}`, () => setRoutine(r, d, student.id, status === '완료' ? '진행중' : '완료'), 'routine-student' + (status === '완료' ? ' is-done' : ''), `aria-pressed="${status === '완료'}" data-routine-student="${esc(student.id)}"`);
  }).join('') || '<p class="muted">대상 학생이 없습니다.</p>'}</div>` : ''}
  </article>`;
}
export function scheduleRoutinesCard() {
  const d = state.date,
    open = state.scheduleRoutineOpen || {},
    manage = state.scheduleManage === '루틴',
    routines = db().routines.filter(r => !r.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  return `<section class="panel schedule-card schedule-card-routines" aria-labelledby="schedule-routines-title">
    <div class="schedule-card-head"><h3 id="schedule-routines-title">루틴 <small>${esc(C.formatDate(d))}</small></h3><div class="row schedule-card-actions">${btn('+ 루틴', () => routineEditor(), 'primary schedule-add')}${btn(manage ? '전체 관리 닫기' : '전체 관리', () => setScheduleManage(manage ? '' : '루틴'), 'schedule-manage-toggle' + (manage ? ' is-active' : ''), `aria-expanded="${manage}" aria-controls="schedule-manage"`)}</div></div>
    <div class="schedule-routine-list">${routines.map(r => routineRow(r, d, !!open[r.id])).join('') || '<p class="muted schedule-empty">등록된 루틴이 없습니다. + 루틴으로 추가하세요.</p>'}</div>
  </section>`;
}
