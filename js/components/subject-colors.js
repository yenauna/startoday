import { SUBJECT_MOODS, smartSubjectAccents, paletteContrast } from '../shared/subject-palette.js';
export function subjectPaletteFields() {
  return '<div class="span2 subject-mood-palette"><strong>교실 감성 추천 색상</strong><div class="subject-mood-chips"></div><small>배경색을 고르면 어울리는 포인트색 3가지를 추천합니다.</small><div class="subject-accent-pairs" aria-label="추천 포인트색"></div></div>';
}
export function bindSubjectPalette(form, onChange) {
  const holder = form.querySelector('.subject-mood-chips'),
    pairs = form.querySelector('.subject-accent-pairs');
  if (!holder || !pairs) return;
  const update = () => {
    pairs.replaceChildren();
    for (const color of smartSubjectAccents(form.elements.color.value)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'subject-accent-chip';
      b.style.background = color;
      b.style.color = paletteContrast(color, '#ffffff') >= 4.5 ? '#fff' : '#172033';
      b.textContent = color.toUpperCase();
      b.setAttribute('aria-label', '추천 포인트색 ' + color);
      b.onclick = () => {
        form.elements.accentColor.value = color;
        onChange();
      };
      pairs.append(b);
    }
  };
  for (const mood of SUBJECT_MOODS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'subject-mood-chip';
    b.style.background = mood.background;
    b.style.color = smartSubjectAccents(mood.background)[0];
    b.textContent = mood.name;
    b.onclick = () => {
      form.elements.color.value = mood.background;
      onChange();
      update();
    };
    holder.append(b);
  }
  form.elements.color.addEventListener('input', update);
  update();
  return update;
}
