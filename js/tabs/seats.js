import { render } from '../app.js';
import * as C from '../core.js';
import { commit, db, name, settings, students } from '../shared/data.js';
import { store } from '../shared/state.js';
import { bindLater, btn, esc, run } from '../shared/ui.js';
let movingStudent = null,
  seatScope = '',
  initializing = false,
  pointerDrag = null,
  swallowUntil = 0;
function scope() {
  return `${store.mode}:${store.classId}:${db()?.settings?.[0]?.academicYear}`;
}
export function seatsView() {
  if (seatScope !== scope()) {
    seatScope = scope();
    movingStudent = null;
  }
  const ops = C.autoSeatOps(db());
  if (ops.length && !initializing) {
    initializing = true;
    setTimeout(() => run(async () => {
      try {
        await commit(C.autoSeatOps(db()), '');
      } finally {
        initializing = false;
      }
    }), 0);
  }
  const st = settings(),
    rows = Number(st.seatRows),
    cols = Number(st.seatCols);
  const order = Array.from({
    length: rows
  }, (_, i) => st.frontTop ? i : rows - 1 - i);
  return `<div class="toolbar"><div><h2>자리</h2><small>학생을 끌거나, 학생 선택 후 빈칸·다른 학생을 눌러 이동하세요.</small></div><div class="row">${movingStudent ? btn('선택 취소', () => {
    movingStudent = null;
    render();
  }) : ''}${btn('교실 앞 ' + (st.frontTop ? '아래로' : '위로'), () => commit([{
    table: 'settings',
    id: st.id,
    data: {
      ...st,
      frontTop: !st.frontTop
    }
  }]))}</div></div>${st.frontTop ? '<div class="front">교실 앞</div>' : ''}<div class="seat-canvas"><div id="seat-grid" class="seats free-seats" style="grid-template-columns:repeat(${cols},minmax(100px,1fr));min-width:${cols * 110}px">${order.flatMap(row => Array.from({
    length: cols
  }, (_, col) => {
    const student = students().find(s => s.seat?.row === row && s.seat?.col === col);
    return btn(student ? esc(name(student.id)) : '', () => chooseSeat(row, col, student?.id), 'seat seat-cell' + (student ? ' occupied' : ' empty') + (movingStudent === student?.id ? ' selected' : ''), `data-row="${row}" data-col="${col}" data-student="${esc(student?.id || '')}" draggable="${!!student}" aria-label="${student ? esc(name(student.id)) : '빈자리'}" aria-pressed="${!!student && movingStudent === student.id}"`);
  })).join('')}</div></div>${!st.frontTop ? '<div class="front">교실 앞</div>' : ''}${bindLater('seat-grid', 'keydown', e => {
    if (e.key === 'Escape') {
      movingStudent = null;
      render();
    }
  })}`;
}
function chooseSeat(row, col, id) {
  if (performance.now() < swallowUntil) return;
  if (movingStudent) {
    if (movingStudent === id) {
      movingStudent = null;
      render();
    } else return moveTo(row, col);
  } else if (id) {
    movingStudent = id;
    render();
  }
}
export async function moveTo(row, col, id = movingStudent) {
  if (!id) return;
  const ops = C.seatMoveOps(db(), id, row, col);
  if (ops.length) await commit(ops, '');
  movingStudent = null;
  render();
}
document.addEventListener('dragstart', e => {
  const cell = e.target.closest?.('#seat-grid [data-student]');
  if (!cell?.dataset.student) return;
  movingStudent = cell.dataset.student;
  e.dataTransfer.setData('application/x-startoday-student', movingStudent);
  e.dataTransfer.effectAllowed = 'move';
  cell.classList.add('dragging');
});
document.addEventListener('dragover', e => {
  if (e.target.closest?.('#seat-grid .seat-cell')) e.preventDefault();
});
document.addEventListener('drop', e => {
  const cell = e.target.closest?.('#seat-grid .seat-cell'),
    id = e.dataTransfer.getData('application/x-startoday-student');
  if (!cell || !id) return;
  e.preventDefault();
  run(() => moveTo(Number(cell.dataset.row), Number(cell.dataset.col), id));
});
document.addEventListener('dragend', () => document.querySelectorAll('.seat.dragging').forEach(el => el.classList.remove('dragging')));
document.addEventListener('pointerdown', e => {
  const cell = e.target.closest?.('#seat-grid .occupied');
  if (!cell || e.pointerType !== 'touch') return;
  pointerDrag = {
    id: cell.dataset.student,
    x: e.clientX,
    y: e.clientY,
    active: false,
    scope: scope(),
    pointerId: e.pointerId,
    cell
  };
});
document.addEventListener('pointermove', e => {
  const drag = pointerDrag;
  if (!drag || drag.pointerId !== e.pointerId) return;
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.active = true;
  if (!drag.active) return;
  e.preventDefault();
  drag.cell.classList.add('dragging');
  if (!drag.ghost) {
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'seat-drag-ghost';
    drag.ghost.textContent = name(drag.id);
    document.body.append(drag.ghost);
  }
  drag.ghost.style.left = e.clientX + 12 + 'px';
  drag.ghost.style.top = e.clientY + 12 + 'px';
  document.querySelectorAll('.seat.drop-target').forEach(el => el.classList.remove('drop-target'));
  document.elementFromPoint(e.clientX, e.clientY)?.closest('#seat-grid .seat-cell')?.classList.add('drop-target');
}, {
  passive: false
});
function endPointer(e, cancel = false) {
  const drag = pointerDrag;
  if (!drag || drag.pointerId !== e.pointerId) return;
  pointerDrag = null;
  drag.ghost?.remove();
  document.querySelectorAll('.seat.dragging,.seat.drop-target').forEach(el => el.classList.remove('dragging', 'drop-target'));
  if (!drag.active) return;
  swallowUntil = performance.now() + 600;
  e.preventDefault();
  const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('#seat-grid .seat-cell');
  if (!cancel && cell && drag.scope === scope()) run(() => moveTo(Number(cell.dataset.row), Number(cell.dataset.col), drag.id));
}
document.addEventListener('pointerup', e => endPointer(e));
document.addEventListener('pointercancel', e => endPointer(e, true));
