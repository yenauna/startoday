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
export function stepToolRace(balls, pegs, dt, width, bottom) {
  for (const b of balls) {
    if (b.rank) continue;
    b.vy += 440 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < b.r) {
      b.x = b.r;
      b.vx = Math.abs(b.vx) * .78;
    }
    if (b.x > width - b.r) {
      b.x = width - b.r;
      b.vx = -Math.abs(b.vx) * .78;
    }
    for (const p of pegs) {
      let dx = b.x - p.x,
        dy = b.y - p.y,
        dist = Math.hypot(dx, dy),
        radius = b.r + p.r;
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
          b.vx -= 1.7 * dot * nx;
          b.vy -= 1.7 * dot * ny;
        }
        b.vx += dx >= 0 ? 7 : -7;
      }
    }
    if (b.y >= bottom) {
      b.y = bottom;
      b.rank = balls.filter(x => x.rank).length + 1;
    }
  }
  return balls.every(b => b.rank);
}
