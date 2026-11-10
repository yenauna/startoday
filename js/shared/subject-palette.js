export const SUBJECT_MOODS = Object.freeze([['라벤더 퍼플', '#EEEAF8'], ['세이지 그린', '#E9F0E7'], ['코랄 핑크', '#FBE8E4'], ['버터 옐로우', '#FBF2D8'], ['더스티 로즈', '#F3E6EC'], ['소프트 스카이', '#E7F2F8'], ['모카 베이지', '#F2EBE3'], ['민트 아쿠아', '#E4F3F0'], ['살구 크림', '#FBEBDD'], ['페리윙클', '#E9ECFA']].map(([name, background]) => Object.freeze({
  name,
  background
})));
function paletteRgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw Error('6자리 HEX 색상을 입력하세요.');
  return hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
}
export function paletteContrast(a, b) {
  const l = hex => {
    const [r, g, b] = paletteRgb(hex).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const x = l(a),
    y = l(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function smartSubjectAccents(background) {
  const [r, g, b] = paletteRgb(background),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = d === 0 ? 210 : max === r ? (g - b) / d % 6 * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  h = (h + 360) % 360;
  const saturation = Math.max(.28, Math.min(.62, d / (1 - Math.abs(max + min - 1)) || .28));
  const hex = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(h / 60 % 2 - 1)),
      m = l - c / 2;
    const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + rgb.map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  };
  const dark = paletteContrast(background, '#000000') >= paletteContrast(background, '#ffffff');
  let low = dark ? 0 : .5,
    high = dark ? .5 : 1;
  for (let i = 0; i < 24; i++) {
    const middle = (low + high) / 2,
      ok = paletteContrast(background, hex(h, saturation, middle)) >= 4.65;
    if (dark) {
      if (ok) low = middle;else high = middle;
    } else {
      if (ok) high = middle;else low = middle;
    }
  }
  const boundary = dark ? low : high;
  return [0, 1, 2].map(i => hex(h, saturation, dark ? boundary < .04 ? boundary * [0, .5, 1][i] : Math.min([.27, .34, .41][i], boundary * [.58, .79, 1][i]) : boundary + (1 - boundary) * [.12, .45, .78][i]));
}
