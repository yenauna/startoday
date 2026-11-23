import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const page = readFileSync(path.join(root, 'design-preview.html'), 'utf8');
const tab = readFileSync(path.join(root, 'js/tabs/design-preview.js'), 'utf8');

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

test('그레이니 배경은 배경만/둘 다에서만, 히어로 그레인은 히어로만/둘 다에서만 보인다', () => {
  assert.match(page, /body:is\(\[data-theme="grainy-bg"\], \[data-theme="grainy-both"\]\) \.sky-grainbg \{ opacity:1; \}/);
  assert.match(page, /body:is\(\[data-theme="grainy-hero"\], \[data-theme="grainy-both"\]\) \.hero-grain \{ opacity:1; \}/);
  // 히어로만일 때는 앱 배경이 정적 단색이어야 하므로 기존 하늘 레이어를 숨긴다
  assert.match(page, /body:is\(\[data-theme="grainy-bg"\], \[data-theme="grainy-hero"\], \[data-theme="grainy-both"\]\) :is\(\.sky-light, \.sky-orbits\) \{ display:none; \}/);
  // 교사·학생 두 화면 모두 히어로 카드에 그레인 레이어를 가진다
  assert.equal(page.match(/class="hero-grain"/g).length, 2);
});

test('움직임은 느린 주기(18~24초)의 블롭 표류뿐이고 노이즈는 고정이다', () => {
  const durations = [...page.matchAll(/animation:(grain-drift-[a-d]|hero-flow-[a-c]) (\d+(?:\.\d+)?)s/g)]
    .map(match => Number(match[2]));
  assert.equal(durations.length, 7);
  for (const seconds of durations) assert.ok(seconds >= 18 && seconds <= 24, String(seconds));
  // 노이즈·그레인 레이어에는 애니메이션을 걸지 않는다(지직거림 방지)
  const grainRules = [...page.matchAll(/\.(?:sky-grain-noise|sky-grainbg|hero-grain)(?:::after)? \{[^}]*\}/g)]
    .map(match => match[0]);
  assert.ok(grainRules.length >= 3);
  for (const rule of grainRules) assert.ok(!/animation:/.test(rule), rule);
});

test('prefers-reduced-motion에서 그레이니 애니메이션을 멈춘다', () => {
  assert.match(page, /@media \(prefers-reduced-motion:reduce\) \{\s*\.grain-blob, \.hero-grain span \{ animation:none !important; \}\s*\}/);
});
