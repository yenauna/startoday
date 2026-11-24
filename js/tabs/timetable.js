import { render, setScheduleManage } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, settings, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, badge, btn, checkbox, esc, input, opts, run, select, textarea, toast, undoToast, quickMemoBar } from '../shared/ui.js';
import { assignmentActions, assignmentEditor, assignmentsView, completeAll, scheduleAssignmentsCard } from './assignments.js';
import { routinesView, scheduleRoutinesCard } from './routines.js';
export function periodInfo(slot) {
  const catalog = C.subjectCatalog(db());
  const rule = db().subject_rules.find(x => x.code === slot?.subjectCode) || [...catalog.regular, ...catalog.special].find(x => x.code === slot?.subjectCode);
  let teacher = rule?.teacherName || '';
  if (rule?.teacherHistory?.length) {
    const versions = rule.teacherHistory.filter(h => h.from <= slot.date).sort((a, b) => b.from.localeCompare(a.from));
    teacher = versions[0]?.name || '';
  }
  return {
    rule,
    teacher: slot?.teacherOverride || teacher,
    location: slot?.locationOverride || rule?.location || '',
    type: slot?.type || rule?.defaultType || '일반'
  };
}
export function timeSlots(d, calendar = false, registeredOnly = false, audience = 'teacher') {
  // 좁은 달력 칸에서는 수업이 있는 교시만 한 줄로 보여 준다. '자세히'를 켜면 교시별 전체 줄이 나온다.
  const compact = calendar && !state.calendarFilters.detail;
  const lessonSlots = Array.from({
    length: 6
  }, (_, i) => {
    const p = i + 1,
      slot = db().timetables.find(t => t.date === d && t.period === p),
      info = periodInfo(slot),
      events = C.calendarEvents(db()).filter(e => e.date === d && e.period === p);
    if (registeredOnly && !slot && !events.length) return '';
    // 달력 칸에는 실제 수업만 그린다. 빈 교시는 오른쪽 시간표 카드에서 채운다.
    if (calendar && !slot && !events.length) return '';
    const memo = slot?.publicMemo ?? slot?.memo ?? '';
    const privateMemo = audience === 'teacher' ? slot?.privateMemo || '' : C.sameDayMemo(slot, d);
    const teacherMemo = audience === 'teacher' ? slot?.teacherMemo || '' : '';
    const subject = slot ? calendar && !state.calendarFilters.detail ? info.rule?.label || slot.subjectCode[0] : slot.subjectCode : '';
    const time = settings().periodTimes?.[i] || C.DEFAULT_PERIOD_TIMES[i];
    const periodRow = compact ? `<span class="slot-period-row"><span class="slot-time">${p}</span></span>` : `<div class="slot-period-row"><span class="slot-time">${p}교시</span><small class="slot-clock">${esc(C.formatTimeRange(time))}</small></div>`;
    const memoIndicator = calendar && (memo || privateMemo || teacherMemo || events.length) ? '<sup class="slot-memo-indicator" aria-label="메모 있음">*</sup>' : '';
    const subjectTitle = subject ? `<strong class="subject-title">${esc(subject)}${memoIndicator}</strong>` : '';
    const memoHtml = `${memo ? `<span class="slot-public-memo">${audience === 'teacher' ? '📢 ' : ''}${esc(memo)}</span>` : ''}${privateMemo ? `<span class="slot-same-day-memo">${esc(privateMemo)}</span>` : ''}${teacherMemo ? `<span class="slot-teacher-memo">🔒 ${esc(teacherMemo)}</span>` : ''}`;
    if (audience === 'classroom') return `<div class="slot${slot ? ' subject-color subject-stripe' : ''}" ${slot ? `style="${C.subjectColorStyle(info.rule || slot.subjectCode)}"` : ''}>${periodRow}<div class="slot-subject-row">${subjectTitle}<div class="slot-memos">${memoHtml}${events.map(event=>`<span class="slot-public-memo">${esc(event.title)}${event.description ? ' '+esc(event.description) : ''}</span>`).join('')}</div></div></div>`;
    const main = btn((calendar ? periodRow : '') + subjectTitle, () => {
      if (state.dragSlot) { const from=state.dragSlot;state.dragSlot=null;return swapSlots(from, `${d}:${p}`); }
      dayEditor(d,'시간표',p);
    },'slot-main');
    const eventLinks = events.map(event => event.id && db().events.some(row=>row.id===event.id) ? btn(esc(event.title)+(event.description ? `<small>${esc(event.description)}</small>` : ''),()=>dayEditor(d,'일정',null,event),'slot-event-link timeline-event'+(event.isImportant!==false?' is-important':' is-ordinary')) : `<span class="slot-event-label">${esc(event.title)}</span>`).join('');
    return `<div class="slot${calendar ? ' calendar-lesson' : ''}${compact ? ' calendar-lesson-chip' : ''}${slot ? ' subject-color subject-stripe' : ''}" ${slot ? `style="${C.subjectColorStyle(info.rule || slot.subjectCode)}"` : ''} title="${esc(slot?.subjectCode || '')}" draggable="${!!slot}" data-drag="${d}:${p}" data-drop="${d}:${p}">${calendar ? '' : periodRow}<div class="slot-subject-row">${main}<div class="slot-memos">${memoHtml}${eventLinks}</div></div></div>`;
  });
  return C.dayTimeline(db(), d).map(part => part.type === 'lesson' ? lessonSlots[part.period - 1] : part.events.length && (!calendar || state.calendarFilters.events) ? `<div class="timeline-slot timeline-${part.period}" data-timeline-period="${part.period}"><strong>${{
    0: '아침',
    7: '점심',
    8: '방과후'
  }[part.period]}</strong>${part.events.map(event => audience === 'classroom' ? `<div class="timeline-event">${esc(event.title)}${event.description ? `<small>${esc(event.description)}</small>` : ''}</div>` : btn(esc(event.title) + (event.description ? `<small>${esc(event.description)}</small>` : ''), () => dayEditor(d, '일정', null, event), 'timeline-event' + (event.isImportant !== false ? ' is-important' : ' is-ordinary'))).join('')}</div>` : '').join('');
}
function calendarDayDetails(date) {
  const events = C.calendarEvents(db()).filter(event => event.date === date);
  modal(C.formatDate(date) + ' · 시간표와 메모', timeSlots(date) + events.map(event => btn(esc(event.title) + (event.description ? `<small>${esc(event.description)}</small>` : ''), () => dayEditor(date, '일정', null, event), 'event')).join(''));
}
const SCHEDULE_FILTERS = [['time', '시간표'], ['events', '행사'], ['tasks', '과제'], ['routines', '루틴'], ['detail', '자세히']];
export function selectScheduleDay(d) {
  state.date = d;
  state.calendarDate = d;
  render();
}
function questDayTag(a, d) {
  if (a.endDate && d === a.endDate) return '마감';
  if (d === a.date) return '진행';
  return '';
}
function eventPeriodLabel(period) {
  return period == null ? '' : period === 0 ? '아침' : period === 7 ? '점심' : period === 8 ? '방과후' : period + '교시';
}
function calendarEventPill(d, event) {
  return btn(esc(event.title) + (event.description ? `<small class="event-description">${esc(event.description)}</small>` : '') + (event.isDday ? ' ' + badge(C.dday(event.date)) : ''), () => dayEditor(d, '일정', null, event), 'event' + (event.isImportant !== false ? ' is-important' : ' is-ordinary'));
}
function calendarTaskPill(d, a) {
  const targets = students().filter(s => C.targeted(a, s.id) && !C.excluded(db(), s.id, d)),
    done = targets.filter(s => ['완료', '늦게완료', '면제'].includes(C.assignmentStatus(db(), a.id, d, s.id))).length;
  return `<div class="taskline">${btn(esc(a.title) + ` <small>${done}/${targets.length}</small>`, () => {
    state.date = d;
    state.calendarDate = d;
    render();
    assignmentActions(a, d);
  }, 'task calendar-task' + (done < targets.length ? ' has-incomplete' : ''))}</div>`;
}
function calendarQuestPill(d, a) {
  return `<div class="schedule-quest-line">${btn(`🏅 ${esc(a.title)} <small>${questDayTag(a, d)}</small>`, () => {
    state.date = d;
    state.calendarDate = d;
    render();
    assignmentActions(a, d);
  }, 'calendar-task calendar-quest')}</div>`;
}
function scheduleDayCell(d) {
  const filters = state.calendarFilters,
    events = C.calendarEvents(db()).filter(e => e.date === d && C.eventTimePeriod(e) == null),
    tasks = filters.tasks ? db().assignments.filter(a => !a.deletedAt && !a.isQuest && C.occurs(a, d)) : [],
    quests = filters.tasks ? db().assignments.filter(a => !a.deletedAt && a.isQuest && questDayTag(a, d)) : [],
    exempt = filters.routines ? db().routines.filter(r => !r.deletedAt && r.exceptions?.[d]?.exempt) : [];
  return `<div class="day schedule-day${d.slice(0, 7) !== state.calendarDate.slice(0, 7) ? ' faded' : ''}${d === C.today() ? ' today' : ''}${d === state.date ? ' selected-day' : ''}" data-schedule-date="${d}">
    <div class="schedule-day-top">${btn(`<span>${Number(d.slice(-2))}${state.calendarMode === 'week' ? '일' : ''}</span>`, () => selectScheduleDay(d), 'day-head schedule-day-select', `aria-label="${esc(C.formatDate(d))} 선택" aria-pressed="${d === state.date}"`)}${btn('메모', () => calendarDayDetails(d), 'calendar-day-details', 'aria-label="메모 상세" title="메모 상세"')}${btn('＋', () => dayEditor(d), 'calendar-day-add', `aria-label="${esc(C.formatDate(d))} 일정 추가" title="일정 추가"`)}</div>
    ${filters.events ? events.map(e => calendarEventPill(d, e)).join('') : ''}
    ${filters.time ? timeSlots(d, true) : ''}
    ${tasks.map(a => calendarTaskPill(d, a)).join('')}
    ${quests.map(a => calendarQuestPill(d, a)).join('')}
    ${exempt.length ? `<div class="routine-exempt-line">🚫 루틴 쉬는 날${exempt.length > 1 ? ` <small>${exempt.length}</small>` : ''}</div>` : ''}
  </div>`;
}
function scheduleEventRow(d, e) {
  const when = eventPeriodLabel(C.eventTimePeriod(e)) || '종일';
  return btn(`<span class="schedule-event-when">${when}</span><span class="schedule-event-body"><strong>${esc(e.title)}</strong>${e.description ? `<small>${esc(e.description)}</small>` : ''}</span>${e.isDday ? badge(C.dday(e.date)) : ''}`, () => dayEditor(d, '일정', null, e), 'schedule-event-row' + (e.isImportant !== false ? ' is-important' : ' is-ordinary'));
}
// 오른쪽 첫 카드: 선택 날짜의 행사와 교시별 시간표·메모.
function scheduleEventsCard() {
  const d = state.date,
    events = C.calendarEvents(db()).filter(e => e.date === d).sort((a, b) => (C.eventTimePeriod(a) ?? -1) - (C.eventTimePeriod(b) ?? -1));
  const periods = Array.from({ length: 6 }, (_, i) => i + 1).map(p => {
    const slot = db().timetables.find(t => t.date === d && t.period === p),
      info = periodInfo(slot),
      time = settings().periodTimes?.[p - 1] || C.DEFAULT_PERIOD_TIMES[p - 1],
      memo = slot?.publicMemo ?? slot?.memo ?? '',
      sameDayMemo = slot?.privateMemo || '',
      teacherMemo = slot?.teacherMemo || '';
    return `<div class="schedule-period${slot ? ' has-lesson' : ''}" data-drop="${d}:${p}" ${slot ? `data-drag="${d}:${p}" draggable="true"` : ''}>${btn(`<span class="schedule-period-no">${p}</span><strong>${slot ? esc(slot.subjectCode) : '수업 없음'}</strong><small class="schedule-period-time">${esc(C.formatTimeRange(time))}</small>`, () => {
      if (state.dragSlot) {
        const from = state.dragSlot;
        state.dragSlot = null;
        swapSlots(from, `${d}:${p}`);
        return;
      }
      timetableEditor(d, p);
    }, 'schedule-period-main' + (slot ? '' : ' is-empty'), slot ? `style="${C.subjectColorStyle(info.rule || slot.subjectCode)}"` : '')}${slot && (memo || sameDayMemo || teacherMemo) ? `<div class="schedule-period-memos">${memo ? `<span class="schedule-memo public" title="메모1 · 학생 공개">📢 ${esc(memo)}</span>` : ''}${sameDayMemo ? `<span class="schedule-memo same-day" title="메모2 · 당일 공개">🗒 ${esc(sameDayMemo)}</span>` : ''}${teacherMemo ? `<span class="schedule-memo teacher" title="메모3 · 교사 전용">🔒 ${esc(teacherMemo)}</span>` : ''}</div>` : ''}</div>`;
  }).join('');
  return `<section class="panel schedule-card schedule-card-events" aria-labelledby="schedule-events-title"><div class="schedule-card-head"><h3 id="schedule-events-title">일정 <small>${esc(C.formatDate(d))}</small></h3><div class="row schedule-card-actions">${btn('+ 일정', () => dayEditor(d), 'primary schedule-add')}</div></div>
    <div class="schedule-event-list">${events.map(e => scheduleEventRow(d, e)).join('') || '<p class="muted schedule-empty">등록된 일정이 없습니다.</p>'}</div>
    <h4 class="schedule-subhead">시간표</h4>
    <div class="schedule-periods">${periods}</div>
  </section>`;
}
function scheduleManagePanel() {
  const manage = state.scheduleManage;
  if (manage !== '과제' && manage !== '루틴') return '';
  return `<div class="schedule-manage" id="schedule-manage"><div class="schedule-manage-bar"><small>${esc(manage)} 전체 목록과 날짜별 관리 화면입니다. 닫으면 일정 화면으로 돌아갑니다.</small>${btn('닫기', () => setScheduleManage(''), 'schedule-manage-close')}</div>${manage === '과제' ? assignmentsView(true) : routinesView(true)}</div>`;
}
export function calendarView() {
  const first = state.calendarDate.slice(0, 7) + '-01',
    start = state.calendarMode === 'month' ? C.addDays(first, -((C.weekday(first) + 6) % 7)) : C.addDays(state.calendarDate, -((C.weekday(state.calendarDate) + 6) % 7)),
    days = state.calendarMode === 'month' ? 42 : 5;
  const heads = state.calendarMode === 'month' ? ['월', '화', '수', '목', '금', '토', '일'] : ['월', '화', '수', '목', '금'];
  const shiftMonth = amount => {
    const dt = new Date(first + 'T12:00Z');
    dt.setUTCMonth(dt.getUTCMonth() + amount);
    state.calendarDate = dt.toISOString().slice(0, 10);
    render();
  };
  return `<div class="toolbar schedule-toolbar"><div><h2>일정</h2><small>시간표·행사·과제·루틴을 한 화면에서 봅니다. 날짜를 누르면 오른쪽 카드가 그 날짜로 바뀝니다.</small></div><div class="row schedule-toolbar-nav">${btn('‹', () => {
    if (state.calendarMode === 'week') {
      state.calendarDate = C.addDays(state.calendarDate, -7);
      render();
    } else shiftMonth(-1);
  }, 'schedule-nav', 'aria-label="이전 기간"')}<strong class="schedule-period-title">${esc(state.calendarMode === 'month' ? state.calendarDate.slice(0, 7).replace('-', '.') : C.formatDate(start) + ' 주간')}</strong>${btn('›', () => {
    if (state.calendarMode === 'week') {
      state.calendarDate = C.addDays(state.calendarDate, 7);
      render();
    } else shiftMonth(1);
  }, 'schedule-nav', 'aria-label="다음 기간"')}${btn('오늘', () => {
    state.calendarDate = C.today();
    state.date = C.today();
    render();
  })}${btn(state.calendarMode === 'month' ? '주간 보기' : '월간 보기', () => {
    state.calendarMode = state.calendarMode === 'month' ? 'week' : 'month';
    render();
  })}${btn('기본안 일괄 배포', bulkTimetable)}${btn('시수 계산', hoursDialog)}</div></div>
  <div class="row schedule-filters" role="group" aria-label="달력에 표시할 항목">${SCHEDULE_FILTERS.map(([key, label]) => btn((state.calendarFilters[key] ? '✓ ' : '') + label, () => {
    state.calendarFilters[key] = !state.calendarFilters[key];
    render();
  }, 'schedule-filter' + (state.calendarFilters[key] ? ' is-on' : ''), `aria-pressed="${!!state.calendarFilters[key]}"`)).join('')}<small class="schedule-filter-hint">${state.calendarFilters.detail ? '수업을 드래그해 교체 · 터치는 길게 누른 후 대상 교시 선택' : '수업 칩을 끌어 교체 · 날짜를 눌러 오른쪽 카드에서 메모 확인'}</small></div>
  <p class="schedule-mobile-hint">달력은 옆으로 넘겨서 볼 수 있어요. 날짜를 누르면 아래 카드가 그 날짜로 바뀝니다.</p>
  <div class="schedule-unified${state.calendarMode === 'week' ? ' is-week' : ''}">
    <section class="panel schedule-calendar-panel" aria-label="통합 달력"><div class="table-wrap"><div class="calendar ${state.calendarMode === 'week' ? 'week' : ''}">${heads.map(h => `<div class="weekday">${h}</div>`).join('')}${Array.from({ length: days }, (_, i) => scheduleDayCell(C.addDays(start, i))).join('')}</div></div></section>
    <div class="schedule-side">${scheduleEventsCard()}${scheduleAssignmentsCard()}${scheduleRoutinesCard()}</div>
    ${scheduleManagePanel()}
  </div>`;
}
export function dayEditor(d, mode = '일정', period = 1, event = null) {
  if (event?.academic) {
    modal('학사일정', `<h3>${esc(event.title)}</h3><p>${esc(C.formatDate(event.date))}</p><p>${esc(event.description)}</p>${btn('학사일정 설정', () => {
      closeModal();
      state.tab = '설정';
      render();
    })}`);
    return;
  }
  if (mode === '과제') {
    closeModal();
    assignmentEditor(null, d);
    return;
  }
  if(mode==='수업'){modal(C.formatDate(d)+' · 수업 추가',`<p>수업을 추가할 교시를 선택하세요.</p><div class="row">${[1,2,3,4,5,6].map(p=>btn(p+'교시',()=>timetableEditor(d,p))).join('')}</div>`);return;}
  if (mode === '시간표') {
    timetableEditor(d, Number(period) || 1);
    return;
  }
  const r = event || {
    id: C.uid(),
    date: d,
    period: null,
    title: '',
    description: '',
    isDday: false,
    createdAt: C.now()
  };
  modal(C.formatDate(d) + ' · 일정 등록', `<div class="row event-entry-tabs" style="margin-bottom:18px">${['일정', '수업', '과제'].map(t => btn(t, () => dayEditor(d, t, period), mode === t ? 'primary' : '')).join('')}</div><div class="formgrid">${input('일정 이름', 'title', r.title, 'text', 'required')}${select('시간', 'period', [['', '종일'], [0, '아침'], ...[1, 2, 3, 4, 5, 6].map(p => [p, p + '교시']), [7, '점심'], [8, '방과후']], C.eventTimePeriod(r) ?? '')}<div class="span2">${textarea('설명', 'description', r.description)}</div>${checkbox('D-Day 표시', 'isDday', r.isDday)}${checkbox('중요 안내 (달력 알약 표시)', 'isImportant', r.isImportant !== false)}</div>`, async f => {
    const title = f.get('title').trim();
    if (!title) throw Error('일정 이름을 입력하세요.');
    await commit([up('events', {
      ...r,
      title,
      period: f.get('period') === '' ? null : Number(f.get('period')),
      timeOfDay: f.get('period') === '' ? 'all' : f.get('period') === '0' ? 'morning' : f.get('period') === '7' ? 'lunch' : f.get('period') === '8' ? 'after' : 'lesson',
      description: f.get('description'),
      isDday: !!f.get('isDday'),
      isImportant: !!f.get('isImportant')
    })]);
    closeModal();
  }, '저장', event ? btn('삭제', async () => {
    if (confirm('일정을 삭제할까요?')) {
      await commit([{
        table: 'events',
        id: r.id,
        remove: true
      }]);
      closeModal();
    }
  }, 'danger', 'aria-label="이 일정 삭제"') : '');
}
export function timetableEditor(d, p) {
  if (!Number.isInteger(p) || p < 1 || p > 6) throw Error('교시를 확인하세요.');
  const slot = db().timetables.find(t => t.date === d && t.period === p);
  const catalog = C.subjectCatalog(db());
  const regular = catalog.regular.filter(subject => subject.enabled !== false),
    special = catalog.special.filter(subject => subject.enabled !== false);
  const cleared = new Set();
  const memoField = (label, key, value) => `<label class="memo-field"><span>${label}${btn('✕ 내용 지우기', event => {
    event?.preventDefault();
    const field = $('#modal-form').elements[key];
    field.value = '';
    cleared.add(key);
    field.focus();
  }, 'memo-clear', `aria-label="${label} 내용 지우기"`)}</span><textarea name="${key}">${esc(value)}</textarea></label>`;
  const memoScope = () => `${store.mode}:${store.classId}:${state.viewMode}`;
  const save = async (subjectCode, form, quick = false) => {
    subjectCode = subjectCode || db().timetables.find(t => t.date === d && t.period === p)?.subjectCode || '';
    const old = db().timetables.find(t => t.date === d && t.period === p);
    const publicMemo = form.get('publicMemo') || '';
    const scope = memoScope(),
      fields = [...cleared].filter(key => !form.get(key) && (key === 'publicMemo' ? old?.publicMemo ?? old?.memo : old?.[key]));
    const ops=[up('timetables', {
      ...old,
      id: old?.id || `${d}-${p}`,
      date: d,
      period: p,
      subjectCode,
      type: old?.type || '일반',
      memo: publicMemo,
      publicMemo,
      privateMemo: form.get('privateMemo') || '',
      teacherMemo: form.get('teacherMemo') || '',
      updatedAt: C.now()
    })];
    const savedId=old?.id||`${d}-${p}`,tab=state.tab;
    let subjectPromise,pending=true,failed=false,closeQuick;
    const available=()=>!failed&&scope===memoScope()&&!state.locked&&state.viewMode!=='student'&&state.tab===tab&&(pending||db()?.timetables.some(t=>t.id===savedId&&t.date===d&&t.period===p));
    if(quick){
      closeModal();
      closeQuick=quickMemoBar(async(key,text)=>{
        try{await subjectPromise;}catch{return;}
        if(!available())throw Error('시간표 화면이 변경되었습니다.');
        await commit(current=>{if(!available())throw Error('시간표 화면이 변경되었습니다.');const latest=current.timetables.find(t=>t.id===savedId&&t.date===d&&t.period===p);if(!latest)throw Error('저장할 시간표가 없습니다.');return [up('timetables',{...latest,[key]:text,...(key==='publicMemo'?{memo:text}:{}),updatedAt:C.now()})];},'');
      },available,'저장 중');
    }
    subjectPromise=commit(ops,quick?'':'저장했습니다.');
    try{await subjectPromise;pending=false;closeQuick?.setStatus?.('저장됨');}
    catch(error){pending=false;failed=true;closeQuick?.();if(quick){toast(error.message||'시간표를 저장하지 못했습니다.');return;}throw error;}
    if(!quick)closeModal();
    if (fields.length && scope === memoScope()) undoToast('수업 메모를 지웠습니다.', async () => {
      const current = db().timetables.find(t => t.date === d && t.period === p);
      if (!current || current.id !== (old?.id || `${d}-${p}`) || current.subjectCode !== subjectCode || fields.some(key => current[key])) throw Error('메모가 변경되어 복구할 수 없습니다.');
      const next = {
        ...current,
        updatedAt: C.now()
      };
      for (const key of fields) {
        next[key] = key === 'publicMemo' ? old.publicMemo ?? old.memo ?? '' : old[key] || '';
        if (key === 'publicMemo') next.memo = next.publicMemo;
      }
      await commit([up('timetables', next)]);
    }, () => scope === memoScope());
  };
  const choices = subjects => subjects.map(subject => btn(esc(subject.code), () => save(subject.code, new FormData($('#modal-form')), true), 'subject-color subject-stripe subject-choice' + (subject.code === slot?.subjectCode ? ' selected' : ''), `style="${C.subjectColorStyle(subject)}" aria-pressed="${subject.code === slot?.subjectCode}"`)).join('');
  modal(`${C.formatDate(d)} · ${p}교시 시간표`, `${C.gradeSubjectCodes(settings().grade).length ? `<div class="subject-grid">${choices(regular)}</div>` : '<p class="muted">설정-기본정보에서 학년을 설정하면 과목이 보입니다.</p>'}<details class="project-subjects" ${special.some(subject => subject.code === slot?.subjectCode) ? 'open' : ''}><summary>+ 특별·프로젝트 수업 ▾</summary><div class="subject-grid">${choices(special) || '<p class="muted">설정-과목·전담에서 특별 과목을 추가하세요.</p>'}</div></details><p class="muted">과목 버튼을 누르면 바로 저장됩니다.</p>${memoField('메모1 : 학생 달력에도 기록되어 언제든 학생들이 볼 수 있음', 'publicMemo', slot?.publicMemo ?? slot?.memo ?? '')}${memoField("메모2 : 학생들은 당일 '오늘의 일정'과 교실화면에서만 볼 수 있음", 'privateMemo', slot?.privateMemo || '')}${memoField('메모3 : 교사만 볼 수 있음', 'teacherMemo', slot?.teacherMemo || '')}${slotEventEditorList(d,p)}${slot ? btn('이 교시 비우기', async () => {
    if (confirm('이 교시를 비울까요?')) {
      await commit([{
        table: 'timetables',
        id: slot.id,
        remove: true
      }]);
      closeModal();
    }
  }, 'danger') : ''}`, f => save(slot?.subjectCode, f), '메모 저장', btn('메모 지우기', () => {
    const form = $('#modal-form');
    for (const key of ['publicMemo', 'privateMemo', 'teacherMemo']) { form.elements[key].value = ''; cleared.add(key); }
    return save(slot?.subjectCode, new FormData(form));
  }, 'danger'));
}
export async function swapSlots(from, to) {
  if (from === to) return;
  const unpack = x => {
    const [d, p] = x.split(':');
    return {
      d,
      p: Number(p)
    };
  };
  const a = unpack(from),
    b = unpack(to),
    one = db().timetables.find(t => t.date === a.d && t.period === a.p),
    two = db().timetables.find(t => t.date === b.d && t.period === b.p);
  if (!one) return;
  const ops = [up('timetables', {
    ...one,
    id: `${b.d}-${b.p}`,
    date: b.d,
    period: b.p,
    updatedAt: C.now()
  })];
  if (two) ops.push(up('timetables', {
    ...two,
    id: `${a.d}-${a.p}`,
    date: a.d,
    period: a.p,
    updatedAt: C.now()
  }));else ops.push({
    table: 'timetables',
    id: one.id,
    remove: true
  });
  await commit(ops, '시간표를 교체했습니다.');
}
export function bulkTimetable() {
  const template = settings().weeklyTemplate || {};
  modal('주간 기본안 · 기간 일괄 배포', `<p class="muted">기본안을 저장한 뒤 선택 기간의 월~금 시간표에 배포합니다. 이미 입력된 시간표는 기본적으로 보존합니다.</p><div class="table-wrap"><table><thead><tr><th>교시</th>${['월', '화', '수', '목', '금'].map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map(p => `<tr><th>${p}</th>${[1, 2, 3, 4, 5].map(w => `<td><select name="slot-${w}-${p}" aria-label="${w}요일 ${p}교시">${opts([['', '없음'], ...[...C.subjectCatalog(db()).regular, ...C.subjectCatalog(db()).special].filter(subject => subject.enabled !== false).map(subject => subject.code)], template[`${w}-${p}`] || '')}</select></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="formgrid" style="margin-top:14px">${input('배포 시작일', 'from', state.date, 'date', 'required')}${input('배포 종료일', 'to', C.addDays(state.date, 30), 'date', 'required')}${checkbox('기존 시간표도 덮어쓰기', 'overwrite')}${checkbox('기본안만 저장 · 배포하지 않음', 'templateOnly')}</div>`, async f => {
    const tmpl = {};
    for (const [k, v] of f) if (k.startsWith('slot-')) tmpl[k.slice(5)] = v;
    const ops = [up('settings', {
      ...settings(),
      weeklyTemplate: tmpl
    })];
    if (!f.get('templateOnly')) {
      const range = C.dates(f.get('from'), f.get('to'));
      if (range.length > 370) throw Error('한 번에 1년 이내로 배포하세요.');
      for (const d of range) {
        const w = C.weekday(d);
        if (w < 1 || w > 5) continue;
        for (let p = 1; p <= 6; p++) {
          const code = tmpl[`${w}-${p}`],
            id = `${d}-${p}`,
            old = db().timetables.find(t => t.id === id);
          if (old && !f.get('overwrite')) continue;
          if (code) {
            const rule = db().subject_rules.find(s => s.code === code) || [...C.subjectCatalog(db()).regular, ...C.subjectCatalog(db()).special].find(s => s.code === code);
            ops.push(up('timetables', {
              id,
              date: d,
              period: p,
              subjectCode: code,
              type: rule.defaultType,
              memo: '',
              locationOverride: null,
              teacherOverride: null,
              updatedAt: C.now()
            }));
          } else if (old && f.get('overwrite')) ops.push({
            table: 'timetables',
            id,
            remove: true
          });
        }
      }
      if (!confirm(`${ops.length - 1}개 수업 변경을 저장할까요?`)) return;
    }
    await commit(ops);
    closeModal();
  });
}
export function hoursDialog(from, to) {
  if (typeof from !== 'string' || typeof to !== 'string') ({
    from,
    to
  } = C.hoursDefaultRange(settings(), C.today()));
  C.dates(from, to);
  const rows = db().subject_rules.map(subject => [subject.code, db().timetables.filter(slot => slot.date >= from && slot.date <= to && slot.subjectCode === subject.code).length]);
  modal('과목별 수업 시수', `<div class="hours-period row">${input('시작', 'from', from, 'date', 'required')}${input('종료', 'to', to, 'date', 'required')}${[1, 2].map(term => {
    const range = C.semesterRange(settings(), term);
    return btn(term + '학기', () => hoursDialog(range.from, range.to), '', range ? '' : 'disabled title="설정에서 학사일정을 먼저 등록하세요"');
  }).join('')}</div><p class="muted" style="margin:12px 0">저장된 실제 시간표의 과목 슬롯을 합산합니다. 교시 연계 행사는 수업 슬롯 자체를 바꾸지 않으므로, 수업을 대체한 경우 해당 슬롯도 변경해 주세요.</p><table class="hours-table"><thead><tr><th>과목</th><th>차시</th></tr></thead><tbody>${rows.map(([subject, count]) => `<tr><td>${esc(subject)}</td><td>${count}</td></tr>`).join('')}</tbody></table>`, f => hoursDialog(f.get('from'), f.get('to')), '다시 계산');
}
export function bindTimetableDrag() {
  document.querySelectorAll('[data-drop]').forEach(el => {
    el.ondragover = e => e.preventDefault();
    el.ondrop = e => {
      e.preventDefault();
      if (state.dragSlot) run(() => swapSlots(state.dragSlot, el.dataset.drop));
      state.dragSlot = null;
    };
  });
  document.querySelectorAll('[data-drag]').forEach(el => {
    el.ondragstart = e => {
      state.dragSlot = el.dataset.drag;
      e.dataTransfer.setData('text/plain', state.dragSlot);
    };
    el.onpointerdown = e => {
      if (e.pointerType === 'touch') {
        el._touchTimer = setTimeout(() => {
          state.dragSlot = el.dataset.drag;
          toast('이동할 교시를 누르세요.');
        }, 550);
      }
    };
    el.onpointerup = () => clearTimeout(el._touchTimer);
    el.onpointercancel = () => clearTimeout(el._touchTimer);
  });
}

function slotEventEditorList(date, period) {
  const events = db().events.filter(event => event.date === date && C.eventTimePeriod(event) === period);
  return `<section class="slot-linked-events"><h3>이 교시의 일정</h3>${events.map(event => `<div class="slot-linked-event"><span>${esc(event.title)}</span>${btn('수정', () => dayEditor(date, '일정', null, event), '', `aria-label="${esc(event.title)} 수정"`)}${btn('삭제', async () => {
    if (!confirm('일정을 삭제할까요?')) return;
    await commit([{ table: 'events', id: event.id, remove: true }]);
    timetableEditor(date, period);
  }, 'danger', `aria-label="${esc(event.title)} 삭제"`)}</div>`).join('') || '<p class="muted">등록된 일정이 없습니다.</p>'}</section>`;
}
