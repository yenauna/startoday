import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, kindLabel, name, settings, students, up } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, badge, btn, checkbox, empty, esc, input, textarea } from '../shared/ui.js';
import { taskStateEditor } from './assignments.js';
import { recordCard, recordEditor } from './records.js';
export function studentsView() {
  const first = state.date.slice(0, 7) + '-01';
  return `<div class="toolbar"><div><h2>학생</h2><small>이번 달 기록과 아직 남은 일을 살펴보세요.</small></div>${btn('+ 학생', () => studentEditor(), 'primary')}</div><div class="table-wrap"><table><thead><tr><th>학생</th><th>모둠</th><th>이번 달 칭찬 / 조언</th><th>미완료 과제</th><th>최근 기록일</th><th>바로 기록</th></tr></thead><tbody>${students().map(s => {
    const records = C.scores(db(), s.id, first, state.date).records;
    return `<tr><td>${btn(esc(name(s.id)), () => studentDetail(s.id))}</td><td>${esc(s.group)}</td><td>${records.filter(r => r.kind === '칭찬').length} / ${records.filter(r => r.kind === '지도').length}</td><td>${C.pending(db(), s.id, state.date).length}</td><td>${esc(db().records.filter(r => r.studentIds.includes(s.id)).map(r => r.date).sort().at(-1) || '—')}</td><td>${btn('+ 기록', () => recordEditor({
      studentIds: [s.id],
      date: state.date
    }))}</td></tr>`;
  }).join('')}</tbody></table></div>${!students().length ? empty('등록된 학생이 없습니다.', '학생을 추가하거나 설정에서 명단을 붙여 넣으세요.') : ''}`;
}
export function studentDetail(id, from = state.date.slice(0, 7) + '-01', to = state.date) {
  const s = db().students.find(s => s.id === id);
  if (!s) return;
  const score = C.scores(db(), id, from, to),
    records = db().records.filter(r => r.studentIds.includes(id) && r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    pending = C.pending(db(), id, state.date);
  modal(name(id), `<div class="row" style="margin-bottom:14px">${btn('+ 기록', () => recordEditor({
    studentIds: [id],
    date: state.date
  }))}${btn('학생 수정', () => studentEditor(s))}${btn('보고서로 내보내기', () => reportDialog(id, from, to), 'primary')}${btn('이번 주', () => studentDetail(id, C.addDays(state.date, -((C.weekday(state.date) + 6) % 7)), state.date))}${btn('이번 달', () => studentDetail(id, state.date.slice(0, 7) + '-01', state.date))}</div><div class="row"><input aria-label="기록 조회 시작" type="date" id="student-from" value="${from}"><span>~</span><input aria-label="기록 조회 종료" type="date" id="student-to" value="${to}">${btn('조회', () => studentDetail(id, $('#student-from').value, $('#student-to').value))}</div><div class="panel" style="margin-top:14px"><h3>★ ${score.total} · 기간 요약</h3><div class="chips">${C.AREAS.map(a => badge(a + ' ' + score.areas[a])).join('')}</div><p class="muted" style="margin-top:10px">${db().tags.map(t => {
    const n = records.filter(r => r.tagIds.includes(t.id)).length;
    return n ? esc(t.label) + ' ' + n + '회' : '';
  }).filter(Boolean).join(' · ') || '태그 기록 없음'}</p></div><h3>미완료 과제 ${pending.length}건</h3>${pending.map(({
    assignment: a,
    date: d
  }) => btn(esc(d + ' ' + a.title), () => taskStateEditor(a, d, id))).join('') || '<p class="muted">남은 과제가 없습니다.</p>'}<details style="margin-top:14px"><summary>과제 처리 이력</summary>${db().assignmentStates.filter(x => x.studentId === id && x.date >= from && x.date <= to).map(x => `<p>${esc(x.date)} · ${esc(db().assignments.find(a => a.id === x.assignmentId)?.title || '(삭제된 과제)')} · ${esc(x.status)} ${esc(x.memo)}</p>`).join('') || '<p>처리 이력 없음</p>'}</details><details><summary>출결 제외 이력</summary><p>${db().attendance.filter(x => x.studentId === id && x.excluded).map(x => esc(x.date)).sort().join(' · ') || '없음'}</p></details><h3 style="margin-top:20px">기록 ${records.length}건</h3>${records.map(r => recordCard(r)).join('') || empty('조회 기간에 기록이 없습니다.')}`);
}
export function studentEditor(s = null) {
  const row = s || {
    id: C.uid(),
    no: Math.max(0, ...students().map(s => s.no)) + 1,
    name: '',
    group: '',
    seat: null,
    academicYear: settings().academicYear,
    studentCode: '',
    createdAt: C.now()
  };
  modal(s ? '학생 수정' : '학생 추가', `<div class="formgrid">${input('번호', 'no', row.no, 'number', 'min="1" required')}${input('이름', 'name', row.name, 'text', 'required')}${input('모둠', 'group', row.group)}${input('교실 화면 별칭', 'alias', row.alias || '')}</div>`, async f => {
    const next = {
      ...row,
      no: Number(f.get('no')),
      name: f.get('name').trim(),
      group: f.get('group'),
      alias: f.get('alias'),
      deletedAt: null
    };
    if (!next.name || !Number.isInteger(next.no) || next.no < 1) throw Error('번호와 이름을 확인하세요.');
    const duplicate = students().filter(x => x.id !== row.id && x.no === next.no);
    if (duplicate.length && !confirm('같은 번호 학생이 있습니다. 그대로 저장할까요?')) return;
    if (!s) {
      const removed = db().students.find(x => x.deletedAt && x.no === next.no && x.name === next.name);
      if (removed && confirm('같은 번호·이름의 나간 학생이 있습니다. 기존 기록과 다시 연결할까요?')) {
        next.id = removed.id;
        next.createdAt = removed.createdAt;
        next.seat = null;
      }
    }
    await commit([up('students', next)]);
    closeModal();
  });
}
export function reportDialog(id, from, to) {
  const s = db().students.find(x => x.id === id);
  modal('개별 보고서 · 기간 선택', `<p>${esc(name(id))}</p><div class="formgrid">${input('시작일', 'from', from, 'date', 'required')}${input('종료일', 'to', to, 'date', 'required')}</div><p class="muted">추가 기록은 인쇄 포함을 승인한 건만 출력합니다. 다른 학생의 이름은 ‘다른 학생’으로 바꾸어 미리보기에 표시합니다.</p>`, async f => {
    C.dates(f.get('from'), f.get('to'));
    reportPreview(s, f.get('from'), f.get('to'));
  }, '인쇄 내용 확인');
}
export function reportPreview(s, from, to) {
  const records = C.reportRecords(db(), s.id, from, to);
  modal('인쇄 전 내용 확인', `<div class="notice">각 기록에서 이 학생과 관계없는 내용·다른 학생의 개인정보를 제거해 주세요. 이름 자동 가림만으로 본문 속 모든 개인정보를 판단할 수는 없습니다. 수정한 내용은 이번 보고서에만 적용됩니다.</div>${records.map((r, i) => `<div class="record"><strong>${esc(r.date)} ${esc(r.period)} · ${esc(kindLabel(r.kind))}</strong>${textarea('이 학생의 기록', 'text-' + i, C.redact(r.text, db(), s.id))}${textarea('이 학생에 대한 조치', 'action-' + i, C.redact(r.action, db(), s.id))}</div>`).join('') || empty('인쇄할 기록이 없습니다.')}${checkbox('이 학생의 내용만 남겼으며, 외부에 전달할 개인정보를 확인했습니다.', 'reviewed')}`, async f => {
    if (!f.get('reviewed')) throw Error('전달 내용을 확인한 뒤 체크해 주세요.');
    const safe = records.map((r, i) => ({
      ...r,
      text: f.get('text-' + i),
      action: f.get('action-' + i)
    }));
    closeModal();
    showPrint(s, from, to, safe);
  }, '보고서 열기');
}
export function showPrint(s, from, to, records) {
  const score = C.scores(db(), s.id, from, to),
    counts = Object.fromEntries(C.KINDS.map(k => [k, records.filter(r => r.kind === k).length]));
  const root = document.createElement('div');
  root.className = 'print-root';
  root.innerHTML = `<div class="report-page"><div class="no-print row">${btn('인쇄 / PDF 저장', () => window.print(), 'primary')}${btn('보고서 닫기', () => {
    root.remove();
    document.body.classList.remove('report-open');
  })}<small>브라우저 인쇄 설정의 머리글·바닥글을 끄면 출력 시각과 주소가 빠집니다.</small></div><p style="margin-top:20px">오늘의 별 · ${esc(settings().className)}</p><h1>${esc(settings().reportHeader)}</h1><p>${esc(s.no)}. ${esc(s.name)} ${s.group ? '· ' + esc(s.group) + '모둠' : ''}<br>${esc(from)} ~ ${esc(to)}</p><h2>기간 요약</h2><p>총 ${records.length}건 · 칭찬 ${counts['칭찬']} · 조언 ${counts['지도']} · 기록 ${counts['관찰']} · 추가 기록 ${counts['추가기록']}</p><table><thead><tr>${C.AREAS.map(a => `<th>${esc(a)}</th>`).join('')}</tr></thead><tbody><tr>${C.AREAS.map(a => `<td>${records.filter(r => r.areas.includes(a)).reduce((n, r) => n + C.delta(r), 0)}</td>`).join('')}</tr></tbody></table><h2 style="margin-top:22px">학교생활 기록</h2>${records.map(r => `<article class="record"><strong>${esc(r.date)} ${esc(r.period)} · ${esc(kindLabel(r.kind))}</strong><div class="body">${esc(r.text)}</div>${r.action ? `<p class="body" style="margin-top:8px">조치: ${esc(r.action)}</p>` : ''}</article>`).join('') || '<p>해당 기간에 기록이 없습니다.</p>'}</div>`;
  document.querySelector('.print-root')?.remove();
  document.body.append(root);
  document.body.classList.add('report-open');
  root.scrollIntoView();
}
