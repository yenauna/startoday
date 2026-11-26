// 월급 주기 화면 회귀: 설정·미리보기·지급·중복 방지까지 실제 화면에서 확인한다.
// PLAYWRIGHT_MODULE / CHROMIUM_EXECUTABLE_PATH, same as economy.browser.mjs.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const {
  chromium
} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const shots = process.env.SALARY_SHOT_DIR || path.resolve(root, '..', 'downloads', 'salary-shots');
mkdirSync(shots, { recursive: true });
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
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html');
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
  const page = await context.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByRole('button', { name: '가상 명단으로 먼저 살펴보기', exact: true }).click();

  // 오늘을 기준으로 기간 안/밖 기록을 넣어 2주·한달 차이를 실제로 만든다.
  const seed = await page.evaluate(async () => {
    const { store } = await import('/js/shared/state.js');
    const C = await import('/js/core.js');
    const db = store.db;
    const day = offset => C.addDays(C.today(), offset);
    const rec = (id, studentId, kind, date) => ({ id, studentIds: [studentId], kind, date, period: '', text: kind + ' 기록', areas: ['학습'], createdAt: new Date().toISOString() });
    const [first, second] = db.students;
    db.records.push(rec('salary-a1', first.id, '칭찬', day(-2)), rec('salary-a2', first.id, '칭찬', day(-20)), rec('salary-b1', second.id, '지도', day(-3)));
    localStorage.setItem('startoday-demo-v1', JSON.stringify(db));
    (await import('/js/app.js')).render();
    const before = { a: C.studentBalance(db, first.id), b: C.studentBalance(db, second.id) };
    const ledger = { a: (db.economy_tx || []).filter(t => t.studentId === first.id).reduce((n, t) => n + t.amount, 0), b: (db.economy_tx || []).filter(t => t.studentId === second.id).reduce((n, t) => n + t.amount, 0) };
    window.__salary = { a: first.id, b: second.id, nameA: first.name, nameB: second.name, noA: first.no, before, ledger, today: C.today() };
    return window.__salary;
  });

  const openMenu = async name => {
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
    await page.locator('#navigation-drawer').getByRole('button', { name, exact: true }).click();
  };
  await openMenu('경제');
  assert.equal((await page.locator('#main > .toolbar .muted').innerText()).trim(), '별 1개 = 10포인트');
  await page.getByRole('button', { name: '자산 관리', exact: true }).click();
  const salaryButton = page.getByRole('button', { name: '월급 주기', exact: true });
  assert.equal(await salaryButton.count(), 1);
  await salaryButton.click();

  const modal = page.locator('#modal');
  await modal.waitFor();
  const pay = modal.locator('[data-salary-pay]');
  const rowA = modal.locator(`.salary-preview tr[data-salary-student="${seed.a}"]`);
  const rowB = modal.locator(`.salary-preview tr[data-salary-student="${seed.b}"]`);
  const cells = async row => (await row.locator('td').allInnerTexts()).map(text => text.replace(/\s+/g, ' ').trim());

  // 실시간 방식에서는 지급할 수 없고, 2주 기준 미리보기가 먼저 맞아야 한다.
  assert.equal(await pay.isDisabled(), true);
  assert.equal((await pay.innerText()).trim(), '월급 정산을 먼저 선택');
  assert.match(await modal.locator('[data-salary-range]').innerText(), /2주/);
  let a = await cells(rowA);
  assert.equal(a[3], '칭찬 1');
  assert.equal(a[4], '10');
  assert.equal(a[6], '10');
  let b = await cells(rowB);
  assert.equal(b[6], '0', '지급액 0인 학생은 총액 0');

  await modal.getByRole('radio', { name: '한달', exact: true }).click();
  a = await cells(rowA);
  const monthCount = Number((a[3].match(/칭찬 (\d+)/) || [])[1]);
  assert.ok(monthCount >= 2, '한달 기간에는 20일 전 기록도 포함');
  assert.equal(Number(a[4]), monthCount * 10);
  assert.equal(Number(a[6]), monthCount * 10);
  await modal.getByRole('radio', { name: '2주', exact: true }).click();
  a = await cells(rowA);
  assert.equal(a[6], '10');

  await modal.getByRole('radio', { name: '칭찬-조언', exact: true }).click();
  a = await cells(rowA);
  assert.equal(a[3], '칭찬 1 - 지도 0');
  await modal.getByRole('radio', { name: '칭찬만', exact: true }).click();

  await modal.locator('[name=salary-multiplier]').fill('20');
  a = await cells(rowA);
  assert.equal(a[4], '20');
  assert.equal(a[6], '20');
  await modal.locator('[name=salary-multiplier]').fill('10');

  // 월급 정산으로 바꾸면 바로 지급할 수 있다.
  await modal.getByRole('radio', { name: '월급 정산', exact: true }).click();
  assert.equal(await pay.isDisabled(), false);
  assert.equal((await pay.innerText()).trim(), '1명에게 지급');

  // 추가 직업: 직업명·월급을 넣으면 총액에 더해진다.
  await modal.getByRole('radio', { name: '있음', exact: true }).click();
  assert.equal(await modal.locator('[data-salary-jobs]').isHidden(), false);
  await modal.getByLabel(`${seed.noA}번 ${seed.nameA} 직업명`).fill('우유 당번');
  await modal.getByLabel(`${seed.noA}번 ${seed.nameA} 직업 월급`).fill('50');
  a = await cells(rowA);
  assert.equal(a[5], '우유 당번 50');
  assert.equal(a[6], '60');
  assert.equal((await pay.innerText()).trim(), '1명에게 지급');
  assert.match(await modal.locator('[data-salary-summary]').innerText(), /선택 1명 · 모두 60포인트/);
  await page.screenshot({ path: path.join(shots, '01-salary-dialog.png'), fullPage: false });
  await modal.locator('.dialog-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(shots, '01b-salary-preview.png'), fullPage: false });
  await modal.locator('.dialog-body').evaluate(el => { el.scrollTop = 0; });

  // 직업 없음으로 돌리면 다시 기록 급여만 남는다.
  await modal.getByRole('radio', { name: '없음', exact: true }).click();
  assert.equal(await modal.locator('[data-salary-jobs]').isHidden(), true);
  assert.equal((await cells(rowA))[6], '10');
  await modal.getByRole('radio', { name: '있음', exact: true }).click();
  assert.equal((await cells(rowA))[6], '60', '직업 값은 유지된다');

  // 지급 실행: 확인 창을 모두 수락한다.
  page.on('dialog', dialog => dialog.accept());
  await pay.click();
  await page.locator('#modal[open]').waitFor({ state: 'detached', timeout: 15000 });
  assert.match(await page.locator('#toast').innerText(), /1명에게 월급 60포인트를 지급했습니다/);

  const after = await page.evaluate(async () => {
    const { store } = await import('/js/shared/state.js');
    const C = await import('/js/core.js');
    const db = store.db;
    return {
      pointMode: db.settings[0].pointMode,
      salary: db.settings[0].salary,
      balanceA: C.studentBalance(db, window.__salary.a),
      balanceB: C.studentBalance(db, window.__salary.b),
      salaryTx: db.economy_tx.filter(t => String(t.memo || '').startsWith('[월급]')).map(t => ({ type: t.type, amount: t.amount, memo: t.memo, studentId: t.studentId })),
      previewAgain: C.salaryPreview(db, db.settings[0], C.today()).rows.find(r => r.studentId === window.__salary.a)
    };
  });
  assert.equal(after.pointMode, 'salary');
  assert.equal(after.salary.jobs, true);
  assert.deepEqual(after.salary.jobWages[seed.a], { name: '우유 당번', amount: 50 });
  assert.equal(after.salaryTx.length, 1);
  assert.equal(after.salaryTx[0].type, '지급');
  assert.equal(after.salaryTx[0].amount, 60);
  assert.equal(after.salaryTx[0].memo, '[월급] 2주 · 칭찬×10 + 직업');
  assert.equal(after.balanceA, seed.ledger.a + 60, '지급한 만큼만 원장 잔액이 늘어난다');
  assert.equal(after.balanceB, seed.ledger.b);
  assert.equal(after.previewAgain.paidOn, seed.today, '오늘 지급으로 기록된다');
  assert.equal(after.previewAgain.total, 0, '같은 기간에는 다시 지급할 금액이 없다');

  // 화면: 월급 정산 표시·잔액·거래 내역이 함께 바뀐다.
  assert.equal((await page.locator('#main > .toolbar .muted').innerText()).trim(), '월급 정산제 · 별 자동 합산 없음');
  const balanceText = await page.locator(`tr[data-economy-student="${seed.a}"] .economy-assets-table, tr[data-economy-student="${seed.a}"]`).first().innerText();
  assert.match(balanceText, new RegExp(`★ ${seed.ledger.a + 60}포인트`));
  assert.match(await page.locator('.economy-history').innerText(), /\[월급\] 2주 · 칭찬×10 \+ 직업/);
  await page.screenshot({ path: path.join(shots, '02-salary-paid-assets.png'), fullPage: false });

  // 다시 열면 이미 지급한 학생은 기본 해제·0포인트로 보이고 지급 이력이 안내된다.
  await page.getByRole('button', { name: '월급 주기', exact: true }).click();
  await modal.waitFor();
  a = await cells(rowA);
  assert.equal(a[6], '0');
  assert.match(a[2], /이미 지급/);
  assert.equal(await rowA.locator('[name=salary-pick]').isDisabled(), true);
  assert.match(await modal.locator('[data-salary-history]').innerText(), /최근 월급 지급/);
  assert.equal((await modal.locator('[data-salary-pay]').innerText()).trim(), '지급할 학생 선택');
  assert.equal(await modal.locator('[data-salary-pay]').isDisabled(), true);
  await page.screenshot({ path: path.join(shots, '03-salary-after-pay.png'), fullPage: false });

  // 좁은 화면에서도 창이 넘치지 않는다.
  await page.setViewportSize({ width: 375, height: 780 });
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    dialogScroll: document.querySelector('#modal .dialog-body').scrollWidth - document.querySelector('#modal .dialog-body').clientWidth
  }));
  assert.equal(overflow.body, 0, '375px에서 페이지 가로 스크롤 없음');
  assert.ok(overflow.dialogScroll <= 1, '창 안쪽 표는 자기 영역 안에서 넘긴다');
  await page.screenshot({ path: path.join(shots, '04-salary-375.png'), fullPage: false });

  // 설정 저장만으로도 기간·방식이 저장된다(지급 없이).
  await modal.getByRole('radio', { name: '한달', exact: true }).click();
  await modal.getByRole('button', { name: '설정 저장', exact: true }).click();
  await page.locator('#modal[open]').waitFor({ state: 'detached', timeout: 15000 });
  const saved = await page.evaluate(async () => (await import('/js/shared/state.js')).store.db.settings[0]);
  assert.equal(saved.salary.period, 'month');
  assert.equal(saved.pointMode, 'salary');
  assert.equal(saved.salary.jobs, true);
  assert.equal(saved.salary.jobWages[seed.a].amount, 50, '직업 월급도 함께 저장한다');
  assert.equal((await page.locator('#toast').innerText()).trim(), '월급 설정을 저장했습니다.');
  assert.deepEqual(errors, [], '화면 오류 없음');
  console.log('PASS: 월급 주기 2주/한달·칭찬/칭찬-조언·배수·직업 전환, 미리보기, 일괄 지급, 잔액·거래내역·중복 지급 방지, 375px 확인. 캡처:', shots);
} finally {
  await browser?.close();
  server.close();
}
