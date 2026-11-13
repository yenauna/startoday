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
  const page = await browser.newPage({
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
      C = await import('/js/core.js'),
      {
        render
      } = await import('/js/app.js');
    const date = C.today();
    window.taskDate = date;
    window.studentIds = store.db.students.map(s => s.id);
    store.db.areas[0].name = '학습태도';
    store.db.records = [{
      id: 'legacy-area',
      date,
      studentIds: [window.studentIds[0]],
      kind: '칭찬',
      text: '독서 잘함',
      areas: ['학습태도', '학습'],
      createdAt: C.now()
    }];
    store.db.assignments = [{
      id: 'legacy-task',
      title: '학습 점검',
      date,
      repeat: {
        type: 'none'
      },
      target: 'all',
      statArea: '학습태도'
    }];
    localStorage.setItem('startoday-demo-v1', JSON.stringify(store.db));
    store.demo();
    state.date = date;
    render();
  });
  assert.equal(await page.locator('.quick-areas .area-chip').filter({
    hasText: '학습'
  }).count(), 1);
  assert(!(await page.locator('#app').textContent()).includes('학습태도'));
  assert((await page.locator('article.student').first().locator('.area-score').textContent()).includes('학습 1'));
  await page.locator('#quick-student-query').fill('1');
  await page.locator('#quick-student-query').press('Enter');
  await page.locator('#quick-text').fill('2교시 발표를 잘함');
  for (const n of [3, 4, 5]) {
    await page.evaluate(async n => {
      const {
          store
        } = await import('/js/shared/state.js'),
        {
          render
        } = await import('/js/app.js');
      await store.commit([{
        table: 'settings',
        id: 'main',
        data: {
          ...store.db.settings[0],
          lunchAfterPeriod: n
        }
      }]);
      render();
    }, n);
    await page.locator('#quick-period').click();
    const labels = await page.locator('.quick-period-card-grid [data-period-value]').allTextContents(),
      index = labels.indexOf('점심');
    assert.equal(labels[index - 1], n + '교시');
    assert.equal(labels[index + 1], n + 1 + '교시');
    assert(!labels.includes('7교시'));
    assert(labels.includes('쉬는시간'));
    await page.locator('#modal [data-period-value="3교시"]').click();
    assert.equal(await page.locator('#quick-period').textContent(), '⏰ 3교시');
    assert.equal(await page.locator('#quick-text').inputValue(), '2교시 발표를 잘함');
    assert.equal(await page.locator('#modal').evaluate(e => e.open), false);
  }
  await page.locator('#quick-period').click();
  await page.locator('#modal [data-period-value=""]').click();
  assert.equal(await page.locator('#quick-period').evaluate(e => e.value), '');
  assert.equal(await page.locator('#quick-period').textContent(), '⏰ 시간 미지정');
  await page.locator('#quick-period').click();
  await page.locator('#modal [data-period-value="자동"]').click();
  assert.equal(await page.locator('#quick-period').textContent(), '⏰ 시간자동');
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await page.locator('#quick-period').click();
  assert.equal(await page.locator('.quick-period-card-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 3);
  assert(await page.locator('#modal').evaluate(e => e.scrollWidth <= e.clientWidth + 1));
  await page.locator('#modal [data-period-value="점심"]').click();
  assert.equal(await page.locator('#quick-period').textContent(), '⏰ 점심');
  await page.locator('#quick-cancel').click();
  await page.setViewportSize({
    width: 1280,
    height: 1000
  });
  await page.locator('nav.tabs').getByRole('button', {
    name: '기록',
    exact: true
  }).click();
  assert((await page.locator('.record-content-line .badge').first().textContent()).includes('학습'));
  assert(!(await page.locator('#main').textContent()).includes('학습태도'));
  await page.locator('nav.tabs').getByRole('button', {
    name: '통계',
    exact: true
  }).click();
  assert(!(await page.locator('#main').textContent()).includes('학습태도'));
  await page.evaluate(async () => {
    const {
        store
      } = await import('/js/shared/state.js'),
      C = await import('/js/core.js'),
      {
        navigate
      } = await import('/js/app.js');
    const a = store.db.assignments[0],
      date = window.taskDate,
      ids = window.studentIds;
    let ops = [];
    for (const [i, status] of [[1, '완료'], [2, '면제'], [4, '늦게완료']]) ops.push(...C.taskStateOps(store.db, a, date, ids[i], status, '보존'));
    ops.push({
      table: 'attendance',
      id: 'bulk-excluded',
      data: {
        id: 'bulk-excluded',
        studentId: ids[3],
        date,
        excluded: true
      }
    });
    await store.commit(ops);
    navigate('과제');
  });
  await page.locator('[data-assignment-id="legacy-task"][data-assignment-date]').first().click();
  await page.locator('#modal .remaining-notdone').click();
  await page.waitForFunction(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.assignmentStates.filter(s => s.assignmentId === 'legacy-task' && s.status === '안함').length === 16;
  });
  const result = await page.evaluate(async () => {
    const {
        store
      } = await import('/js/shared/state.js'),
      C = await import('/js/core.js'),
      ids = window.studentIds,
      d = window.taskDate;
    return {
      statuses: [1, 2, 3, 4].map(i => C.assignmentStatus(store.db, 'legacy-task', d, ids[i])),
      valid: store.db.assignmentStates.every(s => C.isTaskDate(s.date) && s.id === C.stateId(s.assignmentId, s.date, s.studentId)),
      area: store.db.assignments[0].statArea,
      stored: JSON.parse(localStorage.getItem('startoday-demo-v1')).records.find(r => r.id === 'legacy-area').areas
    };
  });
  assert.deepEqual(result, {
    statuses: ['완료', '면제', '진행중', '늦게완료'],
    valid: true,
    area: '학습',
    stored: ['학습']
  });
  assert.deepEqual(errors, []);
  console.log('PASS: legacy XP alias display/storage, period-card popup and lunch placement 3/4/5, draft/mobile selection, bulk-undone status/date integrity');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
