import type { Enemy, Player, World } from './types';
import { move, solid } from './map';
import rules from './config/abilities.json';
// Returns true when an ability owns movement for this tick.
export function enemyAbility(
  s: World,
  z: Enemy,
  p: Player,
  dt: number,
  damage: (p: Player, n: number) => void,
) {
  const distance = Math.hypot(p.x - z.x, p.y - z.y);
  if (z.kind === 'tank') {
    if (!z.ability && z.cool <= 0 && distance > 85 && distance < 380) {
      z.ability = {
        phase: 'windup',
        time: rules.tank.windup,
        angle: Math.atan2(p.y - z.y, p.x - z.x),
        hit: [],
      };
      z.cool = rules.tank.cooldown;
    }
    const a = z.ability;
    if (a) {
      a.time -= dt;
      if (a.phase === 'windup' && a.time <= 0) {
        a.phase = 'dash';
        a.time = rules.tank.dash;
      } else if (a.phase === 'dash') {
        const dx = Math.cos(a.angle) * rules.tank.speed * dt,
          dy = Math.sin(a.angle) * rules.tank.speed * dt;
        const barrier = s.builds.find((b) => Math.hypot(b.x - z.x, b.y - z.y) < 48);
        if (solid(z.x + dx, z.y + dy, 20) || barrier) {
          a.time = 0;
          if (barrier) barrier.hp -= 100;
        } else move(z, dx, dy, 20);
        for (const q of s.players)
          if (q.hp > 0 && !a.hit.includes(q.id) && Math.hypot(q.x - z.x, q.y - z.y) < 45) {
            damage(q, rules.tank.damage * (1 + s.wave * 0.02));
            a.hit.push(q.id);
            move(q, Math.cos(a.angle) * 50, Math.sin(a.angle) * 50);
          }
        if (a.time <= 0) {
          a.phase = 'recover';
          a.time = rules.tank.recovery;
        }
      } else if (a.phase === 'recover' && a.time <= 0) z.ability = undefined;
      return true;
    }
  }
  if (z.kind === 'exploder') {
    if (z.fuse === undefined && (distance < 100 || z.hp < z.max * 0.35))
      z.fuse = rules.exploder.fuse;
    if (z.fuse !== undefined) {
      z.fuse -= dt;
      if (z.fuse <= 0) {
        for (const q of s.players)
          if (q.hp > 0 && Math.hypot(q.x - z.x, q.y - z.y) < rules.exploder.radius)
            damage(q, rules.exploder.damage);
        for (const b of s.builds)
          if (Math.hypot(b.x - z.x, b.y - z.y) < rules.exploder.radius) b.hp -= 100;
        s.events.push({ id: ++s.seq, kind: 'explosion', x: z.x, y: z.y, n: 0 });
        s.enemies = s.enemies.filter((e) => e.id !== z.id);
      }
      return true;
    }
  }
  if (z.kind === 'spitter' && distance < 460 && z.cool <= 0) {
    z.cool = rules.spitter.cooldown;
    if (z.id % 3 === 0 && s.wave >= 4) {
      (s.hazards ??= []).push({
        id: ++s.seq,
        x: p.x,
        y: p.y,
        r: 65,
        warmup: rules.spitter.artilleryWarning,
        ttl: rules.spitter.poolDuration,
      });
    } else {
      const a = Math.atan2(p.y - z.y, p.x - z.x),
        count = s.wave >= 4 ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const angle = a + (i - (count - 1) / 2) * 0.2;
        s.acid.push({
          id: ++s.seq,
          x: z.x,
          y: z.y,
          vx: Math.cos(angle) * rules.spitter.speed,
          vy: Math.sin(angle) * rules.spitter.speed,
          ttl: 2.3,
        });
      }
    }
    s.events.push({ id: ++s.seq, kind: 'spit', x: z.x, y: z.y, n: 0 });
  }
  return false;
}
export function tickHazards(s: World, dt: number, damage: (p: Player, n: number) => void) {
  s.hazards ??= [];
  for (const h of s.hazards) {
    if (h.warmup > 0) {
      h.warmup -= dt;
      continue;
    }
    h.ttl -= dt;
    for (const p of s.players)
      if (p.hp > 0 && Math.hypot(p.x - h.x, p.y - h.y) < h.r)
        damage(p, rules.spitter.poolDamage * dt);
  }
  s.hazards = s.hazards.filter((h) => h.ttl > 0).slice(-24);
}
