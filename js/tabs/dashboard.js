import { render } from '../app.js';
import * as C from '../core.js';
import { commit, db, settings, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, badge, bindLater, btn, empty, esc, toast, input, select, textarea, multiple } from '../shared/ui.js';
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
    enterChecklist();
    render();
  })}${btn('출결', () => {
    state.dashMode = 'attendance';
    render();
  })}</div></div>${announcementEditor()}<section class="panel"><div class="row between"><div class="row"><strong>오늘 일정</strong>${db().events.filter(e => e.date === state.date && e.period == null).map(e => btn(esc(e.title), () => dayEditor(state.date, '일정', null, e), 'event')).join('') || '<span class="muted">오늘 일정 없음</span>'}${db().events.filter(e => e.isDday).sort((a, b) => a.date.localeCompare(b.date)).map(e => badge(e.title + ' ' + C.dday(e.date, state.date))).join('')}</div>${btn('+ 일정', () => dayEditor(state.date))}</div><div class="schedule" style="margin-top:12px">${timeSlots(state.date)}</div><div class="ticker">이번 주 특이사항 · ${esc(weekSummary())}</div></section><div class="summary"><div class="metric"><small>오늘 함께하는 학생</small><strong>${list.filter(s => !C.excluded(db(), s.id, state.date)).length}<small> / ${list.length}명</small></strong></div><div class="metric"><small>할 일을 모두 마친 학생</small><strong>${completed}<small>명</small></strong></div><div class="metric"><small>오늘 남긴 기록</small><strong>${db().records.filter(r => r.date === state.date).length}<small>건</small></strong></div></div><div class="toolbar"><strong>우리 반 학생 <span class="muted">${list.length}명</span></strong><small>카드를 눌러 함께 기록 · ⋯ 버튼으로 개별 보기</small></div><section class="${state.compact ? 'compact' : ''}"><div class="students">${list.map(studentCard).join('')}</div></section>${!list.length ? empty('아직 등록된 학생이 없습니다.', '설정에서 명단을 붙여 넣거나 학생을 추가하세요.') : ''}${bindLater('dash-date', 'change', e => {
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
  return `<article role="button" tabindex="0" aria-pressed="${state.selected.includes(s.id)}" data-action="${id}" class="student ${isUnfinished(s.id, state.date) ? 'unfinished' : ''} ${state.selected.includes(s.id) ? 'selected' : ''} ${ex ? 'excluded' : ''}"><div class="student-head"><strong>${esc(s.no)}. ${esc(s.name)}</strong>${btn('⋯', () => studentDetail(s.id), '', 'aria-label="' + esc(s.name) + ' 상세 보기"')}</div>${ex ? badge('제외') : ''}<div class="score">★${score.total} <small>${C.areaNames(db(), true).filter(a => score.areas[a]).map(a => esc(a) + score.areas[a]).join(' ') || '기록 없음'}</small></div>${missing.slice(0, 2).map(({
    assignment: a,
    date: d
  }) => btn(`${d < state.date ? '이전 · ' : ''}${esc(a.title)}`, () => taskStateEditor(a, d, s.id), 'task ' + (d < state.date ? 'overdue' : ''))).join('')}${routines.slice(0, 2).map(r => btn(`${C.routineStatus(db(), r.id, state.date, s.id) === '완료' ? '☑' : C.routineStatus(db(), r.id, state.date, s.id) === '면제' ? '—' : '☐'} ${esc(r.title)}`, () => setRoutine(r, state.date, s.id, C.routineStatus(db(), r.id, state.date, s.id) === '완료' ? '진행중' : '완료'), 'task')).join('')}<div class="detail">${esc(recent?.text || '아직 기록이 없습니다.')}</div></article>`;
}
const checkDrafts = new Map();
let bulkScope = '',
  bulkReason = '',
  bulkAreas = [];
const recordKinds = [['칭찬', '👏 칭찬', 'praise'], ['관찰', '📝 기록', 'note'], ['추가기록', '➕ 추가 기록', 'extra'], ['지도', '⚠️ 조언', 'advice']];
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
    kind,
    areas: validAreas,
    extraType: kind === '추가기록' ? '메모' : null,
    printIncluded: kind !== '추가기록'
  }))));
}
export function renderBulkBar() {
  const scope = `${store.mode}:${store.classId}:${settings().academicYear}:${state.date}`;
  if (scope !== bulkScope) {
    bulkScope = scope;
    bulkReason = '';
    bulkAreas = [];
  }
  if (!state.selected.length || state.dashMode !== 'normal') return '';
  bulkAreas = bulkAreas.filter(a => C.areaNames(db()).includes(a));
  return `<aside class="bulkbar bulk-compose" aria-label="선택 학생 일괄 기록"><strong>선택된 ${state.selected.length}명</strong><input id="bulk-reason" aria-label="일괄 기록 사유" placeholder="사유 입력" value="${esc(bulkReason)}">${bindLater('bulk-reason', 'input', e => {
    bulkReason = e.target.value;
  })}<div class="chips area-chips" role="group" aria-label="경험치 영역">${C.areaNames(db()).map(a => btn(esc(a), () => {
    bulkReason = $('#bulk-reason').value;
    bulkAreas = bulkAreas.includes(a) ? bulkAreas.filter(x => x !== a) : [...bulkAreas, a];
    render();
  }, bulkAreas.includes(a) ? 'area-chip selected' : 'area-chip', `aria-pressed="${bulkAreas.includes(a)}"`)).join('')}</div><div class="record-actions">${recordButtons(async kind => {
    bulkReason = $('#bulk-reason').value;
    await saveDirectRecords(kind, bulkReason, state.selected, bulkAreas);
    bulkReason = '';
    bulkAreas = [];
    state.selected = [];
    render();
  })}</div></aside>`;
}
export function announcementView() {
  const n = settings().announcement;
  if (!n?.text) return '';
  const sizes = {
      normal: 24,
      large: 36,
      huge: 52
    },
    colors = {
      default: '#1E293B',
      red: '#B91C1C',
      blue: '#1D4ED8',
      yellow: '#FFE066'
    };
  return `<section class="class-announcement" aria-label="공지사항" style="font-size:${sizes[n.size] || 24}px;color:${colors[n.color] || colors.default};background:${n.color === 'yellow' ? '#0F172A' : '#FFFFFF'};white-space:pre-wrap;padding:20px;border-radius:12px;margin-bottom:16px;font-weight:700">${esc(n.text)}</section>`;
}
export function announcementEditor() {
  const n = settings().announcement || {
    text: '',
    size: 'normal',
    color: 'default'
  };
  return `<section class="panel"><h3>공지사항 · 알림장</h3><form id="announcement-form">${textarea('교실 화면에 표시할 공지사항', 'announcement', n.text)}<div class="row">${select('글씨 크기', 'size', [['normal', '보통'], ['large', '크게'], ['huge', '아주 크게']], n.size)}${select('글씨 색상', 'color', [['default', '기본'], ['red', '빨강'], ['blue', '파랑'], ['yellow', '노랑']], n.color)}<button type="submit" class="primary">공지사항 저장</button></div></form>${bindLater('announcement-form', 'submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await commit([up('settings', {
      ...settings(),
      announcement: {
        text: f.get('announcement').trim(),
        size: f.get('size'),
        color: f.get('color')
      }
    })]);
  })}</section>`;
}
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
  })}<h3 style="margin-top:16px">예정된 제외 · ${future.length}건</h3>${future.map(a => `<div class="row"><span>${esc(a.date)} · ${esc(students().find(s => s.id === a.studentId)?.name)} · ${esc(a.memo || '')}</span>${btn('예약 취소', () => commit([up('attendance', {
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
