import {dateRangeField} from '../components/date-range.js';
import { attachHoldDelete } from '../shared/hold-delete.js';
import { actionIcon } from '../components/economy-action.js';
import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, kindLabel, name, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, badge, bindLater, btn, checkbox, empty, esc, input, localTime, multiple, select, textarea, toast, run, registerUndo, filterSelect, filterInput } from '../shared/ui.js';
import { taskStateEditor } from './assignments.js';
import { studentDetail } from './students.js';
const recordDeletions = new Map();
export function newRecord(r) {
  return {
    id: C.uid(),
    date: r.date || state.date,
    period: '',
    studentIds: [],
    areas: [],
    kind: '관찰',
    extraType: null,
    incidentId: null,
    notified: false,
    printIncluded: r.kind !== '추가기록',
    text: '',
    action: '',
    autoRef: null,
    createdAt: C.now(),
    updatedAt: C.now(),
    ...r,
    createdAt: r.createdAt || C.now(),
    areas: C.recordAreas(r),
    ...(r.area !== undefined ? {
      area: C.areaName(r.area)
    } : {})
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
  const warnings = seed.warnings || [];
  modal(existing ? '기록 수정' : '기록 확인 후 저장', `${warnings.length ? `<div class="notice">${warnings.map(esc).join('<br>')}</div>` : ''}${existing ? `<p class="muted">최초 작성: ${esc(localTime(r.createdAt))}<br>최근 수정: ${esc(localTime(r.updatedAt))}</p>` : ''}${r.autoRef ? '<div class="notice">과제 자동 기록입니다. 과제 상태를 통해 수정하면 기록과 상태가 함께 바뀝니다.</div>' : ''}<div class="formgrid">${input('날짜', 'date', r.date, 'date', 'required')}${select('교시', 'period', [['', '시간 미지정'], ...C.PERIODS], C.recordPeriod(r.period))}<div class="span2"><label>학생 · 복수 선택 가능</label>${studentChips(studentList, r.studentIds)}</div><div class="record-kind-row span2">${select('구분', 'kind', C.KINDS.map(k => [k, kindLabel(k)]), r.kind)}<div id="extra-type-control">${select('추가기록 유형', 'extraType', ['메모', '사건', '상담'], r.extraType || '메모')}</div></div><div><label>분야</label>${multiple(C.areaNames(db(), true).filter(a => !C.areaRows(db(), true).find(x => x.name === a)?.deletedAt || r.areas.includes(a)).map(a => [a, a]), 'areas', r.areas)}</div><div class="span2">${textarea('내용 · 입력 원문을 보존합니다.', 'text', r.text)}</div><div class="span2">${textarea('지도 내용 · 필요하면 내용과 나누어 수정하세요.', 'action', r.action)}</div><div class="span2" id="extra-panel">${input('새 사건 제목 · 사건 유형에서 새 사안을 만들 때', 'incidentTitle', db().incidents.find(i => i.id === r.incidentId)?.title || C.incidentTitle(db(), r.studentIds, r.date))}${select('기존 사건 연결', 'incidentId', [['', '연결하지 않음'], ...db().incidents.map(i => [i.id, i.title + ' (' + i.status + ')'])], r.incidentId || '')}<div id="counsel-panel" class="panel" style="margin-top:12px">${select('상담 방식', 'method', ['전화', '대면', '문자·기타'], r.counseling?.method || '대면')}<div class="row" style="margin-top:12px">${checkbox('학생 참석', 'studentAttendee', r.counseling?.attendees?.student)}${checkbox('보호자 참석/통화', 'guardian', r.counseling?.attendees?.guardian)}${checkbox('추가 참석자', 'additional', r.counseling?.attendees?.additional)}</div><div id="guardian-info">${input('보호자 정보', 'guardianInfo', r.counseling?.attendees?.guardianInfo || '')}</div><div id="additional-info">${input('추가 참석자 정보', 'additionalInfo', r.counseling?.attendees?.additionalInfo || '')}</div></div><div class="row" style="margin-top:12px">${checkbox('가정 통보했음', 'notified', r.notified)}</div></div><div class="span2">${checkbox('비공개', 'privateRecord', r.printIncluded === false || r.kind === '추가기록' && r.printIncluded !== true)}</div></div>`, async f => {
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
      createdAt: r.createdAt || C.now(),
      date: recordDate,
      period: f.get('period'),
      kind,
      text: C.replaceStudentNumbers(f.get('text').trim(), db()),
      action: C.replaceStudentNumbers(f.get('action').trim(), db()),
      areas: f.getAll('areas'),
      extraType: extra ? f.get('extraType') : null,
      incidentId,
      notified: !!f.get('notified'),
      printIncluded: !f.has('privateRecord'),
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
  let autoTitle = form.elements.incidentTitle.value,
    titleEdited = !!r.incidentId;
  form.elements.incidentTitle.oninput = () => {
    titleEdited = form.elements.incidentTitle.value !== autoTitle;
  };
  const update = () => {
    const generated = C.incidentTitle(db(), [...form.querySelectorAll('[name=students]:checked')].map(el => el.value), form.elements.date.value);
    if (!titleEdited || form.elements.incidentTitle.value === autoTitle) {
      form.elements.incidentTitle.value = generated;
      autoTitle = generated;
    }
    const extra = form.elements.kind.value === '추가기록';
    $('#extra-panel').hidden = !extra;
    $('#extra-type-control').hidden = !extra;
    $('#counsel-panel').hidden = form.elements.extraType.value !== '상담';
    $('#guardian-info').hidden = !form.elements.guardian.checked;
    $('#additional-info').hidden = !form.elements.additional.checked;
  };
  form.onchange = update;
  update();
  form.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      form.requestSubmit();
    }
  };
}
function recordCreatedTime(r) {
  const created = new Date(r.createdAt), updated = new Date(r.updatedAt);
  if (!r.createdAt || !Number.isFinite(created.getTime())) return '';
  const format = instant => C.formatTimestamp(instant);
  const modified = r.updatedAt && Number.isFinite(updated.getTime()) && updated - created >= 60000;
  return `<time class="record-created-time" datetime="${esc(r.createdAt)}" title="최초 작성 ${esc(C.formatTimestamp(r.createdAt))}">작성 ${esc(format(created))}</time>${modified ? ` / <time class="record-updated-time" datetime="${esc(r.updatedAt)}" title="최근 수정 ${esc(C.formatTimestamp(r.updatedAt))}">수정 ${esc(format(updated))}</time>` : ''}`;
}
// Record cards use the same 38px circular tooltip control as the shop: pencil for
// edit, bin for delete. The bin keeps its 1.2s hold, and only the hold itself grows
// the circle and sweeps the rose fill from left to right.
function recordActionLabel(label) {
  return `<span class="tooltip" aria-hidden="true">${label}</span><span class="economy-action-label" aria-hidden="true">${label}</span>`;
}
function recordEditAction(fn, disabled) {
  const markup = actionIcon('edit') + recordActionLabel('수정');
  return `<span class="economy-action economy-action-edit record-icon-action">${btn(markup, fn, 'record-edit economy-icon-button', `aria-label="수정" title="수정" ${disabled ? 'disabled' : ''}`)}</span>`;
}
function holdRecordDelete(record) {
  const id='hold-record-'+String(++state.actionNo);
  setTimeout(()=>{
    const button=document.getElementById(id);
    if(button)attachHoldDelete(button,()=>run(()=>requestRecordDeletion(record,{target:button})));
  },0);
  const glyph=actionIcon('delete');
  return `<span class="economy-action economy-action-delete record-icon-action"><button type="button" id="${id}" class="record-delete hold-delete economy-icon-button" aria-label="삭제" aria-description="1.2초 동안 누르면 삭제됩니다. 5초 안에 실행 취소할 수 있습니다." ${recordDeletions.has(record.id)?'disabled':''}><span class="hold-fill" aria-hidden="true"><span class="fill"></span></span><span class="hold-glyph base" aria-hidden="true">${glyph}</span><span class="hold-glyph invert" aria-hidden="true">${glyph}</span>${recordActionLabel('삭제')}</button></span>`;
}
export function recordCard(r, controls = true, detail = false) {
  return `<article data-record-id="${esc(r.id)}" class="record ${recordDeletions.has(r.id) ? 'is-deleting' : ''} ${detail ? 'detail-record' : ''} ${r.kind === '칭찬' ? 'praise' : r.kind === '지도' ? 'advice' : r.kind === '관찰' ? 'observation' : ''} ${r.kind === '추가기록' && r.extraType === '사건' ? 'incident-record' : ''}"><div class="record-head"><div class="row record-meta"><strong>${esc(r.studentIds.map(name).join(', '))}</strong>${['칭찬', '지도'].includes(r.kind) ? '' : badge(C.recordLabel(r))}<small>${esc(C.formatDate(r.date))}${C.recordPeriod(r.period) ? ' ' + esc(C.recordPeriod(r.period)) : ''}</small>${recordCreatedTime(r)}${r.printIncluded === false || r.kind === '추가기록' && r.printIncluded !== true ? badge('비공개') : r.kind === '추가기록' ? badge('인쇄 포함') : ''}${r.notified ? badge('가정 통보') : ''}</div>${controls ? `<div class="row record-controls">${recordEditAction(() => {
    if (r.autoRef) {
      const state = db().assignmentStates.find(s => s.id === r.autoRef),
        a = db().assignments.find(a => a.id === state?.assignmentId);
      if (a) taskStateEditor(a, state.date, state.studentId);
      return;
    }
    recordEditor(r, true);
  }, recordDeletions.has(r.id))}${holdRecordDelete(r)}${r.incidentId ? btn('사건 보기', () => incidentDetail(r.incidentId)) : ''}</div>` : ''}</div><div class="record-content-line">${C.recordAreas(r).map(badge).join('')}<span class="body">${esc(r.text)}</span></div>${r.action ? `<div class="action">지도 내용 · ${esc(r.action)}</div>` : ''}</article>`;
}
export function recordsView() {
  const f = state.recordFilters,
    list = db().records.filter(r => r.date >= f.from && r.date <= f.to && (!f.student || r.studentIds.includes(f.student)) && (!f.kind || r.kind === f.kind) && (!f.area || C.recordAreas(r).includes(C.areaName(f.area))) && (!f.q || [r.text, r.action].join(' ').includes(f.q))).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return `<div class="toolbar"><div><h2>관찰기록</h2><small>사실을 남기고, 변화의 흐름을 살펴보세요.</small></div><div class="row">${btn('오늘', () => {
    state.recordFilters.from = state.recordFilters.to = C.today();
    render();
  })}${btn('이번 달', () => {
    state.recordFilters.from = state.date.slice(0, 7) + '-01';
    state.recordFilters.to = state.date;
    render();
  })}${btn('사건 목록', incidentList)}${btn('+ 기록', () => recordEditor({
    date: state.date
  }), 'primary')}</div></div><form id="record-filter" class="filters">${dateRangeField(f.from,f.to,range=>{state.recordFilters={...Object.fromEntries(new FormData($('#record-filter'))),...range};render();})}<input type="hidden" name="from" value="${esc(f.from)}"><input type="hidden" name="to" value="${esc(f.to)}">${filterSelect('학생','student',[['','전체 학생'],...db().students.map(s=>[s.id,name(s.id)])],f.student)}${filterSelect('유형','kind',[['','전체 유형'],...C.KINDS.map(k=>[k,kindLabel(k)])],f.kind)}${filterSelect('영역','area',[['','전체 영역'],...C.areaNames(db(),true)],f.area)}${filterInput('내용 검색','q',f.q)}<button class="primary">조회</button></form><p class="muted">${list.length}건 · 제외일의 기록은 보존되며 점수 집계에서만 제외됩니다.</p>${list.map(r => recordCard(r)).join('') || empty('조건에 맞는 기록이 없습니다.', '기간이나 필터를 바꾸어 보세요.')}${bindLater('record-filter', 'submit', e => {
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
  }))}${db().incidents.map(i => `<div class="record"><div class="row between"><div><strong>${esc(i.title)}</strong> ${badge(i.status)}<div class="muted">${esc(C.formatDate(i.date))} · ${esc(i.studentIds.map(name).join(', '))}</div></div>${btn('타임라인', () => incidentDetail(i.id))}</div></div>`).join('') || empty('등록된 사건이 없습니다.')}`);
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
  }))}${btn('기록 연결', () => linkRecords(id))}${btn('사건 연결', () => linkIncidents(id))}</div><div class="panel" style="margin-top:12px"><small>${esc(C.formatDate(incident.date))} · ${esc(incident.studentIds.map(name).join(', '))}</small><p style="white-space:pre-wrap">${esc(incident.description)}</p></div>${[...linked].filter(x => x !== id).map(x => {
    const i = db().incidents.find(v => v.id === x);
    return i ? badge('연결: ' + i.title) : '';
  }).join('')}${records.map(r => `<small>${esc(db().incidents.find(i => i.id === r.incidentId)?.title)}</small>${recordCard(r)}`).join('')}`);
}
export function linkRecords(id) {
  const list = [...db().records].sort((a, b) => b.date.localeCompare(a.date));
  modal('과거 기록 연결', `<p class="muted">체크한 기록을 이 사건에 연결합니다. 다른 사건에 속한 기록은 이동됩니다.</p><input id="link-search" placeholder="기록 내용·학생 검색" aria-label="연결할 기록 검색" style="width:100%;margin-bottom:12px">${list.map(r => `<label class="record inline" data-search="${esc(r.text + ' ' + r.studentIds.map(name).join(' '))}"><input type="checkbox" name="records" value="${esc(r.id)}" ${r.incidentId === id ? 'checked' : ''}><span>${esc(C.formatDate(r.date))} · ${esc(r.studentIds.map(name).join(', '))}<br>${esc(r.text)}</span></label>`).join('')}`, async f => {
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
function studentChips(list, selected) {
  return `<div class="student-choice-chips" role="group" aria-label="기록 대상 학생">${list.map(s => `<label class="student-choice-chip"><input type="checkbox" name="students" value="${esc(s.id)}" ${selected.includes(s.id) ? 'checked' : ''}><span>${esc((s.deletedAt ? '(나간 학생) ' : '') + s.no + '. ' + s.name)}</span></label>`).join('')}</div>`;
}
function recordDeletionScope() {
  return `${store.mode}:${store.classId}:${db()?.settings?.[0]?.academicYear}:${state.viewMode}`;
}
function recordElements(id) {
  return [...document.querySelectorAll('article.record[data-record-id]')].filter(el => el.dataset.recordId === id);
}
function highlightRecord(id, on) {
  for (const el of recordElements(id)) {
    el.classList.toggle('is-deleting', on);
    el.querySelectorAll('.record-edit,.record-delete').forEach(button => button.disabled = on);
  }
}
function removeRecordDeletion(job) {
  clearInterval(job.timer);
  clearTimeout(job.retry);
  if (recordDeletions.get(job.id) === job) recordDeletions.delete(job.id);
  job.unregister?.();
  job.root?.remove();
  highlightRecord(job.id, false);
  const container = document.querySelector('.record-delete-toasts');
  if (container && !container.children.length) container.remove();
}
async function requestRecordDeletion(record, event) {
  if(recordDeletions.has(record.id))return;
  const current=db().records.find(row=>row.id===record.id);
  if(!current)return;
  const scope=recordDeletionScope(), fingerprint=JSON.stringify(current);
  const detail=event?.target?.closest?.('.student-detail-content');
  let container=document.querySelector('.record-delete-toasts');
  if(!container){container=document.createElement('div');container.className='record-delete-toasts';document.body.append(container);}
  const root=document.createElement('div'),label=document.createElement('span'),button=document.createElement('button');
  root.className='record-delete-toast';root.dataset.recordId=record.id;root.setAttribute('role','status');
  label.textContent=record.studentIds.map(name).join(', ')+' · '+C.recordLabel(record)+' 삭제됨 · '+String(record.text||'').slice(0,36);
  button.type='button';button.textContent='삭제 저장 중';button.disabled=true;root.append(label,button);container.append(root);
  const job={id:record.id,scope,root,button,detail,phase:'saving',timer:null,retry:null,undoOps:[],after:[]};
  recordDeletions.set(job.id,job);highlightRecord(job.id,true);
  try{
    await commit(latest=>{
      if(scope!==recordDeletionScope()||state.locked||JSON.stringify(latest.records.find(row=>row.id===record.id))!==fingerprint)throw Error('기록이 변경되었습니다. 다시 확인하세요.');
      let ops=[];
      if(current.autoRef){
        const taskState=latest.assignmentStates.find(row=>row.id===current.autoRef),assignment=latest.assignments.find(row=>row.id===taskState?.assignmentId);
        if(taskState&&assignment)ops=C.taskStateOps(latest,assignment,taskState.date,taskState.studentId,'진행중',taskState.memo||'');
      }
      if(!ops.some(op=>op.table==='records'&&op.id===record.id&&op.remove))ops.push({table:'records',id:record.id,remove:true});
      job.undoOps=ops.map(op=>{const old=latest[op.table].find(row=>row.id===op.id);return old?{table:op.table,id:op.id,data:structuredClone(old)}:{table:op.table,id:op.id,remove:true};});
      return ops;
    },'');
    if($('#toast')) $('#toast').style.display='none';
    if(scope!==recordDeletionScope()||state.locked){removeRecordDeletion(job);return;}
    job.after=job.undoOps.map(op=>({table:op.table,id:op.id,value:JSON.stringify(db()[op.table].find(row=>row.id===op.id))}));
    job.phase='undoable';job.deadline=performance.now()+5000;button.disabled=false;
    const refreshDetail=()=>{const active=document.querySelector('.student-detail-content');if(detail&&active?.dataset.studentId===detail.dataset.studentId&&$('#modal')?.open)studentDetail(detail.dataset.studentId,detail.dataset.from,detail.dataset.to);};
    refreshDetail();
    button.onclick=()=>run(async()=>{
      if(job.phase!=='undoable'||performance.now()>=job.deadline||scope!==recordDeletionScope()||state.locked)return;
      job.phase='restoring';button.disabled=true;
      try{
        await commit(latest=>{
          if(scope!==recordDeletionScope()||state.locked)throw Error('화면이 변경되어 실행 취소할 수 없습니다.');
          if(job.after.some(op=>JSON.stringify(latest[op.table].find(row=>row.id===op.id))!==op.value))throw Error('연결된 기록이나 과제가 변경되어 실행 취소할 수 없습니다.');
          return job.undoOps;
        },'삭제를 실행 취소했습니다.');
        removeRecordDeletion(job);refreshDetail();
      }catch(error){removeRecordDeletion(job);throw error;}
    });
    job.unregister=registerUndo(button,()=>job.phase==='undoable'&&performance.now()<job.deadline&&scope===recordDeletionScope());
    const tick=()=>{
      if(scope!==recordDeletionScope()||state.locked){removeRecordDeletion(job);return;}
      if(job.phase!=='undoable')return;
      const remaining=Math.ceil((job.deadline-performance.now())/1000);
      if(remaining<=0){removeRecordDeletion(job);return;}
      button.textContent=`↩ 실행취소 (${remaining}초)`;
    };
    tick();job.timer=setInterval(tick,100);
  }catch(error){removeRecordDeletion(job);render();throw error;}
}
