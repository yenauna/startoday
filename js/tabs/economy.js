import * as C from '../core.js';
import { render } from '../app.js';
import { state, store } from '../shared/state.js';
import { commit, db, students, name, up } from '../shared/data.js';
import { btn, esc, input, select, textarea, toast, checkbox } from '../shared/ui.js';
import { modal, closeModal } from '../components/modal.js';
let economyTeacherTab = 'assets';
let openEconomyStudentId = null, openGiftItemId = null, economyDrawerScope = '', economyInlineBusy = false;
// The whole card opens details; buttons keep their own action and keyboard semantics.
document.addEventListener('click', event => {
  if (event.target.closest('button,input,a,select,textarea')) return;
  const person = event.target.closest('[data-economy-student]');
  if (person) { toggleEconomyDrawer(person.dataset.economyStudent); return; }
  event.target.closest('.group-buy-card,.individual-shop-card')?.querySelector('.group-buy-detail-open,.shop-item-detail-open')?.click();
});
export function economyMessage(error) {
  if (['PGRST202', '42883'].includes(error?.code)) return '경제 기능을 사용하려면 Supabase에서 최신 schema.sql을 실행해 주세요.';
  const text = error?.message || '';
  return Object.entries({
    INSUFFICIENT_BALANCE: '잔액이 부족합니다.',
    SOLD_OUT: '품절된 물품입니다.',
    STOCK_LIMIT: '재고 최대 수량을 초과합니다.',
    REFUNDS_DISABLED: '환불이 허용되지 않습니다.',
    INVALID_HOLDING: '이미 사용하거나 환불한 물품입니다.',
    ITEM_UNAVAILABLE: '판매 중인 물품이 아닙니다.',
    GROUP_BUY_CLOSED: '이미 모금이 완료되었습니다.',
    INVALID_AMOUNT: '1 이상의 정수 금액을 입력하세요.',
    INVALID_GROUP_BUY: '공동구매 물품을 확인하세요.',
    INVALID_GROUP_USE: '달성된 미사용 보상만 사용할 수 있습니다.'
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
  const scope = store.mode + ':' + store.classId + ':' + (store.user?.id || '');
  if (scope !== economyDrawerScope) { economyDrawerScope = scope; openEconomyStudentId = null; openGiftItemId = null; }
  const data = db(),
    list = students().sort((a,b) => a.no - b.no);
  return `<div class="toolbar"><h2>경제</h2><span class="muted">별코인 · 별 점수 1점 = 10별코인</span></div><nav class="economy-subtabs" aria-label="경제 관리">${btn('자산 관리', () => {
    economyTeacherTab = 'assets';
    render();
  }, economyTeacherTab === 'assets' ? 'active' : '')}${btn('상점 관리', () => {
    economyTeacherTab = 'shop';
    render();
  }, economyTeacherTab === 'shop' ? 'active' : '')}</nav>${economyTeacherTab === 'assets' ? economyAssetsView(data, list) : `<section class="panel"><div class="toolbar">${btn('환불 허용: ' + (data.settings[0].allowRefund !== false ? '켜짐' : '꺼짐'), () => commit([up('settings', {
    ...data.settings[0],
    allowRefund: data.settings[0].allowRefund === false
  })]))}${btn('물품 등록', () => economyItemDialog())}</div>${economyGroupedItems((data.shop_items || []).filter(i => !i.deletedAt), i => (!i.isGroupBuy ? btn('🎁 선물하기', () => { openGiftItemId = openGiftItemId === i.id ? null : i.id; render(); }, 'economy-item-gift-toggle', `aria-expanded="${openGiftItemId === i.id}"`) : '') + (i.isGroupBuy ? btn('상세 보기', () => teacherGroupBuyDialog(i.id), 'group-buy-detail-open') + (i.isFunded && !i.isUsed ? btn('보상 사용 완료', () => teacherUseGroupBuy(i.id)) : '') : '') + btn('수정', () => economyItemDialog(i)) + btn('삭제', async () => {
    if (confirm('상점에서 이 물품을 삭제할까요? 기존 구매 내역은 유지됩니다.')) await commit([up('shop_items', {
      ...i,
      deletedAt: C.now()
    })]);
  }))}</section>`}<section class="panel"><h3>최근 학급 경제 거래</h3>${economyHistory((data.economy_tx || []).slice(-100), true)}</section>`;
}
function economyAssetsView(data, list) {
  let mode = 'list';
  try { mode = localStorage.getItem('startoday_economy_view_mode') === 'cards' ? 'cards' : 'list'; } catch {}
  const change = value => { try { localStorage.setItem('startoday_economy_view_mode', value); } catch {} render(); };
  const actions = student => btn('지급/차감', () => economyAdjustDialog(student)) + btn('선물하기', () => economyGiftDialog(student));
  return `<section class="panel economy-assets"><div class="toolbar"><h3>자산 관리</h3><div class="row economy-view-switch" role="group" aria-label="자산 보기 방식">${btn('⊞ 카드형', () => change('cards'), mode === 'cards' ? 'active' : '', `aria-pressed="${mode === 'cards'}"`)}${btn('☰ 엑셀 목록형', () => change('list'), mode === 'list' ? 'active' : '', `aria-pressed="${mode === 'list'}"`)}</div></div>${mode === 'cards' ? `<div class="economy-asset-grid">${list.map(student => `<article class="economy-student-card" data-economy-student="${esc(student.id)}"><h3>${btn(esc(student.no) + '번 ' + esc(student.name), () => toggleEconomyDrawer(student.id), 'economy-drawer-toggle', `aria-expanded="${openEconomyStudentId === student.id}"`)}</h3><strong class="economy-asset-balance">★ ${C.studentBalance(data, student.id)}별코인</strong><p>보유 아이템 ${C.studentHoldings(data, student.id).length}개</p><div class="row">${actions(student)}</div>${openEconomyStudentId === student.id ? economyStudentDrawer(student) : ''}</article>`).join('')}</div>` : `<div class="table-wrap"><table class="economy-assets-table"><thead><tr><th>번호</th><th>이름</th><th>별코인 잔액</th><th>보유 아이템 수</th><th>지급/차감 액션</th></tr></thead><tbody>${list.map(student => `<tr data-economy-student="${esc(student.id)}"><td>${esc(student.no)}</td><td>${btn(esc(student.name), () => toggleEconomyDrawer(student.id), 'economy-drawer-toggle', `aria-expanded="${openEconomyStudentId === student.id}"`)}</td><td>★ ${C.studentBalance(data, student.id)}</td><td>${C.studentHoldings(data, student.id).length}개</td><td>${actions(student)}</td></tr>${openEconomyStudentId === student.id ? `<tr class="economy-drawer-row"><td colspan="5">${economyStudentDrawer(student)}</td></tr>` : ''}`).join('')}</tbody></table></div>`}</section>`;
}
function economyGroupedItems(items, actions) {
  const groups = new Map();
  for (const item of items) {
    const category = item.category?.trim() || '기타';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  return [...groups].map(([category, rows]) => `<section class="economy-category"><h3 class="economy-category-title">${esc(category)}</h3><div class="economy-grid economy-shop-grid">${rows.map(item => economyItemCard(item, actions(item), economyItemGiftGrid(item))).join('')}</div></section>`).join('') || '<p class="muted">등록된 상품이 없습니다.</p>';
}
function economyItemCard(item, actions = '', extra = '') {
  if (item.isGroupBuy) return `<article class="economy-item group-buy-card">${groupBuyProgress(item)}<h3>${esc(item.name)}</h3><div class="row">${actions}</div>${extra}</article>`;
  return `<article class="economy-item"><span class="badge">${esc(item.category)}</span><h3>${esc(item.name)}</h3><strong>★ ${esc(item.price)}별코인</strong><p>${item.stock === null ? '무한대' : item.stock === 0 ? '품절' : esc(item.stock) + '개 남음'}</p><div class="row">${actions}</div>${extra}</article>`;
}
function economyItemDialog(item = null) {
  const el = modal(item ? '물품/쿠폰 수정' : '물품 등록', input('카테고리', 'category', item?.category || '쿠폰') + input('이름', 'name', item?.name || '', 'text', 'required maxlength="100"') + textarea('설명', 'description', item?.description || '') + checkbox('공동구매 물품', 'isGroupBuy', !!item?.isGroupBuy) + `<div class="shop-price-field">${input('금액 (별코인)', 'price', item?.isGroupBuy ? item.groupGoal : item?.price ?? 0, 'number', 'required min="0" max="1000000000" step="1"')}</div>` + input('수량 (비워두면 무한대)', 'stock', item?.stock ?? '', 'number', 'min="0" max="1000000000" step="1"'), async f => {
    const price = Number(f.get('price')), isGroupBuy = f.has('isGroupBuy'),
      stock = isGroupBuy || !f.get('stock') ? null : Number(f.get('stock')),
      nameValue = String(f.get('name')).trim();
    if (!nameValue || !Number.isSafeInteger(price) || price < 0 || price > 1000000000 || !(stock === null || Number.isSafeInteger(stock) && stock >= 0 && stock <= 1000000000)) throw Error('이름, 금액, 수량을 확인하세요.');
    await commit(C.shopItemEditOps(db(), {
      ...item, id: item?.id || C.uid(), category: String(f.get('category')).trim() || '기타',
      name: nameValue, description: String(f.get('description') || '').slice(0, 2000),
      price, stock, isGroupBuy, groupGoal: isGroupBuy ? price : 0, createdAt: item?.createdAt || C.now()
    }));
    closeModal();
  });
  const toggle = () => {
    const group = el.querySelector('[name=isGroupBuy]').checked;
    const price = el.querySelector('[name=price]');
    price.parentElement.firstChild.textContent = group ? '목표 모금액 (별코인)' : '금액 (별코인)';
    price.min = group ? '1' : '0';
    const stock = el.querySelector('[name=stock]');
    stock.disabled = group;
    stock.placeholder = group ? '무제한 · 1회성 학급 보상' : '';
    if (group) stock.value = '';
  };
  el.querySelector('[name=isGroupBuy]').onchange = toggle;
  toggle();
}
function economyGiftDialog(s) {
  modal(name(s.id) + ' · 선물하기', `<div class="economy-grid">${(db().shop_items || []).filter(i => !i.deletedAt && !i.isGroupBuy).map(i => economyItemCard(i, btn('선물하기', () => economyTeacherAction('gift', s.id, i.id), '', i.stock === 0 ? 'disabled' : ''))).join('') || '<p>먼저 상점 물품을 등록하세요.</p>'}</div>`);
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
  return `<section class="village-holdings" aria-label="내 보관함"><h3 class="village-section-title">내가 가진 쿠폰·물품</h3><div class="economy-grid village-product-grid">${holdings.map(t => `<article class="economy-item village-product village-holding"><span class="village-product-plaque">${esc(villageCategory(t.itemCategory || (data.items || []).find(item => item.id === t.itemId)?.category))}</span><h3>${esc(t.itemName)}</h3><small class="village-holding-date">${esc(economyDate(t.createdAt))}</small><div class="village-holding-actions">${btn('사용하기', () => act('use', t.id, t.itemName), 'village-buy')}${data.allowRefund && t.type === '구매' ? btn('환불', () => act('refund', t.id, t.itemName), 'village-buy village-refund') : ''}</div></article>`).join('') || '<p class="village-empty">보관함이 비어 있어요. 상점에서 고른 물건과 선물이 이곳에 모여요.</p>'}</div></section><section class="village-ledger" aria-label="내 거래 내역"><h3 class="village-section-title">내 거래 내역</h3><ol class="village-ledger-entries">${[...transactions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(t => `<li class="village-ledger-entry"><div class="village-ledger-date"><time datetime="${esc(t.createdAt)}">${esc(economyDate(t.createdAt))}</time><span class="village-ledger-type">${esc(t.type)}</span></div><div class="village-ledger-item"><strong>${esc(t.itemName || t.type + ' 별코인')}</strong><span class="village-ledger-status">${esc(t.status || (t.type === '환불' ? '환급완료' : '처리완료'))}</span></div><strong class="village-ledger-amount ${t.amount > 0 ? 'is-credit' : t.amount < 0 ? 'is-debit' : 'is-neutral'}">${t.amount > 0 ? '+' : ''}${esc(t.amount)}<small> 별코인</small></strong></li>`).join('') || '<li class="village-ledger-empty">아직 장부에 적힌 거래가 없어요.</li>'}</ol></section>`;
}

// Only categories present in the current product list get navigation buttons.
function villageCategory(value) {
  return String(value || '').trim() || '기타';
}
function villageShopView(data, category, changeCategory, act) {
  const items = data.items || [],
    categories = ['전체', ...new Set(items.map(item => villageCategory(item.category)).filter(c => c !== '전체'))];
  const requested = villageCategory(category),
    selected = categories.includes(requested) ? requested : '전체';
  return `<nav class="village-categories" aria-label="상품 카테고리">${categories.map(c => btn(esc(c), () => changeCategory(c), c === selected ? 'is-selected' : '', `aria-pressed="${c === selected}"`)).join('')}</nav><div class="economy-grid economy-shop-grid village-product-grid">${items.filter(item => selected === '전체' || villageCategory(item.category) === selected).map(item => item.isGroupBuy ? groupBuyStudentCard(item, data, act) : `<article class="economy-item village-product individual-shop-card"><span class="village-product-plaque">${esc(villageCategory(item.category))}</span><h3>${btn(esc(item.name), () => studentItemDetail(item.id, act), 'shop-item-detail-open')}</h3><div class="village-product-meta"><strong><span aria-hidden="true">★</span> ${esc(item.price)}</strong><small>${item.stock === null ? '무제한' : item.stock === 0 ? '품절' : esc(item.stock) + '개 남음'}</small></div>${btn(item.stock === 0 ? '품절' : data.balance < item.price ? '잔액 부족' : '구매하기', () => act('buy', item.id, item.name), 'village-buy', item.stock === 0 || data.balance < item.price ? 'disabled' : '')}</article>`).join('') || '<p class="village-empty">등록된 상품이 없습니다.</p>'}</div>`;
}
function villageEconomyFrame(title, balance, navigation, content) {
  return `<section class="village-shop" aria-label="${esc(title)}"><div class="village-stone-arch" aria-hidden="true"><svg viewBox="0 0 600 80" preserveAspectRatio="none"><path d="M12 73Q50 14 144 14H456Q550 14 588 73" class="village-arch-shadow"/><path d="M12 70Q50 11 144 11H456Q550 11 588 70" class="village-arch-stones"/></svg></div><div class="village-interior"><div class="village-awning" aria-hidden="true">${Array.from({
    length: 10
  }, () => '<i></i>').join('')}</div><header class="village-shop-header"><h2 class="village-sign">${esc(title)}</h2><span class="village-wallet" aria-label="내 지갑 ${esc(balance)}별코인"><span aria-hidden="true">★</span> ${esc(balance)}</span></header>${navigation}${content}</div><span class="village-lantern village-lantern-left" aria-hidden="true"></span><span class="village-lantern village-lantern-right" aria-hidden="true"></span></section>`;
}

function groupBuyProgress(item) {
  const goal = item.groupGoal || 0, collected = item.groupCollected || 0;
  const percent = goal > 0 ? Math.min(100, Math.floor(collected / goal * 100)) : 0;
  return `<span class="badge group-buy-badge">🤝 학급 공동구매</span><p class="group-buy-progress-text">현재 ${esc(collected)} / 목표 ${esc(goal)}별 (${percent}%)</p><progress class="group-buy-progress" value="${esc(collected)}" max="${esc(goal || 1)}" aria-label="모금 진행률">${percent}%</progress>${item.isUsed ? '<p class="group-buy-state">보상 사용 완료</p>' : item.isFunded ? '<p class="group-buy-state">🎉 모금 달성!</p>' : ''}`;
}
function groupBuyStudentCard(item, data, act) {
  const open = () => studentGroupBuyDialog(item.id, act);
  return `<article class="economy-item village-product group-buy-card">${groupBuyProgress(item)}${btn(esc(item.name), open, 'group-buy-detail-open', 'aria-label="' + esc(item.name) + ' 상세 보기"')}<p>${esc(item.description || '')}</p>${btn(item.isFunded ? '🎉 모금 완료!' : '함께 모으기(기부)', open, 'village-buy', item.isFunded ? 'disabled' : '')}</article>`;
}
let activeGroupBuy = null, groupBuyTimer = null;
function studentGroupBuyDialog(itemId, act) {
  const id = state.impersonatingStudentId || state.studentUser?.id;
  openGroupBuy({ itemId, studentId: id, getData: () => {
    if (state.viewMode !== 'student' || id !== (state.impersonatingStudentId || state.studentUser?.id)) return null;
    return state.impersonatingStudentId ? C.studentEconomySnapshot(db(), id) : state.studentSnapshot?.economy;
  }, fund: amount => act('fund', itemId, '', amount), refresh: () => act('refresh') });
}
function teacherGroupBuyDialog(itemId) {
  const scope = store.mode + ':' + store.classId + ':' + (store.user?.id || '');
  openGroupBuy({ itemId, getData: () => {
    if (!db() || state.viewMode === 'student' || scope !== store.mode + ':' + store.classId + ':' + (store.user?.id || '')) return null;
    const item = db().shop_items.find(i => i.id === itemId && !i.deletedAt);
    return { items: item ? [{ ...item, contributors: C.groupBuyContributors(db(), itemId) }] : [] };
  }, refresh: async () => { if (store.mode === 'cloud') { await store.load(); render(); } } });
}
async function teacherUseGroupBuy(itemId) {
  if (!confirm('학급 공동구매 보상을 사용 완료로 표시할까요?')) return;
  try {
    await store.economyAction('group_use', null, itemId);
    render();
    toast('보상 사용을 완료했습니다.');
  } catch (error) { toast(economyMessage(error)); }
}
function openGroupBuy(config) {
  activeGroupBuy = config;
  drawGroupBuyDialog();
  clearInterval(groupBuyTimer);
  groupBuyTimer = setInterval(async () => {
    if (activeGroupBuy !== config || !document.querySelector('#modal[open] .group-buy-detail')) { clearInterval(groupBuyTimer); return; }
    if (config.refreshing || document.hidden) return;
    config.refreshing = true;
    try { await config.refresh(); if (activeGroupBuy === config) syncGroupBuyDialog(); }
    catch (error) { toast(economyMessage(error)); }
    finally { config.refreshing = false; }
  }, 4000);
}
export function syncGroupBuyDialog() {
  if (activeGroupBuy && document.querySelector('#modal[open] .group-buy-detail')) drawGroupBuyDialog();
}
function drawGroupBuyDialog() {
  const config = activeGroupBuy, data = config?.getData();
  const item = data?.items?.find(i => i.id === config.itemId);
  if (!item) { closeModal(); return; }
  const field = document.querySelector('#modal .group-buy-detail [name=amount]');
  const focused = field && document.activeElement === field;
  const value = field?.value || '1';
  const max = Math.max(0, Math.min(data.balance || 0, item.groupGoal - item.groupCollected));
  const canFund = !!config.studentId && !item.isFunded && !item.isUsed && max > 0;
  const rows = [...(item.contributors || [])].sort((a,b) => b.amount - a.amount || a.studentId.localeCompare(b.studentId));
  const body = `<div class="group-buy-detail" data-item-id="${esc(item.id)}"><p>${esc(item.description || '')}</p>${groupBuyProgress(item)}<p>남은 금액 <strong>${esc(Math.max(0, item.groupGoal - item.groupCollected))}별</strong></p><section aria-label="기여도 순위"><h3>기여도 순위 (참여자 명단)</h3><ol class="group-buy-ranking" aria-live="polite">${rows.map((c, i) => `<li class="${c.studentId === config.studentId ? 'is-me' : ''}">${i + 1}등 ${esc(c.name)} (${esc(c.amount)}별)${c.studentId === config.studentId ? ' · 나의 기여' : ''}</li>`).join('') || '<li>첫 기여를 기다리고 있어요.</li>'}</ol></section>${config.studentId ? `<p>내 보유 잔액 <strong>${esc(data.balance)}별코인</strong></p>${canFund ? input('기여할 별코인', 'amount', Math.min(Number(value) || 1, max), 'number', `required min="1" max="${Math.min(1000000000, data.balance)}" step="1"`) + `<div class="group-buy-quick">${[1,5,10].map(n => btn('+' + n + '별', () => {
    const field = document.querySelector('#modal [name=amount]');
    if (field) field.value = Math.min(max, (Number(field.value) || 0) + n);
  })).join('')}${btn('전액', () => { const field = document.querySelector('#modal [name=amount]'); if (field) field.value = max; })}</div>` : `<p>${item.isFunded ? '🎉 모금 완료!' : '기여할 수 있는 잔액이 없습니다.'}</p>`}` : item.isFunded && !item.isUsed ? btn('보상 사용 완료', () => teacherUseGroupBuy(item.id)) : ''}</div>`;
  modal(item.name, body, canFund ? async f => {
    const amount = Number(f.get('amount'));
    if (!Number.isSafeInteger(amount) || amount < 1) throw Error('1 이상의 정수 금액을 입력하세요.');
    await config.fund(amount);
  } : null, '기여하기');
  if (focused) document.querySelector('#modal [name=amount]')?.focus({ preventScroll: true });
}

function studentItemDetail(itemId, act) {
  const id = state.impersonatingStudentId || state.studentUser?.id;
  const data = state.impersonatingStudentId ? C.studentEconomySnapshot(db(), id) : state.studentSnapshot?.economy;
  const item = data?.items?.find(i => i.id === itemId && !i.isGroupBuy);
  if (!item) return toast('판매 중인 물품이 아닙니다.');
  const disabled = item.stock === 0 || data.balance < item.price;
  modal(item.name, `<div class="shop-item-detail"><p>${esc(item.description || '등록된 설명이 없습니다.')}</p><dl><dt>가격</dt><dd>${esc(item.price)}별코인</dd><dt>내 잔액</dt><dd>${esc(data.balance)}별코인</dd><dt>재고</dt><dd>${item.stock === null ? '무제한' : esc(item.stock) + '개'}</dd></dl>${btn(item.stock === 0 ? '품절' : data.balance < item.price ? '잔액 부족' : '구매하기', async () => { await act('buy', item.id, item.name); closeModal(); }, 'primary', disabled ? 'disabled' : '')}</div>`);
}

function toggleEconomyDrawer(id) {
  openEconomyStudentId = openEconomyStudentId === id ? null : id;
  render();
}
async function economyInlineAction(action, studentId, target, amount = 0) {
  if (economyInlineBusy) return;
  economyInlineBusy = true;
  try {
    await store.economyAction(action, studentId, target, amount);
    render();
    toast(name(studentId) + (action === 'gift' ? ' · 선물했습니다.' : ' · 물품을 회수했습니다.'));
  } catch (error) { toast(economyMessage(error)); }
  finally { economyInlineBusy = false; }
}
async function economyReclaim(studentId, tx) {
  if (!confirm(tx.itemName + ' 물품을 회수할까요? 별코인 잔액은 변경하지 않습니다.')) return;
  const item = db().shop_items.find(i => i.id === tx.itemId);
  const restore = item && item.stock !== null ? confirm('상점 재고를 1개 복구할까요? 확인: 복구 / 취소: 재고 복구 없이 회수') : false;
  await economyInlineAction('reclaim', studentId, tx.id, restore ? 1 : 0);
}
function economyStudentDrawer(student) {
  const holdings = C.studentHoldings(db(), student.id);
  const items = db().shop_items.filter(item => !item.deletedAt && !item.isGroupBuy);
  return `<div class="economy-student-drawer" aria-label="${esc(student.no)}번 ${esc(student.name)} 물품 서랍"><section><h4>학생 보유함</h4><ul>${holdings.map(tx => `<li><span>${esc(tx.itemName)}</span>${btn('회수', () => economyReclaim(student.id, tx), '', 'aria-label="' + esc(tx.itemName) + ' 회수"')}</li>`).join('') || '<li>보유 물품이 없습니다.</li>'}</ul></section><section><h4>상점 물품 목록</h4><ul>${items.map(item => `<li><span>${esc(item.name)} <small>${item.stock === null ? '무제한' : item.stock + '개'}</small></span>${btn('선물하기', () => economyInlineAction('gift', student.id, item.id), '', `aria-label="${esc(item.name)} 선물하기" ${item.stock === 0 ? 'disabled' : ''}`)}</li>`).join('') || '<li>등록된 개인 물품이 없습니다.</li>'}</ul></section></div>`;
}
function economyItemGiftGrid(item) {
  if (item.isGroupBuy || openGiftItemId !== item.id) return '';
  return `<section class="economy-gift-grid-panel"><h4>선물할 학생 번호를 누르세요</h4><div class="economy-student-gift-grid">${students().map(student => btn(esc(student.no), () => economyInlineAction('gift', student.id, item.id), '', `aria-label="${esc(student.no)}번 ${esc(student.name)}에게 선물하기" title="${esc(student.name)}" ${item.stock === 0 ? 'disabled' : ''}`)).join('')}</div></section>`;
}
