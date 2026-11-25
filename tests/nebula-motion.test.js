import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const css = readFileSync(path.join(root, 'css/nebula.css'), 'utf8');

const skyAnimations = [...css.matchAll(/animation:\s*(sky-[a-z-]+)\s+(\d+(?:\.\d+)?)s/g)]
  .map(([, name, seconds]) => ({name, seconds: Number(seconds)}));

test('배경 하늘 레이어가 10~15초 고리 애니메이션으로 눈에 보이게 흐른다', () => {
  // 기준층·라벤더·로즈·빛무리·빛무리 층·꽃무리 3개가 모두 움직인다
  const names = new Set(skyAnimations.map(a => a.name));
  for (const name of ['sky-breathe', 'sky-drift-lavender', 'sky-drift-rose', 'sky-drift-glow', 'sky-orbits-drift',
    'sky-bloom-drift-a', 'sky-bloom-drift-b', 'sky-bloom-drift-c']) {
    assert.ok(names.has(name), name);
  }
  // 21~29초처럼 다시 정지 화면처럼 느껴질 만큼 느리지 않게 10~15초로 당긴다
  for (const {name, seconds} of skyAnimations) {
    assert.ok(seconds >= 10 && seconds <= 15, `${name} ${seconds}s`);
  }
});

test('배경 애니메이션은 끊김 없이 이어지고 레이아웃이 아닌 합성 값만 움직인다', () => {
  const keyframes = [...css.matchAll(/@keyframes (sky-[a-z-]+)\s*\{([\s\S]*?)\n  \}/g)];
  assert.ok(keyframes.length >= 8, String(keyframes.length));
  for (const [, name, body] of keyframes) {
    // 0%와 100%를 같은 값으로 두어 다시 시작할 때 튀지 않는다
    assert.match(body, /0%, 100%\s*\{/, name);
    // background-position·left·top을 애니메이션하면 레이아웃/페인트를 다시 하게 된다
    assert.ok(!/background-position/.test(body), `${name} background-position`);
    assert.ok(!/(?:^|[;{\s])(?:left|top|width|height)\s*:/.test(body), `${name} layout property`);
    // transform·translate·scale만 쓴다
    assert.ok(/transform:|translate:/.test(body), name);
  }
});

test('움직임을 줄이기 설정에서는 하늘 배경이 완전히 멈춘다', () => {
  const reduce = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n  \}/)[1];
  for (const selector of ['.sky-light', '.sky-orbits', '.sky-light::before', '.sky-orbits::before', '.sky-orbits::after', '.sky-bloom:nth-child(n)']) {
    assert.ok(reduce.includes(selector), selector);
  }
  assert.match(reduce, /animation: none;/);
});

test('하늘 팔레트는 밝은 맑은 파스텔로, 회색기 도는 회청색은 남기지 않는다', () => {
  // 맑은 바탕과 라벤더·하늘·로즈·페리윙클·피치가 함께 있다
  for (const color of ['#F0F6FD', '#D8CBF3', '#D3E6FB', '#F8D7E3', '#D6D6F5', '#FBDCD4', '#D2CBF2', '#FBDCCF']) {
    assert.ok(css.includes(color), color);
  }
  // 먹구름처럼 보이던 어두운 더스티 블루·회청색은 걷어냈다
  for (const color of ['#9BAFCB', '#B8C9DF', '#C4D2E3', '#C2D1E5', '#CDD3E7']) {
    assert.ok(!css.includes(color), color);
  }
  // 원색·다크 테마로 흐르지 않게 하늘 레이어는 모두 아주 밝은 톤만 쓴다(평균 205 이상)
  const sky = css.slice(css.indexOf('  .sky-light {'), css.indexOf('Neutral reading surfaces'));
  const colors = sky.match(/#[0-9A-F]{6}/gi) || [];
  assert.ok(colors.length >= 20, String(colors.length));
  for (const hex of colors) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    assert.ok((r + g + b) / 3 >= 205, `${hex} is too dark or murky for the clear daylight sky`);
  }
  // 색상(hue)이 보라·파랑·분홍 세 갈래로 나뉘어 파란빛만 가득해 보이지 않는다
  const hue = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const hues = colors.map(hue);
  assert.ok(hues.some(h => h >= 240 && h <= 285), 'lavender/periwinkle hue');
  assert.ok(hues.some(h => h >= 195 && h <= 235), 'sky blue hue');
  assert.ok(hues.some(h => h >= 320 || h <= 20), 'rose/peach hue');
});

test('하늘 색 덩어리는 화면보다 넓게 깔려 움직여도 경계가 보이지 않는다', () => {
  const lavender = css.match(/\.sky-light::before \{([\s\S]*?)\n  \}/)[1];
  const rose = css.match(/\.sky-orbits::before \{([\s\S]*?)\n  \}/)[1];
  const light = css.match(/\.sky-light \{([\s\S]*?)\n  \}/)[1];
  for (const [name, block] of [['lavender', lavender], ['rose', rose]]) {
    // 안쪽으로 줄이지 않고 바깥으로 넓게 잡는다
    assert.match(block, /inset: -\d+% -\d+%;/, name);
    // 가장자리는 투명으로 흘린다
    assert.match(block, /radial-gradient/, name);
    assert.match(block, /00 7\d%\)/, `${name} fade to transparent`);
    // 화면 가운데도 비지 않도록 안쪽을 지나는 덩어리를 하나 더 둔다
    assert.ok((block.match(/radial-gradient/g) || []).length >= 4, `${name} inner blob`);
  }
  // 기준층은 12% 넓혀 고정해 두어 옆으로 흘러도 가장자리가 비지 않는다
  assert.match(light, /scale: 1\.12;/);
  assert.ok(!/scale/.test(css.match(/@keyframes sky-breathe \{([\s\S]*?)\n  \}/)[1]), 'scale should stay static');
});

test('필름 그레인은 맑은 하늘을 흐리지 않게 아주 옅게만 남는다', () => {
  const grain = css.match(/\.sky-light::after \{([\s\S]*?)\n  \}/)[1];
  const opacity = Number('0.' + grain.match(/opacity: \.(\d+)/)[1]);
  assert.ok(opacity >= 0.025 && opacity <= 0.035, String(opacity));
  assert.match(grain, /feTurbulence/);
});

test('카드 유리는 뒤 배경이 비치는 맑은 흰빛 리퀴드글래스이고 미완료 카드는 맑은 핑크 틴트다', () => {
  // 흰 유리 불투명도는 24~48%: 뒤의 파스텔 하늘이 카드 안으로 은은하게 비쳐 보인다
  assert.match(css, /--nebula-glass: linear-gradient\(135deg, #FFFFFF7A 0%, #FFFFFF3D 55%, #FFFFFF6B 100%\)/);
  for (const hex of ['7A', '3D', '6B']) {
    const alpha = parseInt(hex, 16) / 255;
    assert.ok(alpha >= 0.2 && alpha <= 0.5, `${hex} glass should stay see-through`);
  }
  // 표·설정처럼 읽기 전용 패널은 가독성을 위해 조금 더 불투명한 유리를 그대로 쓴다
  assert.match(css, /--nebula-reading-glass: linear-gradient\(145deg, #FFFFFFF0, #F4F9FFD9\)/);
  // 미완료 카드: 회색기 없는 맑은 핑크 그라디언트, 불투명도 42~52%
  const unfinished = css.match(/\.unfinished:not\(\.excluded\) \{\n([\s\S]*?)\n  \}/)[1];
  assert.match(unfinished, /background: linear-gradient\(150deg, rgba\(255, 224, 238, \.52\) 0%, rgba\(255, 200, 220, \.42\) 58%, rgba\(255, 190, 214, \.46\) 100%\) !important;/);
  const gradient = unfinished.match(/background: (linear-gradient\(150deg,[^;]*?\)) !important;/)[1];
  const stops = [...gradient.matchAll(/rgba\((\d+), (\d+), (\d+), \.(\d+)\)/g)];
  assert.equal(stops.length, 3);
  for (const stop of stops) {
    const [r, g, b] = [1, 2, 3].map(i => Number(stop[i]));
    const alpha = Number('0.' + stop[4]);
    assert.ok(r >= 250 && r > b && b > g, `${stop[0]} should be a clear pink, not a murky tint`);
    assert.ok(alpha >= 0.42 && alpha <= 0.52, `${stop[0]} should let the background show through`);
  }
});
