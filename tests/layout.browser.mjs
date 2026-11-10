// Optional rendering checks: install Playwright or set PLAYWRIGHT_MODULE to its path.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const {
  chromium
} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/config.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end('window.STARTODAY_CONFIG={};');
    return;
  }
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) {
    response.statusCode = 403;
    response.end();
    return;
  }
  try {
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html');
    response.end(readFileSync(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH
    } : {}),
    args: ['--no-sandbox']
  });
  const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 1100
      }
    }),
    errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // The baseline rule must also hold without an external font connection.
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', {
    name: '가상 명단으로 먼저 살펴보기',
    exact: true
  }).click();
  await page.evaluate(async () => {
    const {
        store
      } = await import('/js/shared/state.js'),
      C = await import('/js/core.js'),
      date = C.today();
    await store.commit([{
      table: 'settings',
      id: 'main',
      data: {
        ...store.db.settings[0],
        grade: 5
      }
    }, {
      table: 'records',
      id: 'layout-record',
      data: {
        id: 'layout-record',
        date,
        studentIds: [store.db.students[0].id],
        kind: '관찰',
        text: '기록의 첫 줄\n다음 줄',
        areas: ['학습태도', '생활'],
        createdAt: C.now()
      }
    }, {
      table: 'timetables',
      id: 'layout-slot',
      data: {
        id: 'layout-slot',
        date,
        period: 1,
        subjectCode: '국어'
      }
    }]);
    (await import('/js/app.js')).render();
  });
  await page.locator('nav.tabs').getByRole('button', {
    name: '기록',
    exact: true
  }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({
      width,
      height: 1100
    });
    const baselines = await page.locator('[data-record-id=layout-record] .record-content-line').evaluate(line => {
      const ys = [];
      for (const target of [...line.querySelectorAll('.badge'), line.querySelector('.body')]) {
        const probe = document.createElement('i');
        probe.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline';
        target.prepend(probe);
        ys.push(probe.getBoundingClientRect().top);
        probe.remove();
      }
      return ys;
    });
    assert(baselines.every(y => Math.abs(y - baselines[0]) < .1), `baseline ${width}px: ${baselines}`);
  }
  await page.setViewportSize({
    width: 1440,
    height: 1100
  });
  await page.locator('nav.tabs').getByRole('button', {
    name: '대시보드',
    exact: true
  }).click();
  await page.locator('.registered-schedule .slot').first().click();
  const button = await page.locator('.subject-grid .subject-choice').first().evaluate(element => {
    const css = getComputedStyle(element);
    return {
      height: element.getBoundingClientRect().height,
      font: css.fontSize,
      weight: css.fontWeight,
      padding: css.padding
    };
  });
  assert.deepEqual(button, {
    height: 38,
    font: '16px',
    weight: '800',
    padding: '6px 8px'
  });
  await page.getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  await page.locator('nav.tabs').getByRole('button', {
    name: '수업도구',
    exact: true
  }).click();
  await page.locator('.tools-toolbar').getByRole('button', {
    name: '⏱️ 타이머',
    exact: true
  }).click();
  const window = page.locator('[data-tool-type=timer]'),
    fit = () => page.locator('.tools-canvas').evaluate(canvas => {
      const a = canvas.getBoundingClientRect(),
        b = canvas.querySelector('.tools-widget').getBoundingClientRect();
      return {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        left: b.x - a.x - canvas.clientLeft,
        top: b.y - a.y - canvas.clientTop,
        w: b.width,
        h: b.height
      };
    });
  const assertFit = async () => {
    const rect = await fit();
    assert(Math.abs(rect.w - rect.width) < 1 && Math.abs(rect.h - rect.height) < 1 && Math.abs(rect.left) < 1 && Math.abs(rect.top) < 1, JSON.stringify(rect));
  };
  await assertFit();
  await window.locator('.tools-resize').scrollIntoViewIfNeeded();
  const original = await window.boundingBox(),
    handle = await window.locator('.tools-resize').boundingBox();
  await page.mouse.move(handle.x + 12, handle.y + 12);
  await page.mouse.down();
  await page.mouse.move(handle.x - 280, handle.y - 220);
  await page.mouse.up();
  const smaller = await window.boundingBox();
  assert(smaller.width < original.width - 100 && smaller.height < original.height - 100);
  await page.evaluate(() => {
    globalThis.fullscreenCalls = 0;
    Element.prototype.requestFullscreen = function () {
      globalThis.fullscreenCalls++;
      throw Error('native fullscreen must not run');
    };
  });
  await window.getByRole('button', {
    name: '캔버스 꽉 채우기/복원',
    exact: true
  }).click();
  await assertFit();
  for (const width of [1000, 390]) {
    await page.setViewportSize({
      width,
      height: 800
    });
    await assertFit();
  }
  await page.setViewportSize({
    width: 1440,
    height: 1100
  });
  await window.getByRole('button', {
    name: '캔버스 꽉 채우기/복원',
    exact: true
  }).click();
  const restored = await window.boundingBox();
  // In-board maximization preserves the previous rectangle across viewport changes.
  assert(Math.abs(restored.width - smaller.width) < 1 && Math.abs(restored.height - smaller.height) < 1);
  assert.equal(await page.evaluate(() => globalThis.fullscreenCalls), 0);
  assert.equal(await page.evaluate(() => document.fullscreenElement), null);
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile record baselines, compact subject buttons, initial canvas fit and in-board maximize/restore');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
