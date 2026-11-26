import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampToolWindow, resizeToolWindow, TOOL_RESIZE_DIRECTIONS } from '../js/shared/tools-core.js';

const canvas = [1000, 800];

test('여덟 방향 모두 크기를 바꾸고 반대쪽 변은 제자리에 둔다', () => {
  const base = {left: 100, top: 80, width: 500, height: 400};
  assert.deepEqual(TOOL_RESIZE_DIRECTIONS, ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
  assert.deepEqual(resizeToolWindow(base, 'e', 120, 0, ...canvas), {left: 100, top: 80, width: 620, height: 400});
  assert.deepEqual(resizeToolWindow(base, 'w', 120, 0, ...canvas), {left: 220, top: 80, width: 380, height: 400});
  assert.deepEqual(resizeToolWindow(base, 's', 0, 60, ...canvas), {left: 100, top: 80, width: 500, height: 460});
  assert.deepEqual(resizeToolWindow(base, 'n', 0, 60, ...canvas), {left: 100, top: 140, width: 500, height: 340});
  assert.deepEqual(resizeToolWindow(base, 'se', 40, 30, ...canvas), {left: 100, top: 80, width: 540, height: 430});
  assert.deepEqual(resizeToolWindow(base, 'sw', 40, 30, ...canvas), {left: 140, top: 80, width: 460, height: 430});
  assert.deepEqual(resizeToolWindow(base, 'ne', 40, -30, ...canvas), {left: 100, top: 50, width: 540, height: 430});
  assert.deepEqual(resizeToolWindow(base, 'nw', -40, -30, ...canvas), {left: 60, top: 50, width: 540, height: 430});
});

test('크기는 최소 크기와 캔버스 경계를 넘지 않고 왼쪽·위쪽을 줄여도 오른쪽·아래쪽 변이 고정된다', () => {
  const base = {left: 300, top: 200, width: 500, height: 400};
  const tiny = resizeToolWindow(base, 'se', -2000, -2000, ...canvas);
  assert.deepEqual(tiny, {left: 300, top: 200, width: 260, height: 200});
  const wide = resizeToolWindow(base, 'e', 5000, 0, ...canvas);
  assert.equal(wide.width, canvas[0]);
  assert.equal(wide.left, 300);
  const tall = resizeToolWindow(base, 's', 0, 5000, ...canvas);
  assert.equal(tall.height, canvas[1]);
  const fromLeft = resizeToolWindow(base, 'w', 450, 0, ...canvas);
  assert.equal(fromLeft.left + fromLeft.width, 800);
  assert.equal(fromLeft.width, 260);
  const fromTop = resizeToolWindow(base, 'n', 0, 350, ...canvas);
  assert.equal(fromTop.top + fromTop.height, 600);
  assert.equal(fromTop.height, 200);
  const offscreen = resizeToolWindow({left: 100, top: 100, width: 700, height: 500}, 'nw', -500, -400, ...canvas);
  assert.deepEqual(offscreen, {left: 0, top: 0, width: 1000, height: 800});
});

test('알 수 없는 방향과 값이 빠진 사각형은 안전하게 오른쪽 아래로 다룬다', () => {
  assert.deepEqual(resizeToolWindow({left: 10, top: 10, width: 400, height: 300}, 'unknown', 20, 20, ...canvas), {left: 10, top: 10, width: 420, height: 320});
  const fallback = resizeToolWindow({}, 'se', 0, 0, ...canvas);
  assert.deepEqual(fallback, clampToolWindow({left: 0, top: 0, width: 0, height: 0}, ...canvas));
});
