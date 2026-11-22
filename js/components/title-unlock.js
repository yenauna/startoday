import {icon} from './icons.js';
import * as C from '../core.js';
import { revealCards } from '../shared/card-reveal.js';

let activeScope = '', seen = new Set(), notice = null, cancel = null;
export function clearTitleUnlock() {
  cancel?.();
  cancel = null;
  notice?.remove();
  notice = null;
  activeScope = '';
  seen = new Set();
}
// First snapshot is a baseline: opening the codex/login never replays old rewards.
export function syncTitleUnlock(snapshot, scope) {
  const titles = [
    ...C.kingdomCatalog(snapshot.titleCounts, snapshot.titleConfig).flatMap(d => d.unlocked),
    ...C.studentRewardTitles(snapshot.student)
  ];
  if (scope !== activeScope) {
    clearTitleUnlock();
    activeScope = scope;
    seen = new Set(titles.map(t => t.id));
    return;
  }
  const added = titles.filter(t => !seen.has(t.id));
  titles.forEach(t => seen.add(t.id));
  if (!added.length) return;
  cancel?.();
  notice?.remove();
  const card = document.createElement('aside');
  card.className = 'title-unlock-card';
  card.setAttribute('aria-label', '칭호 해금 알림');
  const message = document.createElement('p');
  message.className = 'title-unlock-message';
  message.setAttribute('role', 'status');
  message.textContent = '새 칭호가 열리고 있어요';
  const title = document.createElement('strong');
  title.className = 'title-unlock-name';
  title.textContent = '✦';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'title-unlock-close';
  close.innerHTML = icon('close');
  close.title = '닫기';
  close.setAttribute('aria-label', '닫기');
  close.onclick = () => {
    cancel?.();
    cancel = null;
    card.remove();
    if (notice === card) notice = null;
  };
  card.append(message, title, close);
  document.body.append(card);
  notice = card;
  cancel = revealCards([card], () => {
    title.textContent = added.map(t => t.name).join(' · ');
    message.textContent = added.length > 1 ? `새 칭호 ${added.length}개를 얻었어요!` : '새 칭호를 얻었어요!';
  }, () => { cancel = null; }, true);
}
