// Pure classroom-tool helpers. No app/database writes or browser globals required.
export function toolCandidates(students, privateNames = false) {
  return students.filter(s => !s.deletedAt).sort((a, b) => a.no - b.no).map(s => ({
    id: String(s.id),
    label: privateNames ? s.alias || `${s.no}번` : `${s.no}. ${s.name}`
  }));
}
export function parseToolList(text) {
  return String(text).split(/[,，\r\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 200).map((label, index) => ({
    id: `item-${index}`,
    label: label.slice(0, 100)
  }));
}
export function shuffledTools(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function remainingTools(items, drawn, replacement = false) {
  return replacement ? [...items] : items.filter(item => !drawn.has(item.id));
}
export function toolClockValue(clock, instant) {
  return Math.max(0, clock.elapsed + (clock.started == null ? 0 : instant - clock.started));
}
export function formatToolTime(milliseconds, hundredths = false) {
  const centis = Math.floor(Math.max(0, milliseconds) / 10),
    seconds = Math.floor(centis / 100),
    minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}${hundredths ? '.' + String(centis % 100).padStart(2, '0') : ''}`;
}
export function clampToolWindow(rect, width, height) {
  const w = Math.max(Math.min(260, width), Math.min(rect.width, Math.max(260, width))),
    h = Math.max(200, Math.min(rect.height, Math.max(200, height)));
  return {
    left: Math.max(0, Math.min(rect.left, width - 60)),
    top: Math.max(0, Math.min(rect.top, height - 44)),
    width: w,
    height: h
  };
}
// Semi-implicit integration and circle/peg contacts for the canvas drop race.
export function stepToolRace(balls, pegs, dt, width, bottom, options = {}) {
  const {
    left = 0,
    right = width,
    random = Math.random
  } = options;
  const finishers = [];
  for (const b of balls) {
    if (b.rank) continue;
    const previousY = b.y;
    b.vy += 300 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < left + b.r) {
      b.x = left + b.r;
      b.vx = Math.abs(b.vx) * .78;
    }
    if (b.x > right - b.r) {
      b.x = right - b.r;
      b.vx = -Math.abs(b.vx) * .78;
    }
    for (const p of pegs) {
      let dx = b.x - p.x,
        dy = b.y - p.y,
        radius = b.r + p.r;
      if (Math.abs(dx) >= radius || Math.abs(dy) >= radius) continue;
      let dist = Math.hypot(dx, dy);
      if (dist < radius) {
        if (dist < .01) {
          dx = .1;
          dy = -1;
          dist = Math.hypot(dx, dy);
        }
        const nx = dx / dist,
          ny = dy / dist;
        b.x = p.x + nx * (radius + .1);
        b.y = p.y + ny * (radius + .1);
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) {
          b.vx -= 1.5 * dot * nx;
          b.vy -= 1.5 * dot * ny;
          b.collisions = (b.collisions || 0) + 1;
          b.contactRows = (b.contactRows || 0) | 1 << (p.row || 0);
          b.vx += (random() - .5) * 70;
        }
        b.vx += dx >= 0 ? 9 : -9;
        if (b.x < left + 24) b.vx = Math.abs(b.vx) + 20;
        if (b.x > right - 24) b.vx = -Math.abs(b.vx) - 20;
        b.vx = Math.max(-170, Math.min(170, b.vx));
      }
    }
    if (b.y >= bottom) {
      finishers.push({
        ball: b,
        fraction: (bottom - previousY) / Math.max(.0001, b.y - previousY)
      });
      b.y = bottom;
    }
  }
  let rank = balls.filter(b => b.rank).length;
  finishers.sort((a, b) => a.fraction - b.fraction).forEach(({
    ball
  }) => ball.rank = ++rank);
  return balls.every(b => b.rank);
}
export function defaultToolRect(index, width, height) {
  if (index === 0) return {
    left: 0,
    top: 0,
    width,
    height
  };
  const w = Math.min(width, Math.max(360, width * .58)),
    h = Math.min(height, Math.max(300, height * .78));
  return {
    left: Math.min(index * 26, Math.max(0, width - w)),
    top: Math.min(index * 24, Math.max(0, height - h)),
    width: w,
    height: h
  };
}
export function makeToolPegs(width = 640) {
  const pegs = [],
    left = 40,
    right = width - 40,
    spacing = 48;
  for (let row = 0; row < 9; row++) {
    const xs = [left, right];
    for (let x = left + (row % 2 ? spacing / 2 : spacing); x < right - 12; x += spacing) xs.push(x);
    for (const x of [...new Set(xs)].sort((a, b) => a - b)) pegs.push({
      x,
      y: 86 + row * 39,
      r: 6,
      row
    });
  }
  return pegs;
}
export function createToolRaceBalls(items, pegs, random = Math.random) {
  const lanes = pegs.filter(p => p.row === 0);
  if (!lanes.length) throw Error('출발 레인에 핀이 필요합니다.');
  const left = Math.min(...lanes.map(p => p.x)),
    right = Math.max(...lanes.map(p => p.x));
  return shuffledTools(items, random).map((item, i) => {
    const lane = lanes[Math.min(lanes.length - 1, Math.floor(random() * lanes.length))];
    return {
      ...item,
      x: Math.max(left + 12, Math.min(right - 12, lane.x + (random() - .5) * 8)),
      y: 18 - i * 28,
      vx: 0,
      vy: 12 + random() * 16,
      r: 12,
      rank: 0,
      collisions: 0
    };
  });
}
export function restoreToolRect(saved, index, width, height) {
  const valid = saved && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(saved[key])) && saved.width > 0 && saved.height > 0;
  return clampToolWindow(valid ? saved : defaultToolRect(index, width, height), width, height);
}
