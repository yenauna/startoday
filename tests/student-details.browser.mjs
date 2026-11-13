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
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html');
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
    const sid = store.db.students[0].id,
      day = C.today();
    window.detailStudent = sid;
    window.detailDay = day;
    const ops = store.db.records.map(r => ({
      table: 'records',
      id: r.id,
      remove: true
    }));
    for (let i = 0; i < 65; i++) {
      const id = 'detail-praise-' + i;
      ops.push({
        table: 'records',
        id,
        data: {
          id,
          studentIds: [sid],
          kind: '칭찬',
          date: C.addDays(day, -i),
          period: '',
          text: '확인용 칭찬 편지 ' + i,
          areas: ['학습'],
          createdAt: C.now()
        }
      });
    }
    ops.push({
      table: 'records',
      id: 'private-advice',
      data: {
        id: 'private-advice',
        date: day,
        studentIds: [sid],
        kind: '지도',
        text: 'PRIVATE_ADVICE_SECRET',
        areas: ['관계'],
        createdAt: C.now()
      }
    });
    for (const [id, title, isImportant, period] of [['important', '중요 안내', true, null], ['ordinary', '일반 안내', false, null], ['timed', '6교시 일반 안내', false, 6]]) ops.push({
      table: 'events',
      id,
      data: {
        id,
        title,
        date: day,
        isImportant,
        period,
        description: '당일 준비물을 확인하세요'
      }
    });
    for (const item of store.db.shop_items) ops.push({
      table: 'shop_items',
      id: item.id,
      remove: true
    });
    window.mathItem = C.uid();
    window.writingItem = C.uid();
    ops.push({
      table: 'shop_items',
      id: window.mathItem,
      data: {
        id: window.mathItem,
        category: '수학',
        name: '면제',
        price: 10,
        stock: 2
      }
    }, {
      table: 'shop_items',
      id: window.writingItem,
      data: {
        id: window.writingItem,
        category: '글쓰기',
        name: '도움권',
        price: 0,
        stock: null
      }
    });
    await store.commit(ops);
    state.tab = '대시보드';
    state.date = day;
    (await import('/js/app.js')).render();
    return {
      month: Number(day.slice(-2))
    };
  });
  const teacherEvents = await page.locator('.dashboard-today-events').innerText();
  assert.ok(teacherEvents.includes('중요 안내') && teacherEvents.includes('일반 안내'));
  assert.ok((await page.locator('.registered-schedule').innerText()).includes('6교시 일반 안내'));
  await page.evaluate(async () => {
    (await import('/js/tabs/classroom.js')).classroom();
  });
  assert.ok((await page.locator('.classroom-schedule').innerText()).includes('일반 안내'));
  assert.ok((await page.locator('.classroom-schedule').innerText()).includes('중요 안내'));
  assert.ok((await page.locator('.classroom-schedule').innerText()).includes('6교시 일반 안내'));
  await page.locator('#lock-exit').dblclick();
  await page.locator('.lockscreen').waitFor({
    state: 'detached'
  });
  await page.evaluate(async () => {
    (await import('/js/app.js')).navigate('설정');
  });
  const setting = page.locator('#settings-form [name=studentPraisePeriod]');
  assert.equal(await setting.inputValue(), 'all');
  assert.deepEqual(await setting.locator('option').evaluateAll(rows => rows.map(r => r.value)), ['all', '30d', '7d', 'month', 'recent3']);
  for (const [period, count] of [['recent3', 3], ['30d', 30], ['7d', 7], ['month', expected.month], ['all', 65]]) {
    await setting.selectOption(period);
    await page.locator('#settings-form .settings-save').click();
    await page.waitForFunction(async period => (await import('/js/shared/state.js')).store.db.settings[0].studentPraisePeriod === period, period);
    await page.evaluate(async () => {
      (await import('/js/tabs/student-view.js')).previewStudent(window.detailStudent);
    });
    assert.equal(await page.locator('.student-praise').count(), count);
    assert.ok(!(await page.locator('.student-praise-card').innerText()).includes('PRIVATE_ADVICE_SECRET'));
    assert.equal(await page.locator('.student-profile-score strong').innerText(), '64개');
    const today = page.locator(`[data-calendar-date="${await page.evaluate(() => window.detailDay)}"]`);
    assert.equal(await today.locator('.student-calendar-pill').filter({
      hasText: '중요 안내'
    }).count(), 1);
    assert.equal(await today.locator('.student-calendar-pill').filter({
      hasText: '일반 안내'
    }).count(), 0);
    await today.click();
    assert.ok((await page.locator('.student-calendar-detail').innerText()).includes('일반 안내'));
    const agenda = await page.locator('.student-timetable-card').innerText();
    assert.ok(agenda.includes('일반 안내'));
    assert.ok(agenda.includes('중요 안내'));
    assert.ok(agenda.includes('6교시 일반 안내'));
    await page.getByRole('button', {
      name: '교사 화면으로 돌아가기',
      exact: true
    }).click();
  }
  await page.evaluate(async () => {
    (await import('/js/tabs/student-view.js')).previewStudent(window.detailStudent);
  });
  await page.waitForFunction(() => document.querySelector('.student-profile-image')?.naturalWidth > 0);
  assert.equal(await page.locator('.student-profile-image').getAttribute('src'), 'assets/character-default.png');
  assert.equal(await page.locator('.student-profile-image').evaluate(el => getComputedStyle(el).objectFit), 'contain');
  await page.setViewportSize({
    width: 390,
    height: 900
  });
  await page.screenshot({
    path: '/workspace/work/student-character-details-mobile.png',
    fullPage: false
  });
  await page.getByRole('button', {
    name: '경제',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '상점',
    exact: true
  }).click();
  const categoryNav = page.locator('[aria-label="상품 카테고리"]');
  assert.deepEqual(await categoryNav.getByRole('button').allTextContents(), ['전체', '수학', '글쓰기']);
  assert.equal(await categoryNav.getByRole('button', {
    name: '쿠폰',
    exact: true
  }).count(), 0);
  await categoryNav.getByRole('button', {
    name: '수학',
    exact: true
  }).click();
  assert.deepEqual(await page.locator('.village-product h3').allTextContents(), ['면제']);
  page.on('dialog', d => d.accept());
  await page.getByRole('button', {
    name: '구매하기',
    exact: true
  }).click();
  await page.waitForFunction(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.economy_tx.some(t => t.itemId === window.mathItem && t.type === '구매');
  });
  await page.getByRole('button', {
    name: '내 자산',
    exact: true
  }).click();
  const holding = page.locator('.village-holding');
  assert.equal(await holding.locator('.village-product-plaque').innerText(), '수학');
  assert.equal(await holding.locator('h3').innerText(), '면제');
  assert.equal(await holding.getByRole('button', {
    name: '환불',
    exact: true
  }).count(), 1);
  await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    const item = store.db.shop_items.find(i => i.id === window.mathItem);
    await store.commit([{
      table: 'shop_items',
      id: item.id,
      data: {
        ...item,
        category: '과학',
        deletedAt: new Date().toISOString()
      }
    }]);
    (await import('/js/app.js')).render();
  });
  assert.equal(await holding.locator('.village-product-plaque').innerText(), '수학');
  await page.getByRole('button', {
    name: '상점',
    exact: true
  }).click();
  assert.deepEqual(await categoryNav.getByRole('button').allTextContents(), ['전체', '글쓰기']);
  assert.equal(await page.locator('.village-product').count(), 1);
  await page.getByRole('button', {
    name: '내 자산',
    exact: true
  }).click();
  await holding.getByRole('button', {
    name: '환불',
    exact: true
  }).click();
  await page.waitForFunction(() => document.querySelectorAll('.village-holding').length === 0);
  assert.deepEqual(errors, []);
  console.log('PASS: importance on all today views/grid-only hiding, teacher praise settings/all>50, character PNG, actual category filters and original holding category/refund');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
