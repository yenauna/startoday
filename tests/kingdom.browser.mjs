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
  const context = await browser.newContext({
    viewport: {
      width: 1280,
      height: 1000
    }
  });
  const page = await context.newPage(),
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
    const student = store.db.students[0];
    window.kingdomStudentId = student.id;
    const day = C.today(),
      stamp = C.now();
    const ops = [{
      table: 'students',
      id: student.id,
      data: {
        ...student,
        password: '한글암호7',
        passwordChanged: true,
        passwordResetRequired: false
      }
    }];
    for (const [area, count, text] of [['learning', 14, '학습'], ['life', 29, '생활'], ['jobs', 44, '알바']]) for (let i = 0; i < count; i++) ops.push({
      table: 'records',
      id: 'title-' + area + i,
      data: {
        id: 'title-' + area + i,
        date: day,
        kind: '칭찬',
        studentIds: [student.id],
        text: '영역 기반 칭찬',
        areas: [text],
        createdAt: stamp
      }
    });
    ops.push({
      table: 'records',
      id: 'secret-title',
      data: {
        id: 'secret-title',
        date: day,
        kind: '지도',
        studentIds: [student.id],
        text: 'SECRET_PRIVATE 독서 준비물 줄넘기',
        createdAt: stamp
      }
    });
    await store.commit(ops);
    state.tab = '대시보드';
    render();
  });
  await page.locator('#quick-text').fill('도서관 반납 독서 청소');
  assert.equal(await page.locator('#quick-kingdom').count(), 0);
  await page.locator('.quick-areas .area-chip').filter({
    hasText: '학습'
  }).click();
  await page.locator('#quick-student-query').fill('1');
  await page.locator('#quick-student-query').press('Enter');
  await page.locator('.record-actions').getByRole('button', {
    name: '칭찬',
    exact: true
  }).click();
  assert.equal(await page.evaluate(async () => {
    const {
        store
      } = await import('/js/shared/state.js'),
      C = await import('/js/core.js');
    return C.kingdomCounts(store.db, window.kingdomStudentId).learning;
  }), 15);
  await page.evaluate(async () => {
    const {
      recordEditor
    } = await import('/js/tabs/records.js');
    recordEditor({
      kind: '칭찬',
      studentIds: [window.kingdomStudentId]
    });
  });
  await page.locator('#modal textarea[name=text]').fill('수업 준비 준비물 줄넘기');
  assert.equal(await page.locator('#record-kingdom').count(), 0);
  await page.locator('#modal input[name=areas][value=생활]').check();
  await page.locator('#modal input[name=areas][value=알바]').check();
  await page.locator('#modal button[type=submit]').click();
  const teacherCard = page.locator('article.student').first();
  await teacherCard.locator('.kingdom-earned-open').click();
  assert.equal(await page.locator('#modal .kingdom-domain').count(), 6);
  assert.equal(await page.locator('#modal [data-equip-title]').count(), 0);
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  await teacherCard.locator('.student-head button').click();
  assert((await page.locator('.student-kingdom-detail').textContent()).includes('통찰의 현자') === false);
  assert((await page.locator('.student-kingdom-detail').textContent()).includes('길드의 대들보'));
  await page.locator('#modal').getByRole('button', {
    name: '👁️ 학생 화면으로 보기',
    exact: true
  }).click();
  assert.equal(await page.locator('.student-shell [data-equipped-title=resident]').count(), 2);
  await page.getByRole('button', {
    name: '👑 별 왕국 칭호 도감',
    exact: true
  }).click();
  assert.equal(await page.locator('#modal .kingdom-domain').count(), 6);
  assert((await page.locator('#modal [data-kingdom-domain=learning]').textContent()).includes('15회 남았어요'));
  assert((await page.locator('#modal [data-kingdom-domain=life]').textContent()).includes('질서의 파수꾼'));
  assert((await page.locator('#modal [data-kingdom-domain=jobs]').textContent()).includes('최고 단계'));
  assert.equal(await page.locator('[data-equip-title="learning:2"]').count(), 0);
  await page.locator('[data-equip-title="learning:1"]').click();
  await page.locator('.kingdom-current [data-equipped-title="learning:1"]').waitFor();
  await page.locator('[data-equip-title="jobs:3"]').click();
  await page.locator('.kingdom-current [data-equipped-title="jobs:3"]').waitFor();
  assert(!(await page.locator('.student-shell').textContent()).includes('SECRET_PRIVATE'));
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '교사 화면으로 돌아가기',
    exact: true
  }).click();
  assert.equal(await page.locator('article.student').first().locator('[data-equipped-title="jobs:3"]').count(), 1);
  await page.reload();
  await page.getByRole('button', {
    name: '가상 명단으로 먼저 살펴보기',
    exact: true
  }).click();
  assert.equal(await page.locator('article.student').first().locator('[data-equipped-title="jobs:3"]').count(), 1);
  const teacher = await page.context().newPage();
  await teacher.goto(page.url());
  await teacher.getByRole('button', {
    name: '가상 명단으로 먼저 살펴보기',
    exact: true
  }).click();
  await page.evaluate(async () => {
    const {
        store
      } = await import('/js/shared/state.js'),
      {
        render
      } = await import('/js/app.js');
    await store.logout();
    render();
  });
  await page.getByRole('button', {
    name: '학생 로그인',
    exact: true
  }).click();
  await page.locator('#modal input[name=no]').fill('1');
  await page.locator('#modal input[name=password]').fill('한글암호7');
  await page.locator('#modal button[type=submit]').click();
  await page.locator('.student-shell').waitFor();
  assert.equal(await page.locator('.student-shell [data-equipped-title="jobs:3"]').count(), 2);
  await page.getByRole('button', {
    name: '👑 별 왕국 칭호 도감',
    exact: true
  }).click();
  await page.locator('[data-equip-title="learning:1"]').click();
  await page.locator('.kingdom-current [data-equipped-title="learning:1"]').waitFor();
  await teacher.locator('article.student').first().locator('[data-equipped-title="learning:1"]').waitFor();
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  assert.equal(await page.locator('#modal .kingdom-catalog').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 1);
  assert(await page.locator('#modal').evaluate(e => e.scrollWidth <= e.clientWidth + 1));
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '로그아웃',
    exact: true
  }).click();
  assert((await page.evaluate(async () => {
    try {
      const {
        equipStudentTitle
      } = await import('/js/tabs/student-view.js');
      await equipStudentTitle('learning:1');
      return '';
    } catch (e) {
      return e.message;
    }
  })).includes('학생 로그인'));
  await teacher.close();
  assert.deepEqual(errors, []);
  console.log('PASS: XP-based collection, three title stages, teacher collections, preview and real student equip, reload persistence, cross-window sync, mobile codex and logout guard');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
