import { render } from '../app.js';
import * as C from '../core.js';
import { commit, db, settings, students, up } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, badge, bindLater, btn, empty, esc, toast } from '../shared/ui.js';
import { taskStateEditor } from './assignments.js';
import { newRecord } from './records.js';
import { setRoutine } from './routines.js';
import { studentDetail } from './students.js';
import { dayEditor, periodInfo, timeSlots } from './timetable.js';
export function weekSummary() {
  const start = C.addDays(state.date, -((C.weekday(state.date) + 6) % 7)),
    end = C.addDays(start, 4);
  return [...db().events.filter(e => e.date >= start && e.date <= end).map(e => `${e.date.slice(5)} ${e.title}`), ...db().timetables.filter(t => t.date >= start && t.date <= end && periodInfo(t).type !== '일반').map(t => `${t.date.slice(5)} ${t.period}교시 ${t.subjectCode} ${periodInfo(t).type}`)].join(' · ') || '등록된 특이사항 없음';
}
export function dashboard() {
  if (state.dashMode !== 'normal') return checkView();
  const list = students();
  const completed = list.filter(s => !isUnfinished(s.id, state.date) && !C.excluded(db(), s.id, state.date)).length;
  return `<div class="toolbar"><div><h2>${esc(settings().className)}의 하루</h2><small>${esc(state.date)} · 작은 기록이 모여 성장이 됩니다.</small></div><div class="row"><input aria-label="대시보드 날짜" type="date" value="${state.date}" id="dash-date">${btn('오늘', () => {
    state.date = C.today();
    render();
  })}${btn(state.compact ? '자세히' : '컴팩트', () => {
    state.compact = !state.compact;
    render();
  })}${btn('체크', () => {
    state.dashMode = 'check';
    state.checks = new Set(list.map(s => s.id));
    render();
  })}${btn('출결', () => {
    state.dashMode = 'attendance';
    render();
  })}</div></div><section class="panel"><div class="row between"><div class="row"><strong>오늘 일정</strong>${db().events.filter(e => e.date === state.date && e.period == null).map(e => btn(esc(e.title), () => dayEditor(state.date, '일정', null, e), 'event')).join('') || '<span class="muted">오늘 일정 없음</span>'}${db().events.filter(e => e.isDday).sort((a, b) => a.date.localeCompare(b.date)).map(e => badge(e.title + ' ' + C.dday(e.date, state.date))).join('')}</div>${btn('+ 일정', () => dayEditor(state.date))}</div><div class="schedule" style="margin-top:12px">${timeSlots(state.date)}</div><div class="ticker">이번 주 특이사항 · ${esc(weekSummary())}</div></section><div class="summary"><div class="metric"><small>오늘 함께하는 학생</small><strong>${list.filter(s => !C.excluded(db(), s.id, state.date)).length}<small> / ${list.length}명</small></strong></div><div class="metric"><small>할 일을 모두 마친 학생</small><strong>${completed}<small>명</small></strong></div><div class="metric"><small>오늘 남긴 기록</small><strong>${db().records.filter(r => r.date === state.date).length}<small>건</small></strong></div></div><div class="toolbar"><strong>우리 반 학생 <span class="muted">${list.length}명</span></strong><small>카드를 눌러 함께 기록 · ⋯ 버튼으로 개별 보기</small></div><section class="${state.compact ? 'compact' : ''}"><div class="students">${list.map(studentCard).join('')}</div></section>${!list.length ? empty('아직 등록된 학생이 없습니다.', '설정에서 명단을 붙여 넣거나 학생을 추가하세요.') : ''}${bindLater('dash-date', 'change', e => {
    state.date = e.target.value || C.today();
    render();
  })}`;
}
export function isUnfinished(id, d) {
  if (C.excluded(db(), id, d)) return false;
  return C.pending(db(), id, d).length > 0 || db().routines.some(r => !r.deletedAt && C.targeted(r, id) && C.routineStatus(db(), r.id, d, id) === '진행중');
}
export function studentCard(s) {
  const missing = C.pending(db(), s.id, state.date),
    ex = C.excluded(db(), s.id, state.date),
    score = C.scores(db(), s.id, state.date, state.date),
    routines = db().routines.filter(r => !r.deletedAt && C.targeted(r, s.id)),
    recent = db().records.filter(r => r.studentIds.includes(s.id) && r.date <= state.date).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
  const id = String(++state.actionNo);
  state.actions.set(id, () => {
    state.selected = state.selected.includes(s.id) ? state.selected.filter(x => x !== s.id) : [...state.selected, s.id];
    render();
  });
  return `<article role="button" tabindex="0" aria-pressed="${state.selected.includes(s.id)}" data-action="${id}" class="student ${isUnfinished(s.id, state.date) ? 'unfinished' : ''} ${state.selected.includes(s.id) ? 'selected' : ''} ${ex ? 'excluded' : ''}"><div class="student-head"><strong>${esc(s.no)}. ${esc(s.name)}</strong>${btn('⋯', () => studentDetail(s.id), '', 'aria-label="' + esc(s.name) + ' 상세 보기"')}</div>${ex ? badge('제외') : ''}<div class="score">★${score.total} <small>${C.AREAS.filter(a => score.areas[a]).map(a => esc(a) + score.areas[a]).join(' ') || '기록 없음'}</small></div>${missing.slice(0, 2).map(({
    assignment: a,
    date: d
  }) => btn(`${d < state.date ? '이전 · ' : ''}${esc(a.title)}`, () => taskStateEditor(a, d, s.id), 'task ' + (d < state.date ? 'overdue' : ''))).join('')}${routines.slice(0, 2).map(r => btn(`${C.routineStatus(db(), r.id, state.date, s.id) === '완료' ? '☑' : C.routineStatus(db(), r.id, state.date, s.id) === '면제' ? '—' : '☐'} ${esc(r.title)}`, () => setRoutine(r, state.date, s.id, C.routineStatus(db(), r.id, state.date, s.id) === '완료' ? '진행중' : '완료'), 'task')).join('')}<div class="detail">${esc(recent?.text || '아직 기록이 없습니다.')}</div></article>`;
}
export function checkView() {
  const list = students(),
    attendance = state.dashMode === 'attendance',
    missing = list.filter(s => !state.checks.has(s.id)),
    ex = list.filter(s => C.excluded(db(), s.id, state.date));
  return `<div class="toolbar"><h2>${attendance ? '출결 · 제외 표시' : '빠른 인원 점검'}</h2><div class="row">${!attendance ? btn('전원 체크', () => {
    state.checks = new Set(list.map(s => s.id));
    render();
  }) + btn('전원 해제', () => {
    state.checks.clear();
    render();
  }) : ''}${btn('끝내기', () => {
    state.dashMode = 'normal';
    render();
  }, 'primary')}</div></div><div class="panel"><p>${attendance ? '그날 기록·집계에서 제외할 학생을 선택하세요. 표시를 다시 누르면 복귀합니다. 기존 자료는 삭제되지 않습니다.' : '임시 점검입니다. 끝내기를 누르면 기록 없이 돌아갑니다.'}</p><strong>${attendance ? `총 ${list.length}명 중 ${list.length - ex.length}명 · 제외: ${esc(ex.map(s => s.name).join(', ') || '없음')}` : `총 ${list.length}명 중 ${state.checks.size}명 체크 · 미체크: ${esc(missing.map(s => s.name).join(', ') || '없음')}`}</strong></div><div class="check-mode students">${list.map(s => {
    const checked = attendance ? C.excluded(db(), s.id, state.date) : state.checks.has(s.id);
    return btn(`${checked ? '✓ ' : ''}${esc(s.no)}. ${esc(s.name)}`, async () => {
      if (attendance) {
        const row = {
          id: C.stateId('attendance', state.date, s.id),
          studentId: s.id,
          date: state.date,
          excluded: !checked
        };
        await commit([up('attendance', row)], '');
      } else {
        checked ? state.checks.delete(s.id) : state.checks.add(s.id);
        render();
      }
    }, 'student ' + (attendance ? checked ? 'excluded' : '' : checked ? 'checked' : ''));
  }).join('')}</div>${!attendance ? `<div class="panel" style="margin-top:16px"><label>점검 장소<input id="check-place" placeholder="예: 도서관"></label>${btn('미체크 명단을 관찰 기록으로 남기기', async () => {
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
  })}</div>` : ''}`;
}
