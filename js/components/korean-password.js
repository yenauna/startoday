import { esc, toast } from '../shared/ui.js';
export function koreanPasswordField(label, key, value = '', attrs = '') {
  return `<label>${esc(label)}<span class="korean-password-field"><input name="${esc(key)}" type="password" value="${esc(value)}" lang="ko" data-korean-password maxlength="200" autocapitalize="off" spellcheck="false" ${attrs}><button type="button" class="password-visibility" data-password-label="${esc(label)}" aria-label="${esc(label)} 보기" aria-pressed="false">👁️</button></span></label>`;
}
export function bindKoreanPasswordFields(root) {
  for (const field of root?.querySelectorAll('[data-korean-password]') || []) {
    if (field.dataset.passwordBound) continue;
    field.dataset.passwordBound = 'true';
    let composing = false;
    const alert = () => toast('비밀번호는 한글과 숫자로만 입력할 수 있습니다');
    const sanitize = () => {
      const previous = field.value,
        start = field.selectionStart;
      const value = previous.replace(/[^가-힣0-9]/g, '');
      if (previous === value) return;
      field.value = value;
      if (start != null) {
        const caret = previous.slice(0, start).replace(/[^가-힣0-9]/g, '').length;
        field.setSelectionRange(caret, caret);
      }
      alert();
    };
    field.addEventListener('compositionstart', () => {
      composing = true;
    });
    field.addEventListener('compositionend', () => {
      composing = false;
      setTimeout(sanitize, 0);
    });
    field.addEventListener('beforeinput', e => {
      if (!composing && !e.isComposing && e.data && /[a-zA-Z]/.test(e.data)) {
        e.preventDefault();
        alert();
      }
    });
    field.addEventListener('input', e => {
      if (!composing && !e.isComposing) sanitize();
    });
    field.addEventListener('change', () => {
      if (!composing) sanitize();
    });
    const toggle = field.parentElement.querySelector('.password-visibility');
    toggle.onclick = () => {
      const show = field.type === 'password';
      field.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', toggle.dataset.passwordLabel + ' ' + (show ? '숨기기' : '보기'));
    };
  }
}
