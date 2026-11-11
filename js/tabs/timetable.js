import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, settings, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, badge, btn, checkbox, esc, input, opts, run, select, textarea, toast, undoToast } from '../shared/ui.js';
import { assignmentEditor } from './assignments.js';
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
  const lessonSlots = Array.from({
    length: 6
  }, (_, i) => {
    const p = i + 1,
      slot = db().timetables.find(t => t.date === d && t.period === p),
      info = periodInfo(slot),
      events = C.calendarEvents(db()).filter(e => e.date === d && e.period === p);
    if (registeredOnly && !slot && !events.length) return '';
    const detail = !calendar || state.calendarFilters.detail;
    const teacher = info.teacher ? info.teacher.replace(/선생님$/, '') + '선생님' : '';
    const memo = slot?.publicMemo ?? slot?.memo ?? '';
    const privateMemo = !calendar && audience === 'teacher' ? slot?.privateMemo || '' : '';
    const subject = slot ? calendar && !state.calendarFilters.detail ? info.rule?.label || slot.subjectCode[0] : slot.subjectCode : '';
    const publicNotes = [...new Set([...events.map(event => event.title + (event.description && event.description.trim() !== memo.trim() ? ' · ' + event.description : '')), memo].filter(Boolean))].join('\n');
    const time = settings().periodTimes?.[i] || C.DEFAULT_PERIOD_TIMES[i];
    const content = `<div class="slot-period-row"><span class="slot-time">${p}교시</span><small class="slot-clock">${esc(time || '')}</small></div>${subject || publicNotes ? `<div class="slot-subject-row">${subject ? `<strong class="subject-title">${esc(subject)}</strong>` : ''}${publicNotes ? `<span class="slot-public-memo">${esc(publicNotes)}</span>` : ''}</div>` : ''}${privateMemo ? `<div class="slot-private-memo">🔒 ${esc(privateMemo)}</div>` : ''}`;
    if (audience === 'classroom') return `<div class="slot${slot ? ' subject-color subject-stripe' : ''}" style="${slot ? C.subjectColorStyle(info.rule || slot.subjectCode) : 'background:#FFFFFF'}">${content}</div>`;
    return btn(content, () => {
      if (state.dragSlot) {
        const from = state.dragSlot;
        state.dragSlot = null;
        return swapSlots(from, `${d}:${p}`);
      }
      dayEditor(d, '시간표', p);
    }, 'slot' + (slot ? ' subject-color subject-stripe' : ''), `style="${slot ? C.subjectColorStyle(info.rule || slot.subjectCode) : 'background:#FFFFFF'}" title="${esc(slot?.subjectCode || '')}" draggable="${!!slot}" data-drag="${d}:${p}" data-drop="${d}:${p}"`);
  });
  return C.dayTimeline(db(), d).map(part => part.type === 'lesson' ? lessonSlots[part.period - 1] : part.events.length && (!calendar || state.calendarFilters.events) ? `<div class="timeline-slot timeline-${part.period}" data-timeline-period="${part.period}"><strong>${{
    0: '아침',
    7: '점심',
    8: '방과후'
  }[part.period]}</strong>${part.events.map(event => audience === 'classroom' ? `<div class="timeline-event">${esc(event.title)}${event.description ? `<small>${esc(event.description)}</small>` : ''}</div>` : btn(esc(event.title) + (event.description ? `<small>${esc(event.description)}</small>` : ''), () => dayEditor(d, '일정', null, event), 'timeline-event')).join('')}</div>` : '').join('');
}
export function calendarView() {
  const first = state.calendarDate.slice(0, 7) + '-01',
    start = state.calendarMode === 'month' ? C.addDays(first, -((C.weekday(first) + 6) % 7)) : C.addDays(state.calendarDate, -((C.weekday(state.calendarDate) + 6) % 7)),
    days = state.calendarMode === 'month' ? 42 : 5;
  const heads = state.calendarMode === 'month' ? ['월', '화', '수', '목', '금', '토', '일'] : ['월', '화', '수', '목', '금'];
  return `<div class="toolbar"><div><h2>일정</h2><small>종일 일정 · 교시별 수업과 행사 · 마감 과제</small></div><div class="row">${btn('‹', () => {
    if (state.calendarMode === 'week') state.calendarDate = C.addDays(state.calendarDate, -7);else {
      const dt = new Date(first + 'T12:00Z');
      dt.setUTCMonth(dt.getUTCMonth() - 1);
      state.calendarDate = dt.toISOString().slice(0, 10);
    }
    render();
  })}<strong>${esc(state.calendarMode === 'month' ? state.calendarDate.slice(0, 7).replace('-', '.') : C.formatDate(start) + ' 주간')}</strong>${btn('›', () => {
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
  }, state.calendarFilters[key] ? 'primary' : '')).join('')}<small>수업을 드래그해 교체 · 터치는 길게 누른 후 대상 교시 선택</small></div>${C.calendarEvents(db()).some(event => event.date === C.today()) ? '' : '<div class="empty-calendar-notice" style="color:var(--st-text-muted); font-size:13px; padding:8px 0;">오늘 등록된 일정이 없습니다.</div>'}<div class="table-wrap"><div class="calendar ${state.calendarMode === 'week' ? 'week' : ''}">${heads.map(h => `<div class="weekday">${h}</div>`).join('')}${Array.from({
    length: days
  }, (_, i) => {
    const d = C.addDays(start, i),
      events = C.calendarEvents(db()).filter(e => e.date === d && C.eventTimePeriod(e) == null),
      tasks = db().assignments.filter(a => C.occurs(a, d));
    return `<div class="day ${d.slice(0, 7) !== state.calendarDate.slice(0, 7) ? 'faded' : ''} ${d === C.today() ? 'today' : ''}">${btn(`<span>${Number(d.slice(-2))}${state.calendarMode === 'week' ? '일' : ''}</span><small>＋</small>`, () => dayEditor(d), 'day-head')}${state.calendarFilters.events ? events.map(e => btn(esc(e.title) + (e.description ? `<small class="event-description">${esc(e.description)}</small>` : '') + (e.isDday ? ' ' + badge(C.dday(e.date)) : ''), () => dayEditor(d, '일정', null, e), 'event')).join('') : ''}${state.calendarFilters.time ? timeSlots(d, true) : ''}${state.calendarFilters.tasks ? tasks.map(a => {
      const targets = students().filter(s => C.targeted(a, s.id) && !C.excluded(db(), s.id, d)),
        done = targets.filter(s => ['완료', '늦게완료', '면제'].includes(C.assignmentStatus(db(), a.id, d, s.id))).length;
      return `<div class="taskline">${btn(esc(a.title) + ` <small>${done}/${targets.length}</small>`, () => {
        state.date = d;
        state.tab = '과제';
        render();
      }, 'task calendar-task' + (done < targets.length ? ' has-incomplete' : ''))}</div>`;
    }).join('') : ''}</div>`;
  }).join('')}</div></div>`;
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
  modal(C.formatDate(d) + ' · 일정 등록', `<div class="row event-entry-tabs" style="margin-bottom:18px">${['일정', '과제'].map(t => btn(t, () => dayEditor(d, t, period), mode === t ? 'primary' : '')).join('')}</div><div class="formgrid">${input('일정 이름', 'title', r.title, 'text', 'required')}${select('시간', 'period', [['', '종일'], [0, '아침'], ...[1, 2, 3, 4, 5, 6].map(p => [p, p + '교시']), [7, '점심'], [8, '방과후']], C.eventTimePeriod(r) ?? '')}<div class="span2">${textarea('설명', 'description', r.description)}</div>${checkbox('D-Day 표시', 'isDday', r.isDday)}${checkbox('중요 안내 (달력 알약 표시)', 'isImportant', r.isImportant !== false)}</div>`, async f => {
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
  const save = async (subjectCode, form) => {
    if (!subjectCode) throw Error('과목 버튼을 선택하세요.');
    const old = db().timetables.find(t => t.date === d && t.period === p);
    const publicMemo = form.get('publicMemo') || '';
    const scope = memoScope(),
      fields = [...cleared].filter(key => !form.get(key) && (key === 'publicMemo' ? old?.publicMemo ?? old?.memo : old?.privateMemo));
    await commit([up('timetables', {
      ...old,
      id: old?.id || `${d}-${p}`,
      date: d,
      period: p,
      subjectCode,
      type: old?.type || '일반',
      memo: publicMemo,
      publicMemo,
      privateMemo: form.get('privateMemo') || '',
      updatedAt: C.now()
    })]);
    closeModal();
    if (fields.length && scope === memoScope()) undoToast('수업 메모를 지웠습니다.', async () => {
      const current = db().timetables.find(t => t.date === d && t.period === p);
      if (!current || current.id !== (old?.id || `${d}-${p}`) || current.subjectCode !== subjectCode || fields.some(key => current[key])) throw Error('메모가 변경되어 복구할 수 없습니다.');
      const next = {
        ...current,
        updatedAt: C.now()
      };
      for (const key of fields) {
        next[key] = key === 'publicMemo' ? old.publicMemo ?? old.memo ?? '' : old.privateMemo || '';
        if (key === 'publicMemo') next.memo = next.publicMemo;
      }
      await commit([up('timetables', next)]);
    }, () => scope === memoScope());
  };
  const choices = subjects => subjects.map(subject => btn(esc(subject.code), () => save(subject.code, new FormData($('#modal-form'))), 'subject-color subject-stripe subject-choice' + (subject.code === slot?.subjectCode ? ' selected' : ''), `style="${C.subjectColorStyle(subject)}" aria-pressed="${subject.code === slot?.subjectCode}"`)).join('');
  modal(`${C.formatDate(d)} · ${p}교시 시간표`, `${C.gradeSubjectCodes(settings().grade).length ? `<div class="subject-grid">${choices(regular)}</div>` : '<p class="muted">설정-기본정보에서 학년을 설정하면 과목이 보입니다.</p>'}<details class="project-subjects" ${special.some(subject => subject.code === slot?.subjectCode) ? 'open' : ''}><summary>+ 특별·프로젝트 수업 ▾</summary><div class="subject-grid">${choices(special) || '<p class="muted">설정-과목·전담에서 특별 과목을 추가하세요.</p>'}</div></details><p class="muted">과목 버튼을 누르면 바로 저장됩니다.</p>${memoField('수업 메모 (공개)', 'publicMemo', slot?.publicMemo ?? slot?.memo ?? '')}${memoField('교사 전용 메모 (비공개)', 'privateMemo', slot?.privateMemo || '')}${slot ? btn('이 교시 비우기', async () => {
    if (confirm('이 교시를 비울까요?')) {
      await commit([{
        table: 'timetables',
        id: slot.id,
        remove: true
      }]);
      closeModal();
    }
  }, 'danger') : ''}`, f => save(slot?.subjectCode, f));
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
