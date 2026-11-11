// Optional: PLAYWRIGHT_MODULE / CHROMIUM_EXECUTABLE_PATH, same as layout.browser.mjs.
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
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/config.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end('window.STARTODAY_CONFIG={};');
    return;
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
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
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage({
      viewport: {
        width: 1280,
        height: 1000
      }
    }),
    errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', {
    name: '가상 명단으로 먼저 살펴보기',
    exact: true
  }).click();
  await page.evaluate(async () => {
    const {
        store,
        state
      } = await import('/js/shared/state.js'),
      C = await import('/js/core.js');
    const date = C.today();
    window.detailDate = date;
    await store.commit([{
      table: 'events',
      id: 'important',
      data: {
        id: 'important',
        date,
        title: '중요 행사',
        isImportant: true
      }
    }, {
      table: 'events',
      id: 'normal',
      data: {
        id: 'normal',
        date,
        title: '일반 준비 안내',
        description: '오늘만 준비하세요',
        isImportant: false
      }
    }, {
      table: 'events',
      id: 'legacy',
      data: {
        id: 'legacy',
        date,
        title: '이전 일정'
      }
    }]);
    (await import('/js/tabs/students.js')).studentDetail(store.db.students[0].id);
  });
  assert.equal(await page.locator('.student-kingdom-detail details').getAttribute('open'), null);
  await page.locator('#modal').getByRole('button', {
    name: '👁️ 학생 화면으로 보기',
    exact: true
  }).click();
  assert.equal(await page.locator('.student-stars').count(), 0);
  assert.equal(await page.locator('.student-profile-card .kingdom-title-button').count(), 1);
  assert.equal(await page.getByRole('button', {
    name: '칭호 도감 ›',
    exact: true
  }).count(), 1);
  assert.equal(await page.locator('.student-profile-card .student-profile-edit').count(), 1);
  assert.equal(await page.locator('.student-profile-card .student-nickname-open').count(), 1);
  assert.equal(await page.locator('.student-character-space').count(), 0);
  const date = await page.evaluate(() => window.detailDate),
    cell = page.locator(`[data-calendar-date="${date}"]`);
  assert.equal(await cell.locator('.student-calendar-pill').filter({
    hasText: '중요 행사'
  }).count(), 1);
  assert.equal(await cell.locator('.student-calendar-pill').filter({
    hasText: '이전 일정'
  }).count(), 1);
  assert.equal(await cell.locator('.student-calendar-pill').filter({
    hasText: '일반 준비 안내'
  }).count(), 0);
  assert.ok((await page.locator('.student-today-events').innerText()).includes('일반 준비 안내'));
  await cell.click();
  assert.ok((await page.locator('.student-calendar-detail').innerText()).includes('일반 준비 안내'));
  assert.ok((await page.locator('.student-calendar-detail').innerText()).includes('오늘만 준비하세요'));
  await page.evaluate(async () => {
    window.scrollTo(0, 600);
    (await import('/js/app.js')).render();
  });
  assert.equal(await page.evaluate(() => scrollY), 0);
  await page.getByRole('button', {
    name: '칭호 도감 ›',
    exact: true
  }).click();
  assert.ok(!(await page.locator('#modal').innerText()).includes('키워드가 아닌'));
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '경제',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '상점',
    exact: true
  }).click();
  assert.equal(await page.locator('.village-product').count(), 6);
  const grid = page.locator('.economy-shop-grid').first();
  assert.equal(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), await grid.evaluate(el => Math.floor((el.clientWidth + parseFloat(getComputedStyle(el).columnGap)) / (180 + parseFloat(getComputedStyle(el).columnGap)))));
  await page.setViewportSize({
    width: 384,
    height: 850
  });
  assert.equal((await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ').length, 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.screenshot({
    path: '/tmp/p18-student-shop.png',
    fullPage: true
  });
  await page.getByRole('button', {
    name: '교사 화면으로 돌아가기',
    exact: true
  }).click();
  await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    const {
      dayEditor
    } = await import('/js/tabs/timetable.js');
    dayEditor(window.detailDate, '일정', null, store.db.events.find(e => e.id === 'normal'));
  });
  assert.equal(await page.locator('#modal [name=isImportant]').isChecked(), false);
  await page.locator('#modal [name=isImportant]').check();
  await page.locator('#modal button[type=submit]').click();
  assert.equal(await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.events.find(e => e.id === 'normal').isImportant;
  }), true);
  await page.evaluate(async () => {
    (await import('/js/tabs/timetable.js')).dayEditor(window.detailDate);
  });
  assert.equal(await page.locator('#modal [name=isImportant]').isChecked(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: compact student profile/codex, collapsed teacher titles, scroll reset, grouped 3/2-column shop and important/normal/legacy calendar events');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
