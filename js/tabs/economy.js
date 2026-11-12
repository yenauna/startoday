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
  const navigation = `<nav class="village-categories village-economy-tabs" aria-label="경제 보기">${btn('내 자산', () => changeTab('assets'), tab === 'assets' ? 'is-selected' : '', `aria-pressed="${tab === 'assets'}"`)}${btn('상점', () => changeTab('shop'), tab === 'shop' ? 'is-selected' : '', `aria-pressed="${tab === 'shop'}"`)}</nav>`;
  return villageEconomyFrame(tab === 'assets' ? '별코인 보관함' : '별코인 상점', data.balance, navigation, tab === 'assets' ? villageAssetsView(data, act) : villageShopView(data, category, changeCategory, act));
}
function villageAssetsView(data, act) {
  const transactions = data.transactions || [],
    holdings = transactions.filter(t => t.status === '보유' && ['구매', '선물'].includes(t.type));
  return `<section class="village-holdings" aria-label="내 보관함"><h3 class="village-section-title">내가 가진 쿠폰·물품</h3><div class="economy-grid village-product-grid">${holdings.map(t => `<article class="economy-item village-product village-holding"><span class="village-product-plaque">${esc(t.type)}</span><h3>${esc(t.itemName)}</h3><small class="village-holding-date">${esc(economyDate(t.createdAt))}</small><div class="village-holding-actions">${btn('사용하기', () => act('use', t.id, t.itemName), 'village-buy')}${data.allowRefund && t.type === '구매' ? btn('환불', () => act('refund', t.id, t.itemName), 'village-buy village-refund') : ''}</div></article>`).join('') || '<p class="village-empty">보관함이 비어 있어요. 상점에서 고른 물건과 선물이 이곳에 모여요.</p>'}</div></section><section class="village-ledger" aria-label="내 거래 내역"><h3 class="village-section-title">내 거래 내역</h3><ol class="village-ledger-entries">${[...transactions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(t => `<li class="village-ledger-entry"><div class="village-ledger-date"><time datetime="${esc(t.createdAt)}">${esc(economyDate(t.createdAt))}</time><span class="village-ledger-type">${esc(t.type)}</span></div><div class="village-ledger-item"><strong>${esc(t.itemName || t.type + ' 별코인')}</strong><span class="village-ledger-status">${esc(t.status || (t.type === '환불' ? '환급완료' : '처리완료'))}</span></div><strong class="village-ledger-amount ${t.amount > 0 ? 'is-credit' : t.amount < 0 ? 'is-debit' : 'is-neutral'}">${t.amount > 0 ? '+' : ''}${esc(t.amount)}<small> 별코인</small></strong></li>`).join('') || '<li class="village-ledger-empty">아직 장부에 적힌 거래가 없어요.</li>'}</ol></section>`;
}

// Presentation-only category aliases keep legacy '혜택' stock and item IDs intact.
function villageCategory(value) {
  const category = String(value || '').trim();
  return ['혜택', '특별혜택', '특별 혜택'].includes(category) ? '특별 혜택' : category || '기타';
}
function villageShopView(data, category, changeCategory, act) {
  const items = data.items || [],
    categories = ['전체', '쿠폰', '물품', '간식', '특별 혜택', ...new Set(items.map(item => villageCategory(item.category)).filter(c => !['쿠폰', '물품', '간식', '특별 혜택'].includes(c)))];
  const requested = villageCategory(category),
    selected = categories.includes(requested) ? requested : '전체';
  return `<nav class="village-categories" aria-label="상품 카테고리">${categories.map(c => btn(esc(c), () => changeCategory(c), c === selected ? 'is-selected' : '', `aria-pressed="${c === selected}"`)).join('')}</nav><div class="economy-grid economy-shop-grid village-product-grid">${items.filter(item => selected === '전체' || villageCategory(item.category) === selected).map(item => `<article class="economy-item village-product"><span class="village-product-plaque">${esc(villageCategory(item.category))}</span><h3>${esc(item.name)}</h3><div class="village-product-meta"><strong><span aria-hidden="true">★</span> ${esc(item.price)}</strong><small>${item.stock === null ? '무제한' : item.stock === 0 ? '품절' : esc(item.stock) + '개 남음'}</small></div>${btn(item.stock === 0 ? '품절' : data.balance < item.price ? '잔액 부족' : '구매하기', () => act('buy', item.id, item.name), 'village-buy', item.stock === 0 || data.balance < item.price ? 'disabled' : '')}</article>`).join('') || '<p class="village-empty">등록된 상품이 없습니다.</p>'}</div>`;
}
function villageEconomyFrame(title, balance, navigation, content) {
  return `<section class="village-shop" aria-label="${esc(title)}"><div class="village-stone-arch" aria-hidden="true"><svg viewBox="0 0 600 80" preserveAspectRatio="none"><path d="M12 73Q50 14 144 14H456Q550 14 588 73" class="village-arch-shadow"/><path d="M12 70Q50 11 144 11H456Q550 11 588 70" class="village-arch-stones"/></svg></div><div class="village-interior"><div class="village-awning" aria-hidden="true">${Array.from({
    length: 10
  }, () => '<i></i>').join('')}</div><header class="village-shop-header"><h2 class="village-sign">${esc(title)}</h2><span class="village-wallet" aria-label="내 지갑 ${esc(balance)}별코인"><span aria-hidden="true">★</span> ${esc(balance)}</span></header>${navigation}${content}</div><span class="village-lantern village-lantern-left" aria-hidden="true"></span><span class="village-lantern village-lantern-right" aria-hidden="true"></span></section>`;
}
