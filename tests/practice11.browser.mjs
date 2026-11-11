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
    // Isolate regression fixtures from the enriched public demo seed.
    for (const table of ['records','assignments','assignmentStates','routines','routineStates','events','shop_items','economy_tx']) store.db[table] = [];
    localStorage.setItem('startoday-demo-v1', JSON.stringify(store.db));
    const date = C.today(),
      yesterday = C.addDays(date, -1);
    window.qaDate = date;
    window.qaStudent = store.db.students[0].id;
    const ops = [{
      table: 'settings',
      id: 'main',
      data: {
        ...store.db.settings[0],
        grade: 5,
        lunchAfterPeriod: 3
      }
    }];
    for (let p = 1; p <= 6; p++) ops.push({
      table: 'timetables',
      id: 'p' + p,
      data: {
        id: 'p' + p,
        date,
        period: p,
        subjectCode: p === 2 ? '수학' : '국어',
        publicMemo: '준비물\n태블릿',
        privateMemo: 'PRIVATE_TEACHER'
      }
    });
    for (const [id, period, timeOfDay] of [['아침', 0, 'morning'], ['점심', 7, 'lunch'], ['방과후', 8, 'after'], ['시험', 2, null]]) ops.push({
      table: 'events',
      id,
      data: {
        id,
        date,
        title: id + ' 행사',
        period,
        ...(timeOfDay ? {
          timeOfDay
        } : {}),
        isDday: id === '시험'
      }
    });
    for (const [id, day] of [['today', date], ['past', yesterday]]) ops.push({
      table: 'assignments',
      id,
      data: {
        id,
        title: id === 'today' ? '오늘 과제' : '밀린 과제',
        date: day,
        target: 'all',
        repeat: {
          type: 'none'
        },
        statArea: '과제'
      }
    });
    ops.push({
      table: 'events',
      id: 'future-dday',
      data: {
        id: 'future-dday',
        date: C.addDays(date, 1),
        period: 2,
        title: '미래 디데이 시험',
        isDday: true
      }
    }, {
      table: 'timetables',
      id: 'past-science',
      data: {
        id: 'past-science',
        date: yesterday,
        period: 3,
        subjectCode: '과학'
      }
    });
    await store.commit(ops);
    state.date = date;
    render();
  });
  assert.equal(await page.locator('.toolbar').first().locator('small').textContent(), '작은 기록이 모여 성장이 됩니다.');
  assert.equal(await page.locator('.dashboard-student-controls').getByRole('button', {
    name: '간단히',
    exact: true
  }).count(), 1);
  assert((await page.locator('.dashboard-today-events').textContent()).includes('시험 행사 D-Day'));
  const timeline = await page.locator('.registered-schedule').first().textContent();
  assert(timeline.indexOf('3교시') < timeline.indexOf('점심 행사'));
  assert(timeline.indexOf('점심 행사') < timeline.indexOf('4교시'));
  assert((await page.locator('.dashboard-today-events').textContent()).includes('미래 디데이 시험 D-1'));
  assert(!(await page.locator('.registered-schedule').first().textContent()).includes('미래 디데이 시험'));
  assert(!(await page.locator('.ticker').allTextContents()).join('').includes('미래 디데이 시험'));
  // A parsed lesson and a manual lesson both link the actual selected date's subject.
  const quickSave = async (text, period, date) => {
    if (date) {
      await page.locator('#quick-date').fill(date);
      await page.locator('#quick-date').dispatchEvent('change');
    }
    await page.locator('#quick-student-query').fill('1');
    await page.locator('#quick-student-query').press('Enter');
    await page.locator('#quick-text').fill(text);
    await page.locator('#quick-period').click();
    await page.locator('#modal [data-period-value]').filter({
      hasText: period === '자동' ? '시간 자동' : period
    }).click();
    await page.locator('.quick-areas .area-chip').first().click();
    await page.locator('.record-actions').getByRole('button', {
      name: '칭찬',
      exact: true
    }).click();
  };
  await quickSave('2교시 친구를 도와줌', '자동');
  assert.equal(await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.records.find(r => r.text.includes('친구를 도와줌')).subjectCode;
  }), '수학');
  const past = await page.evaluate(async () => {
    const C = await import('/js/core.js');
    return C.addDays(window.qaDate, -1);
  });
  await quickSave('준비물을 챙겨줌', '3교시', past);
  assert.deepEqual(await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    const r = store.db.records.find(r => r.text.includes('준비물을 챙겨줌'));
    return {
      date: r.date,
      subject: r.subjectCode,
      text: r.text
    };
  }), {
    date: past,
    subject: '과학',
    text: '[과학] 준비물을 챙겨줌'
  });
  await page.locator('#quick-date').fill(await page.evaluate(() => window.qaDate));
  await page.locator('#quick-date').dispatchEvent('change');
  const teacherTimeStyle = await page.locator('.registered-schedule .timeline-slot').first().evaluate(e => ({
    background: getComputedStyle(e).backgroundColor,
    size: getComputedStyle(e.querySelector('strong')).fontSize,
    weight: getComputedStyle(e.querySelector('strong')).fontWeight
  }));
  // Notice formatting uses 4x5 native popovers without losing the selected text.
  await page.locator('#notice-editor').fill('안내 문장');
  await page.locator('#notice-editor').evaluate(editor => {
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editor.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true
    }));
  });
  await page.locator('#notice-toolbar').getByRole('button', {
    name: '글자 크기',
    exact: true
  }).click();
  await page.locator('.size-card-picker:popover-open').getByRole('button', {
    name: '20pt',
    exact: true
  }).click();
  await page.locator('#notice-toolbar').getByRole('button', {
    name: '글자 색상',
    exact: true
  }).click();
  assert.equal(await page.locator('.color-card-picker:popover-open button').count(), 20);
  assert.equal(await page.locator('.color-card-picker:popover-open').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 4);
  await page.locator('.color-card-picker:popover-open').getByRole('button', {
    name: '보라',
    exact: true
  }).click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('#notice-editor span').first().evaluate(e => getComputedStyle(e).color), 'rgb(126, 34, 206)');
  await page.locator('nav.tabs').getByRole('button', {
    name: '과제',
    exact: true
  }).click();
  await page.locator('.assignment-title').filter({
    hasText: '오늘 과제'
  }).click();
  assert.equal(await page.locator('#modal .assignment-progress-item').count(), 20);
  const card = page.locator('#modal .assignment-progress-item').first();
  assert.equal(await card.locator('.assignment-progress-status').textContent(), '진행중');
  await card.click();
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#modal .assignment-progress-item').first().locator('.assignment-progress-status').textContent(), '완료');
  await page.locator('#modal').getByRole('button', {
    name: '남은 진행중 전체 안함',
    exact: true
  }).click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#modal .assignment-progress-status').filter({
    hasText: '안함'
  }).count(), 19);
  assert.equal(await page.locator('#modal .assignment-progress-status').filter({
    hasText: '완료'
  }).count(), 1);
  await page.locator('#modal .assignment-progress-item').nth(1).click({
    button: 'right'
  });
  await page.locator('#modal select[name=status]').selectOption('면제');
  await page.locator('#modal button[type=submit]').click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#modal .assignment-progress-status').filter({
    hasText: '면제'
  }).count(), 1);
  await page.keyboard.press('Escape');
  // Calendar plus seeds the date and checker card selection is saved with the form.
  const add = page.locator('.assignment-calendar-add').nth(10),
    label = await add.getAttribute('aria-label'),
    expectedDate = label.split(' ')[0];
  await add.click();
  assert.equal(await page.locator('#modal input[name=date]').inputValue(), expectedDate);
  await page.locator('#modal input[name=title]').fill('카드 확인 과제');
  assert.equal(await page.locator('.checker-choice').count(), 21);
  await page.locator('.checker-choice').nth(2).click();
  await page.locator('.checker-choice').first().click();
  assert.equal(await page.locator('input[name=checkerStudentId]:checked').inputValue(), '');
  await page.locator('.checker-choice').nth(2).click();
  assert.equal(await page.locator('#modal input[name=checkerStudentId]:checked').inputValue(), await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.students[1].id;
  }));
  await page.locator('#modal button[type=submit]').click();
  // Reopening an assignment retains the native radio choice, and teacher reset is one tap.
  await page.locator('.assignment-calendar-task').filter({
    hasText: '카드 확인 과제'
  }).click();
  await page.locator('#modal').getByRole('button', {
    name: '수정',
    exact: true
  }).click();
  assert.equal(await page.locator('#modal input[name=checkerStudentId]:checked').inputValue(), await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.students[1].id;
  }));
  await page.locator('.checker-choice').first().click();
  await page.locator('#modal button[type=submit]').click();
  assert.equal(await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.assignments.find(a => a.title === '카드 확인 과제').checkerStudentId;
  }), null);
  // The matrix header uses the same bulk handler as the calendar modal.
  await page.evaluate(async () => {
    const {
        store
      } = await import('/js/shared/state.js'),
      {
        render
      } = await import('/js/app.js');
    await store.commit([{
      table: 'assignments',
      id: 'header-bulk',
      data: {
        id: 'header-bulk',
        title: '헤더 일괄',
        date: window.qaDate,
        target: 'all',
        repeat: {
          type: 'none'
        },
        noStar: true
      }
    }]);
    render();
  });
  await page.locator('.assignment-matrix thead th').filter({
    hasText: '헤더 일괄'
  }).getByRole('button', {
    name: '남은 진행중 전체 안함',
    exact: true
  }).click();
  await page.waitForFunction(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.assignmentStates.filter(s => s.assignmentId === 'header-bulk' && s.status === '안함').length === 20;
  });
  // Modal cards stay multiple columns in a phone viewport, long press opens details.
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await page.locator('[data-assignment-id="today"][data-assignment-date]').first().click();
  assert.equal(await page.locator('.assignment-progress-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 3);
  const hold = await page.locator('.assignment-progress-item').first().boundingBox();
  await page.mouse.move(hold.x + 20, hold.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  assert.equal(await page.locator('#modal select[name=status]').count(), 1);
  await page.keyboard.press('Escape');
  // Student projection and timeline are safe and preserve teacher-preview interactions.
  await page.evaluate(async () => {
    const {
        store,
        state
      } = await import('/js/shared/state.js'),
      {
        render
      } = await import('/js/app.js');
    state.impersonatingStudentId = window.qaStudent;
    state.viewMode = 'student';
    render();
  });
  assert((await page.locator('.student-growth h2').textContent()).startsWith('내가 모은 별 '));
  assert.equal(await page.locator('.student-task.is-overdue').filter({
    hasText: '밀린 과제'
  }).count(), 1);
  assert(!(await page.locator('.student-shell').textContent()).includes('PRIVATE_TEACHER'));
  const letter = page.locator('.student-praise').filter({
    hasText: '친구를 도와줌'
  });
  assert.equal(await letter.locator('.record-content-line .badge').count(), 1);
  assert.equal(await letter.locator('.record-content-line .body').textContent(), '[수학] 2교시 친구를 도와줌');
  assert(await letter.locator('.record-content-line').evaluate(e => e.querySelector('.badge').compareDocumentPosition(e.querySelector('.body')) & Node.DOCUMENT_POSITION_FOLLOWING));
  assert.deepEqual(await page.locator('.student-timetable-card>.timeline-slot').first().evaluate(e => ({
    background: getComputedStyle(e).backgroundColor,
    size: getComputedStyle(e.querySelector('strong')).fontSize,
    weight: getComputedStyle(e.querySelector('strong')).fontWeight
  })), teacherTimeStyle);
  const studentTimeline = await page.locator('.student-timetable-card').textContent();
  assert(studentTimeline.indexOf('3교시') < studentTimeline.indexOf('점심 행사'));
  assert(studentTimeline.indexOf('점심 행사') < studentTimeline.indexOf('4교시'));
  assert(!(await page.locator('.assignment-checker').first().textContent()).includes('직접'));
  await page.locator('.student-calendar-day').nth(8).click();
  assert.equal(await page.locator('.student-calendar-detail h3').count(), 1);
  await page.getByRole('button', {
    name: '교사 화면으로 돌아가기',
    exact: true
  }).click();
  await page.setViewportSize({
    width: 1280,
    height: 1000
  });
  // Real settings save, in-dialog color pair cards, and all four timeline audiences.
  await page.evaluate(async () => {
    const {
      navigate
    } = await import('/js/app.js');
    navigate('설정');
  });
  assert.equal(await page.locator('[data-settings-category="기본 정보"] select[name=lunchAfterPeriod]').count(), 0);
  await page.locator('[data-settings-tab=학사일정]').click();
  await page.locator('select[name=lunchAfterPeriod]').selectOption('5');
  await page.getByRole('button', {
    name: '설정 저장',
    exact: true
  }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.settings[0].lunchAfterPeriod;
  }), 5);
  await page.evaluate(async () => {
    const {
      subjectEditor
    } = await import('/js/tabs/settings.js');
    subjectEditor();
  });
  await page.locator('#modal input[name=code]').fill('새 특별수업');
  const pair = page.locator('.subject-mood-chip').first();
  await pair.click();
  assert.equal(await pair.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#modal input[name=color]').inputValue(), '#eeeaf8');
  assert.equal(await page.locator('#modal input[name=accentColor]').inputValue(), await pair.evaluate(e => e.style.getPropertyValue('--pair-accent')));
  await page.locator('#modal button[type=submit]').click();
  for (const position of [3, 4, 5]) {
    await page.evaluate(async position => {
      const {
          store,
          state
        } = await import('/js/shared/state.js'),
        {
          navigate
        } = await import('/js/app.js');
      await store.commit([{
        table: 'settings',
        id: 'main',
        data: {
          ...store.db.settings[0],
          lunchAfterPeriod: position
        }
      }]);
      navigate('대시보드');
    }, position);
    const verify = async locator => {
      const text = await locator.textContent();
      assert(text.indexOf(position + '교시') < text.indexOf('점심 행사'));
      assert(text.indexOf('점심 행사') < text.indexOf(position + 1 + '교시'));
    };
    await verify(page.locator('.registered-schedule').first());
    await page.evaluate(async () => {
      const {
        navigate
      } = await import('/js/app.js');
      navigate('시간표·일정');
    });
    const calendarDay = page.locator('.calendar .day').filter({
      has: page.locator('[data-drag="' + (await page.evaluate(() => window.qaDate)) + ':1"]')
    });
    await verify(calendarDay);
    await page.evaluate(async () => {
      const {
        classroom
      } = await import('/js/tabs/classroom.js');
      classroom();
    });
    await verify(page.locator('.classroom-schedule'));
    await page.locator('#lock-exit').dispatchEvent('dblclick');
    await page.evaluate(async () => {
      const {
          state
        } = await import('/js/shared/state.js'),
        {
          render
        } = await import('/js/app.js');
      state.impersonatingStudentId = window.qaStudent;
      state.viewMode = 'student';
      render();
    });
    await verify(page.locator('.student-timetable-card'));
    await page.getByRole('button', {
      name: '교사 화면으로 돌아가기',
      exact: true
    }).click();
  }
  // Rich board applies the same numeric-size/color cards inside a widget.
  await page.locator('nav.tabs').getByRole('button', {
    name: '수업도구',
    exact: true
  }).click();
  await page.locator('.tools-toolbar').getByRole('button', {
    name: /타이핑 판서/
  }).click();
  const editor = page.locator('.tool-rich-editor');
  await editor.fill('판서 서식');
  await editor.evaluate(e => {
    const range = document.createRange();
    range.selectNodeContents(e);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await page.locator('.tool-rich-controls').getByRole('button', {
    name: '글자 크기',
    exact: true
  }).click();
  await page.locator('.size-card-picker:popover-open').getByRole('button', {
    name: '32pt',
    exact: true
  }).click();
  await page.locator('.tool-rich-controls').getByRole('button', {
    name: '글자 색상',
    exact: true
  }).click();
  await page.locator('.color-card-picker:popover-open').getByRole('button', {
    name: '하늘',
    exact: true
  }).click();
  assert.equal(await editor.locator('span').last().evaluate(e => getComputedStyle(e).color), 'rgb(167, 229, 255)');
  assert(Math.abs((await editor.locator('span').last().evaluate(e => parseFloat(getComputedStyle(e).fontSize))) - 32 * 4 / 3) < .1);
  assert.deepEqual(errors, []);
  console.log('PASS: dashboard controls/D-day/lunch, 20-color notice and board pickers, assignment card toggles/bulk/longpress/calendar add/checker, mobile student backlog and safe timeline');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
