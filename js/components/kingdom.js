import * as C from '../core.js';
import { esc, btn } from '../shared/ui.js';
export function kingdomCards(counts, equipped, onEquip = null) {
  return `<div class="kingdom-catalog">${C.kingdomCatalog(counts).map(d => `<section class="kingdom-domain" data-kingdom-domain="${d.id}"><h3>${d.icon} ${esc(d.label)}</h3><strong>${esc(d.current)}</strong><small>칭찬 ${d.count}회 · ${d.stage}/3단계</small><progress max="${d.next || 15}" value="${Math.min(d.count, d.next || 15)}" aria-label="${esc(d.label)} 칭찬 진행도"></progress><p>${d.next === null ? '최고 단계에 도달했어요!' : '다음 단계까지 칭찬 ' + d.remaining + '회 남았어요!'}</p><ol>${d.titles.map((name, i) => {
    const id = d.id + ':' + (i + 1),
      unlocked = d.count >= C.KINGDOM_THRESHOLDS[i];
    return `<li class="${unlocked ? 'is-unlocked' : 'is-locked'}"><span>${unlocked ? '✨' : '🔒'} ${esc(name)} <small>${C.KINGDOM_THRESHOLDS[i]}회</small></span>${unlocked && onEquip ? btn(equipped === id ? '장착 중' : '대표 칭호로 장착', () => onEquip(id), equipped === id ? 'kingdom-equipped' : '', `data-equip-title="${id}" ${equipped === id ? 'disabled' : ''}`) : ''}</li>`;
  }).join('')}</ol></section>`).join('')}</div>`;
}
