import { render } from '../app.js';
import * as C from '../core.js';
import { db, name, settings } from '../shared/data.js';
import { state, store } from '../shared/state.js';
import { $, btn, esc, opts, toast } from '../shared/ui.js';
import { classroom } from '../tabs/classroom.js';
import { bulkRecord, recordEditor } from '../tabs/records.js';
export function header() {
  return `<header class="top"><div class="brand"><span class="logo">ST</span><strong>오늘의 별</strong><small>${esc(settings().className)}</small></div><div class="row"><span class="saved">${esc(store.mode === 'demo' ? '체험 모드 · 이 기기에만 저장' : state.saveNotice || '클라우드 연결됨')}</span>${btn('새로고침', async () => {
    if (store.mode === 'cloud') {
      await store.load();
      render();
      toast('최신 자료를 불러왔습니다.');
    }
  })}${btn('교실 화면', classroom)}${btn('로그아웃', async () => {
    await store.logout();
    state.selected = [];
    render();
  })}</div></header>`;
}
export function renderLogin() {
  clearInterval(state.clockTimer);
  $('#app').innerHTML = `<div class="panel login"><span class="logo">ST</span><h1>오늘의 별</h1><p>오늘의 작은 행동을 기록하고,<br>아이들의 성장을 함께 살펴보세요.</p><p>생활지도 기록 · 과제와 루틴 · 시간표와 일정<br>선생님의 학급 운영을 한곳에서 관리합니다.</p>${store.client ? btn('구글 계정으로 시작하기', () => store.login(), 'primary') : '<div class="notice">아직 연결 전입니다. config.js에 수파베이스 프로젝트 주소와 공개 키를 입력하면 구글 로그인이 활성화됩니다.</div>'}${btn('가상 명단으로 먼저 살펴보기', () => {
    store.demo();
    render();
  })}<small>연결 전 체험 자료와 로그인 후 학급 자료는 별도로 관리됩니다.</small></div>`;
}
export function renderShell(renderTab) {
  return header() + `<div class="shell"><div class="quick-wrap"><form class="quick" id="quick-form"><input id="quick-text" aria-label="빠른 기록 입력" placeholder="예: 3번 2교시 친구를 도와줌 · / 키로 바로 입력" autocomplete="off"><select id="quick-period" aria-label="교시">${opts(['자동', '아침', ...Array.from({
    length: 7
  }, (_, i) => `${i + 1}교시`), '점심', '방과후', '기타'], '자동')}</select><button class="primary">기록 확인</button></form>${state.selected.length ? `<div class="chips" style="padding-top:7px">${state.selected.map(id => btn(esc(name(id)) + ' ×', () => {
    state.selected = state.selected.filter(x => x !== id);
    render();
  })).join('')}${btn('선택 해제', () => {
    state.selected = [];
    render();
  })}</div>` : ''}</div><nav class="tabs" aria-label="주 메뉴">${['대시보드', '기록', '시간표·일정', '과제', '루틴', '학생', '자리', '설정'].map(t => btn(t, () => {
    state.tab = t;
    render();
  }, state.tab === t ? 'active' : '', state.tab === t ? 'aria-current="page"' : '')).join('')}</nav>${store.mode === 'demo' ? '<div class="notice">가상 명단으로 체험 중입니다. 이 모드의 자료는 이 브라우저에만 저장됩니다. 실제 학급은 수파베이스 연결 후 구글 로그인으로 사용하세요.</div>' : ''}${settings().lastBackupAt && Date.now() - new Date(settings().lastBackupAt) > 7 * 86400000 ? '<div class="notice">마지막 백업 후 7일이 지났습니다. 설정에서 백업 파일을 내려받으세요.</div>' : !settings().lastBackupAt ? '<div class="muted" style="margin-bottom:10px">아직 백업하지 않았습니다. 설정에서 전체 자료를 내보낼 수 있습니다.</div>' : ''}<main id="main">${renderTab()}</main></div>${state.selected.length && state.dashMode === 'normal' ? `<aside class="bulkbar"><div><strong>${state.selected.length}명 선택</strong><small> · ${state.selected.map(name).map(esc).join(', ')}</small></div><div class="row">${btn('+1 칭찬', () => bulkRecord('칭찬'))}${btn('0 기록', () => bulkRecord('관찰'))}${btn('−1 조언', () => bulkRecord('지도'))}</div></aside>` : ''}`;
}
export function bindQuickInput() {
  $('#quick-form').onsubmit = e => {
    e.preventDefault();
    const text = $('#quick-text').value.trim();
    if (!text && !state.selected.length) return toast('내용을 입력하거나 학생을 선택하세요.');
    const parsed = C.parseInput(text, db(), state.selected);
    parsed.date = state.date;
    const period = $('#quick-period').value;
    if (period !== '자동') parsed.period = period;
    recordEditor(parsed);
  };
}
