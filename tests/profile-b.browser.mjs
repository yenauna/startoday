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
  const expected = await page.evaluate(async () => {
    const {
        store,
        state
      } = await import('/js/shared/state.js'),
      C = await import('/js/core.js');
    const student = store.db.students[0];
    await store.commit([{
      table: 'students',
      id: student.id,
      data: {
        ...student,
        nickname: '우주고래',
        equippedTitle: 'learning:1'
      }
    }]);
    state.impersonatingStudentId = student.id;
    state.viewMode = 'student';
    (await import('/js/app.js')).render();
    const score = C.scores(store.db, student.id, '', C.today());
    return {
      total: score.total,
      areas: score.areas,
      name: student.name,
      no: student.no,
      className: store.db.settings[0].className
    };
  });
  const card = page.locator('.student-profile-card');
  assert.equal(await card.count(), 1);
  assert.equal(await page.locator('.student-growth').count(), 1);
  assert.equal(await page.locator('.student-header .student-profile-name').count(), 0);
  assert.equal(await card.locator('.student-profile-name').innerText(), expected.no + '번 ' + expected.name);
  assert.equal(await card.locator('.student-profile-nickname>span').innerText(), '우주고래');
  assert.ok((await card.locator('.kingdom-badge').innerText()).includes('지식의 탐색자'));
  assert.equal(await card.locator('.student-profile-score strong').innerText(), expected.total + '개');
  assert.deepEqual(await card.locator('.student-profile-areas>div>span').allTextContents(), ['학습', '과제', '관계', '도전', '생활', '알바']);
  assert.deepEqual((await card.locator('.student-profile-areas>div>strong').allTextContents()).map(Number), ['학습', '과제', '관계', '도전', '생활', '알바'].map(a => expected.areas[a] || 0));
  assert.equal(await page.locator('.student-stars,.student-character-space').count(), 0);
  assert.equal(await card.locator('.kingdom-title-button').count(), 1);
  await page.getByRole('button', {
    name: '별명 설정',
    exact: true
  }).click();
  await page.locator('#modal [name=nickname]').fill('반짝이는우주고래');
  await page.locator('#modal button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('.student-profile-nickname>span')?.textContent === '반짝이는우주고래');
  assert.equal(await card.locator('.student-profile-nickname>span').innerText(), '반짝이는우주고래');
  await page.getByRole('button', {
    name: '칭호도감 열기',
    exact: true
  }).click();
  await page.locator('#modal .kingdom-current [data-equipped-title="learning:1"]').waitFor();
  await page.getByRole('button', { name: '별의 주민으로 돌아가기', exact: true }).click();
  await page.locator('#modal .kingdom-current [data-equipped-title="resident"]').waitFor();
  await page.locator('#modal [data-equip-title="learning:1"]').click();
  await page.locator('#modal .kingdom-current [data-equipped-title="learning:1"]').waitFor();
  await card.locator('[data-equipped-title="learning:1"]').waitFor();
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  const unchanged = await page.locator('.student-timetable-card').innerHTML();
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({
      width,
      height: 1000
    });
    const layout = await card.evaluate(el => {
      const stage = el.querySelector('.student-avatar-stage').getBoundingClientRect(),
        main = el.querySelector('.student-profile-main').getBoundingClientRect(),
        image = el.querySelector('img').getBoundingClientRect(),
        header = el.querySelector('.student-profile-header').getBoundingClientRect(),
        controls = el.querySelector('.student-profile-controls').getBoundingClientRect(),
        areas = el.querySelector('.student-profile-areas').getBoundingClientRect();
      return {
        stageWidth: stage.width / main.width,
        centered: Math.abs((image.left + image.right) / 2 - (stage.left + stage.right) / 2) < 1,
        ordered: header.bottom <= stage.top && stage.bottom <= controls.top && controls.bottom <= areas.top,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        cols: getComputedStyle(el.querySelector('.student-profile-areas')).gridTemplateColumns.split(' ').length,
        fit: getComputedStyle(el.querySelector('img')).objectFit
      };
    });
    assert.ok(layout.stageWidth > .85);
    assert.ok(layout.centered);
    assert.ok(layout.ordered);
    assert.ok(!layout.overflow);
    assert.equal(layout.fit, 'contain');
    assert.equal(layout.cols, 6);
    await page.screenshot({
      path: '/tmp/profile-b-' + width + '.png',
      fullPage: false
    });
  }
  assert.equal(await page.locator('.student-timetable-card').innerHTML(), unchanged);
  // Large scores and long earned titles wrap, preserving the wide character stage.
  await page.evaluate(async () => {
    const {
      store,
      state
    } = await import('/js/shared/state.js');
    const {
      studentSnapshot
    } = await import('/js/tabs/student-view.js');
    const data = studentSnapshot(store.db, store.db.students[0]);
    data.score.total = 123456789;
    data.student.rewardTitles = [{
      id: 'quest:wrap',
      name: '별빛 가득한 우리 교실의 가장 긴 모험을 완수한 탐험가'
    }];
    data.student.equippedTitle = 'quest:wrap';
    state.studentSnapshot = data;
    state.studentUser = data.student;
    state.impersonatingStudentId = null;
    (await import('/js/app.js')).render();
  });
  await page.setViewportSize({
    width: 360,
    height: 1000
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await card.locator('.kingdom-title-button').click();
  await page.locator('#modal').waitFor({
    state: 'visible'
  });
  assert.deepEqual(errors, []);
  console.log('PASS: B profile counts/zero areas, independent nickname/title, existing edits/codex, unchanged schedule and 360/390/768/1280 responsive layout with long content');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
