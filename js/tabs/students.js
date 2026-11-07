import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, kindLabel, name, settings, students, up } from '../shared/data.js';
import { state } from '../shared/state.js';
import { $, badge, btn, checkbox, empty, esc, input, select, textarea } from '../shared/ui.js';
import { taskStateEditor } from './assignments.js';
import { recordCard, recordEditor } from './records.js';
export function studentsView() {
  const first = state.date.slice(0, 7) + '-01';
  return `<div class="toolbar"><div><h2>학생</h2><small>이번 달 기록과 아직 남은 일을 살펴보세요.</small></div><div class="row">${btn('전체 학생 일괄 내보내기', () => reportDialog(null, first, state.date))}${btn('+ 학생', () => studentEditor(), 'primary')}</div></div><div class="table-wrap"><table><thead><tr><th>학생</th><th>이번 달 칭찬 / 조언</th><th>미완료 과제</th><th>최근 기록일</th><th>바로 기록</th></tr></thead><tbody>${students().map(s => {
    const records = C.scores(db(), s.id, first, state.date).records;
    return `<tr><td>${btn(esc(name(s.id)), () => studentDetail(s.id))}</td><td>${records.filter(r => r.kind === '칭찬').length} / ${records.filter(r => r.kind === '지도').length}</td><td>${C.pending(db(), s.id, state.date).length}</td><td>${esc(db().records.filter(r => r.studentIds.includes(s.id)).map(r => r.date).sort().at(-1) || '—')}</td><td>${btn('+ 기록', () => recordEditor({
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
  }))}${btn('학생 수정', () => studentEditor(s))}${btn('보고서로 내보내기', () => reportDialog(id, from, to), 'primary')}${btn('이번 주', () => studentDetail(id, C.addDays(state.date, -((C.weekday(state.date) + 6) % 7)), state.date))}${btn('이번 달', () => studentDetail(id, state.date.slice(0, 7) + '-01', state.date))}</div><div class="row"><input aria-label="기록 조회 시작" type="date" id="student-from" value="${from}"><span>~</span><input aria-label="기록 조회 종료" type="date" id="student-to" value="${to}">${btn('조회', () => studentDetail(id, $('#student-from').value, $('#student-to').value))}</div><div class="panel" style="margin-top:14px"><h3>★ ${score.total} · 기간 요약</h3><div class="chips">${C.areaNames(db(), true).map(a => badge(a + ' ' + score.areas[a])).join('')}</div></div><h3>미완료 과제 ${pending.length}건</h3>${pending.map(({
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
  modal(s ? '학생 수정' : '학생 추가', `<div class="formgrid">${input('번호', 'no', row.no, 'number', 'min="1" required')}${input('이름', 'name', row.name, 'text', 'required')}${input('교실 화면 별칭', 'alias', row.alias || '')}</div>`, async f => {
    const next = {
      ...row,
      no: Number(f.get('no')),
      name: f.get('name').trim(),
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
  const selected = id ? [db().students.find(x => x.id === id)].filter(Boolean) : students();
  if (!selected.length) throw Error('내보낼 학생이 없습니다.');
  modal(id ? '개별 보고서 · 기간 선택' : '전체 학생 일괄 내보내기', `<p>${id ? esc(name(id)) : `${selected.length}명 · 학생별로 페이지를 나누어 출력합니다.`}</p><div class="formgrid">${input('시작일', 'from', from, 'date', 'required')}${input('종료일', 'to', to, 'date', 'required')}${select('출력 방식', 'printMode', [['color', '컬러'], ['mono', '흑백']], settings().reportPrintMode || 'color')}</div><p class="muted">추가 기록은 인쇄 포함을 승인한 건만 출력합니다. 다른 학생의 이름은 ‘다른 학생’으로 바꾸어 미리보기에 표시합니다.</p>`, async f => {
    C.dates(f.get('from'), f.get('to'));
    reviewReports(selected, f.get('from'), f.get('to'), f.get('printMode'));
  }, '인쇄 내용 확인');
}
export function reportPreview(s, from, to) {
  reviewReports([s], from, to, settings().reportPrintMode || 'color');
}
function reviewReports(list, from, to, mode) {
  const reports = list.map(student => ({
    student,
    records: C.reportRecords(db(), student.id, from, to)
  }));
  modal('인쇄 전 내용 확인', `<div class="notice">학생별 기록에서 관계없는 내용·다른 학생의 개인정보를 제거해 주세요. 이름 자동 가림만으로 모든 개인정보를 판단할 수는 없습니다. 수정한 내용은 이번 보고서에만 적용됩니다.</div>${reports.map(({
    student: s,
    records
  }, j) => `<details class="report-review" open><summary>${esc(s.no)} · ${esc(s.name)} · 인쇄 내용 확인</summary>${records.map((r, i) => `<div class="record ${r.kind === '추가기록' && r.extraType === '사건' ? 'incident-record' : ''}"><strong>${esc(r.date)} ${esc(r.period)} · ${esc(C.recordLabel(r))}</strong>${textarea('이 학생의 기록', `text-${j}-${i}`, C.redact(r.text, db(), s.id))}${textarea('이 학생에 대한 지도 내용', `action-${j}-${i}`, C.redact(r.action, db(), s.id))}</div>`).join('') || empty('인쇄할 기록이 없습니다.')}${checkbox(`${s.name} 학생의 내용과 전달할 개인정보를 확인했습니다.`, `reviewed-${j}`)}</details>`).join('')}`, async f => {
    if (reports.some((_, j) => !f.get('reviewed-' + j))) throw Error('각 학생의 전달 내용을 확인한 뒤 체크해 주세요.');
    const safe = reports.map((report, j) => ({
      ...report,
      records: report.records.map((r, i) => ({
        ...r,
        text: f.get(`text-${j}-${i}`),
        action: f.get(`action-${j}-${i}`)
      }))
    }));
    closeModal();
    showReports(safe, from, to, mode);
  }, '보고서 열기');
}
export function showPrint(s, from, to, records) {
  showReports([{
    student: s,
    records
  }], from, to, settings().reportPrintMode || 'color');
}
function reportPage(s, from, to, records) {
  return `<section class="report-page"><p>오늘의 별 · ${esc(settings().className)}</p><h1>${esc(settings().reportHeader)}</h1><p>${esc(s.no)}. ${esc(s.name)}<br>${esc(from)} ~ ${esc(to)}</p><h2>기간 요약</h2><p>칭찬 ${records.filter(r => r.kind === '칭찬').length}건 · 조언 ${records.filter(r => r.kind === '지도').length}건</p><table><thead><tr>${C.areaNames(db(), true).map(a => `<th>${esc(a)}</th>`).join('')}</tr></thead><tbody><tr>${C.areaNames(db(), true).map(a => `<td>${records.filter(r => (r.areas || []).includes(a)).reduce((n, r) => n + C.delta(r), 0)}</td>`).join('')}</tr></tbody></table><h2 style="margin-top:22px">학교생활 기록</h2>${records.map(r => `<article class="record ${r.kind === '칭찬' ? 'report-praise' : r.kind === '지도' ? 'report-advice' : ''} ${r.kind === '추가기록' && r.extraType === '사건' ? 'incident-record' : ''}"><strong>${esc(r.date)} ${esc(r.period)} · ${esc(C.recordLabel(r))}</strong><div class="body">${esc(r.text)}</div>${r.action ? `<p class="body" style="margin-top:8px">지도 내용: ${esc(r.action)}</p>` : ''}</article>`).join('')}</section>`;
}
function showReports(reports, from, to, mode) {
  const root = document.createElement('div');
  root.className = 'print-root report-' + (mode === 'mono' ? 'monochrome' : 'color');
  root.innerHTML = `<div class="no-print row report-toolbar">${select('출력 방식', 'report-mode', [['color', '컬러'], ['mono', '흑백']], mode)}${btn('인쇄 / PDF 저장', () => window.print(), 'primary')}${btn('보고서 닫기', () => {
    root.remove();
    document.body.classList.remove('report-open');
  })}<small>브라우저 인쇄 설정의 머리글·바닥글을 끄면 출력 시각과 주소가 빠집니다.</small></div>${reports.map(({
    student,
    records
  }) => reportPage(student, from, to, records)).join('')}`;
  root.querySelector('[name="report-mode"]').onchange = e => {
    root.classList.toggle('report-monochrome', e.target.value === 'mono');
    root.classList.toggle('report-color', e.target.value === 'color');
  };
  document.querySelector('.print-root')?.remove();
  document.body.append(root);
  document.body.classList.add('report-open');
  root.scrollIntoView();
}
