import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, name, students, up } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, badge, bindLater, btn, empty, esc, input, multiple, select } from '../shared/ui.js';
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
    statArea: '과제',
    createdAt: C.now()
  };
  modal(a ? '과제 수정' : '새 과제', `<div class="formgrid">${input('과제 제목', 'title', r.title, 'text', 'required')}${input('시작일 / 마감일', 'date', r.date, 'date', 'required')}${select('반복', 'repeat', [['none', '없음'], ['daily', '매일'], ['weekly', '매주 요일 지정']], r.repeat.type)}${select('경험치 영역', 'statArea', [['', '미지정'], ...C.AREAS], r.statArea || '')}<div class="span2" id="repeat-days"><label>반복 요일</label>${multiple([[1, '월'], [2, '화'], [3, '수'], [4, '목'], [5, '금'], [6, '토'], [0, '일']].map(([x, y]) => [String(x), y]), 'weekdays', (r.repeat.weekdays || []).map(String))}</div>${targetForm(r.target)}</div>`, async f => {
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
      statArea: f.get('statArea') || null
    };
    if (!next.title) throw Error('제목을 입력하세요.');
    await commit([up('assignments', next)]);
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
  return `<div class="toolbar"><div><h2>과제</h2><small>과제 × 날짜 × 학생마다 상태가 독립적으로 저장됩니다.</small></div><div class="row"><input id="assignment-date" aria-label="과제 날짜" type="date" value="${state.date}">${btn('+ 과제', () => assignmentEditor(), 'primary')}</div></div><section class="panel"><h3>${esc(state.date)} 과제 상태</h3>${daily.length ? `<div class="table-wrap"><table><thead><tr><th>학생</th>${daily.map(a => `<th>${esc(a.title)}</th>`).join('')}</tr></thead><tbody>${students().map(s => `<tr><th>${esc(name(s.id))}${C.excluded(db(), s.id, state.date) ? badge('제외') : ''}</th>${daily.map(a => {
    const state = db().assignmentStates.find(x => x.id === C.stateId(a.id, state.date, s.id));
    return `<td>${C.targeted(a, s.id) ? btn(esc(state?.status || '진행중'), () => taskStateEditor(a, state.date, s.id), state?.status === '안함' ? 'danger' : '') + `<div class="muted">${esc(state?.memo || '')}</div>` : '—'}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>` : empty('이 날짜에 등록된 과제가 없습니다.', '새 과제를 등록하거나 날짜를 바꾸세요.')}</section><section class="panel"><h3>등록한 과제</h3>${assignments.map(a => `<div class="record"><div class="row between"><div><strong>${esc(a.title)}</strong> ${badge(a.repeat.type === 'none' ? '1회' : a.repeat.type === 'daily' ? '매일' : '매주 ' + a.repeat.weekdays.map(n => '일월화수목금토'[n]).join('·'))}<div class="muted">${esc(a.date)}${a.endDate ? ' ~ ' + esc(a.endDate) : ''} · ${a.target === 'all' ? '전체 학생' : esc(a.target.studentIds.map(name).join(', '))} · ${esc(a.statArea || '영역 미지정')}</div></div><div class="row">${btn('수정', () => assignmentEditor(a))}${btn('복사', () => assignmentEditor({
    ...a,
    id: C.uid(),
    createdAt: C.now(),
    date: state.date,
    deletedAt: null,
    endDate: null
  }))}${btn('삭제/중단', () => deleteAssignment(a), 'danger')}</div></div></div>`).join('') || empty('등록한 과제가 없습니다.')}</section>${bindLater('assignment-date', 'change', e => {
    state.date = e.target.value || C.today();
    render();
  })}`;
}
export function taskStateEditor(a, d, s) {
  const current = db().assignmentStates.find(x => x.id === C.stateId(a.id, d, s));
  modal(`${name(s)} · ${a.title}`, `<p class="muted">${esc(d)}의 과제 · 완료/늦게완료 +1 · 안함 −1 · 진행중/면제 0</p>${C.excluded(db(), s, d) ? '<div class="notice">출결 제외일입니다. 상태는 보존되며 점수 집계에서는 제외됩니다.</div>' : ''}${select('상태', 'status', C.STATUSES, current?.status || '진행중')}${input('상태 메모 · 선택', 'memo', current?.memo || '')}`, async f => {
    await commit(C.taskStateOps(db(), a, d, s, f.get('status'), f.get('memo').trim()));
    closeModal();
  });
}
export function deleteAssignment(a) {
  modal('과제 삭제 / 반복 중단', `<p>${esc(a.title)}</p>${select('처리 방식', 'mode', [['future', state.date + '부터 앞으로만 중단 · 이전 상태/기록 보존'], ['all', '과제와 모든 상태·자동 기록을 삭제']], 'future')}`, async f => {
    if (!confirm('선택한 방식으로 처리할까요?')) return;
    const all = f.get('mode') === 'all';
    const cutoff = state.date;
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
    for (const state of states) {
      ops.push({
        table: 'assignmentStates',
        id: state.id,
        remove: true
      });
      for (const r of db().records.filter(r => r.autoRef === state.id)) ops.push({
        table: 'records',
        id: r.id,
        remove: true
      });
    }
    await commit(ops);
    closeModal();
  });
}
