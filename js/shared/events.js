import { state } from './state.js';
import { $, run } from './ui.js';
export function installGlobalEvents() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (b) {
      e.stopPropagation();
      run(() => state.actions.get(b.dataset.action)?.(e));
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !$('#modal').open && !state.locked) {
      e.preventDefault();
      $('#quick-text')?.focus();
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.student[data-action]')) {
      e.preventDefault();
      run(() => state.actions.get(e.target.dataset.action)?.(e));
    }
  });
}
