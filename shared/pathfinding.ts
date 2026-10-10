import { solid, WIDTH, HEIGHT } from './map';

// Clearance-aware, immutable flow fields are shared by the entire horde.
// A finer grid preserves routes around cars and building corners.
const CELL = 16, cols = WIDTH / CELL, rows = HEIGHT / CELL;
const offsets = [1, -1, cols, -cols];
const grids = new Map<number, Uint8Array>();
const cache = new Map<string, Int16Array>();

export function clearRoute(x: number, y: number, tx: number, ty: number, radius = 14) {
  const steps = Math.max(1, Math.ceil(Math.hypot(tx - x, ty - y) / 4));
  for (let i = 0; i <= steps; i++) {
    if (solid(x + (tx - x) * i / steps, y + (ty - y) * i / steps, radius)) return false;
  }
  return true;
}
function grid(radius: number) {
  let cells = grids.get(radius);
  if (!cells) {
    cells = new Uint8Array(cols * rows);
    for (let i = 0; i < cells.length; i++)
      cells[i] = solid((i % cols) * CELL + CELL / 2, Math.floor(i / cols) * CELL + CELL / 2, radius) ? 0 : 1;
    grids.set(radius, cells);
  }
  return cells;
}
function steer(x: number, y: number, tx: number, ty: number, radius: number) {
  const unit = (px: number, py: number) => {
    const length = Math.hypot(px - x, py - y);
    return length > 0.01 ? { x: (px - x) / length, y: (py - y) / length } : { x: 0, y: 0 };
  };
  if (Math.hypot(tx - x, ty - y) < 96 && clearRoute(x, y, tx, ty, radius)) return unit(tx, ty);
  const cells = grid(radius);
  const gx = Math.max(0, Math.min(cols - 1, Math.floor(tx / CELL)));
  const gy = Math.max(0, Math.min(rows - 1, Math.floor(ty / CELL)));
  let goal = gy * cols + gx;
  // Players fit closer to walls than bosses. Route to the nearest legal center.
  if (!cells[goal]) {
    let distance = Infinity;
    for (let yy = Math.max(0, gy - 5); yy <= Math.min(rows - 1, gy + 5); yy++)
      for (let xx = Math.max(0, gx - 5); xx <= Math.min(cols - 1, gx + 5); xx++) {
        const n = yy * cols + xx, d = Math.hypot(xx * CELL + 8 - tx, yy * CELL + 8 - ty);
        if (cells[n] && d < distance) { goal = n; distance = d; }
      }
  }
  const key = radius + ':' + goal;
  let field = cache.get(key);
  if (!field) {
    field = new Int16Array(cells.length); field.fill(-1);
    const queue = new Int32Array(cells.length);
    let head = 0, tail = 0;
    if (cells[goal]) { queue[tail++] = goal; field[goal] = 0; }
    while (head < tail) {
      const n = queue[head++];
      for (const offset of offsets) {
        const next = n + offset;
        if (next < 0 || next >= cells.length || !cells[next] || field[next] >= 0) continue;
        // Border cells are blocked by solid(), so horizontal edges cannot wrap.
        field[next] = field[n] + 1; queue[tail++] = next;
      }
    }
    cache.set(key, field);
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
  }
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  let best = Infinity, bx = x, by = y;
  // Choose only reachable centers: never cut through a building corner.
  // Including nearby cells also recovers actors pushed off their grid center.
  for (let yy = Math.max(0, cy - 2); yy <= Math.min(rows - 1, cy + 2); yy++)
    for (let xx = Math.max(0, cx - 2); xx <= Math.min(cols - 1, cx + 2); xx++) {
      const cost = field[yy * cols + xx];
      if (cost < 0) continue;
      const px = xx * CELL + 8, py = yy * CELL + 8;
      const score = cost * CELL + Math.hypot(px - x, py - y) * 0.5;
      if (score < best && clearRoute(x, y, px, py, radius)) { best = score; bx = px; by = py; }
    }
  return unit(bx, by);
}
export function direction(x: number, y: number, tx: number, ty: number, _now: number) {
  return steer(x, y, tx, ty, 14);
}
export function eliteDirection(x: number, y: number, tx: number, ty: number, _now: number) {
  return steer(x, y, tx, ty, 24);
}
