import { $, btn, esc, toast } from '../shared/ui.js';
export function closeModal() {
  $('#modal').close();
  $('#modal').innerHTML = '';
}

/**
 * 모달 상자는 머리(고정) - 본문(스크롤) - 하단 줄(고정) 세 칸으로 나눈다.
 * 하단 줄은 본문 스크롤 영역 밖에 두어 어떤 창에서도 마지막 입력 칸을 덮지 않는다.
 * - onSubmit: 있으면 `#modal-form`(또는 options.formId) 폼이 본문과 하단 줄을 감싸고 취소·저장 버튼이 붙는다.
 * - options.footer: 저장 없이 버튼만 하단에 고정할 때 쓴다(예: 기록 쓰기, 가져오기).
 * - options.formId: 이미 폼을 쓰는 창의 폼 id를 그대로 감싸 하단 줄을 폼 안에 둔다.
 */
export function modal(title, body, onSubmit = null, save = '저장', footerStart = '', options = {}) {
  const el = $('#modal');
  const footHtml = onSubmit
    ? `${footerStart ? `<div class="dialog-foot-start">${footerStart}</div>` : ''}${btn('취소', closeModal)}<button class="primary" type="submit">${save}</button>`
    : options.footer || '';
  const content = `<div class="dialog-body">${body}</div>${footHtml ? `<div class="dialog-foot">${footHtml}</div>` : ''}`;
  const formId = options.formId || (onSubmit ? 'modal-form' : '');
  el.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2>${btn('닫기', closeModal)}</div>${formId ? `<form id="${formId}" class="dialog-form">${content}</form>` : content}`;
  if (!el.open) el.showModal();
  if (onSubmit) {
    const form = document.getElementById(formId);
    form.onsubmit = async e => {
      e.preventDefault();
      const f = e.currentTarget;
      if (!f.reportValidity()) return;
      const data = new FormData(f);
      const submit = f.querySelector('[type=submit]');
      if (submit) submit.disabled = true;
      try {
        await onSubmit(data, f);
      } catch (err) {
        toast(err.message);
      } finally {
        if (submit?.isConnected) submit.disabled = false;
      }
    };
  }
  return el;
}
