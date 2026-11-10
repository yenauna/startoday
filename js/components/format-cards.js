import * as C from '../core.js';
// DOM-only, scoped popovers preserve the editor range and never create nested dialogs.
export function createFormatCards({
  onSize,
  onColor,
  beforeOpen = () => {}
}) {
  const root = document.createElement('span');
  root.className = 'format-card-tools';
  for (const [kind, label, values, apply] of [['size', '글자 크기', [16, 20, 24, 32, 40, 48, 64].map(n => ({
    label: n + 'pt',
    value: String(n)
  })), onSize], ['color', '글자 색상', C.TEXT_COLOR_CARDS.map(c => ({
    label: c.name,
    value: c.color
  })), onColor]]) {
    const toggle = document.createElement('button'),
      panel = document.createElement('div');
    toggle.type = 'button';
    toggle.textContent = label;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');
    panel.className = 'format-card-picker ' + kind + '-card-picker';
    panel.setAttribute('aria-label', label + ' 선택');
    panel.setAttribute('popover', 'auto');
    const native = typeof panel.showPopover === 'function';
    if (!native) {
      panel.removeAttribute('popover');
      panel.hidden = true;
    }
    const close = () => {
      if (native && panel.matches(':popover-open')) panel.hidePopover();
      if (!native) {
        panel.removeAttribute('popover');
        panel.hidden = true;
      }
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.onclick = () => {
      beforeOpen();
      if (native && panel.matches(':popover-open') || !native && !panel.hidden) {
        close();
        return;
      }
      const rect = toggle.getBoundingClientRect();
      panel.style.left = Math.min(rect.left, Math.max(8, innerWidth - 220)) + 'px';
      panel.style.top = Math.min(rect.bottom + 6, Math.max(8, innerHeight - 250)) + 'px';
      if (native) panel.showPopover();else panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    };
    if (native) panel.addEventListener('toggle', () => toggle.setAttribute('aria-expanded', String(panel.matches(':popover-open'))));
    for (const item of values) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.setAttribute('aria-label', item.label);
      chip.title = item.label;
      chip.dataset.formatValue = item.value;
      if (kind === 'color') {
        chip.className = 'format-color-card';
        chip.style.setProperty('--chip-color', item.value);
        chip.innerHTML = '<span aria-hidden="true"></span>';
      } else chip.textContent = item.label;
      chip.onpointerdown = e => e.preventDefault();
      chip.onclick = () => {
        apply(item.value);
        close();
      };
      panel.append(chip);
    }
    toggle.onpointerdown = e => {
      beforeOpen();
      e.preventDefault();
    };
    root.append(toggle, panel);
  }
  return root;
}
