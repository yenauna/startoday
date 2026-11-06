import { $, btn, esc, toast } from '../shared/ui.js';
export function closeModal() {
  $('#modal').close();
  $('#modal').innerHTML = '';
}
export function modal(title, body, onSubmit = null, save = '저장') {
  const el = $('#modal');
  el.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2>${btn('닫기', closeModal)}</div><div class="dialog-body">${onSubmit ? '<form id="modal-form">' : ''}${body}${onSubmit ? `<div class="dialog-foot">${btn('취소', closeModal)}<button class="primary" type="submit">${save}</button></div></form>` : ''}</div>`;
  if (!el.open) el.showModal();
  if (onSubmit) {
    $('#modal-form').onsubmit = async e => {
      e.preventDefault();
      const f = e.currentTarget;
      if (!f.reportValidity()) return;
      const data = new FormData(f);
      f.querySelector('[type=submit]').disabled = true;
      try {
        await onSubmit(data, f);
      } catch (err) {
        toast(err.message);
      } finally {
        if (f.isConnected) f.querySelector('[type=submit]').disabled = false;
      }
    };
  }
  return el;
}
