import * as C from '../core.js';
import { state } from './state.js';
export const {
  $,
  esc
} = {
  $: s => document.querySelector(s),
  esc: C.esc
};
export const btn = (label, fn, cls = '', attrs = '') => {
  const id = String(++state.actionNo);
  state.actions.set(id, fn);
  return `<button type="button" class="${cls}" data-action="${id}" ${attrs}>${label}</button>`;
};
export const badge = x => `<span class="badge">${esc(x)}</span>`;
export const empty = (title, desc = '') => `<div class="empty"><h3>${esc(title)}</h3>${esc(desc)}</div>`;
export const opts = (values, value) => values.map(v => {
  const [key, label] = Array.isArray(v) ? v : [v, v];
  return `<option value="${esc(key)}" ${String(value) === String(key) ? 'selected' : ''}>${esc(label)}</option>`;
}).join('');
export const input = (label, key, value = '', type = 'text', attrs = '') => `<label>${label}${type === 'date' ? dateField(value, `name="${esc(key)}" aria-label="${esc(label)}" ${attrs}`) : `<input name="${key}" type="${type}" value="${esc(value)}" ${attrs}>`}</label>`;
export function dateField(value, attrs = '') {
  return `<span class="date-control"><span class="date-display" aria-hidden="true">${esc(C.formatDate(value)) || '날짜 선택'}</span><input type="date" value="${esc(value)}" ${attrs}></span>`;
}
for (const type of ['input', 'change']) document.addEventListener(type, e => {
  if (e.target.matches?.('.date-control input[type=date]')) e.target.parentElement.querySelector('.date-display').textContent = C.formatDate(e.target.value) || '날짜 선택';
});
export const select = (label, key, values, value = '') => `<label>${label}<select name="${key}">${opts(values, value)}</select></label>`;
export const textarea = (label, key, value = '') => `<label>${label}<textarea name="${key}">${esc(value)}</textarea></label>`;
export const checkbox = (label, key, value = false) => `<label class="inline"><input type="checkbox" name="${key}" ${value ? 'checked' : ''}>${label}</label>`;
export const multiple = (list, key, values = []) => `<div class="checkgrid">${list.map(([id, label]) => `<label class="inline"><input type="checkbox" name="${key}" value="${esc(id)}" ${values.includes(id) ? 'checked' : ''}>${esc(label)}</label>`).join('')}</div>`;
export function toast(message) {
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('#toast').style.display = 'none', 6500);
}
export async function run(fn) {
  try {
    await fn();
  } catch (e) {
    toast(e.message || String(e));
    console.error(e);
  }
}
export function bindLater(id, event, fn) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, e => run(() => fn(e)));
  }, 0);
  return '';
}
export function localTime(s) {
  return C.formatTimestamp(s);
}
export async function hashPin(pin) {
  if (!crypto.subtle) throw Error('교실 비밀번호는 HTTPS 또는 localhost 접속에서 설정하세요.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('startoday-classroom:' + pin));
  return Array.from(new Uint8Array(bytes)).map(x => x.toString(16).padStart(2, '0')).join('');
}
export function saveFile(name, data, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], {
      type
    })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const undoButtons = new Map();
export function registerUndo(button, available = () => true) {
  undoButtons.set(button, available);
  return () => undoButtons.delete(button);
}
export function triggerToastUndo(event) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || String(event.key).toLowerCase() !== 'z') return false;
  if (state.locked || state.viewMode === 'student' || event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return false;
  for (const [button, available] of [...undoButtons].reverse()) {
    if (!button.isConnected) {
      undoButtons.delete(button);
      continue;
    }
    if (!button.disabled && available() && button.getClientRects().length) {
      event.preventDefault();
      button.click();
      return true;
    }
  }
  return false;
}
export function undoToast(message, undo, available = () => true, actionLabel = '실행취소') {
  const root = document.createElement('div'),
    label = document.createElement('span'),
    button = document.createElement('button');
  root.className = 'routine-undo memo-undo';
  root.setAttribute('role', 'status');
  label.textContent = message;
  button.type = 'button';
  root.append(label, button);
  document.body.append(root);
  const deadline = performance.now() + 5000;
  let timer, unregister;
  const close = () => {
    clearInterval(timer);
    unregister?.();
    root.remove();
  };
  button.onclick = () => run(async () => {
    if (performance.now() >= deadline || !available()) return close();
    button.disabled = true;
    try {
      await undo();
      close();
    } finally {
      button.disabled = false;
    }
  });
  unregister = registerUndo(button, () => performance.now() < deadline && available());
  const tick = () => {
    if (performance.now() >= deadline || !available() || state.locked || state.viewMode === 'student') return close();
    button.textContent = `↩ ${actionLabel} (${Math.ceil((deadline - performance.now()) / 1000)}초)`;
  };
  tick();
  timer = setInterval(tick, 100);
  return close;
}
