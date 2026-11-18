// CSV parsing and column detection used by the record import dialog.
// Kept free of DOM access so the parsing rules can be tested on their own.

export function parseCSV(text) {
  let src = String(text ?? '');
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const rows = [];
  let row = [],
    field = '',
    inQuotes = false,
    i = 0;
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      if (src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(cells => cells.some(cell => String(cell ?? '').trim() !== ''));
}

const pad2 = value => String(value).padStart(2, '0');

function isoDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  const parsed = new Date(iso + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : '';
}

// Accepts the date spellings commonly found in exported tables.
export function parseImportDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  let match = text.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (match) return isoDate(+match[1], +match[2], +match[3]);
  match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return isoDate(+match[1], +match[2], +match[3]);
  return '';
}

export function splitImportAreas(value) {
  return String(value ?? '')
    .split(/\s*[,、/·|]\s*/)
    .map(part => part.trim())
    .filter(Boolean);
}

// Maps the exported type wording onto the app's 기록/조언/칭찬 scale.
export function importKindFrom(value) {
  const text = String(value ?? '').trim();
  if (!text) return {kind: '관찰', extraType: null, matched: false};
  if (/^\+?\s*1$|^\+$|칭찬|칭송|긍정|우수|강점|잘함|격려/.test(text)) return {kind: '칭찬', extraType: null, matched: true};
  if (/^-\s*1$|^-$|조언|지도|개선|주의|훈계|점검|아쉬|필요/.test(text)) return {kind: '지도', extraType: null, matched: true};
  if (/추가기록|상담|사건|추가/.test(text)) {
    const extraType = /상담/.test(text) ? '상담' : /사건/.test(text) ? '사건' : '메모';
    return {kind: '추가기록', extraType, matched: true};
  }
  if (/^0$|관찰|기록|메모|특이/.test(text)) return {kind: '관찰', extraType: null, matched: true};
  return {kind: '관찰', extraType: null, matched: false};
}

const HEADER_PATTERNS = {
  name: [/(학생|이름|성명|대상|student|name)/, -5, /(번호|순번|학번|반|no\b|id$)/i],
  content: [/(내용|기록|관찰|메모|비고|특이|행동|텍스트|content|note|memo|opinion|description)/, 0, null],
  date: [/(날짜|일자|일시|작성일|date|작성시간)/, 0, null],
  area: [/(분야|영역|카테고리|분류|주제|태그|area|category|tag)/, 0, null],
  type: [/(유형|구분|종류|type|kind)/, 0, null]
};

const KNOWN_TYPES = /^(칭찬|조언|관찰|지도|기록|메모|개선|주의|격려|\+?1|-1|0)$/;

function columnStats(headers, rows) {
  return headers.map((header, index) => {
    const values = rows.map(row => String(row[index] ?? '').trim()).filter(Boolean);
    const count = values.length;
    return {
      index,
      header,
      count,
      average: count ? values.reduce((total, value) => total + value.length, 0) / count : 0,
      distinct: new Set(values).size,
      dateRatio: count ? values.filter(value => parseImportDate(value)).length / count : 0,
      typeRatio: count ? values.filter(value => KNOWN_TYPES.test(value.trim())).length / count : 0
    };
  });
}

function profileScore(field, stats) {
  if (field === 'name') return stats.distinct >= 2 && stats.distinct <= 90 && stats.average >= 1 && stats.average <= 12 && stats.dateRatio < 0.3 ? 0.9 : -1;
  if (field === 'content') return stats.average >= 24 ? 1.6 : stats.average >= 12 ? 0.9 : -1;
  if (field === 'date') return stats.dateRatio >= 0.7 ? 1.6 : -1;
  if (field === 'area') return stats.distinct >= 2 && stats.distinct <= 16 && stats.average <= 12 ? 1 : -1;
  if (field === 'type') return stats.typeRatio >= 0.5 ? 1.4 : -1;
  return 0;
}

// Returns the column index chosen for each field, or null when nothing fits.
export function detectImportMapping(headers, rows) {
  const stats = columnStats(headers, rows);
  const used = new Set();
  const mapping = {};
  for (const field of ['name', 'content', 'date', 'area', 'type']) {
    const [pattern, , penalty] = HEADER_PATTERNS[field];
    let best = null,
      bestScore = 0;
    for (const column of stats) {
      if (used.has(column.index)) continue;
      const normalized = String(column.header ?? '').replace(/\s+/g, '').toLowerCase();
      let score = pattern.test(normalized) ? 3 : 0;
      if (penalty && penalty.test(normalized)) score -= 5;
      score += profileScore(field, column);
      if (score > bestScore) {
        bestScore = score;
        best = column.index;
      }
    }
    if (best != null && bestScore >= 1) {
      used.add(best);
      mapping[field] = best;
    } else mapping[field] = null;
  }
  return mapping;
}
