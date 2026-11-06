import { closeModal, modal } from '../components/modal.js';
import { commit, db, name, settings, students, up } from '../shared/data.js';
import { btn, esc, select } from '../shared/ui.js';
import { studentDetail } from './students.js';
export function seatsView() {
  const st = settings(),
    rows = Number(st.seatRows),
    cols = Number(st.seatCols);
  const order = Array.from({
    length: rows
  }, (_, i) => st.frontTop ? i : rows - 1 - i);
  return `<div class="toolbar"><h2>자리</h2><div class="row">${btn('교실 앞 ' + (st.frontTop ? '아래로' : '위로'), () => commit([up('settings', {
    ...st,
    frontTop: !st.frontTop
  })]))}<small>칸을 눌러 배치 · 학생 버튼으로 기록 확인</small></div></div>${st.frontTop ? '<div class="front">교실 앞</div>' : ''}<div class="seats" style="grid-template-columns:repeat(${cols},minmax(90px,1fr));overflow:auto">${order.flatMap(row => Array.from({
    length: cols
  }, (_, col) => {
    const s = students().find(s => s.seat?.row === row && s.seat?.col === col);
    return `<div class="seat"><small>${row + 1}행 ${col + 1}열</small>${s ? btn(esc(name(s.id)), () => studentDetail(s.id), 'primary') : ''}${btn(s ? '배치 변경' : '학생 배치', () => seatEditor(row, col))}</div>`;
  })).join('')}</div>${!st.frontTop ? '<div class="front" style="margin-top:15px">교실 앞</div>' : ''}`;
}
export function seatEditor(row, col) {
  const current = students().find(s => s.seat?.row === row && s.seat?.col === col);
  modal(`${row + 1}행 ${col + 1}열 배치`, select('학생 · 기존 자리가 있으면 서로 교환합니다.', 'student', [['', '빈자리'], ...students().map(s => [s.id, name(s.id)])], current?.id || ''), async f => {
    const id = f.get('student'),
      next = db().students.find(s => s.id === id),
      ops = [];
    if (current && current.id !== id) ops.push(up('students', {
      ...current,
      seat: next?.seat || null
    }));
    if (next) ops.push(up('students', {
      ...next,
      seat: {
        row,
        col
      }
    }));
    await commit(ops);
    closeModal();
  });
}
