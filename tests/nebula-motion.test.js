import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const css = readFileSync(path.join(root, 'css/nebula.css'), 'utf8');

const skyAnimations = [...css.matchAll(/animation:\s*(sky-[a-z-]+)\s+(\d+(?:\.\d+)?)s/g)]
  .map(([, name, seconds]) => ({name, seconds: Number(seconds)}));

test('배경 하늘 레이어가 20~30초 고리 애니메이션으로 눈에 보이게 흐른다', () => {
  // 기준층·라벤더·로즈·빛무리·빛무리 층·꽃무리 3개가 모두 움직인다
  const names = new Set(skyAnimations.map(a => a.name));
  for (const name of ['sky-breathe', 'sky-drift-lavender', 'sky-drift-rose', 'sky-drift-glow', 'sky-orbits-drift',
    'sky-bloom-drift-a', 'sky-bloom-drift-b', 'sky-bloom-drift-c']) {
    assert.ok(names.has(name), name);
  }
  // 34~79초처럼 너무 느리지도, 12초처럼 빠르지도 않게 20~30초에 맞춘다
  for (const {name, seconds} of skyAnimations) {
    assert.ok(seconds >= 20 && seconds <= 30, `${name} ${seconds}s`);
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

test('하늘 팔레트는 미스티 블루를 유지하며 라벤더·로즈를 한 겹 더한다', () => {
  // 기존 미스티 블루 여섯 방향 색과 바탕색은 그대로 남아 있다
  for (const color of ['#9BAFCB', '#B8C9DF', '#CED9E8', '#C4D2E3', '#CDD3E7', '#EAE2E3', '#D5DFEB']) {
    assert.ok(css.includes(color), color);
  }
  // 새로 더한 저채도 보랏빛·로즈·피치
  for (const color of ['#BFB3DF', '#D4CAEA', '#BAB0D6', '#F0D4CA', '#EBCFD1', '#C3BBDF']) {
    assert.ok(css.includes(color), color);
  }
  // 원색·다크 테마로 흐르지 않게 하늘 레이어에는 밝은 톤만 쓴다
  const sky = css.slice(css.indexOf('  .sky-light {'), css.indexOf('Neutral reading surfaces'));
  for (const hex of sky.match(/#[0-9A-F]{6}/gi) || []) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    assert.ok((r + g + b) / 3 >= 150, `${hex} is too dark for the daylight sky`);
  }
});

test('하늘 색 덩어리는 화면보다 넓게 깔려 움직여도 경계가 보이지 않는다', () => {
  const layer = (selector) => css.match(new RegExp(`\\${selector} \\{([\\s\\S]*?)\\n  \\}`))[1];
  const lavender = css.match(/\.sky-light::before \{([\s\S]*?)\n  \}/)[1];
  const rose = css.match(/\.sky-orbits::before \{([\s\S]*?)\n  \}/)[1];
  const light = css.match(/\.sky-light \{([\s\S]*?)\n  \}/)[1];
  for (const [name, block] of [['lavender', lavender], ['rose', rose]]) {
    // 안쪽으로 줄이지 않고 바깥으로 넓게 잡는다
    assert.match(block, /inset: -\d+% -\d+%;/, name);
    // 가장자리는 투명으로 흘린다
    assert.match(block, /radial-gradient/, name);
    assert.match(block, /00 7\d%\)/, `${name} fade to transparent`);
  }
  // 기준층은 10% 넓혀 고정해 두어 옆으로 흘러도 가장자리가 비지 않는다
  assert.match(light, /scale: 1\.1;/);
  assert.ok(!/scale/.test(css.match(/@keyframes sky-breathe \{([\s\S]*?)\n  \}/)[1]), 'scale should stay static');
  void layer;
});
