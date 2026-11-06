import { closeModal, modal } from '../components/modal.js';
import { render } from '../app.js';
import * as C from '../core.js';
import { commit, db, name, settings, students, up } from '../shared/data.js';
import { $, bindLater, btn, esc, input, select } from '../shared/ui.js';
import { studentDetail } from './students.js';
export function seatsView() {
  const st = settings(),
    rows = Number(st.seatRows),
    cols = Number(st.seatCols);
  const order = Array.from({
    length: rows
  }, (_, i) => st.frontTop ? i : rows - 1 - i);
  return `<div class="toolbar"><h2>자리</h2><div class="row">${btn(editMode ? '배치 완료' : '배치 변경', () => {
    editMode = !editMode;
    movingStudent = null;
    render();
  }, 'primary')}${btn('교실 앞 ' + (st.frontTop ? '아래로' : '위로'), () => commit([up('settings', {
    ...st,
    frontTop: !st.frontTop
  })]))}<small>${editMode ? '카드를 끌어 교환·이동하세요. 터치·키보드는 학생 선택 후 목적지를 누르세요.' : '학생 버튼으로 기록 확인'}</small></div></div>${layoutForm()}${st.frontTop ? '<div class="front">교실 앞</div>' : ''}<div style="overflow:auto"><div id="seat-grid" class="seats" style="grid-template-columns:repeat(${cols},minmax(110px,1fr));min-width:${cols * 120}px;gap:${st.seatLayout === 'exam' ? 28 : 12}px">${order.flatMap(row => Array.from({
    length: cols
  }, (_, col) => {
    const s = students().find(s => s.seat?.row === row && s.seat?.col === col);
    const gap = (st.seatLayout === 'pair' || st.seatLayout === 'group') && col % 2 === 1 && col < cols - 1 ? 22 : 0;
    return `<div class="seat" data-row="${row}" data-col="${col}" data-student="${s?.id || ''}" draggable="${editMode && !!s}" style="margin-right:${gap}px;${st.seatLayout === 'group' && row % 2 === 1 ? 'margin-bottom:24px;' : ''}${movingStudent === s?.id ? 'outline:3px solid #2563EB;' : ''}">${s ? btn(esc(name(s.id)), () => editMode ? (movingStudent = s.id, render()) : studentDetail(s.id), 'primary') : ''}${editMode ? btn(movingStudent ? '이 자리로 이동' : '학생 배치', () => movingStudent ? moveTo(row, col) : seatEditor(row, col)) : ''}</div>`;
  })).join('')}</div></div>${!st.frontTop ? '<div class="front" style="margin-top:15px">교실 앞</div>' : ''}${editMode ? unseatedTray() : ''}${bindLater('seat-grid', 'dragover', e => e.preventDefault())}${bindLater('seat-grid', 'dragstart', e => {
    const seat = e.target.closest('[data-student]');
    if (!seat?.dataset.student) return;
    e.dataTransfer.setData('text/plain', seat.dataset.student);
  })}${bindLater('seat-grid', 'drop', e => {
    e.preventDefault();
    const seat = e.target.closest('[data-row]');
    if (seat) return moveTo(Number(seat.dataset.row), Number(seat.dataset.col), e.dataTransfer.getData('text/plain'));
  })}`;
}
let editMode = false,
  movingStudent = null;
export async function moveTo(row, col, id = movingStudent) {
  if (!editMode || !id) return;
  await commit(C.seatMoveOps(db(), id, row, col));
  movingStudent = null;
  render();
}
function unseatedTray() {
  return `<section class="panel" id="unseated-tray"><h3>아직 배치하지 않은 학생</h3><div class="row">${students().filter(s => !s.seat || s.seat.row >= settings().seatRows || s.seat.col >= settings().seatCols).map(s => `<span draggable="true" data-student="${esc(s.id)}">${btn(esc(name(s.id)), () => {
    movingStudent = s.id;
    render();
  }, movingStudent === s.id ? 'primary' : '')}</span>`).join('') || '<p>모든 학생이 배치되었습니다.</p>'}</div></section>${bindLater('unseated-tray', 'dragstart', e => {
    const item = e.target.closest('[data-student]');
    if (item) e.dataTransfer.setData('text/plain', item.dataset.student);
  })}`;
}
function layoutForm() {
  const st = settings();
  return `<form id="seat-layout" class="panel row">${select('자리 대형', 'layout', [['pair', '짝 대형'], ['exam', '시험 대형'], ['group', '모둠 대형'], ['custom', '사용자 정의']], st.seatLayout || 'custom')}${input('행', 'rows', st.seatRows, 'number', 'required min="1" max="12"')}${input('열', 'cols', st.seatCols, 'number', 'required min="1" max="12"')}<button type="submit">대형 적용</button></form>${bindLater('seat-layout', 'change', e => {
    if (e.target.name !== 'layout' || e.target.value === 'custom') return;
    const form = e.currentTarget,
      cols = e.target.value === 'exam' ? 5 : 6;
    form.elements.cols.value = cols;
    form.elements.rows.value = Math.min(12, Math.max(1, Math.ceil(students().length / cols)));
  })}${bindLater('seat-layout', 'submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target),
      rows = Number(f.get('rows')),
      cols = Number(f.get('cols'));
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 12 || cols > 12) throw Error('행·열은 1~12 사이로 입력하세요.');
    const outside = students().filter(s => s.seat && (s.seat.row >= rows || s.seat.col >= cols));
    if (outside.length && !confirm('범위를 벗어난 ' + outside.length + '명은 미배치 목록으로 옮깁니다. 적용할까요?')) return;
    await commit([up('settings', {
      ...settings(),
      seatRows: rows,
      seatCols: cols,
      seatLayout: f.get('layout')
    }), ...outside.map(s => up('students', {
      ...s,
      seat: null
    }))]);
  })}`;
}
export function seatEditor(row, col) {
  const current = students().find(s => s.seat?.row === row && s.seat?.col === col);
  modal('학생 배치', select('학생 · 기존 자리가 있으면 서로 교환합니다.', 'student', [['', '빈자리'], ...students().map(s => [s.id, name(s.id)])], current?.id || ''), async f => {
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

