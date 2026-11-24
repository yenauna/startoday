import * as C from '../core.js';

/* 디자인 시안 6안(그레이니 히어로)의 밤하늘.
   별자리는 동심원 궤도 대신 자유 좌표의 별 무리를 금빛 선으로 잇는다.
   별 개수와 켜진 별은 실제 진행도(우리 반 학생 수·오늘 할 일 수)를 그대로 따르고,
   끝난 만큼 앞에서부터 차례로 밝아진다. */
const CLASS_SKY = [
  {stars: [[196,52],[232,38],[268,46],[296,70],[262,84],[228,74],[204,88],[250,104],[292,96]], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[5,7],[7,8]]},
  {stars: [[96,140],[132,132],[146,158],[108,168],[70,126],[54,104],[62,82],[152,112]], edges: [[0,1],[1,2],[2,3],[3,0],[0,4],[4,5],[5,6],[1,7]]},
  {stars: [[196,150],[232,166],[272,156],[306,172],[338,158],[268,138],[300,132]], edges: [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]]},
  {stars: [[58,46],[88,28],[120,44],[146,20],[112,80],[74,72]], edges: [[0,1],[1,2],[2,3],[2,4],[4,5],[5,0]]}
];
const MY_SKY = [[214,58],[268,44],[316,74],[338,120],[292,140],[238,132],[186,104],[150,72],[172,36],[224,22],[282,18],[332,40],[352,86],[342,158],[286,176],[218,166]];
const SPARKLES = [[348,44,8],[124,76,5.6],[330,182,6.2],[58,40,4.4],[300,16,5]];

function personalSky(count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    const layer = Math.floor(i / MY_SKY.length);
    const [x, y] = MY_SKY[i % MY_SKY.length];
    stars.push({x: x + layer * 4, y: y + layer * 6});
  }
  const edges = [];
  for (let i = 1; i < count; i += 1) edges.push([i - 1, i]);
  return {stars, edges};
}

function classSky(count) {
  const stars = [];
  const edges = [];
  let cursor = 0;
  for (const cluster of CLASS_SKY) {
    const start = cursor;
    for (const [x, y] of cluster.stars) {
      if (stars.length >= count) break;
      stars.push({x, y});
    }
    cursor = stars.length;
    const taken = cursor - start;
    for (const [a, b] of cluster.edges) if (a < taken && b < taken) edges.push([start + a, start + b]);
  }
  // 별이 모두 들어간 무리(30개)보다 학생이 많으면 같은 무리를 한 겹 더 그려 이어 붙인다.
  if (count > stars.length) {
    const pool = CLASS_SKY.flatMap(cluster => cluster.stars.map(([x, y]) => ({x, y})));
    while (stars.length < count) {
      const layer = Math.floor(stars.length / pool.length);
      const base = pool[stars.length % pool.length];
      stars.push({x: base.x + layer * 4, y: base.y + layer * 5});
    }
    for (let i = pool.length; i < count; i += 1) edges.push([i - 1, i]);
  }
  return {stars, edges};
}

function clusterMarkup({stars, edges}, lit, faint = false) {
  if (!stars.length) return '';
  const lines = edges.map(([a, b]) => {
    const from = stars[a], to = stars[b];
    if (!from || !to) return '';
    const d = `M${from.x} ${from.y}L${to.x} ${to.y}`;
    const on = !faint && a < lit && b < lit;
    return `<path class="constellation-halo" d="${d}"/><path class="constellation-line${on ? ' is-lit' : ''}" d="${d}"/>`;
  }).join('');
  const points = stars.map(({x, y}, index) => {
    const on = !faint && index < lit;
    const glow = on ? `<circle class="star-glow" cx="${x}" cy="${y}" r="7.2"/>` : '';
    return `${glow}<circle class="star-point${on ? ' is-lit' : ''}" cx="${x}" cy="${y}" r="${on ? 3.2 : 2.4}"/>`;
  }).join('');
  return `<g class="constellation-cluster${faint ? ' is-faint' : ''}" data-stars="${stars.length}" data-lit="${faint ? 0 : lit}"${faint ? ' aria-hidden="true"' : ''}>${lines}${points}</g>`;
}

function sparklePath(x, y, size) {
  const t = +(size * 0.12).toFixed(2);
  return `M${x} ${y - size}C${x + t} ${y - t} ${x + t} ${y - t} ${x + size} ${y}`
    + `C${x + t} ${y + t} ${x + t} ${y + t} ${x} ${y + size}`
    + `C${x - t} ${y + t} ${x - t} ${y + t} ${x - size} ${y}`
    + `C${x - t} ${y - t} ${x - t} ${y - t} ${x} ${y - size}Z`;
}

/* 히어로 전체에 깔리는 별가루. 두 겹으로 나눠 아주 느리게 서로 다르게 표류시킨다. */
function dustMarkup() {
  let state = 20261124;
  const random = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const far = [];
  const near = [];
  for (let i = 0; i < 132; i += 1) {
    const x = +(random() * 1200).toFixed(1);
    const y = +(random() * 240).toFixed(1);
    const close = random() > 0.62;
    const r = +(close ? 0.9 + random() * 1.1 : 0.4 + random() * 0.7).toFixed(2);
    const gold = random() < 0.12;
    const tier = gold ? 'dust is-gold' : close ? 'dust is-near' : 'dust is-far';
    const twinkle = random() < 0.2;
    const attributes = twinkle
      ? `class="${tier} is-twinkle" style="--dust-delay:${(-random() * 7).toFixed(2)}s;--dust-duration:${(3.8 + random() * 3.4).toFixed(2)}s"`
      : `class="${tier}"`;
    (close ? near : far).push(`<circle cx="${x}" cy="${y}" r="${r}" ${attributes}/>`);
  }
  return `<g class="constellation-dust is-far">${far.join('')}</g><g class="constellation-dust is-near">${near.join('')}</g>`;
}

export function constellationHero(title, done, total, unit = '명', options = {}) {
  const n = Math.max(0, Math.trunc(total));
  const complete = Math.max(0, Math.min(n, Math.trunc(done)));
  const student = unit === '개';
  const allDone = student && n > 0 && complete >= n;
  const progress = student
    ? (n ? `${Math.min(allDone ? 100 : 99, Math.round(complete / n * 100))}% 완료` : '오늘 등록된 과제가 없어요')
    : `${complete}명 완료`;
  const sky = student ? personalSky(n) : classSky(n);
  // 학생 화면에서는 내 별자리 뒤로 먼 별자리 두 무리를 흐릿하게 깔아 하늘을 채운다.
  const faint = student
    ? CLASS_SKY.slice(1).map(cluster => clusterMarkup({stars: cluster.stars.map(([x, y]) => ({x, y})), edges: cluster.edges}, 0, true)).join('')
    : '';
  const sparkles = allDone
    ? `<g class="constellation-sparkles" aria-hidden="true">${SPARKLES.map(([x, y, size], i) => `<path d="${sparklePath(x, y, size)}" style="--sparkle-delay:${(i * 0.37).toFixed(2)}s"/>`).join('')}</g>`
    : '';
  return `<section class="constellation-hero ${options.className || ''} ${allDone ? 'is-all-complete' : student && n > 0 && complete === 0 ? 'is-zero-progress' : ''}" aria-label="${C.esc(title)}" data-progress-done="${complete}" data-progress-total="${n}"><div class="hero-grain" aria-hidden="true"><span></span><span></span><span></span><span></span></div><svg class="constellation-sky" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${dustMarkup()}</svg>${options.top || ''}<div class="constellation-copy">${options.content || ''}<div class="constellation-heading"><h2>${C.esc(title)}</h2><strong class="constellation-progress ${student && !n ? 'is-empty' : ''}">${progress}</strong></div>${options.controls || ''}</div><svg class="constellation-map" viewBox="0 0 380 200" preserveAspectRatio="xMaxYMid meet" role="img" aria-label="${C.esc(progress)}">${faint}${clusterMarkup(sky, complete)}${sparkles}</svg></section>`;
}
