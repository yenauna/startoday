import * as C from '../core.js';
import { esc, btn } from '../shared/ui.js';
export function kingdomCards(counts, equipped, onEquip = null, config = {}, student = null) {
  return `<div class="kingdom-catalog">${C.kingdomCatalog(counts, config).map(d => `<section class="kingdom-domain" data-kingdom-domain="${d.id}"><h3>${d.icon} ${esc(d.label)}</h3><strong>${esc(d.current)}</strong><small>칭찬 ${d.count}회 · ${d.stage}/3단계</small><progress max="${d.next || d.thresholds[2]}" value="${Math.min(d.count, d.next || d.thresholds[2])}" aria-label="${esc(d.label)} 칭찬 진행도"></progress><p>${d.next === null ? '최고 단계에 도달했어요!' : '다음 단계까지 칭찬 ' + d.remaining + '회 남았어요!'}</p><ol>${d.titles.map((name, i) => {
    const id = d.id + ':' + (i + 1),
      unlocked = d.count >= d.thresholds[i];
    return `<li class="${unlocked ? 'is-unlocked' : 'is-locked'}"><span>${unlocked ? '✨' : '🔒'} ${esc(name)} <small>${d.thresholds[i]}회</small></span>${unlocked && onEquip ? btn(equipped === id ? '장착 중' : '대표 칭호로 장착', () => onEquip(id), equipped === id ? 'kingdom-equipped' : '', `data-equip-title="${id}" ${equipped === id ? 'disabled' : ''}`) : ''}</li>`;
  }).join('')}</ol></section>`).join('')}</div>${C.studentRewardTitles(student).length ? `<section class="quest-reward-collection"><h3>🏅 퀘스트 보상 칭호</h3>${C.studentRewardTitles(student).map(t => `<div>${esc(t.name)} ${onEquip ? btn(equipped === t.id ? '장착 중' : '대표 칭호로 장착', () => onEquip(t.id), '', `data-equip-title="${esc(t.id)}" ${equipped === t.id ? 'disabled' : ''}`) : ''}</div>`).join('')}</section>` : ''}`;
}
