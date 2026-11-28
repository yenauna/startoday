import {pcPreviewActive,togglePcPreview} from './viewport-preview.js';
import {icon} from './icons.js';
import { modal, closeModal } from './modal.js';
import { render, navigate } from '../app.js';
import * as C from '../core.js';
import { db, name, settings } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, btn, esc, opts, toast, dateField } from '../shared/ui.js';
import { classroom } from '../tabs/classroom.js';
import { recordButtons, saveDirectRecords, demoResetButton } from '../tabs/dashboard.js';
import { studentLoginDialog } from '../tabs/student-view.js';
export function header() {
 return `<header class="top"><div class="header-leading">${btn(icon('menu'),openNavigation,'navigation-toggle icon-button','id="navigation-toggle" aria-label="메뉴 열기" title="메뉴 열기" aria-haspopup="dialog" aria-controls="navigation-drawer" aria-expanded="false"')}${btn('<img src="assets/logo-icon.jpg" class="logo" data-logo-slot alt=""><strong>오늘의 별</strong><small>'+esc(settings().className)+'</small>',()=>{state.dashMode='normal';navigate('대시보드');},'brand brand-home','aria-label="오늘의 별 홈"')}</div><div class="row teacher-header-actions">${btn('pc화면',()=>{togglePcPreview();render();},'pc-viewport-toggle'+(pcPreviewActive()?' is-active':''),`aria-pressed="${pcPreviewActive()}" title="${pcPreviewActive()?'모바일 화면으로 복귀':'PC 화면 점검'}"`)}${btn('교실화면',classroom)}</div></header>`;
}
export function closeNavigation(){
 const drawer=$('#navigation-drawer');if(drawer?.open)drawer.close();
 $('#navigation-toggle')?.setAttribute('aria-expanded','false');
}
export function openNavigation(){
 const drawer=$('#navigation-drawer');if(!drawer)return;
 drawer.showModal();$('#navigation-toggle')?.setAttribute('aria-expanded','true');
 drawer.onclose=()=>{$('#navigation-toggle')?.setAttribute('aria-expanded','false');$('#navigation-toggle')?.focus({preventScroll:true});};
 drawer.onpointerdown=e=>{if(e.target===drawer){const r=drawer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeNavigation();}};
}
function navigationDrawer(){
 const menuIcons={'대시보드':'dashboard','기록':'records','사건':'records','일정':'calendar','경제':'economy','알림장':'notice','학급회의':'meeting','통계':'statistics','수업도구':'tools','자리':'seats','설정':'settings','디자인':'sparkles'};
 const tabs=['대시보드','기록','사건','일정','경제','알림장','학급회의','통계','수업도구','자리','설정','디자인'];
 return `<dialog id="navigation-drawer" class="navigation-drawer" aria-labelledby="navigation-title"><div class="drawer-heading"><h2 id="navigation-title">오늘의 별</h2>${btn('닫기',closeNavigation)}</div><nav class="drawer-tabs" aria-label="주 메뉴">${tabs.map(tab=>btn(icon(menuIcons[tab])+`<span>${tab}</span>`,()=>{closeNavigation();navigate(tab);},state.tab===tab?'active':'',state.tab===tab?'aria-current="page"':'')).join('')}</nav><div class="drawer-footer">${btn('로그아웃',async()=>{closeNavigation();await store.logout();state.selected=[];render();})}</div></dialog>`;
}
export function renderLogin() {
  clearInterval(state.clockTimer);
  $('#app').innerHTML = `<div class="panel login"><img src="assets/logo-icon.jpg" class="logo" alt="로고" style="width:54px;height:54px;border-radius:12px;margin-bottom:18px;object-fit:cover"><h1>오늘의 별</h1><p>오늘의 작은 행동을 기록하고,<br>아이들의 성장을 함께 살펴보세요.</p><p>생활지도 기록 · 과제와 루틴 · 시간표와 일정<br>선생님의 학급 운영을 한곳에서 관리합니다.</p>${store.client ? btn('선생님 로그인', () => store.login(), 'teacher-login-entry') : '<div class="notice">아직 연결 전입니다. config.js에 클라우드 데이터베이스 프로젝트 주소와 공개 키를 입력하면 구글 로그인이 활성화됩니다.</div>'}${btn('학생 로그인', studentLoginDialog, 'primary student-login-entry')}${btn('가상 명단으로 먼저 살펴보기', () => {
    store.demo();
    render();
  })}<small>연결 전 체험 자료와 로그인 후 학급 자료는 별도로 관리됩니다.</small></div>`;
}
export function renderShell(renderTab) {
  return `<div class="sticky-navigation">${header()}</div>${navigationDrawer()}<div class="shell">${state.tab==='대시보드'&&state.dashMode==='normal'?'':quickInput()}${store.mode === 'demo' ? `<div class="notice demo-banner"><span>가상 명단으로 체험 중입니다. 이 모드의 자료는 이 브라우저에만 저장됩니다. 실제 학급은 클라우드 데이터베이스 연결 후 구글 로그인으로 사용하세요.</span>${state.tab==='대시보드'?demoResetButton():''}</div>` : ''}${settings().lastBackupAt && Date.now() - new Date(settings().lastBackupAt) > 7 * 86400000 ? '<div class="notice">마지막 백업 후 7일이 지났습니다. 설정에서 백업 파일을 내려받으세요.</div>' : !settings().lastBackupAt ? '<div class="muted" style="margin-bottom:10px">아직 백업하지 않았습니다. 설정에서 전체 자료를 내보낼 수 있습니다.</div>' : ''}<main id="main">${renderTab()}</main>${mobileRecordBar()}</div>`;
}
let quickScope = '',
  quickText = '',
  quickStudentQuery = '',
  quickPeriod = '자동',
  quickDate = '',
  quickAreas = [],
  quickPrivate = false,
  quickCounseling = false, quickCounselText = '', quickOptions = false, quickIncident = '',
  saving = false;
export function quickInput() {
  const scope = `${store.mode}:${store.classId}:${settings().academicYear}:${state.date}`;
  if (scope !== quickScope) {
    quickScope = scope;
    quickText = '';
    quickStudentQuery = '';
    quickPeriod = '자동';
    quickAreas = [];
    quickPrivate = false;quickCounseling=false;quickCounselText='';quickOptions=false;quickIncident='';
    quickDate = state.date;
  }
  if (!state.selected.length && !['대시보드', '기록'].includes(state.tab)) return '';
  quickAreas = quickAreas.filter(a => C.areaNames(db()).includes(a));
  return `<div class="quick-wrap quick-composer-card ${state.selected.length ? 'selection-composer' : ''}" ${state.selected.length ? 'role="region" aria-label="선택 학생 기록"' : ''}><form class="quick" id="quick-form"><div class="quick-main"><div class="quick-entry-fields">${quickStudentsField()}<textarea id="quick-text" rows="1" aria-label="빠른 기록 입력" placeholder="내용">${esc(quickText)}</textarea></div><div class="chips quick-areas" role="group" aria-label="빠른 기록 분야">${C.areaNames(db()).map(a => btn(esc(a), () => {
    quickAreas = quickAreas.includes(a) ? quickAreas.filter(x => x !== a) : [...quickAreas, a];
    render();
  }, 'area-chip' + (quickAreas.includes(a) ? ' selected' : ''), `aria-pressed="${quickAreas.includes(a)}"`)).join('')}</div></div><div class="quick-controls"><label class="quick-date" title="기록 날짜 선택"><span>📅 ${quickDate === C.today() ? '오늘' : esc(C.formatDate(quickDate))}</span><input type="date" id="quick-date" aria-label="빠른 기록 날짜" value="${esc(quickDate)}" required></label>${btn(quickPeriodLabel(), openQuickPeriod, 'quick-period-toggle', `id="quick-period" value="${esc(quickPeriod)}" aria-haspopup="dialog" aria-label="시간·교시 선택"`)}${btn('추가 옵션',()=>{quickOptions=!quickOptions;render();},'quick-options-toggle',`aria-expanded="${quickOptions}"`)}${btn('메모',()=>quickMemoDialog(),'quick-memo-open')}<div class="quick-extra-options" ${quickOptions?'':'hidden'}><select id="quick-incident" aria-label="사건 연결">${opts([['','사건 연결 안 함'],...db().incidents.map(i=>[i.id,i.title])],quickIncident)}</select><label class="quick-private"><input type="checkbox" id="quick-private" ${quickPrivate?'checked':''}>비공개</label><label class="quick-private"><input type="checkbox" id="quick-counseling" ${quickCounseling?'checked':''}>상담</label><input id="quick-counsel-text" aria-label="상담 정보" placeholder="전화·대면, 참석자 등" value="${esc(quickCounselText)}" ${quickCounseling?'':'hidden'}></div><div class="record-actions">${recordButtons(saveQuick)}</div></div></form></div>`;
}
export function bindQuickInput() {
  const form = $('#quick-form');
  if (!form) return;
  const targetField = $('#quick-student-query');
  let imeEnter=false;
  targetField.addEventListener('compositionend',()=>{if(!imeEnter)return;imeEnter=false;setTimeout(()=>{quickStudentQuery=targetField.value;const first=quickStudentCandidates(quickStudentQuery)[0];if(first)addQuickStudent(first.id);},0);});
  targetField.oninput = () => {
    quickStudentQuery = targetField.value;
    showQuickStudentResults();
  };
  targetField.onkeydown = e => {
    if(!['Enter', ',', ' '].includes(e.key))return;
    if(e.isComposing||e.keyCode===229){if(e.key==='Enter')imeEnter=true;return;}
    const tokens = targetField.value.trim().split(/[,，\s]+/).filter(Boolean);
    const valid = tokens.length && tokens.every(token => quickStudentCandidates(token, db(), true).length === 1);
    if (e.key === 'Enter' || valid) {
      e.preventDefault();
      try {
        const candidates=quickStudentCandidates(targetField.value);
        if(e.key==='Enter'&&candidates.length)addQuickStudent(candidates[0].id);else addQuickStudentQuery();
      } catch (error) {
        toast(error.message);
      }
    }
  };
  showQuickStudentResults();
  $('#quick-incident').onchange=e=>quickIncident=e.target.value;
  $('#quick-private').onchange = e => { quickPrivate = e.target.checked; };
  $('#quick-counseling').onchange=e=>{quickCounseling=e.target.checked;$('#quick-counsel-text').hidden=!quickCounseling;};
  $('#quick-counsel-text').oninput=e=>quickCounselText=e.target.value;
  const field = $('#quick-text');
  const resize = () => {
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
    // A tall mobile draft must scroll with the page instead of covering cards.
    form.closest('.quick-wrap').classList.toggle('quick-expanded', form.closest('.quick-wrap').scrollHeight > window.innerHeight * 0.65);
  };
  field.oninput = () => {
    quickText = field.value;
    $('#quick-cancel').hidden = !state.selected.length && !quickText;
    updateAutoPeriod();
    resize();
  };
  $('#quick-date').onchange = e => {
    if (e.target.value) {
      quickDate = e.target.value;
      render();
    }
  };
  updateAutoPeriod();
  resize();
  bindMobileRecordBar();
  form.onsubmit = e => {
    e.preventDefault();
    if(document.activeElement!==targetField)toast('저장할 기록 종류 버튼을 선택하세요.');
  };
}
export async function saveQuick(kind,draft=null) {
  if (saving) return false;
  const text = (draft?.text ?? $('#quick-text')?.value ?? '').trim();
  if (!text) throw Error('내용을 입력하세요.');
  const ids = [...new Set(draft?.ids||state.selected)];
  if (!ids.length) throw Error('대상 학생을 선택하세요.');
  const parsed = C.quickRecordContext(db(), text, draft?.date || $('#quick-date')?.value || quickDate || state.date, draft?.period ?? $('#quick-period').value);
  const recordText = parsed.subjectCode && !text.startsWith('[' + parsed.subjectCode + ']') ? '[' + parsed.subjectCode + '] ' + text : text;
  const scope = quickScope;
  saving = true;
  try {
    await saveDirectRecords(kind, recordText, ids, [...(draft?.areas||quickAreas)], {...parsed,incidentId:(draft?.incidentId??quickIncident)||null,counseling:(draft?.counseling ?? (quickCounseling?{notes:quickCounselText}:null)), printIncluded: !(draft?.privateRecord ?? $('#quick-private')?.checked ?? quickPrivate)});
    if (scope === quickScope && quickText.trim() === text && JSON.stringify(state.selected) === JSON.stringify(ids)) {
      quickText = '';
      quickStudentQuery = '';
      quickAreas = [];
      quickPrivate = false;quickCounseling=false;quickCounselText='';quickOptions=false;quickIncident='';
      state.selected = [];
    }
    render();
    return true;
  } finally {
    saving = false;
  }
}
function quickPeriodLabel() {
  return '⏰ ' + (quickPeriod === '자동' ? '시간자동' : quickPeriod || '시간 미지정');
}
export function openQuickPeriod() {
  const choose = value => {
    quickPeriod = value;
    const button = $('#quick-period');
    if (button) {
      button.value = value;
      button.textContent = quickPeriodLabel();
    }
    closeModal();
    updateAutoPeriod();
  };
  modal('시간·교시 선택', `<div class="quick-period-options">${[['자동', '시간 자동 (현재 시간 자동 매칭)'], ['', '시간 미지정']].map(([value, label]) => btn(label, () => choose(value), 'period-card' + (quickPeriod === value ? ' selected' : ''), `data-period-value="${value}" aria-pressed="${quickPeriod === value}"`)).join('')}</div><div class="quick-period-card-grid">${C.quickPeriodChoices(settings()).map(value => btn(value, () => choose(value), 'period-card' + (quickPeriod === value ? ' selected' : ''), `data-period-value="${value}" aria-pressed="${quickPeriod === value}"`)).join('')}</div>`);
}
function updateAutoPeriod() {
  const button = $('#quick-period');
  if (button && db()) {
    const inferred = C.inputPeriod(quickText, settings());
    button.title = quickPeriod === '자동' ? '시간자동' + (inferred ? ' · ' + inferred : '') : quickPeriod ? '직접 선택 · ' + quickPeriod : '시간 미지정';
  }
}
setInterval(updateAutoPeriod, 60000);
export function quickStudentCandidates(query, source = db(), exact = false) {
  const tokens = query.trim().split(/[,，\s]+/).filter(Boolean),
    students = C.activeStudents(source),
    found = new Map();
  for (const value of tokens) {
    const number = value.match(/^(\d+)(?:번)?$/);
    for (const student of students) {
      const match = number ? exact || tokens.length > 1 || value.endsWith('번') ? student.no === Number(number[1]) : String(student.no).startsWith(number[1]) : exact ? student.name === value || student.name.length === 3 && student.name.slice(1) === value : student.name.includes(value);
      if (match) found.set(student.id, student);
    }
  }
  return [...found.values()];
}
let quickSelectionExpanded = false, quickSelectionOrder = [], quickSelectionScope = '';
const selectionMedia = globalThis.matchMedia?.('(max-width:640px)');
selectionMedia?.addEventListener('change', () => { if ($('#quick-form')) render(); });
function quickStudentsField() {
  const limit = selectionMedia?.matches ? 3 : 5;
  if (quickSelectionScope !== quickScope) {quickSelectionOrder=[];quickSelectionExpanded=false;quickSelectionScope=quickScope;}
  const added = state.selected.filter(id => !quickSelectionOrder.includes(id));
  quickSelectionOrder = [...added.reverse(), ...quickSelectionOrder.filter(id => state.selected.includes(id))];
  if (state.selected.length <= limit) quickSelectionExpanded = false;
  const shortName = id => {const student=db().students.find(row=>row.id===id);return student?student.no+'. '+student.name:'(나간 학생)';};
  const chip=(id,index)=>btn(`<span class="selection-pill"><span class="selection-chip-name" title="${esc(shortName(id))}">${esc(shortName(id))}</span><span class="quick-student-remove" aria-hidden="true">×</span></span>`,()=>{state.selected=state.selected.filter(value=>value!==id);render();},'quick-student-chip',`data-selected-id="${esc(id)}" data-selected-name="${esc(shortName(id))}" aria-label="${esc(shortName(id))} 선택 해제" ${index>=limit&&!quickSelectionExpanded?'hidden':''}`);
  return `<div id="quick-students"><div class="selection-summary" ${!state.selected.length?'data-empty-selection="true"':''}><span class="selection-total" role="status" aria-live="polite" aria-atomic="true"><span data-selection-count="${state.selected.length}">${state.selected.length}명 선택</span></span><span class="selection-hint"><span data-selection-hint>×로 선택 해제</span></span>${btn('전체 선택', () => {
    state.selected = C.activeStudents(db()).map(student => student.id);
    render();
  }, 'selection-select-all')}</div><div class="chips selected-students" aria-label="선택 학생">${quickSelectionOrder.map(chip).join('')}${state.selected.length > limit ? btn(quickSelectionExpanded ? '접기' : '+' + (state.selected.length - limit), () => {
    quickSelectionExpanded = !quickSelectionExpanded;
    render();
    $('#quick-selection-more')?.focus({preventScroll:true});
  }, 'selection-more', `id="quick-selection-more" aria-expanded="${quickSelectionExpanded}" aria-label="${quickSelectionExpanded ? '선택 학생 접기' : '선택 학생 ' + (state.selected.length-limit) + '명 더 보기'}"`) : ''}</div><div class="quick-student-search"><input id="quick-student-query" aria-label="대상 학생 번호 또는 이름" autocomplete="off" placeholder="번호·이름" value="${esc(quickStudentQuery)}" aria-controls="quick-student-results">${btn('학생추가', addQuickStudentQuery)}${btn('×', resetQuickDraft, 'quick-cancel', `aria-label="입력 취소" id="quick-cancel" ${!state.selected.length && !quickText ? 'hidden' : ''}`)}</div><div id="quick-student-results" class="quick-student-results" aria-label="학생 검색 결과"></div></div>`;
}
function addQuickStudent(id) {
  if (!C.activeStudents(db()).some(student => student.id === id)) throw Error('학생을 확인하세요.');
  if (!state.selected.includes(id)) state.selected = [...state.selected, id];
  quickStudentQuery = '';
  render();
  $('#quick-student-query')?.focus();
}
export function addQuickStudentQuery() {
  const query = $('#quick-student-query')?.value || quickStudentQuery;
  const candidates=quickStudentCandidates(query);
  const tokens = query.trim().split(/[,，\s]+/).filter(Boolean);
  if(tokens.length===1&&candidates.length===1){addQuickStudent(candidates[0].id);return;}
  if (!tokens.length) throw Error('학생 번호 또는 이름을 입력하세요.');
  const ids = tokens.map(token => {
    const matches = quickStudentCandidates(token, db(), true);
    if (matches.length !== 1) throw Error(matches.length ? '같은 이름이나 번호가 있습니다. 검색 결과에서 학생을 선택하세요.' : '학생 번호 또는 이름을 확인하세요.');
    return matches[0].id;
  });
  state.selected = [...new Set([...state.selected, ...ids])];
  quickStudentQuery = '';
  render();
  $('#quick-student-query')?.focus();
}
function showQuickStudentResults() {
  const results = $('#quick-student-results');
  if (!results) return;
  results.innerHTML = quickStudentCandidates(quickStudentQuery).slice(0, 12).map(student => btn(esc(student.no + '. ' + student.name) + (state.selected.includes(student.id) ? ' · 선택됨' : ''), () => addQuickStudent(student.id), 'quick-student-result')).join('');
}
function resetQuickDraft() {
  state.selected = [];
  quickText = '';
  quickStudentQuery = '';
  quickAreas = [];
  quickPrivate = false;quickCounseling=false;quickCounselText='';quickOptions=false;quickIncident='';
  render();
}

let disconnectMobileBar=()=>{};
export function stopMobileRecordBar(){disconnectMobileBar();disconnectMobileBar=()=>{};document.body.classList.remove('has-mobile-record-bar');}
function mobileRecordBar(){
 if(!state.selected.length)return '';
 return `<div id="mobile-record-bar" class="mobile-record-bar" role="region" aria-label="선택 학생 기록 작업" hidden>${btn(`${state.selected.length}명 선택 · 기록 쓰기`,openMobileQuickRecord,'primary mobile-record-open','aria-haspopup="dialog" aria-controls="modal"')}${btn('선택 해제',()=>{state.selected=[];render();},'mobile-record-clear')}</div>`;
}
function bindMobileRecordBar(){
 disconnectMobileBar();
 const bar=$('#mobile-record-bar'),field=$('#quick-text');if(!bar||!field)return;
 let frame=0,active=true;
 const update=()=>{
  frame=0;if(!active)return;if(!field.isConnected){stopMobileRecordBar();return;}const rect=field.getBoundingClientRect(),top=document.querySelector('.sticky-navigation')?.getBoundingClientRect().bottom||0;
  const visibleHeight=Math.max(0,Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,Math.max(0,top)));
  const show=matchMedia('(max-width:760px)').matches&&state.selected.length>0&&!$('#modal')?.open&&visibleHeight<Math.min(24,rect.height/2);
  bar.hidden=!show;document.body.classList.toggle('has-mobile-record-bar',show);
 };
 const schedule=()=>{if(active&&!frame)frame=requestAnimationFrame(update);};
 const observer=new IntersectionObserver(schedule,{threshold:[0,.25,.5,1]});observer.observe(field);
 const modalObserver=new MutationObserver(schedule);if($('#modal'))modalObserver.observe($('#modal'),{attributes:true,attributeFilter:['open']});
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 disconnectMobileBar=()=>{active=false;observer.disconnect();modalObserver.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);cancelAnimationFrame(frame);};
 schedule();
}
export function openMobileQuickRecord(){
 if(saving){toast('저장 중입니다. 잠시 기다려 주세요.');return;}
 const ids=[...new Set(state.selected)],scope=quickScope;if(!ids.length)return;
 quickText=$('#quick-text')?.value??quickText;
 let submitted=false,busy=false;
 const content=`<p class="mobile-quick-students">${ids.map(id=>`<span>${esc(name(id))}</span>`).join('')}</p><label>내용<textarea id="mobile-quick-text" aria-label="내용" name="text" rows="3" required>${esc(quickText)}</textarea></label><div class="mobile-quick-areas choice-chips" role="group" aria-label="분야">${C.areaNames(db()).map(area=>`<label class="choice-chip"><input type="checkbox" name="areas" value="${esc(area)}" ${quickAreas.includes(area)?'checked':''}><span>${esc(area)}</span></label>`).join('')}</div><div class="mobile-quick-fields"><label>날짜${dateField(quickDate||state.date,'aria-label="날짜" name="date" required')}</label><label>교시<select aria-label="교시" name="period">${opts([['자동','시간 자동'],['','시간 미지정'],...C.quickPeriodChoices(settings()).map(value=>[value,value])],quickPeriod)}</select></label></div><p id="mobile-quick-error" class="field-error" role="alert" hidden></p><details class="mobile-quick-options"><summary>추가 옵션</summary><label>사건 연결<select name="incidentId">${opts([['','연결하지 않음'],...db().incidents.map(i=>[i.id,i.title])],quickIncident)}</select></label><label class="quick-private mobile-quick-private"><input type="checkbox" name="privateRecord" ${quickPrivate?'checked':''}>비공개</label><label class="quick-private"><input type="checkbox" name="counseling" ${quickCounseling?'checked':''}>상담</label><input name="counselNotes" aria-label="상담 정보" placeholder="전화·대면, 참석자 등" value="${esc(quickCounselText)}" ${quickCounseling?'':'hidden'}></details>${btn('메모',()=>quickMemoDialog())}`;
 const footer=`<div class="mobile-quick-actions">${recordButtons(async kind=>{
  const form=$('#mobile-quick-form');if(!form||busy||!form.reportValidity())return;
  const fields=new FormData(form),error=$('#mobile-quick-error');error.hidden=true;
  if(scope!==quickScope){error.hidden=false;error.textContent='학급 또는 날짜가 바뀌었습니다. 창을 닫고 다시 선택해 주세요.';return;}
  quickText=String(fields.get('text'));quickDate=String(fields.get('date'));quickPeriod=String(fields.get('period'));quickAreas=fields.getAll('areas');quickIncident=String(fields.get('incidentId')||'');quickPrivate=fields.has('privateRecord');quickCounseling=fields.has('counseling');quickCounselText=String(fields.get('counselNotes')||'');
  busy=true;form.querySelectorAll('.record-action').forEach(button=>button.disabled=true);
  try{submitted=await saveQuick(kind,{text:quickText,ids,areas:[...quickAreas],date:quickDate,period:quickPeriod,privateRecord:quickPrivate,incidentId:quickIncident,counseling:quickCounseling?{notes:quickCounselText}:null});if(submitted)closeModal();}
  catch(cause){error.hidden=false;error.textContent=cause.message;}
  finally{busy=false;if(form.isConnected)form.querySelectorAll('.record-action').forEach(button=>button.disabled=false);}
 })}</div>`;
 const dialog=modal(`${ids.length}명 학생 기록`,content,null,'저장','',{formId:'mobile-quick-form',footer});
 const form=$('#mobile-quick-form');
 form.elements.counseling.onchange=e=>{form.elements.counselNotes.hidden=!e.target.checked;};
 form.oninput=()=>{if(scope!==quickScope)return;const fields=new FormData(form);quickText=String(fields.get('text'));if(fields.get('date'))quickDate=String(fields.get('date'));quickPeriod=String(fields.get('period'));quickAreas=fields.getAll('areas');quickIncident=String(fields.get('incidentId')||'');quickPrivate=fields.has('privateRecord');quickCounseling=fields.has('counseling');quickCounselText=String(fields.get('counselNotes')||'');};
 form.onsubmit=event=>event.preventDefault();
 dialog.addEventListener('close',()=>{
  if(!submitted)render();
  requestAnimationFrame(()=>{
   const target=submitted?[...document.querySelectorAll('article.student[data-student-id]')].find(card=>card.dataset.studentId===ids.at(-1)):$('#mobile-record-bar:not([hidden]) .mobile-record-open');
   target?.focus({preventScroll:true});
  });
 },{once:true});
 $('#mobile-quick-text')?.focus();
}

function quickMemoDialog(){
 modal('메모',`<p>별 점수에 영향을 주지 않는 비공개 메모입니다.</p><label>내용<textarea name="memo" required></textarea></label>`,async f=>{const ids=[...state.selected];if(!ids.length)throw Error('대상 학생을 먼저 선택하세요.');await saveDirectRecords('추가기록',f.get('memo'),ids,[],{printIncluded:false,date:quickDate||state.date,incidentId:quickIncident||null});closeModal();render();});
}
