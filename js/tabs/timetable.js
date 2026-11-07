import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, settings, students, up } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, badge, btn, checkbox, esc, input, opts, run, select, textarea, toast } from '../shared/ui.js';
import { assignmentEditor } from './assignments.js';
export function periodInfo(slot) {
  const rule = db().subject_rules.find(x => x.code === slot?.subjectCode);
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
export function timeSlots(d, calendar = false, registeredOnly = false) {
  return Array.from({
    length: 6
  }, (_, i) => {
    const p = i + 1,
      slot = db().timetables.find(t => t.date === d && t.period === p),
      info = periodInfo(slot),
      events = C.calendarEvents(db()).filter(e => e.date === d && e.period === p);
    if (registeredOnly && !slot && !events.length) return '';
    const detail = !calendar || state.calendarFilters.detail;
    const teacher = info.teacher ? info.teacher.replace(/선생님$/, '') + '선생님' : '';
    const content = `<small class="slot-time"><span>${p}교시</span>${!calendar && settings().periodTimes?.[i] ? `<span class="period-time">${esc(settings().periodTimes[i])}</span>` : ''}</small><div class="slot-content"><strong>${esc(slot ? calendar && !state.calendarFilters.detail ? info.rule?.label || slot.subjectCode[0] : slot.subjectCode : '')}</strong><div class="slot-description">${events.map(e => `<span class="slot-note">${esc(e.title)}${e.description ? ' · ' + esc(e.description) : ''}</span>`).join('')}${slot?.memo ? `<span class="slot-note">${esc(slot.memo)}</span>` : ''}${info.type !== '일반' ? badge(info.type) : ''}${detail && settings().timetableDisplay.showLocation && info.location ? `<span class="slot-location">${esc(info.location)}</span>` : ''}${detail && settings().timetableDisplay.showTeacher && teacher ? `<span class="slot-teacher">${esc(teacher)}</span>` : ''}</div></div>`;
    return btn(content, () => {
      if (state.dragSlot) {
        const from = state.dragSlot;
        state.dragSlot = null;
        return swapSlots(from, `${d}:${p}`);
      }
      dayEditor(d, '시간표', p);
    }, 'slot', `style="background:${esc(info.rule?.color || '#FFFFFF')}" draggable="${!!slot}" data-drag="${d}:${p}" data-drop="${d}:${p}"`);
  }).join('');
}
export function calendarView() {
  const first = state.calendarDate.slice(0, 7) + '-01',
    start = state.calendarMode === 'month' ? C.addDays(first, -C.weekday(first)) : C.addDays(state.calendarDate, -((C.weekday(state.calendarDate) + 6) % 7)),
    days = state.calendarMode === 'month' ? 42 : 5;
  const heads = state.calendarMode === 'month' ? ['일', '월', '화', '수', '목', '금', '토'] : ['월', '화', '수', '목', '금'];
  return `<div class="toolbar"><div><h2>시간표·일정</h2><small>종일 일정 · 교시별 수업과 행사 · 마감 과제</small></div><div class="row">${btn('‹', () => {
    if (state.calendarMode === 'week') state.calendarDate = C.addDays(state.calendarDate, -7);else {
      const dt = new Date(first + 'T12:00Z');
      dt.setUTCMonth(dt.getUTCMonth() - 1);
      state.calendarDate = dt.toISOString().slice(0, 10);
    }
    render();
  })}<strong>${esc(state.calendarMode === 'month' ? state.calendarDate.slice(0, 7) : start + ' 주간')}</strong>${btn('›', () => {
    if (state.calendarMode === 'week') state.calendarDate = C.addDays(state.calendarDate, 7);else {
      const dt = new Date(first + 'T12:00Z');
      dt.setUTCMonth(dt.getUTCMonth() + 1);
      state.calendarDate = dt.toISOString().slice(0, 10);
    }
    render();
  })}${btn('오늘', () => {
    state.calendarDate = C.today();
    render();
  })}${btn(state.calendarMode === 'month' ? '주간 보기' : '월간 보기', () => {
    state.calendarMode = state.calendarMode === 'month' ? 'week' : 'month';
    render();
  })}${btn('기본안 일괄 배포', bulkTimetable)}${btn('시수 계산', hoursDialog)}</div></div><div class="row" style="margin-bottom:14px">${[['events', '종일 일정'], ['time', '시간표'], ['tasks', '과제'], ['detail', '자세히 보기']].map(([key, label]) => btn((state.calendarFilters[key] ? '✓ ' : '') + label, () => {
    state.calendarFilters[key] = !state.calendarFilters[key];
    render();
  }, state.calendarFilters[key] ? 'primary' : '')).join('')}<small>수업을 드래그해 교체 · 터치는 길게 누른 후 대상 교시 선택</small></div><div class="table-wrap"><div class="calendar ${state.calendarMode === 'week' ? 'week' : ''}">${heads.map(h => `<div class="weekday">${h}</div>`).join('')}${Array.from({
    length: days
  }, (_, i) => {
    const d = C.addDays(start, i),
      events = C.calendarEvents(db()).filter(e => e.date === d && (e.period == null || e.period === 0 || e.period === 7)),
      tasks = db().assignments.filter(a => C.occurs(a, d));
    return `<div class="day ${d.slice(0, 7) !== state.calendarDate.slice(0, 7) ? 'faded' : ''} ${d === C.today() ? 'today' : ''}">${btn(`<span>${Number(d.slice(-2))}${state.calendarMode === 'week' ? '일' : ''}</span><small>＋</small>`, () => dayEditor(d), 'day-head')}${state.calendarFilters.events ? events.map(e => btn(esc(e.title) + (e.description ? `<small class="event-description">${esc(e.description)}</small>` : '') + (e.isDday ? ' ' + badge(C.dday(e.date)) : ''), () => dayEditor(d, '일정', null, e), 'event')).join('') : ''}${state.calendarFilters.time ? timeSlots(d, true) : ''}${state.calendarFilters.tasks ? tasks.map(a => {
      const targets = students().filter(s => C.targeted(a, s.id) && !C.excluded(db(), s.id, d)),
        done = targets.filter(s => ['완료', '늦게완료', '면제'].includes(C.assignmentStatus(db(), a.id, d, s.id))).length;
      return `<div class="taskline">${btn(esc(a.title) + ` <small>${done}/${targets.length}</small>`, () => {
        state.date = d;
        state.tab = '과제';
        render();
      }, 'task')}</div>`;
    }).join('') : ''}</div>`;
  }).join('')}</div></div>`;
}
export function dayEditor(d, mode = '일정', period = 1, event = null) {
  if (event?.academic) {
    modal('학사일정', `<h3>${esc(event.title)}</h3><p>${esc(event.date)}</p><p>${esc(event.description)}</p>${btn('학사일정 설정', () => {
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
  const slot = db().timetables.find(t => t.date === d && t.period === (period || 1));
  const r = event || {
    id: C.uid(),
    date: d,
    period: null,
    title: '',
    description: '',
    isDday: false,
    createdAt: C.now()
  };
  modal(d + ' · 통합 등록', `<div class="row" style="margin-bottom:18px">${['일정', '시간표', '과제'].map(t => btn(t, () => dayEditor(d, t, period), mode === t ? 'primary' : '')).join('')}</div>${mode === '일정' ? `<div class="formgrid">${input('일정 이름', 'title', r.title, 'text', 'required')}${select('시간', 'period', [['', '종일'], [0, '아침'], ...[1, 2, 3, 4, 5, 6].map(p => [p, p + '교시']), [7, '방과후']], r.period ?? '')}<div class="span2">${textarea('설명', 'description', r.description)}</div>${checkbox('D-Day 표시', 'isDday', r.isDday)}</div>${event ? btn('이 일정 삭제', async () => {
    if (confirm('일정을 삭제할까요?')) {
      await commit([{
        table: 'events',
        id: r.id,
        remove: true
      }]);
      closeModal();
    }
  }, 'danger') : ''}` : `<div class="subject-grid">${db().subject_rules.sort((a, b) => a.sortOrder - b.sortOrder).map(s => btn(esc(s.code), async () => {
    const p = Number($('#modal-form').elements.period.value),
      old = db().timetables.find(t => t.date === d && t.period === p);
    await commit([up('timetables', {
      id: `${d}-${p}`,
      date: d,
      period: p,
      subjectCode: s.code,
      memo: $('#modal-form').elements.memo.value,
      type: s.defaultType,
      locationOverride: null,
      teacherOverride: null,
      updatedAt: C.now()
    })]);
    dayEditor(d, '시간표', p);
  }, '', `style="background:${esc(s.color)}"`)).join('')}</div><p class="muted" style="margin:8px 0">과목 버튼을 누르면 바로 저장됩니다. 아래에서 세부 내용까지 입력할 수도 있습니다.</p><div class="formgrid">${select('교시', 'period', [[0, '아침'], ...[1, 2, 3, 4, 5, 6].map(p => [p, p + '교시']), [7, '방과후']], period || 1)}${select('과목', 'subjectCode', db().subject_rules.map(s => s.code), slot?.subjectCode || db().subject_rules[0]?.code)}${select('특이사항', 'type', ['일반', '외부', '강사', '다른장소'], slot?.type || '일반')}${input('수업 메모', 'memo', slot?.memo || '')}${input('이날만 장소 변경', 'locationOverride', slot?.locationOverride || '')}${input('이날만 담당 교사 변경', 'teacherOverride', slot?.teacherOverride || '')}</div>${btn('이 교시 비우기', async () => {
    const p = Number($('#modal-form').elements.period.value);
    if (confirm('선택한 교시를 비울까요?')) {
      await commit([{
        table: 'timetables',
        id: `${d}-${p}`,
        remove: true
      }]);
      closeModal();
    }
  }, 'danger')}`}`, async f => {
    if (mode === '일정') {
      await commit([up('events', {
        ...r,
        title: f.get('title').trim(),
        period: f.get('period') === '' ? null : Number(f.get('period')),
        description: f.get('description'),
        isDday: !!f.get('isDday')
      })]);
    } else {
      const p = Number(f.get('period'));
      await commit([up('timetables', {
        id: `${d}-${p}`,
        date: d,
        period: p,
        subjectCode: f.get('subjectCode'),
        type: f.get('type'),
        memo: f.get('memo'),
        locationOverride: f.get('locationOverride') || null,
        teacherOverride: f.get('teacherOverride') || null,
        updatedAt: C.now()
      })]);
    }
    closeModal();
  });
  if (mode === '시간표') $('#modal-form').elements.period.onchange = e => dayEditor(d, '시간표', Number(e.target.value));
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
  modal('주간 기본안 · 기간 일괄 배포', `<p class="muted">기본안을 저장한 뒤 선택 기간의 월~금 시간표에 배포합니다. 이미 입력된 시간표는 기본적으로 보존합니다.</p><div class="table-wrap"><table><thead><tr><th>교시</th>${['월', '화', '수', '목', '금'].map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map(p => `<tr><th>${p}</th>${[1, 2, 3, 4, 5].map(w => `<td><select name="slot-${w}-${p}" aria-label="${w}요일 ${p}교시">${opts([['', '없음'], ...db().subject_rules.map(s => s.code)], template[`${w}-${p}`] || '')}</select></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="formgrid" style="margin-top:14px">${input('배포 시작일', 'from', state.date, 'date', 'required')}${input('배포 종료일', 'to', C.addDays(state.date, 30), 'date', 'required')}${checkbox('기존 시간표도 덮어쓰기', 'overwrite')}${checkbox('기본안만 저장 · 배포하지 않음', 'templateOnly')}</div>`, async f => {
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
            const rule = db().subject_rules.find(s => s.code === code);
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
export function hoursDialog(from = state.calendarDate.slice(0, 7) + '-01', to = new Date(Date.UTC(Number(state.calendarDate.slice(0, 4)), Number(state.calendarDate.slice(5, 7)), 0)).toISOString().slice(0, 10)) {
  const rows = db().subject_rules.map(s => [s.code, db().timetables.filter(t => t.date >= from && t.date <= to && t.subjectCode === s.code).length]);
  modal('과목별 수업 시수', `<div class="formgrid">${input('시작', 'from', from, 'date')}${input('종료', 'to', to, 'date')}</div><p class="muted" style="margin:12px 0">저장된 실제 시간표의 과목 슬롯을 합산합니다. 교시 연계 행사는 수업 슬롯 자체를 바꾸지 않으므로, 수업을 대체한 경우 해당 슬롯도 변경해 주세요.</p><table><thead><tr><th>과목</th><th>차시</th></tr></thead><tbody>${rows.map(([s, n]) => `<tr><td>${esc(s)}</td><td>${n}</td></tr>`).join('')}</tbody></table>`, async f => hoursDialog(f.get('from'), f.get('to')), '다시 계산');
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
