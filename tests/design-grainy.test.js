import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const page = readFileSync(path.join(root, 'design-preview.html'), 'utf8');
const tab = readFileSync(path.join(root, 'js/tabs/design-preview.js'), 'utf8');

const heap = page.replace(/\s+/g, ' ');

test('디자인 시안에 그레이니 그라디언트 3안(배경만·히어로만·둘 다)이 있다', () => {
  for (const theme of ['grainy-bg', 'grainy-hero', 'grainy-both']) {
    assert.match(page, new RegExp(`data-theme-choice="${theme}"`), theme);
  }
  assert.match(page, /data-theme-choice="grainy-bg" aria-pressed="false">5안: 그레이니\(배경만\)/);
  assert.match(page, /data-theme-choice="grainy-hero" aria-pressed="false">6안: 그레이니\(히어로만\)/);
  assert.match(page, /data-theme-choice="grainy-both" aria-pressed="false">7안: 그레이니\(둘 다\)/);
  for (const theme of ['grainy-bg', 'grainy-hero', 'grainy-both']) {
    assert.ok(tab.includes(`theme('${theme}'`), theme);
  }
  // 기존 네 테마는 그대로 남아 있다
  for (const theme of ['sky', 'sky-stars', 'nebula', 'watercolor']) {
    assert.match(page, new RegExp(`data-theme-choice="${theme}"`), theme);
  }
});

test('기존 배경 그림을 움직이게 한 8안·9안이 있다', () => {
  // 8안: 파스텔 은하수(움직임), 9안: 새벽하늘 구름(움직임)
  assert.match(page, /data-theme-choice="nebula-motion" aria-pressed="false">8안: 파스텔 은하수\(움직임\)/);
  assert.match(page, /data-theme-choice="watercolor-motion" aria-pressed="false">9안: 새벽하늘 구름\(움직임\)/);
  for (const theme of ['nebula-motion', 'watercolor-motion']) {
    assert.ok(tab.includes(`theme('${theme}'`), theme);
    assert.match(page, new RegExp(`body:is\\(\\[data-theme="nebula-motion"\\], \\[data-theme="watercolor-motion"\\]\\) \\.sky-art \\{ opacity:1; \\}`));
  }
  // 두 8·9안은 기존 3안·4안과 같은 그림을 쓴다
  assert.match(page, /body\[data-theme="nebula-motion"\] \{ --sky-art:url\("assets\/bg-pastel-nebula.webp"\); \}/);
  assert.match(page, /body\[data-theme="watercolor-motion"\] \{\s*--sky-art:url\("assets\/bg-watercolor-stars.webp"\);\s*--sky-art-position:68% top;\s*\}/);
  // 움직이는 그림 레이어가 문서에 한 번 들어 있다
  assert.equal(page.match(/class="sky-art"/g).length, 1);
});

test('그레이니 배경은 배경만/둘 다에서만, 히어로 그레인은 히어로만/둘 다에서만 보인다', () => {
  assert.match(page, /body:is\(\[data-theme="grainy-bg"\], \[data-theme="grainy-both"\]\) \.sky-grainbg \{ opacity:1; \}/);
  assert.match(page, /body:is\(\[data-theme="grainy-hero"\], \[data-theme="grainy-both"\]\) \.hero-grain \{ opacity:1; \}/);
  // 히어로만일 때는 앱 배경이 정적 단색이어야 하므로 기존 하늘 레이어를 숨긴다
  assert.match(page, /body:is\(\[data-theme="grainy-bg"\], \[data-theme="grainy-hero"\], \[data-theme="grainy-both"\]\) :is\(\.sky-light, \.sky-orbits\) \{ display:none; \}/);
  // 교사·학생 두 화면 모두 히어로 카드에 그레인 레이어를 가진다
  assert.equal(page.match(/class="hero-grain"/g).length, 2);
});

test('히어로의 동심원 과녁 궤도를 완전히 걷어내고 자유 좌표 별자리로 바꿨다', () => {
  // 궤도 원·십자축·옛 그리기 함수가 남아 있으면 안 된다
  assert.ok(!/\.orbit\s*\{/.test(page), 'orbit rule');
  assert.ok(!/orbit-axis/.test(page), 'orbit axis');
  assert.ok(!/drawConstellation/.test(page), 'old draw function');
  assert.ok(!/class="orbit"/.test(page), 'orbit node');
  // 교사·학생 히어로 모두 별가루 레이어와 별자리 레이어를 가진다
  assert.equal(page.match(/class="hero-sky"/g).length, 2);
  assert.equal(page.match(/class="hero-constellation"/g).length, 2);
  assert.match(page, /\.constellation-line \{ fill:none; stroke:#D4B06A;/);
  assert.match(page, /\.constellation-halo \{ fill:none; stroke:#F0D79A;/);
  // 별자리는 동심원이 아니라 자유 좌표를 금빛 선으로 잇는다
  assert.match(page, /const CONSTELLATIONS = \[/);
  assert.equal(page.match(/edges: \[\[0,1\]/g).length >= 3, true);
  assert.match(page, /function drawSparkle\(/);
  assert.match(page, /function drawDust\(/);
});

test('히어로 밤하늘은 보라를 뺀 딥 스페이스 팔레트를 쓴다', () => {
  for (const color of ['#0A1026', '#142B52', '#254A7A', '#5D7EA8', '#D4B06A', '#F0D79A', '#F8F6EE']) {
    assert.ok(page.includes(color), color);
  }
  // 히어로 그레인에서 보라 덩어리를 걷어냈다
  assert.ok(!/#7C60CD/i.test(page), 'purple blob');
  assert.ok(!/124, 96, 205/.test(page), 'purple rgba');
  assert.match(page, /background-color:#0A1026;/);
});

test('움직임은 10~13초 주기로 블롭이 10~16% 표류하고 노이즈는 고정이다', () => {
  const durations = [...page.matchAll(/animation:(grain-drift-[a-d]|hero-flow-[a-c]) (\d+(?:\.\d+)?)s/g)]
    .map(match => Number(match[2]));
  assert.equal(durations.length, 7);
  for (const seconds of durations) assert.ok(seconds >= 10 && seconds <= 13, String(seconds));

  // 키프레임마다 이동 폭이 10~16%다 (정지 화면처럼 보이지 않게)
  const moves = [...page.matchAll(/@keyframes (?:grain-drift|hero-flow)-[a-d] \{ from \{ transform:translate3d\((-?\d+(?:\.\d+)?)%, (-?\d+(?:\.\d+)?)%, 0\)[^}]*\} to \{ transform:translate3d\((-?\d+(?:\.\d+)?)%, (-?\d+(?:\.\d+)?)%/g)];
  assert.equal(moves.length, 7);
  for (const [, x1, y1, x2, y2] of moves) {
    assert.ok(Math.abs(Number(x2) - Number(x1)) >= 10, `x ${x1}->${x2}`);
    assert.ok(Math.abs(Number(y2) - Number(y1)) >= 10, `y ${y1}->${y2}`);
    assert.ok(Math.abs(Number(x2) - Number(x1)) <= 16 && Math.abs(Number(y2) - Number(y1)) <= 16);
  }

  // 노이즈·그레인 레이어에는 애니메이션을 걸지 않는다(지직거림 방지)
  const grainRules = [...page.matchAll(/\.(?:sky-grain-noise|sky-grainbg|hero-grain)(?:::after)? \{[^}]*\}/g)]
    .map(match => match[0]);
  assert.ok(grainRules.length >= 3);
  for (const rule of grainRules) assert.ok(!/animation:/.test(rule), rule);
});

test('8·9안 그림 레이어는 1.1배 이상 키워 14~16초 동안 대각선으로 표류한다', () => {
  const durations = [...page.matchAll(/animation:art-drift-(?:nebula|watercolor) (\d+(?:\.\d+)?)s/g)]
    .map(match => Number(match[1]));
  assert.equal(durations.length, 2);
  for (const seconds of durations) assert.ok(seconds >= 14 && seconds <= 16, String(seconds));
  // 화면 끝이 비지 않게 확대해 두고, 대각선으로 조금씩 움직인다
  assert.match(heap, /@keyframes art-drift-nebula \{ from \{ transform:scale\(1\.1\d*\) translate3d\(-?\d+(?:\.\d+)?%, -?\d+(?:\.\d+)?%, 0\); \} to \{ transform:scale\(1\.1\d*\)/);
  assert.match(heap, /@keyframes art-drift-watercolor \{ from \{ transform:scale\(1\.1\d*\)/);
  const scales = [...page.matchAll(/transform:scale\((\d+(?:\.\d+)?)\)/g)].map(match => Number(match[1]));
  assert.ok(scales.length >= 4);
  for (const value of scales) assert.ok(value >= 1.1, String(value));
});

test('prefers-reduced-motion에서 그레이니·배경 그림 애니메이션을 멈춘다', () => {
  assert.match(page, /@media \(prefers-reduced-motion:reduce\) \{\s*\.grain-blob, \.hero-grain span, \.sky-art, \.sky-dust\.is-twinkle \{ animation:none !important; \}\s*\}/);
});

/* ── 본 앱 히어로 적용(6안) ── */
const heroCss = readFileSync(path.join(root, 'css/nebula.css'), 'utf8');
const heroJs = readFileSync(path.join(root, 'js/components/constellation.js'), 'utf8');

test('본 앱 히어로가 6안의 밤하늘 팔레트와 그레인 층을 쓴다', () => {
  for (const color of ['#0A1026', '#16305C', '#D4B06A', '#F0D79A', '#F2DCA8', '#F8F6EE']) {
    assert.ok(heroCss.includes(color), color);
  }
  // 히어로 안쪽에만 그레인·별가루 층을 둔다
  assert.match(heroCss, /#app \.constellation-hero>\.hero-grain\{position:absolute;inset:0;z-index:0/);
  assert.match(heroCss, /#app \.constellation-hero>\.hero-grain span:nth-child\(4\)/);
  assert.match(heroCss, /#app \.constellation-hero>\.constellation-sky\{position:absolute;inset:0;z-index:0/);
  assert.match(heroCss, /#app \.constellation-hero>\.constellation-grain|#app \.constellation-hero>\.hero-grain::after\{/);
  // 별자리: 금빛 후광·연결선·점등 별
  assert.match(heroCss, /\.constellation-line\{fill:none;stroke:#D4B06A/);
  assert.match(heroCss, /\.constellation-halo\{fill:none;stroke:#F0D79A/);
  assert.match(heroCss, /\.constellation-map \.star-point\.is-lit\{fill:#F4DCA6/);
  assert.match(heroJs, /const CLASS_SKY = \[/);
  assert.match(heroJs, /class="hero-grain"/);
  assert.match(heroJs, /class="constellation-sky"/);
  assert.match(heroJs, /class="constellation-map" viewBox="0 0 380 200"/);
  assert.match(heroJs, /data-progress-done="\$\{complete\}"/);
});

test('하늘 움직임은 닫힌 고리로 이어지고 별가루도 따로 표류한다', () => {
  // 왕복(alternate) 대신 0%/100%가 같은 고리 키프레임이라 다시 시작할 때 끊기지 않는다
  for (const name of ['hero-flow-a', 'hero-flow-b', 'hero-flow-c', 'hero-flow-d', 'hero-band']) {
    assert.match(heroCss, new RegExp(`@keyframes ${name}\\{0%,100%\\{`), name);
  }
  // 주기는 12~24초로 당겨 정지 화면처럼 보이지 않게 한다
  const durations = [...heroCss.matchAll(/animation:hero-(?:flow-[a-d]|band) (\d+)s/g)].map(m => Number(m[1]));
  assert.equal(durations.length, 5);
  for (const seconds of durations) assert.ok(seconds >= 12 && seconds <= 24, String(seconds));
  // 이동 폭도 키워 넓고 낮은 교사 히어로에서 흐름이 보이게 한다.
  // 금빛 덩어리(hero-flow-c)는 히어로 색이 흔들리지 않게 작게만 움직인다.
  const span = (values) => Math.max(...values) - Math.min(...values);
  const movesOf = (name) => {
    const line = heroCss.split('\n').find(text => text.includes(`@keyframes ${name}{`));
    return [...line.matchAll(/translate3d\((-?\d+(?:\.\d+)?)%, ?(-?\d+(?:\.\d+)?)%/g)];
  };
  for (const name of ['hero-flow-a', 'hero-flow-b', 'hero-flow-c', 'hero-flow-d', 'hero-band']) {
    const moves = movesOf(name);
    assert.ok(moves.length >= 3, name);
    assert.ok(span(moves.map(m => Number(m[1]))) >= 12, `${name} x`);
    assert.ok(span(moves.map(m => Number(m[2]))) >= 12, `${name} y`);
  }
  for (const name of ['hero-flow-a', 'hero-flow-b']) {
    assert.ok(span(movesOf(name).map(m => Number(m[1]))) >= 20, `${name} x`);
  }
  // 금빛 덩어리는 파란 덩어리보다 덜 움직여 밤하늘 색이 한쪽으로 쏠리지 않는다
  assert.ok(span(movesOf('hero-flow-c').map(m => Number(m[1]))) < span(movesOf('hero-flow-b').map(m => Number(m[1]))));
  // 별가루는 두 겹으로 서로 다른 속도로 흐르고, 일부만 반짝인다
  const farDust = Number(heroCss.match(/\.constellation-dust\.is-far\{animation:dust-drift-far (\d+)s/)[1]);
  const nearDust = Number(heroCss.match(/\.constellation-dust\.is-near\{animation:dust-drift-near (\d+)s/)[1]);
  for (const seconds of [farDust, nearDust]) assert.ok(seconds >= 22 && seconds <= 34, String(seconds));
  assert.notEqual(farDust, nearDust);
  for (const name of ['dust-drift-far', 'dust-drift-near']) {
    const line = heroCss.split('\n').find(text => text.includes(`@keyframes ${name}{`));
    const shifts = [...line.matchAll(/translate3d\((-?\d+)px, ?(-?\d+)px/g)];
    assert.equal(shifts.length, 2, name);
    assert.ok(Math.abs(Number(shifts[1][1]) - Number(shifts[0][1])) >= 20, `${name} x`);
    assert.ok(Math.abs(Number(shifts[1][2]) - Number(shifts[0][2])) >= 15, `${name} y`);
  }
  assert.match(heroCss, /\.dust\.is-twinkle\{animation:dust-twinkle/);
  assert.match(heroCss, /@keyframes dust-twinkle\{from\{opacity:\.18\}to\{opacity:\.95\}\}/);
  // 움직임을 줄이면 히어로 애니메이션을 모두 멈춘다
  assert.ok(heroCss.includes('#app .constellation-hero>.hero-grain span,#app .constellation-hero>.hero-grain::before,'));
  assert.match(heroCss, /animation:none!important\}/);
});
