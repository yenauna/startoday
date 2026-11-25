// 선택 칩(분야·학생)과 과목 카드가 화면마다 같은 모양인지 확인한다.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/config.js') { response.setHeader('Content-Type','text/javascript'); response.end('window.STARTODAY_CONFIG={};'); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { response.statusCode = 403; response.end(); return; }
  try {
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    response.end(readFileSync(file));
  } catch { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.CHROMIUM_EXECUTABLE_PATH} : {})});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', {name: '가상 명단으로 먼저 살펴보기', exact: true}).click();
  const today = await page.evaluate(async () => {
    const C = await import('/js/core.js');
    const {store, state} = await import('/js/shared/state.js');
    const db = C.initialDB();
    db.settings[0].grade = 5;
    db.students = Array.from({length: 20}, (_, i) => ({id: 's' + i, no: i + 1, name: '학생' + (i + 1)}));
    store.db = db; state.date = C.today(); state.selected = [];
    localStorage.setItem('startoday-demo-v1', JSON.stringify(db));
    (await import('/js/app.js')).navigate('대시보드');
    return C.today();
  });
  const chipStyle = locator => locator.evaluate(e => {
    const s = getComputedStyle(e);
    return {bg: s.backgroundColor, color: s.color, radius: s.borderRadius};
  });
  // 1. 빠른 기록 분야 칩과 기록 확인 창의 분야 칩은 같은 회색이다.
  const quickChip = page.locator('.quick-areas .area-chip').filter({hasText: '학습'});
  const quick = await chipStyle(quickChip);
  assert.equal(quick.bg, 'rgb(226, 231, 239)', '빠른 기록 분야 칩 배경');
  await page.evaluate(async () => (await import('/js/tabs/records.js')).recordEditor({}));
  await page.waitForTimeout(200);
  const areaChip = page.locator('#modal .choice-chip').filter({hasText: '학습'});
  const record = await chipStyle(areaChip);
  assert.deepEqual(record, quick, '빠른 기록과 기록 창의 분야 칩 모양이 같아야 합니다.');
  // 2. 분야 6개가 데스크톱 한 줄에 놓인다.
  const areaRows = await page.locator('#modal .choice-chip').evaluateAll(es => new Set(es.map(e => Math.round(e.getBoundingClientRect().y))).size);
  assert.equal(areaRows, 1, '데스크톱 기록 창의 분야 칩은 한 줄이어야 합니다.');
  // 선택 상태도 같은 색이다.
  await areaChip.click();
  assert.equal((await chipStyle(areaChip)).bg, 'rgb(211, 222, 237)', '선택된 분야 칩 배경');
  await page.locator('#modal .dialog-head').getByRole('button', {name: '닫기', exact: true}).click();
  await page.locator('#modal[open]').waitFor({state: 'hidden'});
  // 3. 모바일 기록 창의 분야 칩도 같은 회색/선택색을 쓴다.
  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(async () => {const {state} = await import('/js/shared/state.js'); state.selected = ['s0']; (await import('/js/app.js')).render();});
  await page.evaluate(async () => (await import('/js/components/header.js')).openMobileQuickRecord());
  await page.waitForTimeout(200);
  const mobileChip = page.locator('#modal .choice-chip').filter({hasText: '학습'});
  assert.deepEqual(await chipStyle(mobileChip), quick, '모바일 기록 창의 분야 칩이 같은 모양이어야 합니다.');
  await page.locator('#modal .dialog-head').getByRole('button', {name: '닫기', exact: true}).click();
  await page.locator('#modal[open]').waitFor({state: 'hidden'});
  // 4. 과목 카드는 4글자 과목이 잘리지 않을 만큼만 넓고, 데스크톱에서 5열 이상이다.
  await page.setViewportSize({width: 1440, height: 1000});
  await page.evaluate(async date => (await import('/js/tabs/timetable.js')).timetableEditor(date, 1), today);
  await page.locator('#modal .subject-grid').first().waitFor();
  await page.waitForTimeout(200);
  const columns = await page.locator('#modal .subject-grid').first().evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  assert.ok(columns >= 6, `데스크톱 과목 카드 열 수: ${columns}`);
  const cardWidth = await page.locator('#modal .subject-choice').filter({hasText: '자율자치'}).evaluate(e => e.getBoundingClientRect().width);
  assert.ok(cardWidth <= 130, `과목 카드 폭: ${cardWidth}`);
  const clipped = await page.locator('#modal .subject-choice').evaluateAll(es => es.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim()));
  assert.deepEqual(clipped, [], '과목명이 잘린 카드가 없어야 합니다.');
  // 모바일에서도 3열을 유지하고 잘리지 않는다.
  await page.setViewportSize({width: 390, height: 844});
  const mobileColumns = await page.locator('#modal .subject-grid').first().evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  assert.equal(mobileColumns, 3);
  const mobileClipped = await page.locator('#modal .subject-choice').evaluateAll(es => es.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim()));
  assert.deepEqual(mobileClipped, []);
  assert.deepEqual(errors, []);
  console.log('PASS: 분야 칩 회색/선택색이 빠른 기록·기록 창·모바일에서 같고 한 줄이며, 과목 카드는 4글자가 잘리지 않는 폭으로 줄었다');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
