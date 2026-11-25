import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { detectImportMapping, importKindFrom, parseCSV, parseImportDate, splitImportAreas } from '../shared/csv.js';
import { commit, db, up } from '../shared/data.js';
import { $, btn, dateField, esc, opts, toast } from '../shared/ui.js';
import { newRecord } from './records.js';

const FIELD_LABELS = {
  name: '이름',
  date: '날짜',
  area: '분야',
  type: '유형',
  content: '기록 내용'
};
const MAX_ROWS = 2000;

function normalizedName(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/^\d{1,3}[.)]/, '')
    .trim();
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || Error('파일을 읽지 못했습니다.'));
    reader.readAsText(file, 'utf-8');
  });
}

export function recordImportDialog() {
  const view = {
    fileName: '',
    raw: [],
    headers: [],
    cells: [],
    mapping: {name: null, date: null, area: null, type: null, content: null},
    fallbackDate: C.today(),
    preview: null
  };

  modal('CSV 가져오기', `<div class="csv-import"><p class="muted">다른 곳에서 내려받은 CSV 파일을 <strong>오늘의 별</strong> 기록으로 가져옵니다. 이름·날짜·분야·유형·기록 내용 열을 자동으로 찾고, 가져오기 전에 학생 매칭과 중복을 확인합니다.</p><div class="row csv-import-file"><label class="csv-file-label">CSV 파일<input type="file" id="csv-file" accept=".csv,text/csv"></label><label class="inline"><input type="checkbox" id="csv-header" checked>첫 줄은 열 이름입니다</label></div><div id="csv-import-body"><p class="muted">CSV 파일을 선택하면 열 자동 인식 결과가 여기에 표시됩니다.</p></div></div>`, null, '저장', '', {footer: `${btn('취소', closeModal)}${btn('가져오기', () => save(), 'primary', 'id="csv-import-save" disabled')}`});

  const body = () => $('#csv-import-body');
  const syncSave = () => {
    const button = $('#csv-import-save');
    if (!button) return;
    const rows = view.preview?.rows.length ?? 0;
    button.disabled = !rows || rows > MAX_ROWS;
    button.textContent = rows ? `가져오기 (${rows}건)` : '가져오기';
  };

  const cell = (row, field) => {
    const index = view.mapping[field];
    return index == null ? '' : String(row[index] ?? '').trim();
  };

  const compute = () => {
    const byName = new Map();
    for (const student of C.activeStudents(db())) {
      for (const label of [student.name, student.alias, student.nickname]) {
        const key = normalizedName(label);
        if (key && !byName.has(key)) byName.set(key, student);
      }
    }
    const existing = new Set(db().records.filter(record => !record.deletedAt).map(record => [record.studentIds[0], record.date, record.kind, String(record.text ?? '').trim()].join('\u0001')));
    const knownAreas = new Set(C.areaNames(db(), true));
    const result = {rows: [], unmatched: [], unknownAreas: new Set(), noName: 0, noContent: 0, duplicates: 0, noDate: 0, defaultType: 0};
    const seen = new Set();
    for (const row of view.cells) {
      const rawName = cell(row, 'name');
      const text = cell(row, 'content');
      if (!rawName) {
        result.noName += 1;
        continue;
      }
      if (!text) {
        result.noContent += 1;
        continue;
      }
      const student = byName.get(normalizedName(rawName));
      if (!student) {
        if (!result.unmatched.includes(rawName)) result.unmatched.push(rawName);
        continue;
      }
      const rawDate = cell(row, 'date');
      const parsedDate = parseImportDate(rawDate);
      const date = parsedDate || view.fallbackDate;
      if (!parsedDate) result.noDate += 1;
      const rawType = cell(row, 'type');
      const kind = importKindFrom(rawType);
      if (rawType && !kind.matched) result.defaultType += 1;
      const areas = [...new Set(splitImportAreas(cell(row, 'area')))];
      for (const area of areas) if (!knownAreas.has(C.areaName(area))) result.unknownAreas.add(area);
      const signature = [student.id, date, kind.kind, text].join('\u0001');
      if (existing.has(signature) || seen.has(signature)) {
        result.duplicates += 1;
        continue;
      }
      seen.add(signature);
      result.rows.push({student, date, kind: kind.kind, extraType: kind.extraType, areas, text});
    }
    return result;
  };

  const previewHtml = preview => {
    const counts = `<div class="csv-preview-counts"><span class="badge tone-mint">가져올 기록 ${preview.rows.length}건</span><span class="badge">중복 건너뜀 ${preview.duplicates}건</span>${preview.unmatched.length ? `<span class="badge tone-advice">이름 미매칭 ${preview.unmatched.length}명</span>` : ''}${preview.rows.length > MAX_ROWS ? `<span class="badge tone-advice">한 번에 ${MAX_ROWS}건까지 가져올 수 있습니다</span>` : ''}</div>`;
    const table = preview.rows.length ? `<div class="table-wrap"><table class="csv-preview-table"><thead><tr><th>학생</th><th>날짜</th><th>구분</th><th>분야</th><th>기록 내용</th></tr></thead><tbody>${preview.rows.slice(0, 5).map(row => `<tr><td>${esc(row.student.no + '. ' + row.student.name)}</td><td>${esc(C.formatDate(row.date))}</td><td>${esc(C.recordLabel(row))}</td><td>${esc(row.areas.join(', ') || '-')}</td><td>${esc(row.text.length > 60 ? row.text.slice(0, 60) + '…' : row.text)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="csv-preview-empty">가져올 기록이 없습니다. 열 매핑과 학생 이름을 확인하세요.</p>';
    return `<div class="csv-preview" id="csv-preview">${counts}${summaryHtml(preview)}${table}</div>`;
  };

  const summaryHtml = preview => {
    const notes = [];
    if (preview.unmatched.length) notes.push(`명단과 이름이 같은 학생만 가져옵니다. 미매칭: ${preview.unmatched.slice(0, 8).map(esc).join(', ')}${preview.unmatched.length > 8 ? ` 외 ${preview.unmatched.length - 8}명` : ''}`);
    if (preview.noContent) notes.push(`기록 내용이 비어 있어 건너뛴 행 ${preview.noContent}개`);
    if (preview.noName) notes.push(`이름이 비어 있어 건너뛴 행 ${preview.noName}개`);
    if (preview.noDate) notes.push(`날짜를 읽지 못해 ${esc(C.formatDate(view.fallbackDate))}로 저장할 기록 ${preview.noDate}건`);
    if (preview.defaultType) notes.push(`유형을 알아보지 못해 기록으로 저장할 행 ${preview.defaultType}개`);
    if (preview.unknownAreas.size) notes.push(`설정에 없는 분야 이름은 그대로 저장됩니다: ${[...preview.unknownAreas].slice(0, 8).map(esc).join(', ')}`);
    return notes.length ? `<ul class="csv-preview-notes">${notes.map(note => `<li>${note}</li>`).join('')}</ul>` : '';
  };

  const renderPreview = () => {
    view.preview = compute();
    const preview = $('#csv-preview');
    if (preview) preview.outerHTML = previewHtml(view.preview);
    syncSave();
  };

  const renderBody = () => {
    if (!view.cells.length) {
      body().innerHTML = '<p class="muted">가져올 행이 없습니다. 파일과 첫 줄 설정을 확인하세요.</p>';
      view.preview = {rows: []};
      syncSave();
      return;
    }
    body().innerHTML = `<div class="csv-mapping"><p class="muted">${esc(view.fileName)} · ${view.cells.length}행 · 열 ${view.headers.length}개</p><div class="formgrid">${Object.keys(FIELD_LABELS).map(field => `<label>${FIELD_LABELS[field]}<select id="csv-map-${field}">${opts([['', '사용 안 함'], ...view.headers.map((header, index) => [String(index), header])], view.mapping[field] == null ? '' : String(view.mapping[field]))}</select></label>`).join('')}</div><label>날짜가 없거나 읽지 못한 기록에 적용할 날짜${dateField(view.fallbackDate, 'id="csv-fallback-date"')}</label></div><div id="csv-preview"></div>`;
    for (const field of Object.keys(FIELD_LABELS)) {
      const select = $(`#csv-map-${field}`);
      if (select) select.onchange = () => {
        view.mapping[field] = select.value === '' ? null : Number(select.value);
        renderPreview();
      };
    }
    const fallbackField = $('#csv-fallback-date');
    if (fallbackField) fallbackField.onchange = () => {
      if (!fallbackField.value) return;
      view.fallbackDate = fallbackField.value;
      renderPreview();
    };
    renderPreview();
  };

  const applyHeader = () => {
    const hasHeader = $('#csv-header')?.checked !== false;
    const first = view.raw[0] || [];
    const seen = new Map();
    view.headers = first.map((value, index) => {
      let label = hasHeader ? String(value ?? '').replace(/^\uFEFF/, '').trim() : '';
      if (!label) label = `열${index + 1}`;
      if (seen.has(label)) {
        const count = seen.get(label) + 1;
        seen.set(label, count);
        label = `${label} (${count})`;
      } else seen.set(label, 1);
      return label;
    });
    view.cells = (hasHeader ? view.raw.slice(1) : view.raw).filter(row => row.some(value => String(value ?? '').trim() !== '')).map(row => {
      const copy = [];
      view.headers.forEach((_, index) => copy.push(String(row[index] ?? '').trim()));
      return copy;
    });
    view.mapping = detectImportMapping(view.headers, view.cells);
    renderBody();
  };

  const load = (text, fileName) => {
    view.fileName = fileName || '';
    view.raw = parseCSV(text);
    if (!view.raw.length) {
      view.headers = [];
      view.cells = [];
      body().innerHTML = '<p class="muted">CSV에 읽을 행이 없습니다.</p>';
      view.preview = {rows: []};
      syncSave();
      return;
    }
    applyHeader();
  };

  const save = async () => {
    const preview = compute();
    if (!preview.rows.length) return toast('가져올 기록이 없습니다.');
    if (preview.rows.length > MAX_ROWS) return toast(`한 번에 ${MAX_ROWS}건까지 가져올 수 있습니다. CSV를 나누어 주세요.`);
    const ops = preview.rows.map(row => up('records', newRecord({
      studentIds: [row.student.id],
      date: row.date,
      kind: row.kind,
      extraType: row.kind === '추가기록' ? row.extraType : null,
      areas: row.areas,
      text: row.text,
      action: '',
      printIncluded: true
    })));
    await commit(ops, `${ops.length}건의 기록을 가져왔습니다.`);
    closeModal();
    render();
  };

  const fileInput = $('#csv-file');
  if (fileInput) fileInput.onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileText(file);
      if (text.includes('\uFFFD')) toast('UTF-8로 읽지 못했습니다. CSV를 UTF-8로 저장한 뒤 다시 시도하세요.');
      load(text, file.name);
    } catch (error) {
      toast(error.message);
    }
  };
  const headerToggle = $('#csv-header');
  if (headerToggle) headerToggle.onchange = () => {
    if (!view.raw.length) return;
    applyHeader();
  };
}
