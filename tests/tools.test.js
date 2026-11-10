import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolCandidates, parseToolList, shuffledTools, remainingTools, toolClockValue, formatToolTime, clampToolWindow, stepToolRace } from '../js/shared/tools-core.js';
import { toolQrMatrix } from '../js/shared/tools-qr.js';
test('수업도구 학생 후보는 활성 명단 번호순이며 별명/번호 표시는 실명을 포함하지 않음', () => {
  const students = [{
    id: 'b',
    no: 2,
    name: '김학생',
    alias: '파랑'
  }, {
    id: 'a',
    no: 1,
    name: '박학생'
  }, {
    id: 'c',
    no: 3,
    name: '제외',
    deletedAt: 'x'
  }];
  assert.deepEqual(toolCandidates(students).map(s => s.label), ['1. 박학생', '2. 김학생']);
  const masked = toolCandidates(students, true);
  assert.deepEqual(masked.map(s => s.label), ['1번', '파랑']);
  assert.equal(masked[0].id, 'a');
  assert(!JSON.stringify(masked).includes('학생'));
});
test('상자·룰렛·레이스가 공유하는 비복원 후보는 ID로 제외하고 표시명 변경 시에도 보존', () => {
  const students = [{
      id: 'a',
      no: 1,
      name: '가온'
    }, {
      id: 'b',
      no: 2,
      name: '다온',
      alias: '별'
    }],
    drawn = new Set(['a']);
  for (const privateNames of [false, true]) {
    const candidates = toolCandidates(students, privateNames);
    assert.equal(remainingTools(candidates, drawn).length, 1);
    assert.equal(remainingTools(candidates, drawn)[0].id, 'b');
    assert.equal(remainingTools(candidates, drawn, true).length, 2);
  }
  drawn.clear();
  assert.equal(remainingTools(toolCandidates(students), drawn).length, 2);
});
test('사용자 후보는 쉼표/줄바꿈을 지원하고 같은 텍스트도 서로 다른 카드로 유지', () => {
  const items = parseToolList('칭찬 쿠폰,과자\n자리선택권\r\n과자');
  assert.equal(items.length, 4);
  assert.equal(new Set(items.map(i => i.id)).size, 4);
  assert.deepEqual(shuffledTools(items, () => 0).map(i => i.label), ['과자', '자리선택권', '과자', '칭찬 쿠폰']);
  assert.equal(items[0].label, '칭찬 쿠폰');
});
test('타이머·스톱워치는 경과 시각으로 계산하고 1/100초 표시를 지원', () => {
  assert.equal(toolClockValue({
    elapsed: 1500,
    started: 2000
  }, 4500), 4000);
  assert.equal(toolClockValue({
    elapsed: 1500,
    started: null
  }, 99999), 1500);
  assert.equal(formatToolTime(61234, true), '01:01.23');
  assert.equal(formatToolTime(-1), '00:00');
});
test('도구 창은 화면 경계에서 제목을 잃지 않고 최소 크기를 유지', () => {
  const r = clampToolWindow({
    left: -50,
    top: 900,
    width: 100,
    height: 50
  }, 384, 600);
  assert.equal(r.left, 0);
  assert.equal(r.top, 556);
  assert.equal(r.width, 260);
  assert.equal(r.height, 200);
});
test('핀볼은 벽/핀과 충돌하고 실제 결승선을 통과한 순서만 순위를 부여', () => {
  const balls = [{
    x: 30,
    y: 95,
    vx: 0,
    vy: 50,
    r: 10,
    rank: 0
  }, {
    x: 70,
    y: 10,
    vx: 0,
    vy: 0,
    r: 10,
    rank: 0
  }];
  assert.equal(stepToolRace(balls, [], .1, 100, 100), false);
  assert.equal(balls[0].rank, 1);
  for (let i = 0; i < 100 && !balls[1].rank; i++) stepToolRace(balls, [], .02, 100, 100);
  assert.equal(balls[1].rank, 2);
  const hit = {
    x: 2,
    y: 30,
    vx: -20,
    vy: 0,
    r: 6,
    rank: 0
  };
  stepToolRace([hit], [{
    x: 10,
    y: 34,
    r: 5
  }], .01, 100, 100);
  assert(hit.x >= 0);
  assert(Number.isFinite(hit.vx));
});
test('QR은 URL/한글/긴 텍스트의 버전에 맞는 정방형과 파인더/여백 구성을 생성', () => {
  const small = toolQrMatrix('안녕'),
    large = toolQrMatrix('한글'.repeat(100));
  assert(small.length < large.length);
  assert(small.every(row => row.length === small.length));
  assert(small[0][0]);
  assert(small[6][6]);
  assert.equal(small[1][1], false);
  assert(large.every(row => row.every(v => typeof v === 'boolean')));
  assert.throws(() => toolQrMatrix('한'.repeat(1000)), /너무 깁니다/);
});
test('첫 도구는 캔버스를 채우고 이후 도구는 넉넉한 복원 크기로 생성', async () => {
  const {
    defaultToolRect
  } = await import('../js/shared/tools-core.js');
  assert.deepEqual(defaultToolRect(0, 1200, 700), {
    left: 0,
    top: 0,
    width: 1200,
    height: 700
  });
  const next = defaultToolRect(1, 1200, 700);
  assert(next.width > 440);
  assert(next.height > 390);
  assert(next.left + next.width <= 1200);
  assert(next.top + next.height <= 700);
});
test('핀 격자는 좌우 40px 여백과 9개 교차 행을 유지', async () => {
  const {
    makeToolPegs
  } = await import('../js/shared/tools-core.js');
  const pegs = makeToolPegs();
  assert.equal(new Set(pegs.map(p => p.row)).size, 9);
  for (let row = 0; row < 9; row++) {
    const xs = pegs.filter(p => p.row === row).map(p => p.x);
    assert.equal(Math.min(...xs), 40);
    assert.equal(Math.max(...xs), 600);
    assert(xs.length >= 12);
  }
  assert.notDeepEqual(pegs.filter(p => p.row === 0).map(p => p.x), pegs.filter(p => p.row === 1).map(p => p.x));
});
test('다양한 난수 레이스의 모든 구슬은 여러 행과 충돌하고 고유한 순위로 완주', async () => {
  const {
    makeToolPegs,
    createToolRaceBalls,
    stepToolRace
  } = await import('../js/shared/tools-core.js');
  const pegs = makeToolPegs();
  for (let seed = 1; seed <= 30; seed++) {
    let state = seed;
    const random = () => (state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296;
    const balls = createToolRaceBalls(Array.from({
      length: 25
    }, (_, i) => ({
      id: String(i),
      label: String(i)
    })), pegs, random);
    assert.equal(balls[0].y - balls[1].y, 28);
    const dt = [1 / 240, 1 / 120, 1 / 100][seed % 3];
    let duration = 0;
    for (; duration < 40 && !balls.every(b => b.rank); duration += dt) stepToolRace(balls, pegs, dt, 640, 440, {
      left: 40,
      right: 600,
      random
    });
    assert(balls.every(b => b.rank), `seed ${seed}: 완주`);
    assert(balls.every(b => b.collisions >= 2), `seed ${seed}: 충돌`);
    assert(balls.every(b => b.contactRows.toString(2).replaceAll('0', '').length >= 2), `seed ${seed}: 다른 행 충돌`);
    assert.deepEqual(balls.map(b => b.rank).sort((a, b) => a - b), Array.from({
      length: 25
    }, (_, i) => i + 1));
    assert(duration > 3);
  }
});
test('동일 스텝에서 결승선을 건너도 배열 순서 대신 도달 비율로 순위를 부여', () => {
  const balls = [{
    x: 30,
    y: 98,
    vx: 0,
    vy: 15,
    r: 10,
    rank: 0
  }, {
    x: 70,
    y: 99,
    vx: 0,
    vy: 15,
    r: 10,
    rank: 0
  }];
  stepToolRace(balls, [], .1, 100, 100);
  assert.equal(balls[1].rank, 1);
  assert.equal(balls[0].rank, 2);
});
