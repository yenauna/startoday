import { render } from '../app.js';
import { closeModal, modal } from '../components/modal.js';
import * as C from '../core.js';
import { commit, db, kindLabel, settings, students, up } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, bindLater, btn, checkbox, empty, esc, hashPin, input, localTime, saveFile, select, textarea, toast } from '../shared/ui.js';
import { studentDetail, studentEditor } from './students.js';
export function settingsView() {
  const st = settings(),
    bytes = new Blob([JSON.stringify(db())]).size;
  return `${areasSettings()}<div class="toolbar"><div><h2>설정</h2><small>학급과 기록 방식을 선생님께 맞추세요.</small></div></div><div class="grid2"><section class="panel"><h3>학급 · 화면</h3><form id="settings-form"><div class="formgrid">${input('학급 이름', 'className', st.className, 'text', 'required')}${input('학년도', 'academicYear', st.academicYear, 'number', 'min="2020" max="2100" required')}${input('학교명 · 학생 아이디 준비용', 'schoolName', st.schoolName || '')}${select('교실 화면 이름 표기', 'nameDisplayMode', [['number', '번호만 · 기본'], ['masked', '이름 가림 · 김●수'], ['alias', '교사가 정한 별칭']], st.nameDisplayMode)}${input('자리 행', 'seatRows', st.seatRows, 'number', 'min="1" max="12" required')}${input('자리 열', 'seatCols', st.seatCols, 'number', 'min="1" max="12" required')}<div class="span2">${input('보고서 제목', 'reportHeader', st.reportHeader)}</div><div>${checkbox('시간표에 선생님 표시', 'showTeacher', st.timetableDisplay.showTeacher)}</div><div>${checkbox('시간표에 장소 표시', 'showLocation', st.timetableDisplay.showLocation)}</div><div class="span2">${input('교실 화면 해제 비밀번호 · 새로 설정할 때만 입력', 'classroomPin', '', 'password', 'minlength="4" autocomplete="new-password"')}</div>${(st.periodTimes || []).map((time, i) => input(`${i + 1}교시 시간 · 표시용`, 'period-' + i, time)).join('')}</div><button class="primary" style="margin-top:15px">설정 저장</button></form></section><section class="panel"><h3>백업과 복원</h3><p class="muted">${store.mode === 'cloud' ? '학생의 텍스트 자료는 외부 서버인 수파베이스에 저장됩니다.' : '체험 모드 자료는 현재 브라우저에만 저장됩니다.'}</p><p>학급 데이터 약 <strong>${(bytes / 1024).toFixed(1)} KB</strong><br><small>텍스트 JSON 기준 추정치입니다. 실제 DB·백업·인증 저장량은 수파베이스 대시보드에서 확인하세요.</small></p><p class="muted">마지막 파일 백업: ${st.lastBackupAt ? esc(localTime(st.lastBackupAt)) : '없음'}</p><div class="row">${btn('전체 JSON 내려받기', downloadBackup, 'primary')}${btn('JSON 가져오기', () => $('#backup-input').click())}${btn('클라우드에 한 벌 더 저장', async () => {
    await store.cloudBackup();
    toast('클라우드 백업을 저장했습니다. 최근 2세대를 보관합니다.');
  })}${btn('클라우드 백업 복구', cloudRestore)}</div><input id="backup-input" type="file" accept="application/json,.json" hidden><div class="notice">사진·음성은 저장하지 않습니다. 백업 파일에는 학생 기록이 포함되므로 안전한 곳에 보관하세요.</div><h3 style="margin-top:22px">학년도 전환</h3><p class="muted">현재 학생을 새 고유 ID로 복제합니다. 지난 기록은 보존하고 새 학생에게는 연결하지 않습니다.</p>${btn('다음 학년으로 이어 가기', rollover)}</section></div><section class="panel"><div class="toolbar"><h3>학생 명단</h3><div class="row">${btn('명단 붙여넣기', rosterPaste, 'primary')}${btn('+ 학생', () => studentEditor())}${btn('나간 학생 보기', removedStudents)}</div></div><div class="table-wrap"><table><thead><tr><th>번호</th><th>이름</th><th>모둠</th><th>별칭</th><th></th></tr></thead><tbody>${students().map(s => `<tr><td>${s.no}</td><td>${esc(s.name)}</td><td>${esc(s.group)}</td><td>${esc(s.alias || '')}</td><td><div class="row">${btn('수정', () => studentEditor(s))}${btn('삭제', async () => {
    if (confirm(`${s.name} 학생을 명단에서 뺄까요? 기록과 과제 상태는 보존합니다.`)) await commit([up('students', {
      ...s,
      deletedAt: C.now(),
      seat: null
    })]);
  }, 'danger')}</div></td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="toolbar"><h3>과목 · 전담 설정</h3>${btn('+ 과목', () => subjectEditor())}</div><div class="table-wrap"><table><thead><tr><th>과목</th><th>구분</th><th>장소</th><th>담당 교사</th><th></th></tr></thead><tbody>${db().subject_rules.map(s => `<tr><td><span class="badge" style="background:${esc(s.color)}">${esc(s.code)}</span></td><td>${s.isSpecialist ? '전담' : '담임'} · ${esc(s.defaultType)}</td><td>${esc(s.location)}</td><td>${esc(s.teacherName)}</td><td>${btn('수정', () => subjectEditor(s))}</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="toolbar"><h3>태그 · 파서 별칭 사전</h3>${btn('+ 태그', () => tagEditor())}</div><div class="table-wrap"><table><thead><tr><th>태그</th><th>성격</th><th>영역</th><th>별칭</th><th></th></tr></thead><tbody>${db().tags.filter(t => !t.deletedAt).map(t => `<tr><td>${esc(t.label)}</td><td>${esc(kindLabel(t.kind))}</td><td>${esc(t.area)}</td><td>${esc(t.aliases.join(', '))}</td><td><div class="row">${btn('수정', () => tagEditor(t))}${btn('삭제', async () => {
    if (confirm('태그를 삭제할까요? 기존 기록은 그대로 남습니다.')) await commit([up('tags', {
      ...t,
      deletedAt: C.now()
    })]);
  }, 'danger')}</div></td></tr>`).join('')}</tbody></table></div></section>${bindLater('settings-form', 'submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target),
      pin = f.get('classroomPin');
    const next = {
      ...st,
      className: f.get('className').trim(),
      academicYear: Number(f.get('academicYear')),
      schoolName: f.get('schoolName').trim(),
      nameDisplayMode: f.get('nameDisplayMode'),
      seatRows: Number(f.get('seatRows')),
      seatCols: Number(f.get('seatCols')),
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
  })}${bindLater('backup-input', 'change', e => importBackup(e.target.files[0]))}`;
}
export function rosterPaste() {
  modal('명단 붙여넣기', `${textarea('번호 이름 모둠 · 탭/쉼표/공백 구분 모두 인식', 'roster', '')}<p class="muted">예: 1 김민준 1모둠<br>51 이서연 2모둠<br>이름만 붙이면 다음 번호부터 제안합니다.</p>`, async f => {
    const rows = C.parseRoster(f.get('roster'), Math.max(0, ...students().map(s => s.no)) + 1);
    if (!rows.length) throw Error('명단을 붙여 넣으세요.');
    rosterPreview(rows);
  }, '등록 미리보기');
}
export function rosterPreview(rows) {
  modal('명단 확인 · 수정 후 한 번에 등록', `<p class="muted">동명이인도 고유 ID로 각각 등록합니다. 번호는 입력한 그대로 유지합니다.</p><div class="table-wrap"><table><thead><tr><th>번호</th><th>이름</th><th>모둠</th></tr></thead><tbody>${rows.map((s, i) => `<tr><td><input aria-label="${i + 1}행 번호" name="no-${i}" type="number" min="1" required value="${s.no}" style="width:75px"></td><td><input aria-label="${i + 1}행 이름" name="name-${i}" required value="${esc(s.name)}"></td><td><input aria-label="${i + 1}행 모둠" name="group-${i}" value="${esc(s.group)}"></td></tr>`).join('')}</tbody></table></div>`, async f => {
    const next = rows.map((_, i) => ({
      id: C.uid(),
      no: Number(f.get('no-' + i)),
      name: f.get('name-' + i).trim(),
      group: f.get('group-' + i),
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
    await commit(next.map(s => up('students', s)));
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
export function tagEditor(t = null) {
  const row = t || {
    id: C.uid(),
    label: '',
    kind: '칭찬',
    area: null,
    aliases: []
  };
  modal(t ? '태그 수정' : '태그 추가', `<div class="formgrid">${input('태그 이름', 'label', row.label, 'text', 'required')}${select('성격', 'kind', [['칭찬', '칭찬'], ['지도', '조언']], row.kind)}${select('기본 영역', 'area', [['', '미지정'], ...C.areaNames(db(), true).filter(a => C.areaNames(db()).includes(a) || a === row.area)], row.area || '')}${input('별칭 · 쉼표로 구분', 'aliases', row.aliases.join(', '))}</div>`, async f => {
    await commit([up('tags', {
      ...row,
      label: f.get('label').trim(),
      kind: f.get('kind'),
      area: f.get('area') || null,
      aliases: f.get('aliases').split(',').map(x => x.trim()).filter(Boolean)
    })]);
    closeModal();
  });
}
export function subjectEditor(s = null) {
  const row = s || {
    id: C.uid(),
    code: '',
    label: '',
    color: '#E0F2FE',
    isSpecialist: false,
    location: '',
    teacherName: '',
    defaultType: '일반',
    sortOrder: db().subject_rules.length,
    teacherHistory: []
  };
  modal(s ? '과목 설정' : '과목 추가', `<div class="formgrid">${input('과목명 · 코드', 'code', row.code, 'text', 'required')}${input('한 글자 축약명', 'label', row.label)}${input('과목 색상', 'color', row.color, 'color')}${select('기본 구분', 'defaultType', ['일반', '외부', '강사', '다른장소'], row.defaultType)}${checkbox('전담 과목', 'isSpecialist', row.isSpecialist)}${input('장소', 'location', row.location)}${input('담당 교사명', 'teacherName', row.teacherName)}${input('담당 교사 변경 적용일', 'teacherFrom', state.date, 'date', 'required')}${input('정렬 순서', 'sortOrder', row.sortOrder, 'number')}</div><p class="muted">과목명 변경 시 기존 시간표도 함께 변경합니다. 담당 교사 변경은 적용일 이후에만 반영됩니다.</p>`, async f => {
    const code = f.get('code').trim();
    if (db().subject_rules.some(x => x.id !== row.id && x.code === code)) throw Error('같은 과목명이 있습니다.');
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
      color: f.get('color'),
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
    await commit(ops);
    closeModal();
  });
}
export function areasSettings() {
  return `<section class="panel"><h3>경험치 종류</h3><p class="muted">이름 변경은 기존 기록에도 반영됩니다. 삭제한 영역의 지난 기록과 통계는 보존합니다.</p>${C.areaRows(db(), true).map((a, i, list) => `<div class="row" style="margin-bottom:8px"><input aria-label="경험치 이름 ${esc(a.name)}" id="area-${esc(a.id)}" value="${esc(a.name)}" ${a.deletedAt ? 'disabled' : ''}>${a.deletedAt ? '<span>삭제됨</span>' : btn('이름 저장', () => renameArea(a.id))}${btn('↑', () => moveArea(a.id, -1), '', `aria-label="${esc(a.name)} 위로" ${i === 0 ? 'disabled' : ''}`)}${btn('↓', () => moveArea(a.id, 1), '', `aria-label="${esc(a.name)} 아래로" ${i === list.length - 1 ? 'disabled' : ''}`)}${btn(a.deletedAt ? '복원' : '삭제', async () => {
    if (!a.deletedAt && !confirm('이 영역을 삭제할까요? 지난 기록은 보존됩니다.')) return;
    await commit(C.areaRows(db(), true).map(x => up('areas', x.id === a.id ? {
      ...x,
      deletedAt: a.deletedAt ? null : C.now()
    } : x)));
  })}</div>`).join('')}<div class="row"><input id="new-area" aria-label="새 경험치 이름" placeholder="새 경험치 이름">${btn('영역 추가', async () => {
    const name = $('#new-area').value.trim();
    if (!name) throw Error('영역 이름을 입력하세요.');
    if (C.areaNames(db(), true).includes(name)) throw Error('같은 이름의 영역이 있습니다.');
    const rows = C.areaRows(db(), true);
    await commit([...rows.map(a => up('areas', a)), up('areas', {
      id: C.uid(),
      name,
      sortOrder: rows.length,
      deletedAt: null
    })]);
  })}</div></section>`;
}
export async function moveArea(id, direction) {
  const rows = C.areaRows(db(), true),
    i = rows.findIndex(a => a.id === id),
    j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await commit(rows.map((a, sortOrder) => up('areas', {
    ...a,
    sortOrder
  })));
}
export async function renameArea(id) {
  const old = C.areaRows(db(), true).find(a => a.id === id);
  const name = $('#area-' + id).value.trim();
  await commit(C.areaEditOps(db(), id, name));
  if (state.recordFilters.area === old.name) state.recordFilters.area = name;
}
