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
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.webp') ? 'image/webp' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html');
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
    } = await import('/js/shared/state.js');
    state.impersonatingStudentId = store.db.students[0].id;
    state.viewMode = 'student';
    (await import('/js/app.js')).render();
  });
  assert.ok((await page.locator('.student-timetable-card').innerText()).includes('오늘 등록된 수업이 없습니다.'));
  await page.setViewportSize({
    width: 1100,
    height: 1000
  });
  const emptyHeight = (await page.locator('.student-timetable-card').boundingBox()).height;
  assert.ok(emptyHeight < 290);
  const expected = await page.evaluate(async () => {
    const {
        store,
        state
      } = await import('/js/shared/state.js'),
      C = await import('/js/core.js');
    const student = store.db.students[0],
      day = C.today();
    window.homeDay = day;
    const ops = [{
      table: 'students',
      id: student.id,
      data: {
        ...student,
        name: '이름이아주긴우리반가온',
        nickname: '반짝이는우주고래',
        rewardTitles: [{
          id: 'quest:visual',
          name: '별빛과 약속을 지킨 우리 마을의 든든한 수호자'
        }],
        equippedTitle: 'quest:visual'
      }
    }];
    for (const p of [1, 3]) ops.push({
      table: 'timetables',
      id: day + ':' + p,
      data: {
        id: day + ':' + p,
        date: day,
        period: p,
        subjectCode: p === 1 ? '국어' : '과학',
        publicMemo: '[준비물] 공책과 필통\n모둠과 함께 활동해요',
        privateMemo: '비공개 교사 메모는 보이지 않아야 함'
      }
    });
    const long = '아주 긴 과제 이름도 끝까지 읽을 수 있도록 친구들과 함께 준비물을 정리하고 오늘 배운 내용을 공책에 기록하기';
    ops.push({
      table: 'assignments',
      id: 'home-long',
      data: {
        id: 'home-long',
        title: long,
        date: day,
        target: 'all',
        repeat: {
          type: 'none'
        },
        memo: '안내사항도 줄바꿈을 유지해요\n내일 챙겨 오세요',
        statArea: '과제'
      }
    });
    ops.push({
      table: 'assignments',
      id: 'home-repeat',
      data: {
        id: 'home-repeat',
        title: '반복 일정 확인 과제',
        date: day,
        target: 'all',
        repeat: {
          type: 'daily'
        },
        statArea: '과제'
      }
    });
    for (let i = 0; i < 5; i++) {
      const id = 'home-event-' + i;
      ops.push({
        table: 'events',
        id,
        data: {
          id,
          date: i === 4 ? C.addDays(day, 1) : day,
          title: '학교 행사와 오늘 안내 ' + (i + 1),
          description: '준비물을 잘 확인해요',
          isImportant: i !== 3,
          period: i === 2 ? 3 : null
        }
      });
    }
    for (let i = 0; i < 4; i++) {
      const id = 'home-praise-' + i;
      ops.push({
        table: 'records',
        id,
        data: {
          id,
          date: day,
          period: '1교시',
          kind: '칭찬',
          studentIds: [student.id],
          text: '친구들과 함께 배운 내용을 차분히 돌아보고 서로의 생각을 존중하며 끝까지 도전했어요. '.repeat(8) + '\n두 번째 줄도 끝까지 보여야 해요.',
          areas: ['학습', '관계'],
          createdAt: C.now()
        }
      });
    }
    ops.push({
      table: 'records',
      id: 'home-private',
      data: {
        id: 'home-private',
        date: day,
        kind: '지도',
        studentIds: [student.id],
        text: '비공개 조언 내용은 학생에게 표시하지 않기',
        areas: ['관계'],
        createdAt: C.now()
      }
    });
    await store.commit(ops);
    await store.commit(C.taskStateOps(store.db, store.db.assignments[0], day, student.id, '완료'));
    await store.commit(C.taskStateOps(store.db, store.db.assignments[1], day, student.id, '면제'));
    await store.commit(C.taskStateOps(store.db, store.db.assignments.find(a => a.id === 'home-long'), day, student.id, '안함'));
    (await import('/js/app.js')).render();
    return {
      total: C.scores(store.db, student.id, '', day).total,
      long
    };
  });
  const rootHome = page.locator('.student-home-village');
  assert.equal(await rootHome.count(), 1);
  assert.equal(await page.locator('.student-profile-info .student-profile-areas').count(), 1);
  assert.equal(await page.locator('.student-home-topbar .economy-subtabs').count(), 1);
  assert.ok((await page.locator('.student-home-scene-wall').evaluate(el => getComputedStyle(el).backgroundImage)).includes('student-arch.webp'));
  assert.equal(await page.locator('.student-character-scene').evaluate(el => el.getBoundingClientRect().height >= 300), true);
  assert.equal(await page.locator('.student-profile-score strong').innerText(), expected.total + '개');
  assert.ok((await page.locator('.student-profile-name').innerText()).includes('이름이아주긴우리반가온'));
  assert.ok((await page.locator('.student-profile-card .kingdom-badge').innerText()).includes('든든한 수호자'));
  assert.equal(await page.locator('.student-character-equipment').count(), 1);
  assert.equal(await page.locator('.student-profile-art').getAttribute('aria-hidden'), 'true');
  assert.equal(await rootHome.locator(':scope > .student-card').count(), 5);
  assert.equal(await page.locator('.student-timetable-card .subject-title').count(), 2);
  assert.ok((await page.locator('.student-tasks-card').innerText()).includes(expected.long));
  assert.ok((await page.locator('.student-tasks-card').innerText()).includes('면제'));
  assert.equal((await page.locator('.student-praise-card').getByText('두 번째 줄도 끝까지 보여야 해요.', {
    exact: false
  }).count()) >= 4, true);
  assert.ok(!(await rootHome.innerText()).includes('비공개 조언'));
  assert.ok(!(await rootHome.innerText()).includes('비공개 교사 메모'));
  const day = await page.evaluate(() => window.homeDay),
    today = page.locator(`[data-calendar-date="${day}"]`);
  assert.equal(await today.evaluate(el => el.classList.contains('is-today')), true);
  await today.click();
  assert.ok((await page.locator('.student-calendar-detail').innerText()).includes(expected.long));
  await page.getByRole('button', {
    name: '주간',
    exact: true
  }).click();
  assert.equal(await page.locator('.student-calendar-day').count(), 7);
  await page.getByRole('button', {
    name: '월간',
    exact: true
  }).click();
  assert.equal(await page.locator('.student-calendar-day').count(), 42);
  assert.ok(await page.locator('.student-calendar-grid').evaluate(el => [...el.querySelectorAll('.student-calendar-day')].every(day => getComputedStyle(day).backgroundImage === 'none')));
  await page.getByRole('button', {
    name: '다음 학생 달력',
    exact: true
  }).click();
  assert.ok(!(await page.locator('.student-calendar-controls strong').innerText()).includes(day.slice(0, 7).replace('-', '.')));
  await page.getByRole('button', {
    name: '이전 학생 달력',
    exact: true
  }).click();
  const nextDay = await page.evaluate(async () => {
    return (await import('/js/core.js')).addDays(window.homeDay, 1);
  });
  await page.locator(`[data-calendar-date="${nextDay}"]`).click();
  assert.ok((await page.locator('.student-calendar-detail').innerText()).includes('학교 행사와 오늘 안내 5'));
  assert.equal(await today.evaluate(el => el.classList.contains('is-today')), true);
  assert.equal(await page.locator(`[data-calendar-date="${nextDay}"]`).getAttribute('aria-pressed'), 'true');
  const routine = page.locator('.student-routine-toggle').first();
  await routine.click();
  await page.waitForFunction(() => document.querySelector('.student-routine-toggle')?.getAttribute('aria-pressed') === 'true');
  await routine.click();
  await page.waitForFunction(() => document.querySelector('.student-routine-toggle')?.getAttribute('aria-pressed') === 'false');
  await page.getByRole('button', {
    name: '별명 설정',
    exact: true
  }).click();
  await page.locator('#modal [name=nickname]').fill('우주고래');
  await page.locator('#modal button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('.student-profile-nickname>span')?.textContent === '우주고래');
  await page.getByRole('button', {
    name: '칭호 도감 ›',
    exact: true
  }).click();
  await page.locator('#modal .kingdom-current [data-equipped-title="quest:visual"]').waitFor();
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({
      width,
      height: 1000
    });
    const layout = await rootHome.evaluate(el => {
      const schedule = el.querySelector('.student-timetable-card').getBoundingClientRect(),
        tasks = el.querySelector('.student-tasks-card').getBoundingClientRect();
      return {
        sx: schedule.x,
        sy: schedule.y,
        sb: schedule.bottom,
        tx: tasks.x,
        ty: tasks.y,
        overflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    });
    assert.equal(layout.overflow, false);
    if (width > 640) {
      assert.ok(layout.tx > layout.sx);
      assert.ok(Math.abs(layout.sy - layout.ty) < 2);
    } else assert.ok(layout.ty >= layout.sb);
    for (const letter of await page.locator('.student-praise').all()) {
      assert.equal(await letter.evaluate(el => el.scrollHeight <= el.clientHeight + 2), true);
    }
    if ([390, 1280].includes(width)) await page.screenshot({
      path: '/workspace/work/student-home-village-' + width + '.png',
      fullPage: true
    });
    if ([390, 1280].includes(width)) await page.screenshot({
      path: '/workspace/work/student-home-village-' + width + '-top.png',
      fullPage: false
    });
  }
  // Large star totals use the existing value field; no wallet/coin value is substituted.
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
  assert.ok((await page.locator('.student-profile-score').innerText()).includes('123456789'));
  await page.getByRole('button', {
    name: '경제',
    exact: true
  }).click();
  assert.equal(await page.locator('.student-home-village').count(), 0);
  assert.equal(await page.locator('.village-shop').count(), 1);
  assert.equal(await page.locator('.student-home-sign').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: scoped village home, layered character, star/nickname/title data, empty/populated schedules, long tasks/praise, routine toggle, calendar controls/today and responsive layout');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
