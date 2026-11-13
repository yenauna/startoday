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
    const s = store.db.students[0],
      day = C.today();
    window.studentId = s.id;
    let ops = [{
      table: 'students',
      id: s.id,
      data: {
        ...s,
        password: '한글암호7',
        passwordChanged: true,
        passwordResetRequired: false
      }
    }];
    for (const [i, area] of ['학습', '과제', '관계', '도전', '생활', '알바'].entries()) for (let j = 0; j < 45; j++) ops.push({
      table: 'records',
      id: 'xp' + i + '-' + j,
      data: {
        id: 'xp' + i + '-' + j,
        date: day,
        kind: '칭찬',
        studentIds: [s.id],
        text: '키워드 없는 칭찬',
        areas: [area],
        createdAt: C.now()
      }
    });
    await store.commit(ops);
    state.tab = '대시보드';
    render();
  });
  assert.equal(await page.locator('#quick-kingdom').count(), 0);
  await page.locator('article.student').first().locator('.student-head button').click();
  await page.locator('#modal').getByRole('button', {
    name: '👁️ 학생 화면으로 보기',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '별명 설정',
    exact: true
  }).click();
  await page.locator('#modal input[name=nickname]').fill('별 a!');
  assert.equal(await page.locator('#modal input[name=nickname]').inputValue(), '별');
  await page.locator('#modal input[name=nickname]').fill('반짝별');
  await page.locator('#modal button[type=submit]').click();
  assert.equal(await page.locator('.student-profile-nickname>span').textContent(), '반짝별');
  await page.getByRole('button', {
    name: '칭호도감 열기',
    exact: true
  }).click();
  assert.equal(await page.locator('#modal .kingdom-domain').count(), 6);
  assert((await page.locator('#modal').textContent()).includes('통찰의 현자'));
  assert((await page.locator('#modal').textContent()).includes('길드의 대들보'));
  assert(!(await page.locator('#modal').textContent()).includes('책탑의 사서'));
  await page.locator('[data-equip-title="learning:3"]').click();
  await page.locator('.kingdom-current [data-equipped-title="learning:3"]').waitFor();
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '교사 화면으로 돌아가기',
    exact: true
  }).click();
  assert((await page.locator('article.student').first().locator('.student-head').textContent()).includes('(반짝별)'));
  await page.reload();
  await page.getByRole('button', {
    name: '가상 명단으로 먼저 살펴보기',
    exact: true
  }).click();
  assert((await page.locator('article.student').first().locator('.student-head').textContent()).includes('(반짝별)'));
  await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    window.studentId = store.db.students[0].id;
    const {
      navigate
    } = await import('/js/app.js');
    navigate('설정');
  });
  await page.locator('[data-settings-tab="경험치 종류"]').click();
  await page.locator('#title-goal').fill('30');
  await page.getByRole('button', {
    name: '칭호 목표 저장',
    exact: true
  }).click();
  assert.equal(await page.evaluate(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.settings[0].titleGoal;
  }), 30);
  await page.locator('[data-settings-tab="학생 명단"]').click();
  assert((await page.locator('[data-settings-category="학생 명단"] table').textContent()).includes('가온(반짝별)'));
  await page.evaluate(async () => {
    const {
      navigate
    } = await import('/js/app.js');
    navigate('과제');
  });
  await page.getByRole('button', {
    name: '+ 과제',
    exact: true
  }).click();
  await page.locator('#modal input[name=title]').fill('독서 원정');
  await page.locator('#modal input[name=isQuest]').check();
  await page.locator('#modal input[name=questGoal]').fill('3');
  await page.locator('#modal input[name=questTitle]').fill('책의 탐험가');
  await page.locator('#modal button[type=submit]').click();
  const th = page.locator('.long-assignment-card').filter({
    hasText: '독서 원정'
  });
  assert.equal(await th.locator('.remaining-notdone').count(), 0);
  await th.getByRole('button', { name: '관리', exact: true }).click();
  const student = page.locator('#modal .quest-progress-card').first();
  assert((await student.textContent()).includes('0/3'));
  for (let i = 1; i <= 3; i++) {
    await page.locator('#modal .quest-progress-card').first().getByRole('button', {
      name: '+ 도장',
      exact: true
    }).click();
    await page.waitForFunction(async n => {
      const {
        store
      } = await import('/js/shared/state.js');
      return store.db.assignmentStates.find(st => st.studentId === window.studentId)?.stamps === n;
    }, i);
  }
  assert((await page.locator('#modal .quest-progress-card').first().textContent()).includes('3/3'));
  assert((await page.locator('#toast').textContent()).includes('칭호를 획득'));
  await page.locator('#modal .quest-progress-card').first().getByRole('button', {
    name: '−',
    exact: true
  }).click();
  await page.waitForFunction(async () => {
    const {
      store
    } = await import('/js/shared/state.js');
    return store.db.assignmentStates.find(st => st.studentId === window.studentId)?.stamps === 2;
  });
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  await page.evaluate(async () => {
    const {
      previewStudent
    } = await import('/js/tabs/student-view.js');
    const {
      store
    } = await import('/js/shared/state.js');
    previewStudent(store.db.students[0].id);
  });
  assert((await page.locator('.student-task').filter({
    hasText: '독서 원정'
  }).textContent()).includes('2/3'));
  assert.equal(await page.locator('.quest-stamp-board .is-stamped').count(), 2);
  await page.getByRole('button', {
    name: '칭호도감 열기',
    exact: true
  }).click();
  assert((await page.locator('#modal [data-kingdom-domain=learning]').textContent()).includes('칭찬 45회 · 1/3단계'));
  const reward = page.locator('.quest-reward-collection button');
  assert.equal(await reward.count(), 1);
  await reward.click();
  await page.locator('.kingdom-current .kingdom-badge').filter({
    hasText: '책의 탐험가'
  }).waitFor();
  await page.locator('#modal .dialog-head').getByRole('button', {
    name: '닫기',
    exact: true
  }).click();
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  assert(await page.locator('.student-shell').evaluate(e => e.scrollWidth <= innerWidth + 1));
  await page.getByRole('button', {
    name: '교사 화면으로 돌아가기',
    exact: true
  }).click();
  await page.setViewportSize({
    width: 1280,
    height: 1000
  });
  // Dynamic voices choose a newly available Natural voice, with comfortable defaults.
  await page.evaluate(() => {
    window.qaVoices = [{
      name: 'Legacy Korean',
      lang: 'ko-KR',
      voiceURI: 'legacy'
    }];
    window.qaSpeech = [];
    const synthesis = new EventTarget();
    synthesis.getVoices = () => window.qaVoices;
    synthesis.cancel = () => {};
    synthesis.speak = u => window.qaSpeech.push({
      voice: u.voice?.voiceURI,
      rate: u.rate,
      pitch: u.pitch,
      text: u.text
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: synthesis,
      configurable: true
    });
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
  });
  await page.locator('nav.tabs').getByRole('button', {
    name: '수업도구',
    exact: true
  }).click();
  await page.locator('.tools-toolbar').getByRole('button', {
    name: /음성 안내/
  }).click();
  const speech = page.locator('[data-tool-type=speech]');
  await page.evaluate(() => {
    window.qaVoices.push({
      name: 'Microsoft SunHi Natural',
      lang: 'ko-KR',
      voiceURI: 'natural'
    });
    window.speechSynthesis.dispatchEvent(new Event('voiceschanged'));
  });
  assert.equal(await page.locator('[aria-label="목소리 선택"]').inputValue(), 'natural');
  assert.equal(await page.locator('[aria-label="낭독 속도"]').inputValue(), '0.95');
  await page.getByRole('button', {
    name: '자리에 앉아 바른 자세로 준비하세요.',
    exact: true
  }).click();
  assert.deepEqual(await page.evaluate(() => ({
    voice: qaSpeech[0].voice,
    rate: qaSpeech[0].rate,
    pitch: qaSpeech[0].pitch
  })), {
    voice: 'natural',
    rate: .95,
    pitch: 1
  });
  assert.deepEqual(errors, []);
  console.log('PASS: Korean student nickname and teacher display/reload, six XP titles/settings, quest creation/stamps/permanent reward/equip/mobile board, dynamic Natural TTS defaults');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
