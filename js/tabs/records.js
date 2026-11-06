import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, kindLabel, name, up } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, badge, bindLater, btn, checkbox, empty, esc, input, localTime, multiple, select, textarea, toast } from '../shared/ui.js';
import { taskStateEditor } from './assignments.js';
export function newRecord(r) {
  return {
    id: C.uid(),
    date: r.date || state.date,
    period: '기타',
    studentIds: [],
    tagIds: [],
    areas: [],
    kind: '관찰',
    extraType: null,
    incidentId: null,
    notified: false,
    printIncluded: true,
    text: '',
    action: '',
    autoRef: null,
    createdAt: C.now(),
    updatedAt: C.now(),
    ...r
  };
}
export async function bulkRecord(kind) {
  const ids = state.selected.filter(id => !C.excluded(db(), id, state.date));
  if (!ids.length) return toast('선택 학생이 모두 제외 상태입니다.');
  await commit(ids.map(id => up('records', newRecord({
    studentIds: [id],
    kind,
    date: state.date,
    text: kind === '칭찬' ? '칭찬을 남김' : kind === '지도' ? '조언을 전함' : '관찰 기록을 남김'
  }))));
  state.selected = [];
  render();
}
export function recordEditor(seed = {}, existing = false) {
  const r = newRecord(seed);
  const studentList = db().students.filter(s => !s.deletedAt || r.studentIds.includes(s.id));
  const tags = db().tags.filter(t => !t.deletedAt);
  const warnings = seed.warnings || [];
  modal(existing ? '기록 수정' : '기록 확인 후 저장', `${warnings.length ? `<div class="notice">${warnings.map(esc).join('<br>')}</div>` : ''}${existing ? `<p class="muted">최초 작성: ${esc(localTime(r.createdAt))}<br>최근 수정: ${esc(localTime(r.updatedAt))}</p>` : ''}${r.autoRef ? '<div class="notice">과제 자동 기록입니다. 과제 상태를 통해 수정하면 기록과 상태가 함께 바뀝니다.</div>' : ''}<div class="formgrid">${input('날짜', 'date', r.date, 'date', 'required')}${select('교시', 'period', ['아침', ...Array.from({
    length: 7
  }, (_, i) => `${i + 1}교시`), '점심', '방과후', '기타'], r.period)}<div class="span2"><label>학생 · 복수 선택 가능</label>${multiple(studentList.map(s => [s.id, (s.deletedAt ? '(나간 학생) ' : '') + s.no + '. ' + s.name]), 'students', r.studentIds)}</div>${select('구분', 'kind', C.KINDS.map(k => [k, kindLabel(k)]), r.kind)}<div><label>경험치 영역</label>${multiple(C.areaNames(db(), true).filter(a => !C.areaRows(db(), true).find(x => x.name === a)?.deletedAt || r.areas.includes(a)).map(a => [a, a]), 'areas', r.areas)}</div><div class="span2"><label>태그</label>${multiple(tags.map(t => [t.id, t.label]), 'tags', r.tagIds)}</div><div class="span2">${textarea('내용 · 입력 원문을 보존합니다.', 'text', r.text)}</div><div class="span2">${textarea('조치 · 필요하면 내용과 나누어 수정하세요.', 'action', r.action)}</div><div class="span2" id="extra-panel">${select('추가 기록 유형', 'extraType', ['메모', '사건', '상담'], r.extraType || '메모')}${input('새 사건 제목 · 사건 유형에서 새 사안을 만들 때', 'incidentTitle', r.kind === '추가기록' && r.extraType === '사건' ? r.text.slice(0, 40) : '')}${select('기존 사건 연결', 'incidentId', [['', '연결하지 않음'], ...db().incidents.map(i => [i.id, i.title + ' (' + i.status + ')'])], r.incidentId || '')}<div id="counsel-panel" class="panel" style="margin-top:12px">${select('상담 방식', 'method', ['전화', '대면', '문자·기타'], r.counseling?.method || '대면')}<div class="row" style="margin-top:12px">${checkbox('학생 참석', 'studentAttendee', r.counseling?.attendees?.student)}${checkbox('보호자 참석/통화', 'guardian', r.counseling?.attendees?.guardian)}${checkbox('추가 참석자', 'additional', r.counseling?.attendees?.additional)}</div><div id="guardian-info">${input('보호자 정보', 'guardianInfo', r.counseling?.attendees?.guardianInfo || '')}</div><div id="additional-info">${input('추가 참석자 정보', 'additionalInfo', r.counseling?.attendees?.additionalInfo || '')}</div></div><div class="row" style="margin-top:12px">${checkbox('가정 통보했음', 'notified', r.notified)}${checkbox('가정 발송 보고서에 인쇄 포함', 'printIncluded', r.kind === '추가기록' ? r.printIncluded : false)}</div></div></div>`, async f => {
    const ids = f.getAll('students');
    if (!ids.length) throw Error('학생을 1명 이상 선택하세요.');
    if (!f.get('text').trim()) throw Error('기록 내용을 입력하세요.');
    if (existing && r.autoRef) throw Error('자동 기록은 해당 과제의 상태에서 변경하세요.');
    const recordDate = f.get('date');
    const skipped = ids.filter(id => C.excluded(db(), id, recordDate));
    if (skipped.length) throw Error('출결 제외 학생은 기록 대상에서 해제해 주세요: ' + skipped.map(name).join(', '));
    let incidentId = f.get('incidentId') || null;
    const kind = f.get('kind'),
      extra = kind === '추가기록';
    let ops = [];
    if (extra && f.get('extraType') === '사건' && !incidentId) {
      const title = f.get('incidentTitle').trim();
      if (!title) throw Error('사건 제목을 입력하세요.');
      incidentId = C.uid();
      ops.push(up('incidents', {
        id: incidentId,
        title,
        date: recordDate,
        studentIds: ids,
        status: '진행중',
        description: f.get('text'),
        linkedIds: [],
        createdAt: C.now(),
        updatedAt: C.now()
      }));
    }
    if (incidentId) {
      const old = db().incidents.find(i => i.id === incidentId);
      if (old) ops.push(up('incidents', {
        ...old,
        studentIds: [...new Set([...old.studentIds, ...ids])],
        updatedAt: C.now()
      }));
    }
    const values = {
      ...r,
      date: recordDate,
      period: f.get('period'),
      kind,
      text: f.get('text').trim(),
      action: f.get('action').trim(),
      areas: f.getAll('areas'),
      tagIds: f.getAll('tags'),
      extraType: extra ? f.get('extraType') : null,
      incidentId,
      notified: !!f.get('notified'),
      printIncluded: extra ? !!f.get('printIncluded') : true,
      counseling: extra && f.get('extraType') === '상담' ? {
        method: f.get('method'),
        attendees: {
          student: !!f.get('studentAttendee'),
          guardian: !!f.get('guardian'),
          guardianInfo: f.get('guardian') ? f.get('guardianInfo') : null,
          additional: !!f.get('additional'),
          additionalInfo: f.get('additional') ? f.get('additionalInfo') : null
        }
      } : null,
      updatedAt: C.now()
    };
    delete values.warnings;
    if (existing) ops.push(up('records', {
      ...values,
      studentIds: ids
    }));else for (const id of ids) ops.push(up('records', {
      ...values,
      id: C.uid(),
      studentIds: [id]
    }));
    await commit(ops);
    state.selected = [];
    closeModal();
    render();
  });
  const form = $('#modal-form');
  const update = () => {
    const extra = form.elements.kind.value === '추가기록';
    $('#extra-panel').hidden = !extra;
    $('#counsel-panel').hidden = form.elements.extraType.value !== '상담';
    $('#guardian-info').hidden = !form.elements.guardian.checked;
    $('#additional-info').hidden = !form.elements.additional.checked;
  };
  form.elements.printIncluded.onchange = e => {
    if (e.target.checked && !confirm('이 내용은 학부모에게 전달되는 보고서에 인쇄됩니다. 전달 가능한 내용인지 다시 한번 확인하셨나요?')) e.target.checked = false;
  };
  form.onchange = e => {
    if (e.target.name === 'tags') {
      const checked = [...form.querySelectorAll('[name=tags]:checked')].map(x => x.value);
      const areas = new Set(tags.filter(t => checked.includes(t.id)).map(t => t.area));
      form.querySelectorAll('[name=areas]').forEach(el => {
        if (areas.has(el.value)) el.checked = true;
      });
    }
    update();
  };
  update();
  form.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      form.requestSubmit();
    }
  };
}
export function recordCard(r, controls = true) {
  return `<article class="record ${r.kind === '칭찬' ? 'praise' : r.kind === '지도' ? 'advice' : ''}"><div class="row between"><div class="row"><strong>${esc(r.studentIds.map(name).join(', '))}</strong>${badge(kindLabel(r.kind))}${r.extraType ? badge(r.extraType) : ''}<small>${esc(r.date)} ${esc(r.period)}</small>${r.autoRef ? badge('자동') : ''}${r.kind === '추가기록' ? badge(r.printIncluded ? '인쇄 포함' : '비공개') : ''}${r.notified ? badge('가정 통보') : ''}</div>${controls ? `<div class="row">${r.incidentId ? btn('사건 보기', () => incidentDetail(r.incidentId)) : ''}${r.autoRef ? btn('과제 상태', () => {
    const state = db().assignmentStates.find(s => s.id === r.autoRef),
      a = db().assignments.find(a => a.id === state?.assignmentId);
    if (a) taskStateEditor(a, state.date, state.studentId);
  }) : btn('수정', () => recordEditor(r, true))}${btn('삭제', async () => {
    if (r.autoRef) {
      if (!confirm('자동 기록을 삭제하면 연결된 과제를 진행중으로 되돌립니다. 계속할까요?')) return;
      const state = db().assignmentStates.find(s => s.id === r.autoRef),
        a = db().assignments.find(a => a.id === state?.assignmentId);
      if (a) await commit(C.taskStateOps(db(), a, state.date, state.studentId, '진행중'));else await commit([{
        table: 'records',
        id: r.id,
        remove: true
      }]);
    } else if (confirm('이 기록을 삭제할까요?')) await commit([{
      table: 'records',
      id: r.id,
      remove: true
    }]);
  }, 'danger')}</div>` : ''}</div><div class="body">${esc(r.text)}</div>${r.action ? `<div class="action">조치 · ${esc(r.action)}</div>` : ''}<div class="chips" style="margin-top:8px">${(r.areas || []).map(badge).join('')}${(r.tagIds || []).map(id => badge(db().tags.find(t => t.id === id && !t.deletedAt)?.label || '(삭제된 항목)')).join('')}</div></article>`;
}
export function recordsView() {
  const f = state.recordFilters,
    list = db().records.filter(r => r.date >= f.from && r.date <= f.to && (!f.student || r.studentIds.includes(f.student)) && (!f.kind || r.kind === f.kind) && (!f.tag || r.tagIds.includes(f.tag)) && (!f.area || r.areas.includes(f.area)) && (!f.q || [r.text, r.action].join(' ').includes(f.q))).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return `<div class="toolbar"><div><h2>기록</h2><small>사실을 남기고, 변화의 흐름을 살펴보세요.</small></div><div class="row">${btn('오늘', () => {
    state.recordFilters.from = state.recordFilters.to = C.today();
    render();
  })}${btn('이번 달', () => {
    state.recordFilters.from = state.date.slice(0, 7) + '-01';
    state.recordFilters.to = state.date;
    render();
  })}${btn('사건 목록', incidentList)}${btn('+ 기록', () => recordEditor({
    date: state.date
  }), 'primary')}</div></div><form id="record-filter" class="filters">${input('시작', 'from', f.from, 'date')}${input('종료', 'to', f.to, 'date')}${select('학생', 'student', [['', '전체'], ...db().students.map(s => [s.id, name(s.id)])], f.student)}${select('구분', 'kind', [['', '전체'], ...C.KINDS.map(k => [k, kindLabel(k)])], f.kind)}${select('영역', 'area', [['', '전체'], ...C.areaNames(db(), true)], f.area)}${select('태그', 'tag', [['', '전체'], ...db().tags.map(t => [t.id, t.label])], f.tag)}${input('내용 검색', 'q', f.q)}<button class="primary">조회</button></form><p class="muted">${list.length}건 · 제외일의 기록은 보존되며 점수 집계에서만 제외됩니다.</p>${list.map(r => recordCard(r)).join('') || empty('조건에 맞는 기록이 없습니다.', '기간이나 필터를 바꾸어 보세요.')}${bindLater('record-filter', 'submit', e => {
    e.preventDefault();
    state.recordFilters = Object.fromEntries(new FormData(e.target));
    render();
  })}`;
}
export function incidentList() {
  modal('사건 목록', `${btn('+ 사건 기록', () => recordEditor({
    kind: '추가기록',
    extraType: '사건',
    printIncluded: false,
    studentIds: state.selected
  }))}${db().incidents.map(i => `<div class="record"><div class="row between"><div><strong>${esc(i.title)}</strong> ${badge(i.status)}<div class="muted">${esc(i.date)} · ${esc(i.studentIds.map(name).join(', '))}</div></div>${btn('타임라인', () => incidentDetail(i.id))}</div></div>`).join('') || empty('등록된 사건이 없습니다.')}`);
}
export function incidentDetail(id) {
  const incident = db().incidents.find(i => i.id === id);
  if (!incident) return toast('사건을 찾지 못했습니다.');
  const linked = C.linkedIncidentIds(db(), id),
    records = db().records.filter(r => linked.has(r.incidentId)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  modal(incident.title, `<div class="row">${badge(incident.status)}${btn(incident.status === '진행중' ? '종결 처리' : '진행중으로', async () => {
    await commit([up('incidents', {
      ...incident,
      status: incident.status === '진행중' ? '종결' : '진행중',
      updatedAt: C.now()
    })]);
    incidentDetail(id);
  })}${btn('+ 후속 기록', () => recordEditor({
    studentIds: incident.studentIds,
    kind: '추가기록',
    extraType: '메모',
    incidentId: id,
    printIncluded: false
  }))}${btn('기록 연결', () => linkRecords(id))}${btn('사건 연결', () => linkIncidents(id))}</div><div class="panel" style="margin-top:12px"><small>${esc(incident.date)} · ${esc(incident.studentIds.map(name).join(', '))}</small><p style="white-space:pre-wrap">${esc(incident.description)}</p></div>${[...linked].filter(x => x !== id).map(x => {
    const i = db().incidents.find(v => v.id === x);
    return i ? badge('연결: ' + i.title) : '';
  }).join('')}${records.map(r => `<small>${esc(db().incidents.find(i => i.id === r.incidentId)?.title)}</small>${recordCard(r)}`).join('')}`);
}
export function linkRecords(id) {
  const list = [...db().records].sort((a, b) => b.date.localeCompare(a.date));
  modal('과거 기록 연결', `<p class="muted">체크한 기록을 이 사건에 연결합니다. 다른 사건에 속한 기록은 이동됩니다.</p><input id="link-search" placeholder="기록 내용·학생 검색" aria-label="연결할 기록 검색" style="width:100%;margin-bottom:12px">${list.map(r => `<label class="record inline" data-search="${esc(r.text + ' ' + r.studentIds.map(name).join(' '))}"><input type="checkbox" name="records" value="${esc(r.id)}" ${r.incidentId === id ? 'checked' : ''}><span>${esc(r.date)} · ${esc(r.studentIds.map(name).join(', '))}<br>${esc(r.text)}</span></label>`).join('')}`, async f => {
    const chosen = new Set(f.getAll('records'));
    const ops = list.filter(r => chosen.has(r.id) || r.incidentId === id).map(r => up('records', {
      ...r,
      incidentId: chosen.has(r.id) ? id : null,
      updatedAt: C.now()
    }));
    await commit(ops);
    incidentDetail(id);
  });
  $('#link-search').oninput = e => document.querySelectorAll('[data-search]').forEach(el => el.hidden = !el.dataset.search.includes(e.target.value));
}
export function linkIncidents(id) {
  const incident = db().incidents.find(i => i.id === id),
    list = db().incidents.filter(i => i.id !== id);
  modal('사건 연결 · 병합하지 않고 연결합니다.', multiple(list.map(i => [i.id, i.date + ' ' + i.title]), 'linked', incident.linkedIds || []), async f => {
    const chosen = f.getAll('linked');
    const ops = [up('incidents', {
      ...incident,
      linkedIds: chosen,
      updatedAt: C.now()
    })];
    for (const i of list) {
      let links = (i.linkedIds || []).filter(x => x !== id);
      if (chosen.includes(i.id)) links.push(id);
      ops.push(up('incidents', {
        ...i,
        linkedIds: links,
        updatedAt: C.now()
      }));
    }
    await commit(ops);
    incidentDetail(id);
  });
}
