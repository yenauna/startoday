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
export const input = (label, key, value = '', type = 'text', attrs = '') => `<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
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
  return new Date(s).toLocaleString('sv-SE', {
    timeZone: 'Asia/Seoul'
  });
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
