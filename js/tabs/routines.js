import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, name, students, up } from '../shared/data.js';
import { state } from '../shared/state.js';
import { bindLater, btn, empty, esc, input, select } from '../shared/ui.js';
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
export function routinesView() {
  const routines = db().routines.filter(r => !r.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  return `<div class="toolbar"><div><h2>루틴</h2><small>날짜가 바뀌면 새 체크로 시작합니다. 루틴 체크에는 별 점수를 부여하지 않습니다.</small></div><div class="row"><input aria-label="루틴 날짜" type="date" id="routine-date" value="${state.date}">${btn('+ 루틴', () => routineEditor(), 'primary')}</div></div>${routines.map(r => `<section class="panel"><div class="toolbar"><h3>${esc(r.title)}</h3><div class="row">${['진행중', '완료', '면제'].map(status => btn(status === '진행중' ? '전체 리셋' : '전체 ' + status, async () => {
    if (!confirm(`${r.title}: ${state.date} 대상 학생 전체를 ${status}으로 바꿀까요?`)) return;
    const ops = students().filter(s => C.targeted(r, s.id) && !C.excluded(db(), s.id, state.date)).map(s => up('routineStates', {
      id: C.stateId(r.id, state.date, s.id),
      routineId: r.id,
      date: state.date,
      studentId: s.id,
      status,
      updatedAt: C.now()
    }));
    await commit(ops);
  })).join('')}${btn('수정', () => routineEditor(r))}${btn('삭제', async () => {
    if (confirm('루틴을 삭제할까요? 기존 체크 이력은 보존합니다.')) await commit([up('routines', {
      ...r,
      deletedAt: C.now()
    })]);
  }, 'danger')}</div></div><div class="checkgrid">${students().filter(s => C.targeted(r, s.id)).map(s => {
    const status = C.routineStatus(db(), r.id, state.date, s.id);
    return btn(`${status === '완료' ? '☑' : status === '면제' ? '—' : '☐'} ${esc(name(s.id))}`, () => {
      modal(r.title + ' · ' + name(s.id), select('상태', 'status', ['진행중', '완료', '면제'], status), async f => {
        await setRoutine(r, state.date, s.id, f.get('status'));
        closeModal();
      });
    }, status === '진행중' ? '' : 'primary');
  }).join('')}</div></section>`).join('') || empty('매일 확인할 루틴을 등록하세요.', '연산, 독서, 일기장 제출 등 학급에 맞게 자유롭게 만들 수 있습니다.')}${bindLater('routine-date', 'change', e => {
    state.date = e.target.value || C.today();
    render();
  })}`;
}
