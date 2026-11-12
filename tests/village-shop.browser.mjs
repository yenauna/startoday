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
    const s = store.db.students[0];
    const entries = [['쿠폰', '작은 자리 선택권', 10, null], ['물품', '온 학급 친구들과 함께 쓰는 아주아주 긴 이름의 특별한 문구 꾸러미 선물 세트', 15, 5], ['간식', '초코 쿠키', 10, 0], ['혜택', '특별한 하루', 99999, 2], ['우리 반 특별 수업 기념품 모음', '오래된 자료도 보이는 기념품', 20, 3]];
    const ops = entries.map(([category, name, price, stock]) => {
      const id = C.uid();
      return {
        table: 'shop_items',
        id,
        data: {
          id,
          category,
          name,
          price,
          stock
        }
      };
    });
    await store.commit(ops);
    window.villageStudent = s.id;
    state.impersonatingStudentId = s.id;
    state.viewMode = 'student';
    (await import('/js/app.js')).render();
  });
  await page.getByRole('button', {
    name: '경제',
    exact: true
  }).click();
  assert.ok((await page.locator('.village-empty').innerText()).includes('보관함이 비어 있어요'));
  assert.equal(await page.locator('.village-ledger-empty').count(), 1);
  await page.getByRole('button', {
    name: '내 교실(홈)',
    exact: true
  }).click();
  await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    const C = await import('/js/core.js');
    const sid = window.villageStudent;
    const ops = Array.from({
      length: 9
    }, (_, i) => {
      const id = C.uid();
      return {
        table: 'economy_tx',
        id,
        data: {
          id,
          studentId: sid,
          type: i === 0 ? '구매' : '선물',
          itemId: store.db.shop_items[0].id,
          itemName: i === 1 ? '우리 반 모험가가 차곡차곡 모아 둔 이름이 아주 긴 특별한 물품 보관함 테스트' : '보관 물품 ' + (i + 1),
          amount: i === 0 ? -10 : 0,
          status: '보유',
          createdAt: C.now()
        }
      };
    });
    await store.commit([...ops, ...C.teacherBalanceAdjustOps(store.db, sid, 25, '비공개 교사 사유'), ...C.teacherBalanceAdjustOps(store.db, sid, -5, '비공개 교사 사유')]);
    (await import('/js/app.js')).render();
  });
  const home = (await page.locator('.student-profile-card').innerHTML()).replace(/data-action="[0-9]+"/g, '');
  await page.getByRole('button', {
    name: '경제',
    exact: true
  }).click();
  const assets = await page.locator('.student-economy').innerText();
  await page.getByRole('button', {
    name: '상점',
    exact: true
  }).click();
  assert.equal(await page.locator('.village-shop').count(), 1);
  assert.equal(await page.locator('.economy-wallet').count(), 0);
  assert.equal(await page.locator('.village-shop .economy-item').count(), 11);
  assert.equal(await page.locator('.village-product img,.village-product svg').count(), 0);
  assert.equal(await page.locator('.village-product').filter({
    has: page.getByRole('heading', {
      name: '초코 쿠키',
      exact: true
    })
  }).getByRole('button', {
    name: '품절'
  }).isDisabled(), true);
  assert.equal(await page.locator('.village-product').filter({
    has: page.getByRole('heading', {
      name: '특별한 하루',
      exact: true
    })
  }).getByRole('button', {
    name: '잔액 부족'
  }).isDisabled(), true);
  assert.ok((await page.locator('.village-product').filter({
    has: page.getByRole('heading', {
      name: '작은 자리 선택권',
      exact: true
    })
  }).innerText()).includes('무제한'));
  for (const width of [320, 340, 341, 360, 390, 640, 641, 768, 900, 901, 1100, 1440, 1920, 2560]) {
    await page.setViewportSize({
      width,
      height: 1000
    });
    const layout = await page.locator('.village-shop').evaluate(el => ({
      columns: getComputedStyle(el.querySelector('.village-product-grid')).gridTemplateColumns.split(' ').length,
      gridWidth: el.querySelector('.village-product-grid').clientWidth,
      gap: parseFloat(getComputedStyle(el.querySelector('.village-product-grid')).columnGap),
      cardWidths: [...el.querySelectorAll('.village-product')].map(card => card.getBoundingClientRect().width),
      headerWidth: document.querySelector('.student-header').getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      texture: getComputedStyle(el).backgroundSize,
      categoryScroll: el.querySelector('[aria-label="상품 카테고리"]').scrollWidth > el.querySelector('[aria-label="상품 카테고리"]').clientWidth
    }));
    if (width <= 900) assert.equal(layout.columns, width <= 340 ? 1 : width <= 640 ? 2 : 3);else {
      assert.equal(layout.columns, Math.floor((layout.gridWidth + layout.gap) / (180 + layout.gap)));
      assert.ok(layout.columns >= 4);
      if (width >= 1100) assert.ok(layout.columns >= 5);
      assert.ok(layout.cardWidths.every(cardWidth => cardWidth >= 179.9 && cardWidth <= 220.1));
      assert.ok(layout.headerWidth <= 1010.1); // Common header keeps its original column.
    }
    assert.ok(layout.cardWidths.every(cardWidth => cardWidth <= 220.1));
    assert.equal(layout.overflow, false);
    assert.equal(layout.texture, '112px 76px');
    if (width === 390) assert.ok(layout.categoryScroll);
    if ([390, 1100].includes(width)) await page.screenshot({
      path: '/tmp/village-shop-' + width + '.png',
      fullPage: true
    });
    await page.getByRole('button', {
      name: '혜택',
      exact: true
    }).click();
    assert.deepEqual(await page.locator('.village-product h3').allTextContents(), ['5분 자유시간권', '특별한 하루']);
    await page.getByRole('button', {
      name: '우리 반 특별 수업 기념품 모음',
      exact: true
    }).click();
    assert.equal(await page.locator('.village-product').count(), 1);
    await page.getByRole('button', {
      name: '전체',
      exact: true
    }).click();
    await page.getByRole('button', {
      name: '내 자산',
      exact: true
    }).click();
    assert.equal(await page.locator('.village-holding').count(), 9);
    assert.equal(await page.locator('.student-economy table').count(), 0);
    assert.equal(await page.locator('.village-wallet').count(), 1);
    const assetsLayout = await page.locator('.village-shop').evaluate(el => ({
      columns: getComputedStyle(el.querySelector('.village-product-grid')).gridTemplateColumns.split(' ').length,
      widths: [...el.querySelectorAll('.village-holding')].map(c => c.getBoundingClientRect().width),
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    }));
    assert.equal(assetsLayout.columns, layout.columns);
    assert.ok(assetsLayout.widths.every(w => w <= 220.1));
    assert.equal(assetsLayout.overflow, false);
    assert.equal(await page.locator('.village-ledger-entry').count(), 11);
    assert.ok((await page.locator('.village-ledger .is-credit').innerText()).includes('+25'));
    assert.ok(!(await page.locator('.village-ledger').innerText()).includes('비공개 교사 사유'));
    const useButton = page.locator('.village-holding-actions button').first();
    assert.ok((await useButton.boundingBox()).width >= 70);
    if ([390, 1100].includes(width)) await page.screenshot({
      path: '/tmp/village-assets-' + width + '.png',
      fullPage: true
    });
    await page.getByRole('button', {
      name: '상점',
      exact: true
    }).click();
  }
  page.on('dialog', dialog => dialog.accept());
  const item = page.locator('.village-product').filter({
    has: page.getByRole('heading', {
      name: '작은 자리 선택권',
      exact: true
    })
  });
  const before = await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return (await import('/js/core.js')).studentBalance(store.db, window.villageStudent);
  });
  await item.getByRole('button', {
    name: '구매하기'
  }).click();
  await page.waitForFunction(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.economy_tx.some(t => t.itemName === '작은 자리 선택권');
  });
  const after = await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return (await import('/js/core.js')).studentBalance(store.db, window.villageStudent);
  });
  assert.equal(after, before - 10);
  assert.ok((await page.locator('.village-wallet').innerText()).includes(String(after)));
  await page.getByRole('button', {
    name: '내 자산',
    exact: true
  }).click();
  assert.ok((await page.locator('.student-economy').innerText()).includes('작은 자리 선택권'));
  await page.getByRole('button', {
    name: '내 교실(홈)',
    exact: true
  }).click();
  assert.equal((await page.locator('.student-profile-card').innerHTML()).replace(/data-action="[0-9]+"/g, ''), home);
  await page.getByRole('button', {
    name: '교사 화면으로 돌아가기',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '경제',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '상점 관리',
    exact: true
  }).click();
  assert.equal(await page.locator('.village-shop').count(), 0);
  assert.equal(await page.getByRole('button', {
    name: '새 물품/쿠폰 등록'
  }).count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: themed student shop and holdings,  1/2/3 and auto-fill desktop columns, long name, unlimited/sold-out/insufficient balance, legacy/custom categories, live purchase/holdings and unchanged home/teacher management');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
