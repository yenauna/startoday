import * as C from '../core.js';
import { render } from '../app.js';
import { state, store } from '../shared/state.js';
import { commit, db, students, name, up } from '../shared/data.js';
import { btn, esc, input, select, textarea, toast } from '../shared/ui.js';
import { modal, closeModal } from '../components/modal.js';
let economyTeacherTab = 'assets';
export function economyMessage(error) {
  if (['PGRST202', '42883'].includes(error?.code)) return '경제 기능을 사용하려면 Supabase에서 최신 schema.sql을 실행해 주세요.';
  const text = error?.message || '';
  return Object.entries({
    INSUFFICIENT_BALANCE: '잔액이 부족합니다.',
    SOLD_OUT: '품절된 물품입니다.',
    REFUNDS_DISABLED: '환불이 허용되지 않습니다.',
    INVALID_HOLDING: '이미 사용하거나 환불한 물품입니다.',
    ITEM_UNAVAILABLE: '판매 중인 물품이 아닙니다.'
  }).find(([code]) => text.includes(code))?.[1] || text || '거래를 완료하지 못했습니다.';
}
async function economyTeacherAction(action, id, target = null, amount = 0, memo = '') {
  try {
    await store.economyAction(action, id, target, amount, memo);
    closeModal();
    render();
    toast('처리했습니다.');
  } catch (error) {
    toast(economyMessage(error));
  }
}
function economyDate(value) {
  const date = String(value || '').slice(0, 10);
  const time = new Date(value);
  return (C.formatDate(date) || date) + (Number.isNaN(time.getTime()) ? '' : ' ' + time.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }));
}
function economyHistory(rows, teacher = false) {
  return `<div class="table-wrap"><table><thead><tr><th>일시</th>${teacher ? '<th>학생</th>' : ''}<th>종류</th><th>내용</th><th>별코인</th><th>상태</th></tr></thead><tbody>${[...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(t => `<tr><td>${esc(economyDate(t.createdAt))}</td>${teacher ? `<td>${esc(name(t.studentId))}</td>` : ''}<td>${esc(t.type)}</td><td>${esc(t.itemName || t.memo || '')}</td><td>${t.amount > 0 ? '+' : ''}${esc(t.amount)}</td><td>${esc(t.status || '')}</td></tr>`).join('')}</tbody></table></div>`;
}
export function economyView() {
  const data = db(),
    list = students();
  return `<div class="toolbar"><h2>경제</h2><span class="muted">별코인 · 별 점수 1점 = 10별코인</span></div><nav class="economy-subtabs" aria-label="경제 관리">${btn('자산 관리', () => {
    economyTeacherTab = 'assets';
    render();
  }, economyTeacherTab === 'assets' ? 'active' : '')}${btn('상점 관리', () => {
    economyTeacherTab = 'shop';
    render();
  }, economyTeacherTab === 'shop' ? 'active' : '')}</nav>${economyTeacherTab === 'assets' ? `<section class="panel"><div class="table-wrap"><table><thead><tr><th>번호</th><th>이름</th><th>별명</th><th>현재 잔액</th><th>보유 아이템</th><th>관리</th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.no)}</td><td>${esc(s.name)}</td><td>${esc(s.nickname || '')}</td><td>★ ${C.studentBalance(data, s.id)}</td><td>${C.studentHoldings(data, s.id).length}개</td><td>${btn('선물하기', () => economyGiftDialog(s))}${btn('지급/차감', () => economyAdjustDialog(s))}</td></tr>`).join('')}</tbody></table></div></section>` : `<section class="panel"><div class="toolbar">${btn('환불 허용: ' + (data.settings[0].allowRefund !== false ? '켜짐' : '꺼짐'), () => commit([up('settings', {
    ...data.settings[0],
    allowRefund: data.settings[0].allowRefund === false
  })]))}${btn('새 물품/쿠폰 등록', () => economyItemDialog())}</div>${economyGroupedItems((data.shop_items || []).filter(i => !i.deletedAt), i => btn('수정', () => economyItemDialog(i)) + btn('삭제', async () => {
    if (confirm('상점에서 이 물품을 삭제할까요? 기존 구매 내역은 유지됩니다.')) await commit([up('shop_items', {
      ...i,
      deletedAt: C.now()
    })]);
  }))}</section>`}<section class="panel"><h3>최근 학급 경제 거래</h3>${economyHistory((data.economy_tx || []).slice(-100), true)}</section>`;
}
function economyGroupedItems(items, actions) {
  const groups = new Map();
  for (const item of items) {
    const category = item.category?.trim() || '기타';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  return [...groups].map(([category, rows]) => `<section class="economy-category"><h3 class="economy-category-title">${esc(category)}</h3><div class="economy-grid economy-shop-grid">${rows.map(item => economyItemCard(item, actions(item))).join('')}</div></section>`).join('') || '<p class="muted">등록된 상품이 없습니다.</p>';
}
function economyItemCard(item, actions = '') {
  return `<article class="economy-item"><span class="badge">${esc(item.category)}</span><h3>${esc(item.name)}</h3><strong>★ ${esc(item.price)}별코인</strong><p>${item.stock === null ? '무한대' : item.stock === 0 ? '품절' : esc(item.stock) + '개 남음'}</p><div class="row">${actions}</div></article>`;
}
function economyItemDialog(item = null) {
  modal(item ? '물품/쿠폰 수정' : '새 물품/쿠폰 등록', input('카테고리', 'category', item?.category || '쿠폰') + input('이름', 'name', item?.name || '', 'text', 'required maxlength="100"') + input('금액 (별코인)', 'price', item?.price ?? 0, 'number', 'required min="0" max="1000000000" step="1"') + input('수량 (비워두면 무한대)', 'stock', item?.stock ?? '', 'number', 'min="0" max="1000000000" step="1"'), async f => {
    const price = Number(f.get('price')),
      stock = f.get('stock') === '' ? null : Number(f.get('stock')),
      nameValue = String(f.get('name')).trim();
    if (!nameValue || !Number.isSafeInteger(price) || price < 0 || !(stock === null || Number.isSafeInteger(stock) && stock >= 0)) throw Error('이름, 금액, 수량을 확인하세요.');
    await commit([up('shop_items', {
      ...item,
      id: item?.id || C.uid(),
      category: String(f.get('category')).trim() || '기타',
      name: nameValue,
      price,
      stock,
      createdAt: item?.createdAt || C.now()
    })]);
    closeModal();
  });
}
function economyGiftDialog(s) {
  modal(name(s.id) + ' · 선물하기', `<div class="economy-grid">${(db().shop_items || []).filter(i => !i.deletedAt).map(i => economyItemCard(i, btn('선물하기', () => economyTeacherAction('gift', s.id, i.id), '', i.stock === 0 ? 'disabled' : ''))).join('') || '<p>먼저 상점 물품을 등록하세요.</p>'}</div>`);
}
function economyAdjustDialog(s) {
  modal(name(s.id) + ' · 지급/차감', input('금액 (지급은 양수, 차감은 음수)', 'amount', '', 'number', 'required step="1" min="-1000000000" max="1000000000"') + textarea('사유', 'memo', ''), async f => {
    await store.economyAction('adjust', s.id, null, Number(f.get('amount')), String(f.get('memo')));
    closeModal();
    render();
  });
}

// This renderer accepts only the student's allow-listed economy projection.
export function studentEconomyView(data, tab, category, changeTab, changeCategory, act) {
  if (!data) return '<section class="panel">경제 정보를 불러오려면 다시 로그인해 주세요.</section>';
  const tx = data.transactions || [],
    items = data.items || [],
    categories = ['전체', ...new Set(items.map(i => i.category))];
  return `<section class="student-card economy-wallet"><h2>내 지갑</h2><strong>★ ${esc(data.balance)}별코인</strong></section><nav class="economy-subtabs">${btn('내 자산', () => changeTab('assets'), tab === 'assets' ? 'active' : '')}${btn('상점', () => changeTab('shop'), tab === 'shop' ? 'active' : '')}</nav>${tab === 'assets' ? `<section class="student-card"><h2>내가 가진 쿠폰·물품</h2><div class="economy-grid">${tx.filter(t => t.status === '보유' && ['구매', '선물'].includes(t.type)).map(t => `<article class="economy-item"><h3>${esc(t.itemName)}</h3><small>${esc(economyDate(t.createdAt))} · ${esc(t.type)}</small><div class="row">${btn('사용하기', () => act('use', t.id, t.itemName))}${data.allowRefund && t.type === '구매' ? btn('환불', () => act('refund', t.id, t.itemName)) : ''}</div></article>`).join('') || '<p class="muted">아직 보유한 물품이 없어요.</p>'}</div><h3>내 거래 내역</h3>${economyHistory(tx)}</section>` : `<section class="student-card"><nav class="economy-subtabs">${categories.map(c => btn(esc(c), () => changeCategory(c), c === category ? 'active' : '')).join('')}</nav>${economyGroupedItems(items.filter(i => category === '전체' || i.category === category), i => btn(i.stock === 0 ? '품절' : data.balance < i.price ? '잔액 부족' : '구매하기', () => act('buy', i.id, i.name), '', i.stock === 0 || data.balance < i.price ? 'disabled' : ''))}</section>`}`;
}
