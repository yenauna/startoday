export const DEFAULT_AREAS = ['학습', '과제', '관계', '도전', '생활', '알바'];
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
// Saved colors without provenance remain ambiguous, even if equal to an old default.
export const SUBJECT_PALETTE = Object.freeze({
  '국어': {
    background: '#EDF5FB',
    accent: '#397FAE'
  },
  '수학': {
    background: '#FBF7E8',
    accent: '#997710'
  },
  '사회': {
    background: '#F7F0EA',
    accent: '#946B46'
  },
  '과학': {
    background: '#EFF6EC',
    accent: '#527F4A'
  },
  '영어': {
    background: '#F0F1FC',
    accent: '#6269B0'
  },
  '음악': {
    background: '#FCEDF3',
    accent: '#B6537D'
  },
  '미술': {
    background: '#F7EFFB',
    accent: '#9161AD'
  },
  '체육': {
    background: '#EAF7F3',
    accent: '#287E73'
  },
  '실과': {
    background: '#FCEFE9',
    accent: '#BA6044'
  },
  '도덕': {
    background: '#F5F7E8',
    accent: '#7B8527'
  },
  '창체': {
    background: '#EDE9FA',
    accent: '#7256A5'
  }
});
export const SUBJECT_COLOR_ALIASES = Object.freeze({
  '자율자치': '창체',
  '동아리': '창체',
  '진로': '창체',
  '학자시': '창체'
});
export const DEFAULT_SUBJECT_CODES = ['국어', '수학', '사회', '과학', '체육', '음악', '미술', '실과', '영어', '창체', '도덕', ...Object.keys(SUBJECT_COLOR_ALIASES)];
export function defaultSubjectColors(code) {
  const key = ['자율', '자치'].includes(code) ? '창체' : Object.hasOwn(SUBJECT_COLOR_ALIASES, code) ? SUBJECT_COLOR_ALIASES[code] : code;
  return {
    ...(Object.hasOwn(SUBJECT_PALETTE, key) ? SUBJECT_PALETTE[key] : SUBJECT_PALETTE['창체'])
  };
}
function subjectHex(value) {
  return typeof value === 'string' && /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(value) ? value : null;
}
export function usesDefaultSubjectColors(rule) {
  return !subjectHex(rule?.color) || rule?.colorSource === 'default' && rule.color.toLowerCase() === String(rule.defaultColorValue || '').toLowerCase();
}
export function subjectColors(subject) {
  const rule = typeof subject === 'string' ? {
      code: subject
    } : subject || {},
    defaults = defaultSubjectColors(rule.code);
  return usesDefaultSubjectColors(rule) ? defaults : {
    background: subjectHex(rule.color) || defaults.background,
    accent: subjectHex(rule.accentColor) || defaults.accent
  };
}
export function subjectColorStyle(subject) {
  const colors = subjectColors(subject);
  const hex = colors.accent.slice(1),
    full = hex.length === 3 ? [...hex].map(x => x + x).join('') : hex;
  const deep = '#' + full.match(/../g).map(x => Math.round(parseInt(x, 16) * .78).toString(16).padStart(2, '0')).join('');
  return `--subject-bg:${colors.background};--subject-accent:${colors.accent};--subject-title-color:${deep};`;
}
export const GRADE_SUBJECT_PRESETS = {
  lower: ['국어', '수학', '통합교과', '창체', '자율자치', '동아리', '진로'],
  middle: ['국어', '수학', '사회', '과학', '영어', '음악', '미술', '체육', '도덕', '창체', '자율자치', '동아리', '진로', '학자시'],
  upper: ['국어', '수학', '사회', '과학', '영어', '음악', '미술', '체육', '실과', '도덕', '창체', '자율자치', '동아리', '진로', '학자시']
};
export function gradeSubjectCodes(grade) {
  return Number.isInteger(Number(grade)) && Number(grade) >= 1 && Number(grade) <= 6 ? [...GRADE_SUBJECT_PRESETS[Number(grade) <= 2 ? 'lower' : Number(grade) <= 4 ? 'middle' : 'upper']] : [];
}
export function subjectCatalog(database) {
  const codes = gradeSubjectCodes(database.settings[0]?.grade),
    standard = new Set([...DEFAULT_SUBJECT_CODES, '통합교과']);
  const regular = codes.map((code, index) => database.subject_rules.find(rule => rule.code === code) || {
    id: 'preset:' + code,
    code,
    label: code[0],
    color: defaultSubjectColors(code).background,
    colorSource: 'default',
    defaultColorValue: defaultSubjectColors(code).background,
    sortOrder: index,
    defaultType: '일반',
    location: '',
    teacherName: '',
    teacherHistory: []
  }).filter(rule => !rule.isProject);
  const special = database.subject_rules.filter(rule => rule.isProject || !standard.has(rule.code)).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    regular,
    special
  };
}
export function assignmentPublicInfo(database, assignment) {
  const checker = database.students.find(student => student.id === assignment.checkerStudentId && !student.deletedAt);
  return {
    memo: assignment.memo || '',
    checkerName: checker ? `${checker.no}. ${checker.name}` : ''
  };
}
export function classStatisticsSummary(database, date = today()) {
  const from = date.slice(0, 7) + '-01',
    counts = new Map(areaNames(database, true).map(area => [area, 0]));
  let total = 0,
    praise = 0,
    advice = 0;
  for (const student of activeStudents(database)) {
    const score = scores(database, student.id, from, date);
    total += score.total;
    for (const record of score.records) {
      if (record.kind === '칭찬') {
        praise++;
        for (const area of recordAreas(record)) counts.set(area, (counts.get(area) || 0) + 1);
      } else if (record.kind === '지도') advice++;
    }
  }
  const top = [...counts].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])[0];
  return {
    total,
    praise,
    advice,
    praisePercent: praise + advice ? Math.round(100 * praise / (praise + advice)) : 0,
    topArea: top?.[0] || '',
    topCount: top?.[1] || 0
  };
}
export function studentCalendarData(database, id) {
  return {
    assignments: database.assignments.filter(a => !a.deletedAt && targeted(a, id)).map(a => ({
      id: a.id,
      title: a.title,
      date: a.date,
      endDate: a.endDate,
      isQuest: !!a.isQuest,
      questGoal: a.isQuest ? questGoal(a) : undefined,
      repeat: a.repeat,
      ...assignmentPublicInfo(database, a)
    })),
    states: database.assignmentStates.filter(s => s.studentId === id).map(s => ({
      assignmentId: s.assignmentId,
      date: s.date,
      status: s.status,
      stamps: s.stamps
    })),
    excludedDates: database.attendance.filter(row => row.studentId === id && row.excluded).map(row => row.date),
    events: calendarEvents(database).map(e => ({
      date: e.date,
      title: e.title,
      description: e.description || '',
      period: e.period,
      timeOfDay: e.timeOfDay,
      isDday: !!e.isDday
    }))
  };
}
export function initialDB() {
  const db = Object.fromEntries(TABLES.map(t => [t, []]));
  db.areas = defaultAreas();
  db.settings = [{
    id: 'main',
    className: '우리 반',
    nameDisplayMode: 'real',
    classroomShowScores: true,
    lunchAfterPeriod: 4,
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
  db.subject_rules = DEFAULT_SUBJECT_CODES.map((code, i) => ({
    id: uid(),
    code,
    label: code[0],
    color: defaultSubjectColors(code).background,
    colorSource: 'default',
    defaultColorValue: defaultSubjectColors(code).background,
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
  if (a.isQuest) return true;
  return a.repeat.type === 'none' ? d === a.date : a.repeat.type === 'daily' || a.repeat.weekdays?.includes(weekday(d));
}
export function assignmentStatus(db, a, d, s) {
  const assignment = db.assignments.find(row => row.id === a);
  if (assignment?.isQuest) return questProgress(db, assignment, s).status;
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
    areas: Object.fromEntries(areaNames(db, true).map(k => [k, records.filter(r => recordAreas(r).includes(k)).reduce((n, r) => n + delta(r), 0)])),
    records
  };
}
export function pending(db, s, d) {
  const out = [];
  for (const a of db.assignments.filter(a => targeted(a, s) && !a.deletedAt && a.date <= d && (!a.endDate || a.endDate >= a.date))) {
    if (a.isQuest) {
      if (occurs(a, d) && !excluded(db, s, d) && assignmentStatus(db, a.id, d, s) === '진행중') out.push({
        assignment: a,
        date: d
      });
      continue;
    }
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
  validateTaskDate(d);
  if (a.isQuest) throw Error('장기 퀘스트는 스탬프로 체크하세요.');
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
  if (!a.noStar && ['완료', '늦게완료', '안함', '면제'].includes(status)) ops.push({
    table: 'records',
    id: old?.id || `auto:${id}`,
    data: {
      id: old?.id || `auto:${id}`,
      date: d,
      period: '',
      studentIds: [s],
      areas: a.statArea ? [areaName(a.statArea)] : [],
      area: a.statArea ? areaName(a.statArea) : null,
      kind: status === '안함' ? '지도' : status === '완료' ? '칭찬' : '관찰',
      text: `${a.title} ${status === '늦게완료' ? '늦게 완료' : status}${memo ? ' (' + memo + ')' : ''}`,
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
      const data = structuredClone(op.data);
      if (op.table === 'students' && i >= 0 && Array.isArray(list[i].rewardTitles)) data.rewardTitles = mergeRewardTitles(list[i].rewardTitles, data.rewardTitles);
      if (i >= 0) list[i] = data;else list.push(data);
    }
  }
  return copy;
}
export function parseRoster(text, start = 1) {
  return text.split(/\r?\n/).filter(x => x.trim()).map(line => {
    const parts = line.trim().replace(/^(\d+)\.\s*(?=[^\d.\s])/u, '$1 ').split(/[\t,，]+|\s+/).filter(Boolean);
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
  const subjects = mentions.filter(mention => mention.role === 'subject');
  // Explicit subjects replace a prior card selection. Otherwise preserve it.
  let ids = subjects.length ? [] : [...selected];
  if (subjects.length || !selected.length) {
    const targets = subjects.length ? subjects : mentions.filter(mention => mention.role === 'bare');
    for (const mention of targets) {
      if (!mention.ids.length) warnings.push(mention.warning || '학생을 확인하세요.');
      ids.push(...mention.ids);
    }
    for (const id of ids) {
      const student = candidates.find(row => row.id === id);
      if (student && candidates.some(row => row.id !== id && (row.name === student.name || row.no === student.no))) warnings.push('동명이인·중복 번호를 확인하세요.');
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
const mentionSuffix = String.raw`(?:(?:이)?(?:(?:에게서|한테서|에게|한테|으로|로|의|을|를)(?:은|는|도|만)?|와|과|랑|하고|이|가|은|는|도))?`;
function mentionRole(suffix) {
  if (!suffix) return 'bare';
  if (/^(?:이)?(?:에게서|한테서|에게|한테|으로|로|의|을|를)(?:은|는|도|만)?$/.test(suffix)) return 'object';
  if (/^(?:이)?(?:와|과|랑|하고)$/.test(suffix)) return 'conjunct';
  if (/^(?:이)?(?:이|가|은|는|도)$/.test(suffix)) return 'subject';
  return 'bare';
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
  const ordered = filtered.sort((a, b) => a.start - b.start || b.end - a.end);
  // Only adjacent coordinated mentions share a role; intervening words or
  // sentence boundaries must not pull an unrelated student into the target list.
  for (let i = ordered.length - 1; i >= 0; i--) {
    const mention = ordered[i];
    if (!['bare', 'conjunct'].includes(mention.role)) continue;
    const following = ordered.find(next => next.start >= mention.end);
    if (!following) continue;
    const gap = text.slice(mention.end, following.start);
    const connected = mention.role === 'conjunct' ? /^\s*(?:[,，]\s*)?$/.test(gap) : /^\s*[,，]\s*$/.test(gap);
    if (!connected) continue;
    if (mention.role === 'conjunct' && following.role === 'bare') {
      // A trailing bare name/number closes a coordinated subject list.
      for (const sibling of ordered) if (sibling.start === following.start && sibling.end === following.end && sibling.role === 'bare') sibling.role = 'subject';
    }
    if (['subject', 'object'].includes(following.role)) mention.role = following.role;
  }
  return ordered;
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
  normalizeDB(x.data);
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
  const rows = canonicalAreas(db);
  return rows.filter(a => includeDeleted || !a.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}
export function areaNames(db, includeDeleted = false) {
  return areaRows(db, includeDeleted).map(a => a.name);
}
export function normalizeDB(db) {
  delete db.tags;
  for (const row of db.records || []) delete row.tagIds;
  if (!Array.isArray(db.areas) || !db.areas.length) db.areas = defaultAreas();
  const ops = areaMigrationOps(db);
  if (ops.length) {
    const next = applyOps(db, ops);
    for (const table of ['areas', 'records', 'assignments']) if (next[table]) db[table] = next[table];
  }
  return db;
}
export function mergeAreaRows(current, incoming) {
  current = canonicalAreaRows(current);
  incoming = canonicalAreaRows(incoming);
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
  name = areaName(name.trim());
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
    for (const key of ['area', 'statArea']) if (areaName(next[key]) === old.name) {
      next[key] = name;
      changed = true;
    }
    if (next.areas?.some(a => areaName(a) === old.name)) {
      next.areas = next.areas.map(a => areaName(a) === old.name ? name : areaName(a));
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
  const sizes = ['normal', 'large', 'huge', '16', '18', '20', '24', '32', '40', '48', '64'],
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
      color: colors.includes(item.color) || TEXT_COLOR_CARDS.some(c => c.color === item.color) ? item.color : 'default'
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
    name: areaName(a.name.trim()),
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
    const areas = recordAreas(r).map(a => renamed.get(a) || a),
      area = renamed.get(areaName(r.area)) || areaName(r.area);
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
  for (const a of db.assignments) if (renamed.has(areaName(a.statArea)) && renamed.get(areaName(a.statArea)) !== a.statArea) ops.push({
    table: 'assignments',
    id: a.id,
    data: {
      ...a,
      statArea: renamed.get(areaName(a.statArea))
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

// Seoul wall-clock schedule windows; never count down through an ongoing lesson.
export function classroomCountdown(database, config, instant = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`,
    seconds = +parts.hour * 3600 + +parts.minute * 60 + +parts.second;
  const times = Array.from({
    length: 6
  }, (_, i) => {
    const match = String(config.periodTimes?.[i] || DEFAULT_PERIOD_TIMES[i]).match(/(\d{1,2}):(\d{2})\s*[~～–—-]\s*(\d{1,2}):(\d{2})/);
    if (!match || +match[1] > 23 || +match[3] > 23 || +match[2] > 59 || +match[4] > 59) return null;
    return {
      start: +match[1] * 3600 + +match[2] * 60,
      end: +match[3] * 3600 + +match[4] * 60
    };
  });
  for (let i = 0; i < 6; i++) {
    const time = times[i],
      previous = i ? times[i - 1] : null;
    if (!time || seconds >= time.start || previous && seconds < previous.end) continue;
    const slot = database.timetables.find(t => t.date === date && t.period === i + 1);
    if (!slot) continue;
    const rule = database.subject_rules.find(r => r.code === slot.subjectCode) || {};
    const location = slot.locationOverride || rule.location || '';
    const moving = [slot.type, rule.type, rule.defaultType].some(t => t && t !== '일반') || !!(slot.teacherOverride || rule.teacherName) || !!location && !/^(우리 ?)?교실$/.test(location);
    const remaining = time.start - seconds;
    if (remaining > (moving ? 300 : 60)) continue;
    return {
      key: `${date}:${i + 1}:${time.start}`,
      period: i + 1,
      subject: slot.subjectCode,
      location,
      memo: slot.publicMemo ?? slot.memo ?? '',
      remaining
    };
  }
  return null;
}
export function checkerAssignments(database, checkerId, date = today()) {
  return database.assignments.filter(a => !a.isQuest && a.checkerStudentId === checkerId && occurs(a, date)).map(a => ({
    id: a.id,
    title: a.title
  }));
}
export function checkerChecklist(database, checkerId, assignmentId, date = today()) {
  if (!activeStudents(database).some(s => s.id === checkerId)) throw Error('확인자 학생을 확인하세요.');
  const assignment = database.assignments.find(a => a.id === assignmentId && a.checkerStudentId === checkerId && occurs(a, date));
  if (!assignment) throw Error('오늘 확인할 수 있는 과제가 아닙니다.');
  return {
    assignment: {
      id: assignment.id,
      title: assignment.title
    },
    students: activeStudents(database).filter(s => targeted(assignment, s.id)).map(s => ({
      id: s.id,
      no: s.no,
      name: s.name,
      excluded: excluded(database, s.id, date),
      completed: ['완료', '늦게완료', '면제'].includes(assignmentStatus(database, assignment.id, date, s.id))
    }))
  };
}
export function checkerStateOps(database, checkerId, assignmentId, targetId, completed, date = today()) {
  const checklist = checkerChecklist(database, checkerId, assignmentId, date),
    target = checklist.students.find(s => s.id === targetId);
  if (!target || target.excluded || typeof completed !== 'boolean') throw Error('체크할 학생을 확인하세요.');
  const assignment = database.assignments.find(a => a.id === assignmentId),
    id = stateId(assignmentId, date, targetId),
    old = database.assignmentStates.find(s => s.id === id);
  // A peer may only change completion, never overwrite a teacher's private memo.
  return taskStateOps(database, assignment, date, targetId, completed ? '완료' : '진행중', old?.memo || '');
}
export function studentRoutineOps(database, studentId, routineId, completed, date = today()) {
  const routine = database.routines.find(r => r.id === routineId && !r.deletedAt && targeted(r, studentId));
  if (typeof completed !== 'boolean' || !activeStudents(database).some(s => s.id === studentId) || !routine || excluded(database, studentId, date) || routineStatus(database, routineId, date, studentId) === '면제') throw Error('오늘 체크할 수 있는 루틴이 아닙니다.');
  const id = stateId(routineId, date, studentId),
    old = database.routineStates.find(s => s.id === id);
  return [{
    table: 'routineStates',
    id,
    data: {
      ...old,
      id,
      routineId,
      date,
      studentId,
      status: completed ? '완료' : '진행중',
      updatedAt: now()
    }
  }];
}
// New events use explicit semantic time slots. Legacy 7/8 keep their original
// after-school/lunch meanings until that individual event is edited.
export function eventTimePeriod(event) {
  const names = {
    all: null,
    morning: 0,
    lunch: 7,
    after: 8
  };
  if (Object.hasOwn(names, event.timeOfDay)) return names[event.timeOfDay];
  return event.period === 7 ? 8 : event.period === 8 ? 7 : event.period ?? null;
}
export function dayTimeline(database, date) {
  const events = calendarEvents(database).filter(e => e.date === date),
    slot = p => ({
      type: 'event',
      period: p,
      events: events.filter(e => eventTimePeriod(e) === p)
    }),
    out = [slot(0)];
  for (let p = 1; p <= 6; p++) {
    out.push({
      type: 'lesson',
      period: p
    });
    if (p === lunchPosition(database.settings[0])) out.push(slot(7));
  }
  out.push(slot(8));
  return out;
}
export function upcomingWeekEvents(database, date) {
  const monday = addDays(date, -((weekday(date) + 6) % 7)),
    end = addDays(monday, 4);
  return calendarEvents(database).filter(event => event.date > date && event.date <= end);
}
export function lunchPosition(config = {}) {
  return [3, 4, 5].includes(Number(config.lunchAfterPeriod)) ? Number(config.lunchAfterPeriod) : 4;
}
export function markRemainingUndoneOps(database, assignment, date) {
  validateTaskDate(date);
  return activeStudents(database).filter(s => !assignment.isQuest && targeted(assignment, s.id) && !excluded(database, s.id, date) && assignmentStatus(database, assignment.id, date, s.id) === '진행중').flatMap(s => taskStateOps(database, assignment, date, s.id, '안함', database.assignmentStates.find(st => st.id === stateId(assignment.id, date, s.id))?.memo || ''));
}
export function assignmentPolicyOps(database) {
  const ops = [];
  for (const state of database.assignmentStates) {
    const assignment = database.assignments.find(a => a.id === state.assignmentId);
    if (!assignment || !targeted(assignment, state.studentId) || !database.students.some(s => s.id === state.studentId) || !STATUSES.includes(state.status)) continue;
    if (assignment.isQuest) continue;
    const old = database.records.find(r => r.autoRef === state.id),
      change = isTaskDate(state.date) ? taskStateOps(database, assignment, state.date, state.studentId, state.status, state.memo || '').find(op => op.table === 'records') : null;
    if (!change) continue;
    if (change.remove) {
      ops.push(change);
      continue;
    }
    if (!old) ops.push(change);else if (old.kind !== change.data.kind || old.text !== change.data.text) ops.push({
      table: 'records',
      id: old.id,
      data: {
        ...old,
        kind: change.data.kind,
        text: change.data.text,
        updatedAt: now()
      }
    });
  }
  return ops;
}
export const TEXT_COLOR_CARDS = [['검정', '#172033'], ['회색', '#64748B'], ['흰색', '#FFFFFF'], ['빨강', '#B91C1C'], ['주황', '#C2410C'], ['황금', '#A16207'], ['노랑', '#FFE066'], ['연노랑', '#FFF176'], ['초록', '#15803D'], ['민트', '#0F766E'], ['청록', '#0E7490'], ['파랑', '#1D4ED8'], ['하늘', '#A7E5FF'], ['남색', '#3730A3'], ['보라', '#7E22CE'], ['라벤더', '#C4B5FD'], ['분홍', '#FFB3D1'], ['장미', '#BE185D'], ['갈색', '#854D0E'], ['연두', '#BEF264']].map(([name, color]) => ({
  name,
  color
}));

// Resolve against the record's selected day, never today's timetable implicitly.
export function quickRecordContext(database, text, date, choice = '자동') {
  const period = choice === '자동' ? inputPeriod(text, database.settings[0]) : recordPeriod(choice);
  const number = choice !== '자동' || explicitPeriod(text) ? String(period).match(/^([1-6])교시$/) : null;
  const slot = number ? database.timetables.find(t => t.date === date && Number(t.period) === Number(number[1])) : null;
  return {
    date,
    period,
    ...(slot?.subjectCode ? {
      subjectCode: slot.subjectCode
    } : {})
  };
}

// Titles bind to the six XP areas, never to words in record content.
export const KINGDOM_THRESHOLDS = [5, 10, 15];
export const KINGDOM_DOMAINS = [['learning', '학습', '📘', 'area-1', ['지식의 탐색자', '사유의 탐구자', '통찰의 현자']], ['tasks', '과제', '📋', 'area-2', ['약속의 수행자', '완수의 장인', '결실의 마스터']], ['relationships', '관계', '🤝', 'area-3', ['공감의 동행자', '신뢰의 중재자', '화합의 대사']], ['challenge', '도전', '🧭', 'area-4', ['용기의 모험가', '역경의 돌파자', '불굴의 개척자']], ['life', '생활', '🌿', 'area-5', ['자율의 길잡이', '질서의 파수꾼', '균형의 수호자']], ['jobs', '알바', '🏰', 'area-6', ['길드의 지원자', '길드의 기둥', '길드의 대들보']]].map(([id, label, icon, areaId, titles]) => ({
  id,
  label,
  icon,
  areaId,
  titles
}));
export function titleThresholds(config = {}) {
  const goal = Number(config.goal ?? config.titleGoal ?? 15);
  if (!Number.isInteger(goal) || goal < 3 || goal > 9999) throw Error('칭호 목표는 3~9999의 정수로 입력하세요.');
  return [Math.ceil(goal / 3), Math.ceil(goal * 2 / 3), goal];
}
export function kingdomConfig(database) {
  return {
    goal: Number(database.settings?.[0]?.titleGoal ?? 15),
    labels: Object.fromEntries(KINGDOM_DOMAINS.map(d => [d.id, areaRows(database, true).find(a => a.id === d.areaId)?.name || d.label]))
  };
}
export function kingdomCounts(database, studentId, to = today()) {
  const counts = Object.fromEntries(KINGDOM_DOMAINS.map(d => [d.id, 0])),
    config = kingdomConfig(database);
  for (const r of database.records) {
    if (r.kind !== '칭찬' || !r.studentIds?.includes(studentId) || !r.date || r.date > to || excluded(database, studentId, r.date)) continue;
    if (r.autoRef != null) {
      const st = database.assignmentStates.find(s => s.id === r.autoRef && s.studentId === studentId),
        a = database.assignments.find(a => a.id === st?.assignmentId);
      if (!a || a.noStar || st.status !== '완료' || a.isQuest && Number(st.stamps || 0) < questGoal(a)) continue;
    }
    const areas = recordAreas(r);
    for (const d of KINGDOM_DOMAINS) if (areas.includes(config.labels[d.id])) counts[d.id]++;
  }
  return counts;
}
export function kingdomCatalog(counts = {}, config = {}) {
  const thresholds = titleThresholds(config);
  return KINGDOM_DOMAINS.map(d => {
    const count = Math.max(0, Number(counts?.[d.id]) || 0),
      stage = thresholds.filter(n => count >= n).length,
      next = thresholds[stage] || null;
    return {
      ...d,
      label: config.labels?.[d.id] || d.label,
      thresholds,
      count,
      stage,
      next,
      remaining: next === null ? 0 : next - count,
      current: stage ? d.titles[stage - 1] : '아직 획득한 칭호가 없어요',
      unlocked: d.titles.slice(0, stage).map((name, i) => ({
        id: d.id + ':' + (i + 1),
        name,
        icon: d.icon
      }))
    };
  });
}
export function studentRewardTitles(student) {
  return (student?.rewardTitles || []).filter(t => t && typeof t.id === 'string' && t.id.startsWith('quest:') && typeof t.name === 'string').map(t => ({
    id: t.id,
    name: t.name,
    icon: '🏅'
  }));
}
export function kingdomEquipped(student, counts, config = {}) {
  return [...kingdomCatalog(counts, config).flatMap(d => d.unlocked), ...studentRewardTitles(student)].find(t => t.id === (student?.equippedTitle ?? student?.equipped_title)) || {
    id: null,
    name: '별의 주민',
    icon: '🌱'
  };
}
export function studentTitleOps(database, studentId, titleId) {
  const student = activeStudents(database).find(s => s.id === studentId);
  if (!student) throw Error('학생을 확인하세요.');
  if (titleId && kingdomEquipped({
    ...student,
    equippedTitle: titleId
  }, kingdomCounts(database, studentId), kingdomConfig(database)).id !== titleId) throw Error('획득한 칭호만 장착할 수 있습니다.');
  return [{
    table: 'students',
    id: student.id,
    data: {
      ...student,
      equippedTitle: titleId || null,
      updatedAt: now()
    }
  }];
}
export function kingdomBadge(student, counts, config = {}) {
  const t = kingdomEquipped(student, counts, config);
  return `<span class="kingdom-badge" data-equipped-title="${esc(t.id || 'resident')}">${t.icon} ${esc(t.name)}</span>`;
}
export function kingdomSummary(counts, config = {}, student = null) {
  return `<div class="kingdom-teacher-summary">${kingdomCatalog(counts, config).map(d => `<div><strong>${d.icon} ${esc(d.label)} · 칭찬 ${d.count}회</strong><span>${d.unlocked.map(t => esc(t.name)).join(' / ') || '아직 획득한 칭호가 없어요'}</span></div>`).join('')}${studentRewardTitles(student).map(t => `<div>🏅 ${esc(t.name)} · 퀘스트 보상</div>`).join('')}</div>`;
}
export function validateStudentNickname(value) {
  if (typeof value !== 'string' || !/^[가-힣]{1,8}$/.test(value)) throw Error('별명은 공백 없이 완성된 한글 1~8자로 입력하세요. 영문·숫자·특수문자는 사용할 수 없습니다.');
  return value;
}
export function studentNicknameOps(database, id, nickname) {
  const s = activeStudents(database).find(s => s.id === id);
  if (!s) throw Error('학생을 확인하세요.');
  if (nickname !== null) validateStudentNickname(nickname);
  return [{
    table: 'students',
    id,
    data: {
      ...s,
      nickname,
      updatedAt: now()
    }
  }];
}
export function studentLabel(s, studentMode = false) {
  return s.name + (s.nickname ? studentMode ? ' "' + s.nickname + '"' : '(' + s.nickname + ')' : '');
}
export function questGoal(a) {
  const n = Number(a.questGoal ?? 10);
  if (!Number.isInteger(n) || n < 1 || n > 999) throw Error('퀘스트 목표는 1~999의 정수로 입력하세요.');
  return n;
}
export function questProgress(database, a, studentId) {
  const state = database.assignmentStates.find(s => s.id === stateId(a.id, a.date, studentId)),
    goal = questGoal(a),
    stamps = Math.min(goal, Math.max(0, Number(state?.stamps) || 0));
  return {
    stamps,
    goal,
    status: stamps >= goal ? '완료' : '진행중'
  };
}
export function questStampOps(database, a, date, studentId, change, memo = null) {
  validateTaskDate(date);
  validateTaskDate(a.date);
  if (!a.isQuest || !occurs(a, date) || excluded(database, studentId, date) || !Number.isInteger(change)) throw Error('퀘스트 대상과 날짜를 확인하세요.');
  const student = activeStudents(database).find(s => s.id === studentId);
  if (!student || !targeted(a, studentId)) throw Error('퀘스트 대상 학생을 확인하세요.');
  const progress = questProgress(database, a, studentId),
    stamps = Math.max(0, Math.min(progress.goal, progress.stamps + change)),
    old = database.assignmentStates.find(s => s.id === stateId(a.id, a.date, studentId));
  const ops = taskStateOps(database, {
    ...a,
    isQuest: false
  }, a.date, studentId, stamps >= progress.goal ? '완료' : '진행중', memo ?? old?.memo ?? '');
  ops[0].data.stamps = stamps;
  const rewardRecord = ops.find(op => op.table === 'records' && op.data);
  if (rewardRecord) {
    const existing = database.records.find(r => r.autoRef === ops[0].id);
    rewardRecord.data.date = progress.stamps >= progress.goal && existing ? existing.date : date;
  }
  const title = String(a.questTitle || '').trim();
  if (stamps >= progress.goal && title && !studentRewardTitles(student).some(t => t.id === 'quest:' + a.id)) ops.push({
    table: 'students',
    id: studentId,
    data: {
      ...student,
      rewardTitles: [...(student.rewardTitles || []), {
        id: 'quest:' + a.id,
        name: title,
        assignmentId: a.id,
        earnedAt: now()
      }]
    }
  });
  return ops;
}
export function areaName(value) {
  return value === '학습태도' ? '학습' : value;
}
export function recordAreas(record) {
  return [...new Set((record.areas || (record.area ? [record.area] : [])).map(areaName))];
}
export function canonicalAreaRows(rows) {
  const kept = [];
  for (const original of [...rows].sort((a, b) => Number(!!a.deletedAt) - Number(!!b.deletedAt) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))) {
    const row = {
      ...original,
      name: areaName(original.name)
    };
    if (!kept.some(a => a.name === row.name)) kept.push(row);
  }
  return kept;
}
export function areaMigrationOps(database) {
  const ops = [],
    rows = canonicalAreas(database);
  for (const old of database.areas || []) {
    const next = rows.find(a => a.id === old.id);
    if (!next) ops.push({
      table: 'areas',
      id: old.id,
      remove: true
    });else if (next.name !== old.name) ops.push({
      table: 'areas',
      id: old.id,
      data: next
    });
  }
  for (const row of rows) if (database.areas?.length && !database.areas.some(old => old.id === row.id)) ops.push({
    table: 'areas',
    id: row.id,
    data: row
  });
  for (const old of database.records || []) {
    const areas = recordAreas(old),
      area = areaName(old.area);
    if (JSON.stringify(areas) !== JSON.stringify(old.areas || []) || area !== old.area) ops.push({
      table: 'records',
      id: old.id,
      data: {
        ...old,
        areas,
        ...(old.area !== undefined ? {
          area
        } : {})
      }
    });
  }
  for (const old of database.assignments || []) if (areaName(old.statArea) !== old.statArea) ops.push({
    table: 'assignments',
    id: old.id,
    data: {
      ...old,
      statArea: areaName(old.statArea)
    }
  });
  return ops;
}
export function isTaskDate(value) {
  return typeof value === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) && value.slice(0, 4) !== '0000' && !!formatDate(value);
}
export function validateTaskDate(value) {
  if (!isTaskDate(value)) throw Error('과제 날짜를 YYYY-MM-DD 형식의 올바른 날짜로 확인하세요.');
  return value;
}
export function quickPeriodChoices(config = {}) {
  const choices = ['아침'];
  for (let p = 1; p <= 6; p++) {
    choices.push(p + '교시');
    if (p === lunchPosition(config)) choices.push('점심');
  }
  return [...choices, '방과후', '쉬는시간'];
}
export function areaScoreEntries(areas = {}) {
  const merged = {};
  for (const [name, score] of Object.entries(areas)) merged[areaName(name)] = (merged[areaName(name)] || 0) + Number(score || 0);
  return Object.entries(merged);
}
export function canonicalAreas(database) {
  const original = Array.isArray(database.areas) && database.areas.length ? database.areas : defaultAreas(),
    rows = canonicalAreaRows(original);
  if (!rows.some(a => a.name === '학습') && ((database.records || []).some(r => recordAreas(r).includes('학습')) || (database.assignments || []).some(a => areaName(a.statArea) === '학습'))) {
    let id = 'area-learning',
      suffix = 0;
    while (original.some(a => a.id === id)) id = 'area-learning-' + ++suffix;
    rows.push({
      id,
      name: '학습',
      sortOrder: Math.max(-1, ...rows.map(a => a.sortOrder)) + 1,
      deletedAt: null
    });
  }
  return rows;
}
export function mergeRewardTitles(existing = [], incoming = []) {
  const out = [];
  for (const t of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) if (t && typeof t.id === 'string' && !out.some(row => row.id === t.id)) out.push(structuredClone(t));
  return out;
}
