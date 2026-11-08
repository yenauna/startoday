export const DEFAULT_AREAS = ['학습태도', '과제', '관계', '도전', '생활', '알바'];
export const KINDS = ['칭찬', '지도', '관찰', '추가기록'];
export const STATUSES = ['진행중', '완료', '늦게완료', '안함', '면제'];
export const TABLES = ['students', 'incidents', 'records', 'assignments', 'assignmentStates', 'events', 'routines', 'routineStates', 'subject_rules', 'timetables', 'quests', 'settings', 'attendance', 'areas'];
export const uid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = b[6] & 15 | 64;
  b[8] = b[8] & 63 | 128;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
export const now = () => new Date().toISOString();
export const today = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());
export const addDays = (d, n) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const weekday = d => new Date(d + 'T12:00:00Z').getUTCDay();
export function dates(a, b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || a > b) throw Error('날짜 범위를 확인하세요.');
  const out = [];
  for (let d = a; d <= b; d = addDays(d, 1)) {
    if (out.length > 3700) throw Error('기간은 10년 이내로 선택하세요.');
    out.push(d);
  }
  return out;
}
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
export const delta = r => r.kind === '칭찬' ? 1 : r.kind === '지도' ? -1 : 0;
export const stateId = (a, d, s) => `${a}:${d}:${s}`;
export const activeStudents = db => db.students.filter(s => !s.deletedAt).sort((a, b) => a.no - b.no || a.name.localeCompare(b.name));
export function initialDB() {
  const db = Object.fromEntries(TABLES.map(t => [t, []]));
  db.areas = defaultAreas();
  db.settings = [{
    id: 'main',
    className: '우리 반',
    nameDisplayMode: 'number',
    seatRows: 4,
    seatCols: 5,
    frontTop: true,
    reportHeader: '우리 아이의 학교생활',
    lastBackupAt: null,
    academicYear: 2026,
    schoolName: '',
    timetableDisplay: {
      showTeacher: true,
      showLocation: true,
      viewMode: 'detailed'
    },
    periodTimes: [...DEFAULT_PERIOD_TIMES]
  }];
  db.subject_rules = ['국어', '수학', '사회', '과학', '체육', '음악', '미술', '실과', '영어', '창체', '도덕'].map((code, i) => ({
    id: uid(),
    code,
    label: code[0],
    color: ['#E0F2FE', '#FEF08A', '#FFEDD5', '#DCFCE7', '#F3E8FF', '#FFE4E6', '#FFE4E6'][i % 7],
    isSpecialist: false,
    location: '',
    teacherName: '',
    teacherHistory: [],
    defaultType: '일반',
    sortOrder: i
  }));
  return db;
}
export const targeted = (a, s) => a.target === 'all' || a.target?.studentIds?.includes(s);
export function occurs(a, d) {
  if (a.deletedAt || d < a.date || a.endDate && d > a.endDate) return false;
  return a.repeat.type === 'none' ? d === a.date : a.repeat.type === 'daily' || a.repeat.weekdays?.includes(weekday(d));
}
export function assignmentStatus(db, a, d, s) {
  return db.assignmentStates.find(x => x.id === stateId(a, d, s))?.status || '진행중';
}
export function routineStatus(db, r, d, s) {
  if (db.routines.find(row => row.id === r)?.exceptions?.[d]?.exempt) return '면제';
  return db.routineStates.find(x => x.id === stateId(r, d, s))?.status || '진행중';
}
export function excluded(db, s, d) {
  return db.attendance.some(x => x.date === d && x.studentId === s && x.excluded);
}
export function scores(db, s, a, b) {
  const records = db.records.filter(r => r.studentIds.includes(s) && r.date >= a && r.date <= b && !excluded(db, s, r.date));
  return {
    total: records.reduce((n, r) => n + delta(r), 0),
    areas: Object.fromEntries(areaNames(db, true).map(k => [k, records.filter(r => (r.areas || [r.area]).includes(k)).reduce((n, r) => n + delta(r), 0)])),
    records
  };
}
export function pending(db, s, d) {
  const out = [];
  for (const a of db.assignments.filter(a => targeted(a, s) && !a.deletedAt && a.date <= d && (!a.endDate || a.endDate >= a.date))) {
    const start = a.date;
    for (const day of dates(start, d)) {
      if (occurs(a, day) && !excluded(db, s, day) && assignmentStatus(db, a.id, day, s) === '진행중') out.push({
        assignment: a,
        date: day
      });
    }
  }
  return out;
}
export function taskStateOps(db, a, d, s, status, memo = '') {
  if (!STATUSES.includes(status)) throw Error('올바르지 않은 과제 상태입니다.');
  if (!db.assignments.some(x => x.id === a.id) || !db.students.some(x => x.id === s) || !targeted(a, s)) throw Error('과제 대상 학생을 확인하세요.');
  const id = stateId(a.id, d, s),
    old = db.records.find(r => r.autoRef === id),
    stamp = now();
  const ops = [{
    table: 'assignmentStates',
    id,
    data: {
      id,
      assignmentId: a.id,
      date: d,
      studentId: s,
      status,
      memo,
      updatedAt: stamp
    }
  }];
  if (['완료', '늦게완료', '안함'].includes(status)) ops.push({
    table: 'records',
    id: old?.id || `auto:${id}`,
    data: {
      id: old?.id || `auto:${id}`,
      date: d,
      period: '',
      studentIds: [s],
      areas: a.statArea ? [a.statArea] : [],
      area: a.statArea || null,
      kind: status === '안함' ? '지도' : '칭찬',
      text: `${a.title} ${status === '늦게완료' ? '늦게 완료' : status}${memo ? ' · ' + memo : ''}`,
      action: '',
      autoRef: id,
      printIncluded: true,
      extraType: null,
      incidentId: null,
      createdAt: old?.createdAt || stamp,
      updatedAt: stamp
    }
  });else if (old) ops.push({
    table: 'records',
    id: old.id,
    remove: true
  });
  return ops;
}
export function applyOps(db, ops) {
  const copy = structuredClone(db);
  for (const op of ops) {
    if (!TABLES.includes(op.table) || !op.id) throw Error('지원하지 않는 데이터입니다.');
    const list = copy[op.table],
      i = list.findIndex(x => x.id === op.id);
    if (op.remove) {
      if (i >= 0) list.splice(i, 1);
    } else {
      if (op.data.id !== op.id) throw Error('데이터 ID가 일치하지 않습니다.');
      if (i >= 0) list[i] = structuredClone(op.data);else list.push(structuredClone(op.data));
    }
  }
  return copy;
}
export function parseRoster(text, start = 1) {
  return text.split(/\r?\n/).filter(x => x.trim()).map(line => {
    const parts = line.trim().split(/[\t,]+|\s+/);
    const numeric = /^\d+\.?$/.test(parts[0]);
    return {
      no: numeric ? Number(parts.shift().replace('.', '')) : start++,
      name: parts.shift() || '',
      group: parts.join(' ')
    };
  });
}
export function parseInput(text, db, selected = []) {
  const warnings = [],
    candidates = activeStudents(db),
    mentions = studentMentions(text, candidates);
  let ids = [...selected];
  if (!ids.length) {
    const subjects = mentions.filter(m => m.role === 'subject');
    const targets = subjects.length ? subjects : mentions.filter(m => m.role === 'bare');
    for (const mention of targets) {
      if (!mention.ids.length) warnings.push(mention.warning || '학생을 확인하세요.');
      ids.push(...mention.ids);
    }
    for (const id of ids) {
      const s = candidates.find(row => row.id === id);
      if (s && candidates.some(row => row.id !== id && (row.name === s.name || row.no === s.no))) warnings.push('동명이인·중복 번호를 확인하세요.');
    }
  }
  ids = [...new Set(ids)];
  if (!ids.length) warnings.push('학생을 선택하세요.');
  let kind = /잘함|칭찬/.test(text) ? '칭찬' : '관찰';
  if (/추가\s*기록|상담|사건/.test(text)) kind = '추가기록';
  return {
    date: today(),
    period: inputPeriod(text, db.settings?.[0]),
    studentIds: ids,
    kind,
    areas: [],
    text,
    action: text.match(/(?:지도\s*내용|조치)\s*[:：]\s*(.+)/)?.[1] || '',
    warnings: [...new Set(warnings)],
    extraType: '메모',
    printIncluded: kind !== '추가기록'
  };
}
function escapedName(name) {
  return [...name].map(ch => '^$.*+?()[]{}|'.includes(ch) || ch.charCodeAt(0) === 92 ? String.fromCharCode(92) + ch : ch).join('');
}
const mentionSuffix = String.raw`(?:(?:이)?(?:에게(?:서|는|도|만)?|한테(?:서|는|도|만)?|의|를|을|가|이|은|는|와|과|랑|하고|도))?`;
function mentionRole(suffix) {
  if (!suffix) return 'bare';
  if (/^(?:이)?(?:에게|한테|의|를|을)/.test(suffix)) return 'object';
  if (/^(?:이)?(?:과|와|랑|하고)$/.test(suffix)) return 'conjunction';
  return /^(?:이)?(?:이|가|은|는)$/.test(suffix) ? 'subject' : 'other';
}
function studentMentions(text, candidates) {
  const phrases = new Map(),
    mentions = [];
  for (const student of candidates) {
    for (const [name, full] of [[student.name, true], ...(/^[가-힣]{3}$/.test(student.name) ? [[student.name.slice(1), false]] : [])]) {
      if (!phrases.has(name)) phrases.set(name, []);
      phrases.get(name).push({
        student,
        full
      });
    }
  }
  for (const [name, entries] of phrases) {
    const full = entries.filter(e => e.full),
      matches = full.length ? full : entries;
    const ambiguousAlias = !full.length && matches.length !== 1;
    const regex = new RegExp(String.raw`(?<![\p{L}\p{N}_])${escapedName(name)}(${mentionSuffix})(?![\p{L}\p{N}_])`, 'gu');
    for (const match of text.matchAll(regex)) mentions.push({
      start: match.index,
      length: name.length,
      end: match.index + match[0].length,
      role: mentionRole(match[1]),
      ids: ambiguousAlias ? [] : matches.map(e => e.student.id),
      warning: `${name}: 이름이 같은 후보가 여러 명입니다. 번호 또는 성명을 입력하세요.`
    });
  }
  const filtered = mentions.filter(m => !mentions.some(other => other.start === m.start && other.length > m.length));
  const numbers = new RegExp(String.raw`(?<![\p{L}\p{N}_])((?:\d{1,3}\s*[,， ]\s*)*\d{1,3})\s*번(${mentionSuffix})(?![\p{L}\p{N}_])`, 'gu');
  for (const match of text.matchAll(numbers)) {
    for (const value of match[1].split(/[,，\s]+/).filter(Boolean)) {
      const no = Number(value),
        found = candidates.filter(s => s.no === no);
      filtered.push({
        start: match.index,
        end: match.index + match[0].length,
        role: mentionRole(match[2]),
        ids: found.map(s => s.id),
        warning: `${no}번 학생을 찾지 못했습니다.`
      });
    }
  }
  // Resolve coordinated noun phrases backwards from their explicit subject.
  const ordered = [...filtered].sort((a, b) => b.start - a.start);
  for (const mention of ordered) {
    if (!['bare', 'conjunction'].includes(mention.role)) continue;
    const following = filtered.filter(next => next.start >= mention.end).sort((a, b) => a.start - b.start)[0];
    if (!following) continue;
    const gap = text.slice(mention.end, following.start);
    const connected = mention.role === 'conjunction' ? /^\s*$/.test(gap) : /^\s*[,，]\s*$/.test(gap);
    if (connected && following.role === 'subject') mention.role = 'subject';
  }
  return filtered;
}
export function nameInSentence(text, name) {
  if (!name?.trim()) return false;
  return new RegExp(String.raw`(?<![\p{L}\p{N}_])${escapedName(name)}${mentionSuffix}(?![\p{L}\p{N}_])`, 'u').test(text);
}
export function replaceStudentNumbers(text, db) {
  const candidates = activeStudents(db);
  const regex = new RegExp(String.raw`(?<![\p{L}\p{N}_])((?:\d{1,3}\s*[,， ]\s*)*\d{1,3})\s*번(${mentionSuffix})(?![\p{L}\p{N}_])`, 'gu');
  return String(text || '').replace(regex, (whole, list, suffix) => {
    const values = [...list.matchAll(/\d{1,3}/g)];
    let replaced = list,
      lastName = '';
    for (let i = values.length - 1; i >= 0; i--) {
      const value = values[i],
        found = candidates.filter(s => s.no === Number(value[0]));
      const name = found.length === 1 ? found[0].name : value[0] + (i === values.length - 1 ? '번' : '');
      if (i === values.length - 1 && found.length === 1) lastName = found[0].name;
      replaced = replaced.slice(0, value.index) + name + replaced.slice(value.index + value[0].length);
    }
    const last = lastName.charCodeAt(lastName.length - 1);
    if (last >= 0xAC00 && last <= 0xD7A3) {
      const consonant = (last - 0xAC00) % 28 !== 0;
      for (const [withFinal, withoutFinal] of [['이', '가'], ['은', '는'], ['을', '를'], ['과', '와']]) if (suffix === withFinal || suffix === withoutFinal) {
        suffix = consonant ? withFinal : withoutFinal;
        break;
      }
    }
    return replaced + suffix;
  });
}
export function explicitPeriod(text) {
  return String(text).match(/아침|(?<!\d)[1-6]\s*교시|쉬는\s*시간|점심|방과후/)?.[0].replace(/\s/g, '') || '';
}
export function inputPeriod(text, settings, now = new Date()) {
  return explicitPeriod(text) || (/(?<!\d)\d+\s*교시/.test(text) ? '' : periodAtTime(settings, now));
}
export const DEFAULT_PERIOD_TIMES = ['09:00–09:40', '09:50–10:30', '10:40–11:20', '11:30–12:10', '13:00–13:40', '13:50–14:30'];
export function periodAtTime(settings = {}, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const minute = Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
  const ranges = (settings.periodTimes || DEFAULT_PERIOD_TIMES).slice(0, 6).map((value, i) => {
    const m = String(value).match(/(\d{1,2}):(\d{2})\s*[–—~\-]\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    if (Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[3]) > 24 || Number(m[4]) > 59 || Number(m[3]) === 24 && Number(m[4]) !== 0) return null;
    const start = Number(m[1]) * 60 + Number(m[2]),
      end = Number(m[3]) * 60 + Number(m[4]);
    return start < end && end <= 1440 ? {
      start,
      end,
      period: `${i + 1}교시`
    } : null;
  }).filter(Boolean).sort((a, b) => a.start - b.start);
  if (!ranges.length) return '';
  if (minute < ranges[0].start) return '아침';
  const current = ranges.find(r => minute >= r.start && minute < r.end);
  if (current) return current.period;
  if (minute >= ranges.at(-1).end) return '방과후';
  const gaps = ranges.slice(0, -1).map((r, i) => ({
    start: r.end,
    end: ranges[i + 1].start
  }));
  const lunch = gaps.filter(g => g.start >= 11 * 60 && g.end <= 14 * 60 && g.end - g.start >= 20).sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  return lunch && minute >= lunch.start && minute < lunch.end ? '점심' : '쉬는시간';
}
export function cumulativeScores(db, studentId, to = today()) {
  return scores(db, studentId, '', to);
}
export const PERIODS = ['아침', ...Array.from({
  length: 6
}, (_, i) => `${i + 1}교시`), '쉬는시간', '점심', '방과후'];
export function reportRecords(db, s, a, b) {
  return db.records.filter(r => r.date >= a && r.date <= b && r.studentIds.includes(s) && (r.kind !== '추가기록' || r.printIncluded === true)).sort((x, y) => x.date.localeCompare(y.date) || x.createdAt.localeCompare(y.createdAt));
}
export function redact(text, db, s) {
  let out = String(text || '');
  for (const x of [...db.students].sort((a, b) => b.name.length - a.name.length)) if (x.id !== s && x.name && x.name !== db.students.find(v => v.id === s)?.name) out = out.split(x.name).join('다른 학생');
  const own = db.students.find(x => x.id === s);
  out = out.replace(/(\d{1,3})\s*번/g, (m, n) => Number(n) !== own?.no && db.students.some(x => x.no === Number(n)) ? '다른 학생' : m);
  return out;
}
export function validateBackup(x) {
  if (!x || x.app !== 'startoday' || x.version !== 1 || !x.data) throw Error('오늘의 별 버전 1 백업 파일이 아닙니다.');
  delete x.data.tags;
  for (const row of x.data.records || []) delete row.tagIds;
  if (x.data.areas === undefined) x.data.areas = defaultAreas();
  for (const t of TABLES) {
    if (!Array.isArray(x.data[t])) throw Error(`${t}: 목록 형식 오류`);
    const ids = new Set();
    for (const row of x.data[t]) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw Error(`${t}: ID 중복/누락`);
      ids.add(row.id);
    }
  }
  if (x.data.areas.some(a => typeof a.name !== 'string' || !a.name.trim() || !Number.isInteger(a.sortOrder) || a.sortOrder < 0) || new Set(x.data.areas.map(a => a.name)).size !== x.data.areas.length) throw Error('경험치 영역 형식 오류');
  if (x.data.settings.length !== 1 || x.data.settings[0].id !== 'main') throw Error('설정 데이터가 올바르지 않습니다.');
  for (const r of x.data.records) if (!Array.isArray(r.studentIds) || !Array.isArray(r.areas) || !KINDS.includes(r.kind) || typeof r.text !== 'string' || typeof r.createdAt !== 'string') throw Error('기록 형식 오류');
  for (const a of x.data.assignments) if (!a.repeat || !['none', 'daily', 'weekly'].includes(a.repeat.type) || !a.date) throw Error('과제 형식 오류');
  const d = x.data,
    studentIds = new Set(d.students.map(s => s.id)),
    assignmentIds = new Set(d.assignments.map(a => a.id)),
    routineIds = new Set(d.routines.map(r => r.id));
  for (const s of d.students) if (!Number.isInteger(s.no) || s.no < 1 || typeof s.name !== 'string' || !s.name.trim()) throw Error('학생 번호·이름 형식 오류');
  for (const r of d.records) if (!r.studentIds.length || r.studentIds.some(id => !studentIds.has(id)) || r.areas.some(a => !areaNames(d, true).includes(a))) throw Error('기록의 학생·영역 참조 오류');
  for (const row of d.assignmentStates) if (!studentIds.has(row.studentId) || !assignmentIds.has(row.assignmentId) || !STATUSES.includes(row.status) || row.id !== stateId(row.assignmentId, row.date, row.studentId)) throw Error('과제 상태의 학생·날짜 참조 오류');
  for (const row of d.routineStates) if (!studentIds.has(row.studentId) || !routineIds.has(row.routineId) || !['진행중', '완료', '면제'].includes(row.status) || row.id !== stateId(row.routineId, row.date, row.studentId)) throw Error('루틴 상태 참조 오류');
  if (!d.settings[0].timetableDisplay || !Number.isInteger(d.settings[0].seatRows) || !Number.isInteger(d.settings[0].seatCols)) throw Error('화면 설정 형식 오류');
  return d;
}
export function linkedIncidentIds(db, id) {
  const seen = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of db.incidents) if (seen.has(i.id) || i.linkedIds?.some(x => seen.has(x))) {
      for (const n of [i.id, ...(i.linkedIds || [])]) if (!seen.has(n)) {
        seen.add(n);
        changed = true;
      }
    }
  }
  return seen;
}
export const dday = (d, ref = today()) => {
  const n = Math.round((new Date(d + 'T12:00Z') - new Date(ref + 'T12:00Z')) / 86400000);
  return n === 0 ? 'D-Day' : n > 0 ? `D-${n}` : `D+${-n}`;
};
export function defaultAreas() {
  return DEFAULT_AREAS.map((name, i) => ({
    id: 'area-' + (i + 1),
    name,
    sortOrder: i,
    deletedAt: null
  }));
}
export function areaRows(db, includeDeleted = false) {
  const rows = Array.isArray(db.areas) && db.areas.length ? db.areas : defaultAreas();
  return rows.filter(a => includeDeleted || !a.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}
export function areaNames(db, includeDeleted = false) {
  return areaRows(db, includeDeleted).map(a => a.name);
}
export function normalizeDB(db) {
  delete db.tags;
  for (const row of db.records || []) delete row.tagIds;
  if (!Array.isArray(db.areas) || !db.areas.length) db.areas = defaultAreas();
  return db;
}
export function mergeAreaRows(current, incoming) {
  const rows = current.map(a => ({
    ...a
  }));
  for (const area of incoming) {
    const i = rows.findIndex(a => a.name === area.name);
    if (i >= 0) rows[i] = {
      ...area,
      id: rows[i].id
    };else rows.push({
      ...area,
      id: rows.some(a => a.id === area.id) ? uid() : area.id
    });
  }
  return rows.map((a, sortOrder) => ({
    ...a,
    sortOrder
  }));
}
export function areaEditOps(db, id, name) {
  name = name.trim();
  if (!name) throw Error('영역 이름을 입력하세요.');
  if (areaRows(db, true).some(a => a.id !== id && a.name === name)) throw Error('같은 이름의 영역이 있습니다.');
  const old = areaRows(db, true).find(a => a.id === id);
  if (!old) throw Error('영역을 찾지 못했습니다.');
  const ops = areaRows(db, true).map(a => ({
    table: 'areas',
    id: a.id,
    data: a.id === id ? {
      ...a,
      name
    } : a
  }));
  if (old.name === name) return ops;
  for (const table of ['records', 'assignments']) for (const row of db[table]) {
    const next = {
      ...row
    };
    let changed = false;
    for (const key of ['area', 'statArea']) if (next[key] === old.name) {
      next[key] = name;
      changed = true;
    }
    if (next.areas?.includes(old.name)) {
      next.areas = next.areas.map(a => a === old.name ? name : a);
      changed = true;
    }
    if (changed) ops.push({
      table,
      id: row.id,
      data: next
    });
  }
  return ops;
}
export function attendanceOps(db, ids, from, to, memo) {
  const days = dates(from, to);
  if (days.some(d => new Date(d + 'T12:00Z').toISOString().slice(0, 10) !== d)) throw Error('날짜를 확인하세요.');
  if (days.length > 366) throw Error('한 번에 1년 이내로 예약하세요.');
  if (!ids.length || ids.some(id => !activeStudents(db).some(s => s.id === id))) throw Error('예약할 학생을 선택하세요.');
  return days.flatMap(date => ids.map(studentId => {
    const id = stateId('attendance', date, studentId);
    const previous = db.attendance.find(r => r.id === id);
    return {
      table: 'attendance',
      id,
      data: {
        ...previous,
        id,
        date,
        studentId,
        excluded: true,
        memo: String(memo || '').trim()
      }
    };
  }));
}
export function seatMoveOps(db, studentId, row, col) {
  const st = db.settings[0];
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= st.seatRows || col >= st.seatCols) throw Error('좌석 범위를 확인하세요.');
  const source = activeStudents(db).find(s => s.id === studentId);
  if (!source) throw Error('학생을 찾지 못했습니다.');
  const target = activeStudents(db).find(s => s.seat?.row === row && s.seat?.col === col);
  if (target?.id === source.id) return [];
  return [{
    table: 'students',
    id: source.id,
    data: {
      ...source,
      seat: {
        row,
        col
      }
    }
  }, ...(target ? [{
    table: 'students',
    id: target.id,
    data: {
      ...target,
      seat: source.seat && source.seat.row >= 0 && source.seat.col >= 0 && source.seat.row < st.seatRows && source.seat.col < st.seatCols ? source.seat : null
    }
  }] : [])];
}
export function pendingRoutines(db, studentId, date) {
  return excluded(db, studentId, date) ? [] : db.routines.filter(r => !r.deletedAt && targeted(r, studentId) && routineStatus(db, r.id, date, studentId) === '진행중').sort((a, b) => a.sortOrder - b.sortOrder);
}
export function normalizeAnnouncement(note = {}) {
  const sizes = ['normal', 'large', 'huge', '18', '24', '32', '40', '48', '64'],
    colors = ['default', 'red', 'blue', 'yellow', 'green', 'purple', 'orange', 'gray'];
  const source = Array.isArray(note?.runs) ? note.runs : [{
    text: note?.text || '',
    size: note?.size,
    color: note?.color
  }];
  const runs = [];
  for (const item of source) {
    if (!item || typeof item.text !== 'string' || !item.text) continue;
    const run = {
      text: item.text,
      size: sizes.includes(item.size) ? item.size : 'normal',
      color: colors.includes(item.color) ? item.color : 'default'
    };
    const prev = runs.at(-1);
    if (prev && prev.size === run.size && prev.color === run.color) prev.text += run.text;else runs.push(run);
  }
  return {
    text: runs.map(r => r.text).join(''),
    runs
  };
}
export function formatAnnouncement(note, start, end, patch) {
  const normalized = normalizeAnnouncement(note);
  start = Math.max(0, Math.min(normalized.text.length, start));
  end = Math.max(start, Math.min(normalized.text.length, end));
  if (start === end) {
    start = 0;
    end = normalized.text.length;
  }
  let offset = 0;
  const runs = [];
  for (const run of normalized.runs) {
    const a = Math.max(0, start - offset),
      b = Math.min(run.text.length, end - offset);
    if (a < b) {
      if (a) runs.push({
        ...run,
        text: run.text.slice(0, a)
      });
      runs.push({
        ...run,
        ...patch,
        text: run.text.slice(a, b)
      });
      if (b < run.text.length) runs.push({
        ...run,
        text: run.text.slice(b)
      });
    } else runs.push(run);
    offset += run.text.length;
  }
  return normalizeAnnouncement({
    runs
  });
}
export function recordLabel(record) {
  return record.kind === '추가기록' && record.extraType ? record.extraType : {
    지도: '조언',
    관찰: '기록',
    추가기록: '추가 기록'
  }[record.kind] || record.kind;
}

// Academic dates are derived from settings; manual events remain independent.
export function calendarEvents(db) {
  const schedule = db.settings.find(s => s.id === 'main')?.academicCalendar || {};
  const definitions = [['term1Start', '개학식'], ['summerEnd', '여름방학식'], ['term2Start', '개학식'], ['winterEnd', '겨울방학식']];
  if (schedule.springBreak) definitions.push(['winterReturn', '개학식'], ['springEnd', '종업식']);
  const derived = definitions.filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(schedule[key] || '')).map(([key, title]) => ({
    id: 'academic:' + key,
    date: schedule[key],
    title,
    description: '학사일정 · 설정에서 관리',
    period: null,
    academic: true
  }));
  for (const date of new Set(schedule.holidays || [])) if (/^\d{4}-\d{2}-\d{2}$/.test(date)) derived.push({
    id: 'academic:holiday:' + date,
    date,
    title: '자율휴업일',
    description: '학사일정 · 재량휴업일',
    period: null,
    academic: true
  });
  return [...db.events, ...derived];
}
// Rename all references from the original names in one pass, including swaps.
export function areaBatchOps(db, draft) {
  const rows = draft.map((a, sortOrder) => ({
    ...a,
    name: a.name.trim(),
    sortOrder
  }));
  if (rows.some(a => !a.name) || new Set(rows.map(a => a.name)).size !== rows.length) throw Error('경험치 이름을 비우거나 중복할 수 없습니다.');
  if (new Set(rows.map(a => a.id)).size !== rows.length || areaRows(db, true).some(a => !rows.some(r => r.id === a.id))) throw Error('경험치 목록을 다시 확인하세요.');
  const renamed = new Map(areaRows(db, true).map(a => [a.name, rows.find(r => r.id === a.id).name]));
  const ops = rows.map(data => ({
    table: 'areas',
    id: data.id,
    data
  }));
  for (const r of db.records) {
    const areas = (r.areas || []).map(a => renamed.get(a) || a),
      area = renamed.get(r.area) || r.area;
    if (JSON.stringify(areas) !== JSON.stringify(r.areas || []) || area !== r.area) ops.push({
      table: 'records',
      id: r.id,
      data: {
        ...r,
        areas,
        ...(r.area !== undefined ? {
          area
        } : {})
      }
    });
  }
  for (const a of db.assignments) if (renamed.has(a.statArea) && renamed.get(a.statArea) !== a.statArea) ops.push({
    table: 'assignments',
    id: a.id,
    data: {
      ...a,
      statArea: renamed.get(a.statArea)
    }
  });
  return ops;
}

// Keep ISO dates in storage; format only text presented to the teacher.
export function formatDate(value) {
  if (!value) return '';
  let date = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(date + 'T12:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return '';
  return date.replaceAll('-', '.') + '.(' + '일월화수목금토'[parsed.getUTCDay()] + ')';
}
export function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const day = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  const time = date.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  return formatDate(day) + ' ' + time;
}
export function incidentTitle(db, ids, date) {
  const selected = new Set(ids);
  return [...activeStudents(db).filter(s => selected.has(s.id)), ...db.students.filter(s => s.deletedAt && selected.has(s.id))].map(s => String(s.no) + s.name).join(' ') + (ids.length ? ' ' : '') + formatDate(date);
}
export function studentScoreSummary(db, id, date = today(), from = date.slice(0, 7) + '-01', to = date) {
  const all = scores(db, id, '', date),
    month = scores(db, id, from, to);
  return {
    total: all.total,
    change: month.total,
    praise: all.records.filter(r => r.kind === '칭찬').length,
    praiseChange: month.records.filter(r => r.kind === '칭찬').length,
    advice: all.records.filter(r => r.kind === '지도').length,
    adviceChange: -month.records.filter(r => r.kind === '지도').length || 0,
    areas: all.areas
  };
}
export function autoSeatOps(db) {
  const list = activeStudents(db),
    st = db.settings[0];
  if (!list.length) return [];
  const side = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(list.length))));
  const occupied = new Set(),
    unplaced = [];
  let maxRow = -1,
    maxCol = -1;
  for (const student of list) {
    const seat = student.seat,
      key = seat ? `${seat.row}:${seat.col}` : '';
    if (seat && Number.isInteger(seat.row) && Number.isInteger(seat.col) && seat.row >= 0 && seat.col >= 0 && seat.row < 12 && seat.col < 12 && !occupied.has(key)) {
      occupied.add(key);
      maxRow = Math.max(maxRow, seat.row);
      maxCol = Math.max(maxCol, seat.col);
    } else unplaced.push(student);
  }
  let rows = Math.min(12, Math.max(side + 2, maxRow + 2, st.seatCanvasVersion ? Number(st.seatRows) || 0 : 0));
  let cols = Math.min(12, Math.max(side + 2, maxCol + 2, st.seatCanvasVersion ? Number(st.seatCols) || 0 : 0));
  const candidates = [];
  // Fill the square first, leaving a border for free arrangements.
  for (let row = 0; row < side; row++) for (let col = 0; col < side; col++) candidates.push({
    row,
    col
  });
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if (row >= side || col >= side) candidates.push({
    row,
    col
  });
  const ops = [];
  for (const student of unplaced) {
    const seat = candidates.find(c => !occupied.has(`${c.row}:${c.col}`));
    if (!seat) throw Error('자리 공간이 부족합니다. 학생 수를 확인하세요.');
    occupied.add(`${seat.row}:${seat.col}`);
    ops.push({
      table: 'students',
      id: student.id,
      data: {
        ...student,
        seat
      }
    });
  }
  if (st.seatRows !== rows || st.seatCols !== cols || st.seatCanvasVersion !== 1 || st.seatLayout !== 'custom') ops.push({
    table: 'settings',
    id: st.id,
    data: {
      ...st,
      seatRows: rows,
      seatCols: cols,
      seatLayout: 'custom',
      seatCanvasVersion: 1
    }
  });
  return ops;
}
export function withAutoSeats(db, ops) {
  const combined = [...ops, ...autoSeatOps(applyOps(db, ops))];
  return [...new Map(combined.map(op => [op.table + ':' + op.id, op])).values()];
}
export function recordPeriod(period) {
  return PERIODS.includes(period) ? period : '';
}
export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('월을 확인하세요.');
  const [year, index] = month.split('-').map(Number);
  return {
    from: month + '-01',
    to: new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10)
  };
}
export function semesterRange(settings, term) {
  const calendar = settings?.academicCalendar || {};
  const from = term === 1 ? calendar.term1Start : calendar.term2Start;
  const to = term === 1 ? calendar.summerEnd : calendar.springBreak && calendar.springEnd ? calendar.springEnd : calendar.winterEnd;
  return formatDate(from) && formatDate(to) && from <= to ? {
    from,
    to
  } : null;
}
export function hoursDefaultRange(settings, date = today()) {
  const semester = [semesterRange(settings, 1), semesterRange(settings, 2)].find(range => range && range.from <= date && date <= range.to);
  return semester ? {
    from: semester.from,
    to: date
  } : monthRange(date.slice(0, 7));
}
