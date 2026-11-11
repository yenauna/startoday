import { subjectPaletteFields, bindSubjectPalette } from '../components/subject-colors.js';
import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, settings, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, bindLater, btn, checkbox, empty, esc, hashPin, input, localTime, run, saveFile, select, textarea, toast } from '../shared/ui.js';
import { studentDetail, studentEditor } from './students.js';
import { schoolPickerFields, bindSchoolPicker } from '../components/school-picker.js';
import { koreanPasswordField, bindKoreanPasswordFields } from '../components/korean-password.js';
import { validateKoreanPassword } from '../shared/student-auth.js';
const settingsCategories = ['기본 정보', '교실 화면', '학사일정', '과목·전담', '경험치 종류', '학생 명단', '데이터 백업'];
let settingsCategory = '기본 정보';
export function settingsView() {
  const st = settings(),
    bytes = new Blob([JSON.stringify(db())]).size;
  const calendar = st.academicCalendar || {};
  return `<div class="toolbar"><div><h2>설정</h2><small>학급과 기록 방식을 선생님께 맞추세요.</small></div></div><div id="settings-layout" class="settings-layout"><nav class="settings-sidebar" aria-label="설정 카테고리">${settingsCategories.map(category => btn(esc(category), () => {
    settingsCategory = category;
    applySettingsCategory();
  }, settingsCategory === category ? 'active' : '', `data-settings-tab="${esc(category)}" aria-pressed="${settingsCategory === category}"`)).join('')}</nav><div class="settings-content"><form id="settings-form" novalidate><section class="panel" data-settings-category="기본 정보"><h3>기본 정보</h3><div class="formgrid">${input('학급 이름', 'className', st.className, 'text', 'required')}${input('학년도', 'academicYear', st.academicYear, 'number', 'min="2020" max="2100" required')}${schoolPickerFields(st.schoolName || '', st.schoolCode || '')}${input('학년', 'grade', st.grade || '', 'number', 'min="1" max="6" required')}${input('반', 'classGroup', st.classGroup || '', 'text', 'required maxlength="40"')}</div></section><section class="panel" data-settings-category="교실 화면" hidden><h3>교실 화면</h3><div class="formgrid">${select('이름 표시 방식', 'nameDisplayMode', [['real', '실명 그대로 노출'], ['number', '번호만 · 기본'], ['masked', '이름 가림 · 김●수'], ['alias', '교사가 정한 별명']], st.nameDisplayMode)}${checkbox('학생 점수 표시', 'classroomShowScores', !!st.classroomShowScores)}${input('화면 해제 비밀번호 · 변경할 때만 입력', 'classroomPin', '', 'password', 'minlength="4" autocomplete="new-password"')}</div></section><section class="panel" data-settings-category="기본 정보"><h3>보고서</h3><div class="formgrid">${input('보고서 제목', 'reportHeader', st.reportHeader)}${select('기본 출력 방식', 'reportPrintMode', [['color', '컬러'], ['mono', '흑백']], st.reportPrintMode || 'color')}</div></section><section class="panel" data-settings-category="학사일정" hidden><h3>학사일정</h3><div class="formgrid">${select('점심시간 위치', 'lunchAfterPeriod', [[3, '3교시 후'], [4, '4교시 후'], [5, '5교시 후']], C.lunchPosition(st))}${Array.from({
    length: 6
  }, (_, i) => input(`${i + 1}교시 시간`, 'period-' + i, st.periodTimes?.[i] || C.DEFAULT_PERIOD_TIMES[i])).join('')}${checkbox('시간표에 선생님 표시', 'showTeacher', st.timetableDisplay.showTeacher)}${checkbox('시간표에 장소 표시', 'showLocation', st.timetableDisplay.showLocation)}${[['term1Start', '1학기 개학일'], ['summerEnd', '여름방학식'], ['term2Start', '2학기 개학일'], ['winterEnd', '겨울방학식']].map(([key, label]) => input(label, key, calendar[key] || '', 'date')).join('')}<div class="span2">${checkbox('봄방학 사용', 'springBreak', !!calendar.springBreak)}</div><fieldset id="spring-dates" class="span2 formgrid" ${calendar.springBreak ? '' : 'disabled'}>${input('겨울방학 후 개학일', 'winterReturn', calendar.winterReturn || '', 'date')}${input('봄방학식 · 종업식/졸업식', 'springEnd', calendar.springEnd || '', 'date')}</fieldset><div class="span2"><label>자율휴업일 · 여러 날짜 선택 후 추가</label><div class="row"><span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate('')) || '날짜 선택'}</span><input id="holiday-date" type="date" aria-label="자율휴업일 추가 날짜"></span>${btn('날짜 추가', () => {
    const field = $('#holiday-date'),
      date = field.value;
    if (!date) return;
    const holder = $('#holiday-dates');
    if (![...holder.querySelectorAll('input')].some(i => i.value === date)) holder.insertAdjacentHTML('beforeend', holidayChip(date));
    field.value = '';
  })}</div><div id="holiday-dates" class="chips">${(calendar.holidays || []).map(holidayChip).join('')}</div></div></div><p class="muted">개학식·방학식·종업식·자율휴업일은 일정 달력에 자동 반영됩니다.</p></section><button class="primary settings-save">설정 저장</button></form><section class="panel" data-settings-category="데이터 백업" hidden><h3>백업과 복원</h3><p class="muted">${store.mode === 'cloud' ? '학생의 텍스트 자료는 외부 서버인 수파베이스에 저장됩니다.' : '체험 모드 자료는 현재 브라우저에만 저장됩니다.'}</p><p>학급 데이터 약 <strong>${(bytes / 1024).toFixed(1)} KB</strong><br><small>텍스트 JSON 기준 추정치입니다. 실제 DB·백업·인증 저장량은 수파베이스 대시보드에서 확인하세요.</small></p><p class="muted">마지막 파일 백업: ${st.lastBackupAt ? esc(localTime(st.lastBackupAt)) : '없음'}</p><div class="row">${btn('전체 JSON 내려받기', downloadBackup, 'primary')}${btn('JSON 가져오기', () => $('#backup-input').click())}${btn('클라우드에 한 벌 더 저장', async () => {
    await store.cloudBackup();
    toast('클라우드 백업을 저장했습니다. 최근 2세대를 보관합니다.');
  })}${btn('클라우드 백업 복구', cloudRestore)}</div><input id="backup-input" type="file" accept="application/json,.json" hidden><div class="notice">사진·음성은 저장하지 않습니다. 백업 파일에는 학생 기록이 포함되므로 안전한 곳에 보관하세요.</div><h3 style="margin-top:22px">학년도 전환</h3><p class="muted">현재 학생을 새 고유 ID로 복제합니다. 지난 기록은 보존하고 새 학생에게는 연결하지 않습니다.</p>${btn('다음 학년으로 이어 가기', rollover)}</section><section class="panel" data-settings-category="학생 명단" hidden><div class="toolbar"><h3>학생 명단</h3><div class="row">${btn('초기화 비밀번호 설정', initialStudentPasswordDialog)}${btn('명단 붙여넣기', rosterPaste, 'primary')}${btn('+ 학생', () => studentEditor())}${btn('나간 학생 보기', removedStudents)}</div></div><div class="table-wrap"><table><thead><tr><th>번호</th><th>이름</th><th>교실 화면 별명</th><th></th></tr></thead><tbody>${students().map(s => `<tr><td>${s.no}</td><td>${esc(C.studentLabel(s))}</td><td>${esc(s.alias || '')}</td><td><div class="row">${btn('수정', () => studentEditor(s))}${btn('삭제', async () => {
    if (confirm(`${s.name} 학생을 명단에서 뺄까요? 기록과 과제 상태는 보존합니다.`)) await commit([up('students', {
      ...s,
      deletedAt: C.now(),
      seat: null
    })]);
  }, 'danger')}</div></td></tr>`).join('')}</tbody></table></div></section><section class="panel" data-settings-category="과목·전담" hidden><h3>과목 · 전담 설정</h3>${C.gradeSubjectCodes(st.grade).length ? `<div class="table-wrap"><table><thead><tr><th>사용</th><th>과목</th><th>구분</th><th>장소</th><th>담당 교사</th><th></th></tr></thead><tbody>${[...C.subjectCatalog(db()).regular, ...C.subjectCatalog(db()).special].map(subject => `<tr><td><input type="checkbox" data-subject-enabled="${esc(subject.code)}" aria-label="${esc(subject.code)} 사용" ${subject.enabled !== false ? 'checked' : ''}></td><td><span class="badge subject-color subject-badge" style="${C.subjectColorStyle(subject)}">${esc(subject.code)}</span></td><td>${subject.isSpecialist ? '전담' : '담임'}</td><td>${esc(subject.location || '')}</td><td>${esc(subject.teacherName || '')}</td><td>${btn('수정', () => subjectEditor(subject))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">설정-기본정보에서 학년을 설정하면 과목이 보입니다.</p>'}${btn('+ 과목 추가', () => subjectEditor())}</section>${bindLater('settings-form', 'submit', async e => {
    e.preventDefault();
    const invalid = e.target.querySelector(':invalid');
    if (invalid) {
      settingsCategory = invalid.closest('[data-settings-category]')?.dataset.settingsCategory || settingsCategory;
      applySettingsCategory();
      e.target.reportValidity();
      return;
    }
    const f = new FormData(e.target),
      pin = f.get('classroomPin');
    if (!f.get('schoolName').trim() || !f.get('classGroup').trim()) throw Error('학교명과 반을 입력하세요.');
    const next = {
      ...st,
      className: f.get('className').trim() || `${f.get('grade')}학년 ${f.get('classGroup').trim()}반`,
      academicYear: Number(f.get('academicYear')),
      schoolName: f.get('schoolName').trim(),
      schoolCode: f.get('schoolCode') || '',
      grade: Number(f.get('grade')),
      classGroup: f.get('classGroup').trim(),
      defaultStudentPassword: settings().defaultStudentPassword || '바람123',
      nameDisplayMode: f.get('nameDisplayMode'),
      classroomShowScores: !!f.get('classroomShowScores'),
      reportPrintMode: f.get('reportPrintMode'),
      academicCalendar: {
        ...calendar,
        ...Object.fromEntries(['term1Start', 'summerEnd', 'term2Start', 'winterEnd'].map(key => [key, f.get(key) || ''])),
        springBreak: !!f.get('springBreak'),
        winterReturn: f.get('winterReturn') ?? calendar.winterReturn ?? '',
        springEnd: f.get('springEnd') ?? calendar.springEnd ?? '',
        holidays: [...new Set(f.getAll('holidays'))].sort()
      },
      lunchAfterPeriod: C.lunchPosition({
        lunchAfterPeriod: f.get('lunchAfterPeriod')
      }),
      reportHeader: f.get('reportHeader'),
      periodTimes: Array.from({
        length: 6
      }, (_, i) => f.get('period-' + i)),
      timetableDisplay: {
        ...st.timetableDisplay,
        showTeacher: !!f.get('showTeacher'),
        showLocation: !!f.get('showLocation')
      }
    };
    if (pin) next.classroomPinHash = await hashPin(pin);
    await commit([up('settings', next)]);
  })}${bindLater('settings-form', 'change', e => {
    if (e.target.name === 'springBreak') $('#spring-dates').disabled = !e.target.checked;
  })}${areasSettings()}${bindLater('backup-input', 'change', e => importBackup(e.target.files[0]))}</div></div>${bindSettingsCategory()}${bindSchoolSettings()}`;
}
export function rosterPaste() {
  modal('명단 붙여넣기', `${textarea('번호 이름 · 탭/쉼표/공백 구분 모두 인식', 'roster', '')}<p class="muted">예: 1 김민준<br>51 이서연<br>이름만 붙이면 다음 번호부터 제안합니다.</p>`, async f => {
    const rows = C.parseRoster(f.get('roster'), Math.max(0, ...students().map(s => s.no)) + 1);
    if (!rows.length) throw Error('명단을 붙여 넣으세요.');
    rosterPreview(rows);
  }, '등록 미리보기');
}
export function rosterPreview(rows) {
  modal('명단 확인 · 수정 후 한 번에 등록', `<p class="muted">동명이인도 고유 ID로 각각 등록합니다. 번호는 입력한 그대로 유지합니다.</p><div class="table-wrap"><table><thead><tr><th>번호</th><th>이름</th></tr></thead><tbody>${rows.map((s, i) => `<tr><td><input aria-label="${i + 1}행 번호" name="no-${i}" type="number" min="1" required value="${s.no}" style="width:75px"></td><td><input aria-label="${i + 1}행 이름" name="name-${i}" required value="${esc(s.name)}"></td></tr>`).join('')}</tbody></table></div>`, async f => {
    const next = rows.map((_, i) => ({
      id: C.uid(),
      no: Number(f.get('no-' + i)),
      name: f.get('name-' + i).trim(),
      group: '',
      academicYear: settings().academicYear,
      seat: null,
      createdAt: C.now()
    }));
    if (next.some(s => !s.name || !Number.isInteger(s.no) || s.no < 1)) throw Error('이름과 번호를 확인하세요.');
    const all = [...students(), ...next],
      seen = new Set(),
      duplicate = all.some(s => seen.has(s.no) ? true : (seen.add(s.no), false));
    if (duplicate && !confirm('중복 번호가 있습니다. 그대로 등록할까요?')) return;
    for (const s of next) {
      const old = db().students.find(x => x.deletedAt && x.no === s.no && x.name === s.name);
      if (old && confirm(`${s.no}. ${s.name}: 기존 학생의 기록과 다시 연결할까요?`)) {
        s.id = old.id;
        s.createdAt = old.createdAt;
        s.deletedAt = null;
      }
    }
    await commit(C.withAutoSeats(db(), next.map(s => up('students', s))));
    closeModal();
  }, '명단 등록');
}
export function removedStudents() {
  modal('나간 학생 · 기록은 보존됩니다.', db().students.filter(s => s.deletedAt).map(s => `<div class="row between record"><span>${esc(s.no)}. ${esc(s.name)} (${s.academicYear})</span><div class="row">${btn('기록 보기', () => studentDetail(s.id))}${btn('복귀', async () => {
    await commit([up('students', {
      ...s,
      deletedAt: null
    })]);
    removedStudents();
  })}</div></div>`).join('') || empty('나간 학생이 없습니다.'));
}
export function subjectEditor(s = null) {
  const row = s || {
    id: C.uid(),
    code: '',
    label: '',
    isProject: true,
    color: C.defaultSubjectColors('').background,
    colorSource: 'default',
    defaultColorValue: C.defaultSubjectColors('').background,
    isSpecialist: false,
    location: '',
    teacherName: '',
    defaultType: '일반',
    sortOrder: db().subject_rules.length,
    teacherHistory: []
  };
  const colors = C.subjectColors(row);
  let updateColorPairs;
  let colorMode = C.usesDefaultSubjectColors(row) ? 'default' : 'preserve';
  const resetColors = () => {
    const form = $('#modal-form'),
      defaults = C.defaultSubjectColors(form.elements.code.value.trim());
    form.elements.color.value = defaults.background;
    form.elements.accentColor.value = defaults.accent;
    colorMode = 'default';
    updateColorPairs?.();
  };
  modal(s ? '과목 설정' : '과목 추가', `<div class="formgrid">${input('과목명 · 코드', 'code', row.code, 'text', 'required')}${input('한 글자 축약명', 'label', row.label)}${input('과목 배경색', 'color', colors.background, 'color')}${input('과목 포인트색', 'accentColor', colors.accent, 'color')}${btn('기본 색상으로', resetColors)}${subjectPaletteFields()}${select('기본 구분', 'defaultType', ['일반', '외부', '강사', '다른장소'], row.defaultType)}${checkbox('전담 과목', 'isSpecialist', row.isSpecialist)}${input('장소', 'location', row.location)}${input('담당 교사명', 'teacherName', row.teacherName)}${input('담당 교사 변경 적용일', 'teacherFrom', state.date, 'date', 'required')}${input('정렬 순서', 'sortOrder', row.sortOrder, 'number')}</div><p class="muted">과목명 변경 시 기존 시간표도 함께 변경합니다. 담당 교사 변경은 적용일 이후에만 반영됩니다.</p>`, async f => {
    const code = f.get('code').trim();
    if ([...db().subject_rules, ...C.subjectCatalog(db()).regular, ...C.subjectCatalog(db()).special].some(x => x.id !== row.id && x.code === code)) throw Error('같은 과목명이 있습니다.');
    const teacher = f.get('teacherName'),
      history = [...(row.teacherHistory || [])];
    if (!history.length) history.push({
      from: '1900-01-01',
      name: row.teacherName || ''
    });
    if (teacher !== row.teacherName) history.push({
      from: f.get('teacherFrom'),
      name: teacher
    });
    const next = {
      ...row,
      code,
      label: f.get('label') || code[0],
      ...(colorMode === 'preserve' ? {} : colorMode === 'default' ? {
        color: C.defaultSubjectColors(code).background,
        accentColor: null,
        colorSource: 'default',
        defaultColorValue: C.defaultSubjectColors(code).background
      } : {
        color: f.get('color'),
        accentColor: f.get('accentColor'),
        colorSource: 'custom',
        defaultColorValue: null
      }),
      defaultType: f.get('defaultType'),
      isSpecialist: !!f.get('isSpecialist'),
      location: f.get('location'),
      teacherName: teacher,
      teacherHistory: history,
      sortOrder: Number(f.get('sortOrder'))
    };
    let ops = [up('subject_rules', next)];
    if (s && s.code !== code) {
      ops.push(...db().timetables.filter(t => t.subjectCode === s.code).map(t => up('timetables', {
        ...t,
        subjectCode: code
      })));
      const template = {
        ...settings().weeklyTemplate
      };
      for (const key in template) if (template[key] === s.code) template[key] = code;
      ops.push(up('settings', {
        ...settings(),
        weeklyTemplate: template
      }));
    }
    await commit(ops);
    closeModal();
  });
  const colorForm = $('#modal-form');
  updateColorPairs = bindSubjectPalette(colorForm, () => colorMode = 'custom');
  for (const key of ['color', 'accentColor']) colorForm.elements[key].oninput = () => {
    colorMode = 'custom';
  };
  colorForm.elements.code.addEventListener('input', () => {
    if (colorMode === 'default') resetColors();
  });
}
export function backupObject() {
  return {
    app: 'startoday',
    version: 1,
    exportedAt: C.now(),
    data: structuredClone(db())
  };
}
export async function downloadBackup() {
  saveFile(`startoday-backup-${C.today().replaceAll('-', '')}.json`, JSON.stringify(backupObject(), null, 2));
  await commit([up('settings', {
    ...settings(),
    lastBackupAt: C.now()
  })], '백업 파일 다운로드를 시작했습니다.');
}
export async function importBackup(file) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) throw Error('백업 파일은 20MB 이하만 불러올 수 있습니다.');
  const imported = C.validateBackup(JSON.parse(await file.text()));
  restoreDialog(imported);
}
export function restoreDialog(imported) {
  modal('백업 복원', `<p>학생 ${imported.students.length}명 · 기록 ${imported.records.length}건</p>${select('복원 방식', 'mode', [['replace', '현재 자료를 파일 내용으로 대체 · 기본'], ['merge', '고유 ID로 합치기 · 같은 ID는 파일 내용 우선']], 'replace')}<div class="notice">복원 직전 자료는 자동으로 백업 파일을 내려받습니다. 같은 번호·이름이어도 ID가 다르면 별도 학생입니다.</div>`, async f => {
    if (!confirm('현재 자료를 백업한 뒤 복원할까요?')) return;
    saveFile(`startoday-before-restore-${Date.now()}.json`, JSON.stringify(backupObject(), null, 2));
    const replace = f.get('mode') === 'replace';
    let ops = [];
    for (const t of C.TABLES) {
      if (!replace && t === 'areas') {
        ops.push(...C.mergeAreaRows(db().areas, imported.areas).map(x => up(t, x)));
        continue;
      }
      if (replace) ops.push(...db()[t].map(x => ({
        table: t,
        id: x.id,
        remove: true
      })));
      ops.push(...imported[t].map(x => up(t, x)));
    }
    await commit(ops, '복원했습니다.');
    state.selected = [];
    closeModal();
    render();
  });
}
export async function cloudRestore() {
  if (store.mode !== 'cloud') throw Error('구글 로그인 후 사용할 수 있습니다.');
  const {
    data,
    error
  } = await store.client.from('startoday_backups').select('id,created_at,data').eq('class_id', store.classId).order('created_at', {
    ascending: false
  }).limit(2);
  if (error) throw error;
  modal('클라우드 백업 복구', data.map(b => `<div class="record row between"><span>${esc(localTime(b.created_at))}</span>${btn('이 백업 선택', () => restoreDialog(C.validateBackup({
    app: 'startoday',
    version: 1,
    data: b.data.data
  })))}</div>`).join('') || empty('아직 저장한 백업이 없습니다.'));
}
export function rollover() {
  modal('다음 학년으로 이어 가기', `${input('새 학년도', 'year', Number(settings().academicYear) + 1, 'number', 'required min="2020" max="2100"')}<p class="muted">현재 학생은 나간 학생으로 보관하고, 명단을 새로운 ID로 복제합니다. 현재 과제·루틴은 중단합니다. 지난 기록과 과제 상태는 보존합니다.</p>${students().map(s => `<div class="row" style="margin-bottom:8px"><span style="min-width:100px">${esc(s.name)}</span><input aria-label="${esc(s.name)} 새 번호" name="no-${s.id}" type="number" min="1" value="${s.no}" required style="width:90px"></div>`).join('')}`, async f => {
    if (!confirm('새 학년도 명단으로 전환할까요?')) return;
    saveFile(`startoday-before-year-${Date.now()}.json`, JSON.stringify(backupObject(), null, 2));
    const year = Number(f.get('year'));
    const ops = [up('settings', {
      ...settings(),
      academicYear: year
    })];
    for (const s of students()) {
      ops.push(up('students', {
        ...s,
        deletedAt: C.now(),
        seat: null
      }));
      ops.push(up('students', {
        ...s,
        id: C.uid(),
        no: Number(f.get('no-' + s.id)),
        academicYear: year,
        seat: null,
        createdAt: C.now(),
        studentCode: '',
        deletedAt: null
      }));
    }
    for (const a of db().assignments.filter(a => !a.deletedAt)) ops.push(up('assignments', {
      ...a,
      endDate: C.addDays(state.date, -1)
    }));
    for (const r of db().routines.filter(r => !r.deletedAt)) ops.push(up('routines', {
      ...r,
      deletedAt: C.now()
    }));
    await commit(C.withAutoSeats(db(), ops));
    closeModal();
  });
}
function holidayChip(date) {
  return `<label class="holiday-chip"><input type="checkbox" name="holidays" value="${esc(date)}" checked>${esc(C.formatDate(date))}</label>`;
}
let areaDraftScope = '',
  areaDraft = null,
  areaDraftBase = '',
  draggedArea = null;
function captureAreas() {
  for (const row of areaDraft || []) {
    const field = $('#area-' + row.id);
    if (field) row.name = field.value;
  }
}
export function areasSettings() {
  const scope = `${store.mode}:${store.classId}:${settings().academicYear}`;
  const source = JSON.stringify(C.areaRows(db(), true));
  if (areaDraftScope !== scope || !areaDraft || source !== areaDraftBase && JSON.stringify(areaDraft) === areaDraftBase) {
    areaDraftScope = scope;
    areaDraft = JSON.parse(source);
    areaDraftBase = source;
  }
  return `<section class="panel" data-settings-category="경험치 종류" hidden><h3>경험치 종류</h3><div class="row title-goal-settings"><label>칭호 최종 목표 횟수 <input id="title-goal" type="number" min="3" max="9999" step="1" value="${settings().titleGoal || 15}"></label>${btn('칭호 목표 저장', async () => {
    const goal = Number($('#title-goal').value);
    C.titleThresholds({
      goal
    });
    captureAreas();
    await commit([up('settings', {
      ...settings(),
      titleGoal: goal
    })]);
  })}<small>기본 15회: 5 · 10 · 15회. 목표를 바꾸면 세 단계가 비례 조정됩니다.</small></div><p class="muted">카드를 끌어서 순서를 바꾸세요. 변경한 이름과 순서는 아래 버튼으로 한 번에 저장합니다. 삭제한 영역의 지난 기록은 보존됩니다.</p><div class="area-cards">${areaDraft.map((a, i) => `<div class="area-card" draggable="true" data-area-id="${esc(a.id)}"><span class="area-drag-handle" draggable="true" title="끌어서 순서 변경" aria-hidden="true">⠿</span><input id="area-${esc(a.id)}" aria-label="경험치 이름 ${esc(a.name)}" value="${esc(a.name)}" ${a.deletedAt ? 'disabled' : ''}>${a.deletedAt ? '<small>삭제됨</small>' : ''}${btn('↑', () => moveArea(a.id, -1), '', `aria-label="${esc(a.name)} 위로" ${i === 0 ? 'disabled' : ''}`)}${btn('↓', () => moveArea(a.id, 1), '', `aria-label="${esc(a.name)} 아래로" ${i === areaDraft.length - 1 ? 'disabled' : ''}`)}${btn(a.deletedAt ? '복원' : '삭제', () => {
    captureAreas();
    a.deletedAt = a.deletedAt ? null : C.now();
    render();
  })}</div>`).join('')}</div><div class="row"><input id="new-area" aria-label="새 경험치 이름" placeholder="새 경험치 이름">${btn('영역 추가', () => {
    captureAreas();
    const name = $('#new-area').value.trim();
    if (!name) throw Error('이름을 입력하세요.');
    areaDraft.push({
      id: C.uid(),
      name,
      deletedAt: null
    });
    render();
  })}${btn('경험치 순서/이름 저장', async () => {
    captureAreas();
    if (JSON.stringify(C.areaRows(db(), true)) !== areaDraftBase) throw Error('경험치 목록이 다른 곳에서 변경되었습니다. 변경 취소 후 다시 확인하세요.');
    const old = C.areaRows(db(), true).find(a => a.name === state.recordFilters.area);
    const ops = C.areaBatchOps(db(), areaDraft);
    await commit(ops);
    if (old) state.recordFilters.area = areaDraft.find(a => a.id === old.id).name;
    areaDraft = structuredClone(C.areaRows(db(), true));
    areaDraftBase = JSON.stringify(areaDraft);
    render();
  }, 'primary')}${btn('변경 취소', () => {
    areaDraft = null;
    render();
  })}</div></section>`;
}
export function moveArea(id, direction) {
  captureAreas();
  const i = areaDraft.findIndex(a => a.id === id),
    j = i + direction;
  if (i < 0 || j < 0 || j >= areaDraft.length) return;
  [areaDraft[i], areaDraft[j]] = [areaDraft[j], areaDraft[i]];
  render();
}
document.addEventListener('input', e => {
  if (e.target.closest?.('.area-card')) captureAreas();
});
document.addEventListener('dragstart', e => {
  const card = e.target.closest?.('[data-area-id]');
  if (!card) return;
  captureAreas();
  draggedArea = card.dataset.areaId;
  e.dataTransfer.setData('text/plain', draggedArea);
  e.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragover', e => {
  if (draggedArea && e.target.closest?.('[data-area-id]')) e.preventDefault();
});
document.addEventListener('drop', e => {
  const card = e.target.closest?.('[data-area-id]');
  if (!card || !draggedArea) return;
  e.preventDefault();
  captureAreas();
  const from = areaDraft.findIndex(a => a.id === draggedArea),
    to = areaDraft.findIndex(a => a.id === card.dataset.areaId);
  if (from >= 0 && to >= 0) {
    areaDraft.splice(to, 0, areaDraft.splice(from, 1)[0]);
    render();
  }
  draggedArea = null;
});
document.addEventListener('dragend', () => draggedArea = null);
function bindSettingsCategory() {
  setTimeout(applySettingsCategory, 0);
  return '';
}
function applySettingsCategory() {
  const layout = $('#settings-layout');
  if (!layout) return;
  layout.querySelectorAll('[data-settings-category]').forEach(panel => panel.hidden = panel.dataset.settingsCategory !== settingsCategory);
  layout.querySelectorAll('[data-settings-tab]').forEach(button => {
    const active = button.dataset.settingsTab === settingsCategory;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const form = $('#settings-form');
  if (form) form.hidden = !['기본 정보', '교실 화면', '학사일정'].includes(settingsCategory);
}
function bindSchoolSettings() {
  setTimeout(() => {
    const form = document.querySelector('#settings-form');
    bindSchoolPicker(form);
    bindKoreanPasswordFields(form);
  }, 0);
  return '';
}
export function initialStudentPasswordDialog() {
  modal('초기화 비밀번호 설정', `${koreanPasswordField('반 공통 초기 비밀번호', 'defaultStudentPassword', settings().defaultStudentPassword || '바람123', 'required minlength="5" autocomplete="new-password"')}<p class="muted">완성된 한글을 포함해 5자 이상, 한글과 숫자만 사용하세요. 학생이 변경한 개인 비밀번호는 유지됩니다.</p>`, async f => {
    const password = f.get('defaultStudentPassword');
    validateKoreanPassword(password);
    await commit([up('settings', {
      ...settings(),
      defaultStudentPassword: password
    })]);
    closeModal();
  });
  bindKoreanPasswordFields($('#modal-form'));
}
document.addEventListener('change', event => {
  const field = event.target.closest?.('[data-subject-enabled]');
  if (!field) return;
  const catalog = C.subjectCatalog(db()),
    subject = [...catalog.regular, ...catalog.special].find(row => row.code === field.dataset.subjectEnabled);
  if (!subject) return;
  run(async () => {
    try {
      await commit([up('subject_rules', {
        ...subject,
        enabled: field.checked
      })], '');
    } catch (error) {
      if (field.isConnected) field.checked = subject.enabled !== false;
      throw error;
    }
  });
});
