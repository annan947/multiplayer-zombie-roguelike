import type { World } from '../../../shared/types';
import { move } from '../../../shared/map';
type Point = { x: number; y: number };
// Render between authoritative snapshots instead of repeatedly easing toward stale coordinates.
export class SnapshotBuffer {
  private frames: World[] = [];
  receivedAt = 0;
  interval = 70;
  push(state: World, now = performance.now()) {
    const last = this.frames.at(-1);
    if (last && state.time < last.time) return false;
    if (last && state.elapsed < last.elapsed) this.frames = [];
    if (last && state.time > last.time)
      this.interval = this.interval * 0.8 + Math.min(350, state.time - last.time) * 0.2;
    if (last?.time === state.time) this.frames.pop();
    this.frames.push(state);
    this.frames = this.frames.slice(-12);
    this.receivedAt = now;
    return true;
  }
  point(
    kind: 'players' | 'enemies',
    id: string | number,
    fallback: Point,
    now = performance.now(),
  ): Point {
    const last = this.frames.at(-1);
    if (!last) return fallback;
    const target =
      last.time + now - this.receivedAt - Math.max(60, Math.min(180, this.interval * 1.1));
    for (let i = 1; i < this.frames.length; i++) {
      const a = this.frames[i - 1],
        b = this.frames[i];
      if (a.time <= target && target <= b.time) {
        const p = a[kind].find((e) => e.id === id),
          q = b[kind].find((e) => e.id === id);
        if (!p || !q) return fallback;
        const t = (target - a.time) / Math.max(1, b.time - a.time);
        if (Math.hypot(q.x - p.x, q.y - p.y) > 200) return { x: q.x, y: q.y };
        return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
      }
    }
    if (target < last.time) return fallback;
    const prev = this.frames.at(-2),
      p = prev?.[kind].find((e) => e.id === id),
      q = last[kind].find((e) => e.id === id);
    if (!prev || !p || !q) return fallback;
    const seconds = Math.max(0.001, (last.time - prev.time) / 1000),
      vx = (q.x - p.x) / seconds,
      vy = (q.y - p.y) / seconds;
    const scale =
      (Math.min(1, 650 / Math.max(1, Math.hypot(vx, vy))) * Math.min(100, target - last.time)) /
      1000;
    const result = { x: q.x, y: q.y };
    move(result, vx * scale, vy * scale, kind === 'enemies' ? 14 : 12);
    return result;
  }
  clear() {
    this.frames = [];
    this.receivedAt = 0;
    this.interval = 70;
  }
}
